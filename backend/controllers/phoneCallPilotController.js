import fs from "fs";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import PhoneCall from "../models/phoneCallModel.js";
import {
  ensureAudioDir,
  hasAudioRecord,
  materializeAudio,
  withAudioFile,
} from "../services/pilotAudioStorage.js";
import { transcribePilotAudio } from "../services/sttService.js";
import {
  buildCatalogProjection,
  extractOrderDraft,
} from "../services/orderExtractionService.js";
import { setProcessingStatus } from "../services/phoneCallService.js";
import {
  addManualReviewLine,
  confirmReviewDraft,
  getReviewCatalog,
  openReview,
  publicReview,
  reopenReview,
  REVIEW_STATUS,
  saveReviewLines,
} from "../services/pilotDraftReviewService.js";
import { aggregatePilotAnalytics } from "../services/pilotAnalyticsService.js";

/**
 * Phone-call audio -> STT -> AI draft -> supplier review.
 *
 * This file handles the pipeline and the review screen only. It imports no Order
 * model and no Order controller, which means saving or confirming a draft here
 * can never create an order by accident.
 *
 * Creating the real Order from a confirmed draft is a separate, explicit step
 * (POST /api/v1/phone-call/drafts/:id/order), so a supplier can always review
 * first and order second.
 *
 * The recording itself arrives through the supplier upload endpoint
 * (POST /api/v1/phone-orders/recording); every route in this file is guarded by
 * isAuthenticated + isSupp.
 */

const REPROCESSABLE_STAGES = ["new", "failed"];

/*
 * Stages a run is actively sitting in. These must be released before a new run
 * can start — the only way out is a claim that sees the run as abandoned.
 */
const IN_FLIGHT_STAGES = [
  "processing_recording",
  "transcribing",
  "extracting",
];

const STALE_CLAIM_MS = Number(
  process.env.PILOT_CLAIM_TIMEOUT_MS || 10 * 60 * 1000,
);

/**
 * The one claim every pipeline run goes through: the upload endpoint, manual
 * retries and the crash-recovery sweep all gate on the same atomic filter.
 *
 * A pipeline in flight can only be claimed again after it has been silent for
 * longer than STALE_CLAIM_MS. `pipeline.recordingReadyAt` doubles as the run
 * token: it is stamped here with a fresh timestamp, and every write of a run
 * matches on it, so a run that was declared stale and replaced can never
 * scribble over its replacement.
 */
const claimProcessing = async ({ match = {}, set = {} } = {}) => {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

  return PhoneCallPilot.findOneAndUpdate(
    {
      ...match,
      $or: [
        { "pipeline.stage": { $in: REPROCESSABLE_STAGES } },
        {
          "pipeline.stage": { $in: IN_FLIGHT_STAGES },
          "pipeline.recordingReadyAt": {
            $lte: staleBefore,
          },
        },
      ],
    },
    {
      $set: {
        "pipeline.stage": "processing_recording",
        "pipeline.recordingReadyAt": new Date(),
        "pipeline.error": null,
        ...set,
      },
    },
    { new: true },
  );
};

const findOwnedPilotCall = async (id, supplierId, select = null) => {
  let query = PhoneCallPilot.findById(id);
  if (select) query = query.select(select);
  const doc = await query;
  if (!doc) return null;

  if (String(doc.supplierId || "") === String(supplierId || "")) return doc;
  if (doc.phoneCallId) {
    const call = await PhoneCall.findOne({
      _id: doc.phoneCallId,
      supplierId,
    }).select("_id");
    if (call) return doc;
  }
  return null;
};

const recordPipelineError = async (pilotId, error, runToken = null) => {
  const filter = { _id: pilotId };
  if (runToken) filter["pipeline.recordingReadyAt"] = runToken;

  const result = await PhoneCallPilot.updateOne(
    filter,
    {
      $set: {
        "pipeline.stage": "failed",
        "pipeline.error": {
          message: error?.message || "Unknown pilot pipeline error.",
          code: error?.code || null,
          at: new Date(),
        },
      },
    },
  );

  // A newer run owns the document; the failing run may not flip it to failed.
  if (result.matchedCount === 0) return;

  await PhoneCall.updateOne(
    { pilotCallId: pilotId },
    {
      $set: {
        processingStatus: "failed",
        lastError: {
          message: error?.message || "Unknown pilot pipeline error.",
          code: error?.code || null,
          at: new Date(),
        },
      },
    },
  );
};

/**
 * Runs STT -> extraction over a recording the supplier already uploaded.
 *
 * Fire-and-forget from the upload endpoint, so the HTTP response returns at once
 * and the long job never blocks it.
 */
const runPilotPipeline = async (pilotId) => {
  let doc;
  try {
    doc = await PhoneCallPilot.findById(pilotId);
    if (!doc) return;

    await ensureAudioDir();

    // The claim stamped by whichever path started this run. Every write below
    // carries it, so once a run has been declared stale and replaced, the old
    // run's writes simply match nothing and it stops — see the `write` guard.
    const runToken = doc.pipeline?.recordingReadyAt || null;

    const write = async (set) => {
      const filter = { _id: pilotId };
      if (runToken) filter["pipeline.recordingReadyAt"] = runToken;
      const result = await PhoneCallPilot.updateOne(filter, { $set: set });
      if (result.matchedCount === 0) {
        if (runToken) {
          console.warn("Pilot pipeline superseded, stopping:", pilotId);
        }
        return false;
      }
      return true;
    };

    // The stored recording, whichever backend holds it. Kept as a record rather
    // than a file name so a durable recording is re-read the same way a local
    // one is, and so a retry after a redeploy finds the audio again.
    const audio = doc.audio || null;

    if (!hasAudioRecord(audio)) {
      const missing = new Error(
        "This call has no stored audio, so there is nothing to transcribe.",
      );
      missing.code = "NO_AUDIO_AVAILABLE";
      throw missing;
    }

    if (!(await write({ "pipeline.stage": "transcribing" }))) {
      return;
    }

    // A local recording is transcribed where it lies; a durable one is fetched
    // into a working copy for the length of the call and removed afterwards.
    // Nothing here deletes the stored recording, so a failure leaves the audio
    // in place and the supplier can retry against the very same bytes.
    const transcript = await withAudioFile(audio, ({ filePath, fileName }) =>
      transcribePilotAudio({
        filePath,
        fileName,
        contentType: audio.contentType,
      }),
    );

    if (
      !(await write({
        "stt.status": "completed",
        "stt.engine": transcript.engine,
        "stt.transport": transcript.transport,
        "stt.model": transcript.model,
        "stt.jobId": transcript.jobId,
        "stt.transcript": transcript.transcript,
        "stt.languageCode": transcript.languageCode,
        "stt.timestamps": transcript.timestamps,
        "stt.speakers": transcript.speakers,
        "stt.speakerAttributionAvailable":
          transcript.speakerAttributionAvailable,
        "stt.channelsMerged": transcript.channelsMerged,
        "stt.audioInput": transcript.audioInput ?? null,
        "stt.error": null,
        "pipeline.stage": "extracting",
      }))
    ) {
      return;
    }

    const catalog = await buildCatalogProjection();
    const extraction = await extractOrderDraft({
      transcript: transcript.transcript,
      catalog,
    });

    if (
      !(await write({
        "extraction.status": "completed",
        "extraction.model": extraction.model,
        "extraction.draft": extraction.draft,
        "extraction.validationErrors": extraction.validationErrors,
        "extraction.needsReview": extraction.needsReview,
        "extraction.error": null,
        "pipeline.stage": "completed",
        "pipeline.completedAt": new Date(),
        "pipeline.error": null,
      }))
    ) {
      return;
    }

    await PhoneCall.updateOne(
      { pilotCallId: pilotId },
      {
        $set: {
          processingStatus: extraction.draft?.isOrderIntent
            ? "needs_review"
            : "draft_ready",
          lastError: { message: null, code: null, at: null },
        },
      },
    );
  } catch (error) {
    console.error("Pilot pipeline failed:", pilotId, error?.message);
    await recordPipelineError(
      pilotId,
      error,
      doc?.pipeline?.recordingReadyAt || null,
    );
  }
};

/**
 * Kicks the STT -> draft pipeline off without blocking the HTTP response.
 *
 * Exported so the supplier upload route starts this exact runner when a
 * recording arrives, instead of growing a second copy of the pipeline.
 */
export const startPipelineInBackground = (pilotId) => {
  setImmediate(() => {
    runPilotPipeline(pilotId).catch((error) =>
      console.error("Pilot pipeline crashed:", pilotId, error?.message),
    );
  });
};

const RECOVERY_INTERVAL_MS = Number(
  process.env.PILOT_RECOVERY_INTERVAL_MS || 5 * 60 * 1000,
);

/**
 * Crash recovery for the STT -> draft pipeline.
 *
 * A run that dies mid-flight leaves its stage parked in an in-flight value with
 * a stale run token. Nothing else in the system would ever move it — so this
 * sweep reclaims exactly those runs through the same atomic claim every
 * other start uses, and relaunches the run under a fresh token.
 *
 * Never throws on its own: a flaky database visit is logged and the next sweep
 * tries again.
 */
export const startPilotPipelineRecovery = () => {
  const run = async () => {
    try {
      const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);
      const stuck = await PhoneCallPilot.find({
        "pipeline.stage": { $in: IN_FLIGHT_STAGES },
        "pipeline.recordingReadyAt": { $lte: staleBefore },
      })
        .select("_id")
        .limit(25);

      for (const doc of stuck) {
        const claimed = await claimProcessing({ match: { _id: doc._id } });
        if (claimed) {
          console.warn(
            "Recovered a stale pilot pipeline:",
            claimed._id,
            "from stage:",
            doc.pipeline?.stage,
          );
          startPipelineInBackground(claimed._id);
        }
      }
    } catch (error) {
      console.error("Pilot pipeline recovery sweep failed:", error?.message);
    }
  };

  void run();
  const timer = setInterval(run, RECOVERY_INTERVAL_MS);
  timer.unref?.();
  return timer;
};

/* ----------------------------- supplier pilot UI ---------------------------- */

const toPublicCall = (doc) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;

  return {
    _id: plain._id,
    source: plain.source,
    phoneCallId: plain.phoneCallId || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    caller: plain.caller || null,
    customer: plain.customer || null,
    audio: {
      // Presence is decided by the stored record, not by a local file name, so
      // a durable recording is reported and played exactly like a local one.
      // No storage identifier is ever included: the authenticated endpoint is
      // the only way to reach the audio.
      available: hasAudioRecord(plain.audio),
      bytes: plain.audio?.bytes ?? null,
      contentType: plain.audio?.contentType || null,
      storedAt: plain.audio?.storedAt || null,
      endpoint: hasAudioRecord(plain.audio)
        ? `/api/v1/pilot/phone-call/${plain._id}/audio`
        : null,
    },
    stt: plain.stt || null,
    extraction: plain.extraction || null,
    pipeline: plain.pipeline || null,
    review: {
      status: plain.review?.status || REVIEW_STATUS.NOT_STARTED,
      lineCount: plain.review?.lines?.length || 0,
      blocking: plain.review?.report?.blockers?.length || 0,
      confirmedAt: plain.review?.confirmed?.at || null,
      confirmedItemCount: plain.review?.confirmed?.itemCount || 0,
      // Pilot guarantee, surfaced so the screen can state it plainly.
      orderCreated: plain.review?.confirmed?.orderCreated === true,
    },
  };
};

export const listPilotCalls = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const calls = await PhoneCallPilot.find({ supplierId: req.userId })
      .sort({ createdAt: -1 })
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: calls.length,
      calls: calls.map(toPublicCall),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPilotCall = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(req.params.id, req.userId);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "यह कॉल नहीं मिली।" });
    }
    return res.status(200).json({ success: true, call: toPublicCall(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Runs the STT -> draft pipeline again for a call whose processing failed.
 *
 * The supplier never has to re-upload: the recording is deliberately preserved
 * after a failure, so a retry is just this call. It re-arms the same claim the
 * upload endpoint uses and hands off to the same runner, so there is exactly
 * one pipeline in the codebase.
 *
 * Refuses anything that already produced a real Order, and anything that did
 * not fail, so a retry can never silently discard a good draft or duplicate an
 * order.
 */
export const retryPilotProcessing = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(
      req.params.id,
      req.userId,
      "audio.fileName audio.publicId audio.storage audio.format audio.bytes " +
        "audio.contentType audio.sha256 pipeline.stage phoneCallId " +
        "review.confirmed",
    );
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "यह कॉल नहीं मिली।" });
    }

    if (doc.review?.confirmed?.orderCreated === true) {
      return res.status(409).json({
        success: false,
        code: "ORDER_ALREADY_CREATED",
        message: "इस कॉल का ऑर्डर पहले ही बन चुका है।",
      });
    }

    // A retry with no audio can never succeed, and the re-upload path is
    // separately refused while a recording is attached, so say which one it is.
    // Checked against the stored record, so a durable recording counts just as
    // much as a local file, including on a server that has never seen it.
    if (!hasAudioRecord(doc.audio)) {
      return res.status(409).json({
        success: false,
        code: "NO_RECORDING",
        message: "इस कॉल में रिकॉर्डिंग नहीं है। पहले रिकॉर्डिंग जोड़ें।",
      });
    }

    // Atomic claim, same as the upload path: a double tap can only start
    // one run, and a run in flight is never stolen from — except once it has
    // been silent long enough to count as crashed, in which case this is the
    // manual way back.
    const claimed = await claimProcessing({ match: { _id: doc._id } });

    if (!claimed) {
      return res.status(409).json({
        success: false,
        code: "ALREADY_PROCESSING",
        message: "यह कॉल अभी प्रोसेस हो रही है। थोड़ी देर बाद देखें।",
      });
    }

    if (doc.phoneCallId) {
      await setProcessingStatus({
        callId: doc.phoneCallId,
        processingStatus: "processing",
        error: null,
      });
    }

    // Acknowledge first, then do the slow work.
    res.status(202).json({
      success: true,
      pilotCallId: claimed._id,
      message: "प्रोसेसिंग फिर से शुरू हो गई।",
    });
    startPipelineInBackground(claimed._id);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Streams stored audio. The only way to hear a pilot recording: authenticated,
 * no public URL, no-store caching.
 */
export const streamPilotAudio = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(
      req.params.id,
      req.userId,
      "audio supplierId phoneCallId source",
    );

    if (!hasAudioRecord(doc?.audio)) {
      return res
        .status(404)
        .json({ success: false, message: "इस कॉल की रिकॉर्डिंग नहीं है।" });
    }

    const contentType = doc.audio.contentType || "application/octet-stream";

    // A durable recording is fetched into a working copy and streamed from
    // there, so the browser keeps getting the same authenticated, no-store
    // response no matter which backend holds the audio.
    const handle = await materializeAudio(doc.audio);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", fs.statSync(handle.filePath).size);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");

    const stream = fs.createReadStream(handle.filePath);
    if (handle.temporary) {
      // The working copy is only needed while the response is being written.
      res.on("close", () => void handle.cleanup());
    }

    return stream.pipe(res);
  } catch (error) {
    if (
      error?.code === "AUDIO_FILE_MISSING" ||
      error?.code === "AUDIO_CLOUD_MISSING"
    ) {
      return res.status(410).json({
        success: false,
        message: "रिकॉर्डिंग अब उपलब्ध नहीं है।",
      });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ------------------------- supplier review & confirm ------------------------ */

/**
 * Pilot accuracy analytics, for suppliers only.
 *
 * Reads review.confirmed snapshots and nothing else: no transcript, no customer
 * record, no order, no cart, no pricing. Callers are masked before they leave
 * here, because an aggregate report has no reason to hand out phone numbers.
 *
 * Aggregation itself lives in pilotAnalyticsService so it stays pure and
 * testable; this handler only does the query and the projection.
 */
export const getPilotAnalytics = async (_req, res) => {
  try {
    const supplierId = _req.user?._id || _req.user?.id || null;

    // Explicit projection. lean() plus select() keeps transcripts and raw
    // payloads out of memory on a table that grows by the minute.
    const records = await PhoneCallPilot.find({ supplierId: _req.userId })
      .select(
        "caller source pipeline.stage extraction.status extraction.draft.isOrderIntent " +
          "review.status review.report.blockers review.confirmed",
      )
      .lean();

    const report = aggregatePilotAnalytics(records);

    return res.status(200).json({
      success: true,
      // Echoed purely so the client can confirm it is looking at its own
      // pilot data. Never used for filtering.
      supplierId: supplierId ? String(supplierId) : null,
      ...report,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Read-only catalog for the review pickers.
 *
 * Reuses the extractor's projection: product, brand and variant only. No price,
 * no stock, no cart, no order. One request per screen open, after which the
 * client works against it locally.
 */
export const getPilotReviewCatalog = async (_req, res) => {
  try {
    const catalog = await getReviewCatalog();
    return res.status(200).json({
      success: true,
      count: catalog.length,
      products: catalog.map((product) => ({
        productId: product.productId,
        name: product.name,
        hinglishName: product.hinglishName,
        aliases: product.aliases,
        variants: product.variants.map((variant) => ({
          companyId: variant.companyId,
          company: variant.company,
          measurement: variant.measurement,
        })),
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Returns the supplier's working copy, seeding it from the AI draft the first
 * time it is opened so the screen never has to build lines itself.
 */
export const getPilotReview = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(req.params.id, req.userId);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "यह कॉल नहीं मिली।" });
    }

    if (doc.extraction?.status !== "completed" || !doc.extraction?.draft) {
      return res.status(409).json({
        success: false,
        message: "इस कॉल का ऑर्डर ड्राफ्ट अभी तैयार नहीं है।",
        review: publicReview(doc),
      });
    }

    if (
      doc.review?.status === REVIEW_STATUS.NOT_STARTED ||
      !doc.review?.lines?.length
    ) {
      openReview({ doc, catalog: await getReviewCatalog() });
      await doc.save();
    }

    return res.status(200).json({
      success: true,
      review: publicReview(doc),
      customerNote: doc.extraction?.draft?.customerNote || "",
      clarificationQuestion: doc.extraction?.draft?.clarificationQuestion || "",
      needsClarification: doc.extraction?.draft?.needsClarification === true,
      validationErrors: doc.extraction?.validationErrors || [],
      isOrderIntent: doc.extraction?.draft?.isOrderIntent === true,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const loadReviewableCall = async (id, supplierId) => {
  const doc = await findOwnedPilotCall(id, supplierId);
  if (!doc) return { status: 404, message: "यह कॉल नहीं मिली।" };
  if (doc.extraction?.status !== "completed" || !doc.extraction?.draft) {
    return { status: 409, message: "इस कॉल का ऑर्डर ड्राफ्ट अभी तैयार नहीं है।" };
  }
  if (doc.review?.status === REVIEW_STATUS.CONFIRMED) {
    return { status: 409, message: "यह ड्राफ्ट पहले ही कन्फर्म हो चुका है।" };
  }
  return { doc };
};

/**
 * One autosave endpoint for the whole review screen: edits, manual adds,
 * removals, restores and explicit resolutions all arrive as one line list.
 *
 * The rules live in pilotDraftReviewService, which re-grades every line against
 * the live catalog, so a hand-crafted request cannot mark a broken line clean.
 */
export const savePilotReview = async (req, res) => {
  try {
    const loaded = await loadReviewableCall(req.params.id, req.userId);
    if (loaded.message) {
      return res
        .status(loaded.status)
        .json({ success: false, message: loaded.message });
    }

    if (!Array.isArray(req.body?.lines)) {
      return res.status(400).json({
        success: false,
        message: "पूरी जाँच { lines: [...] } के रूप में भेजें।",
      });
    }

    const { doc } = loaded;
    saveReviewLines({
      doc,
      incomingLines: req.body.lines,
      catalog: await getReviewCatalog(),
    });
    await doc.save();

    return res.status(200).json({
      success: true,
      savedAt: doc.review.updatedAt,
      review: publicReview(doc),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Adds a missing item the AI missed. It goes through the same validation as
 * every other line, so an unresolvable manual add cannot be confirmed either.
 */
export const addPilotReviewItem = async (req, res) => {
  try {
    const loaded = await loadReviewableCall(req.params.id, req.userId);
    if (loaded.message) {
      return res
        .status(loaded.status)
        .json({ success: false, message: loaded.message });
    }

    const { doc } = loaded;
    addManualReviewLine({
      doc,
      input: req.body || {},
      userId: req.userId || null,
      catalog: await getReviewCatalog(),
    });
    await doc.save();

    return res.status(201).json({ success: true, review: publicReview(doc) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * The final pilot action.
 *
 * Refused while any line is unresolved, ambiguous, uncertain or invalid, unless
 * the supplier explicitly resolved that line during review. On success the
 * result is written to PhoneCallPilot.review.confirmed and nowhere else.
 *
 * With `createOrder: true` the same tap also asks the bridge for a real Order,
 * so the supplier reviews and orders in one action. That is opt-in per request:
 * omitted or false, no Order is created, imported or referenced. Either way the
 * Order is only ever written by the bridge, so revalidation and the duplicate
 * guard behave identically to the separate step.
 */
export const confirmPilotDraft = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(req.params.id, req.userId);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "यह कॉल नहीं मिली।" });
    }
    if (doc.extraction?.status !== "completed" || !doc.extraction?.draft) {
      return res.status(409).json({
        success: false,
        message: "इस कॉल का ऑर्डर ड्राफ्ट नहीं बना है।",
      });
    }
    const wantsOrder = req.body?.createOrder === true;
    const alreadyConfirmed = doc.review?.status === REVIEW_STATUS.CONFIRMED;

    // A draft that is already confirmed only short-circuits when the supplier
    // is not also asking for the order. Asking again is exactly how a retry
    // after a failed order creation reaches the bridge, and the bridge answers
    // "already created" when the order is in fact there.
    if (alreadyConfirmed && !wantsOrder) {
      return res.status(200).json({
        success: true,
        alreadyConfirmed: true,
        review: publicReview(doc),
        message: "यह ड्राफ्ट पहले ही कन्फर्म है।",
      });
    }

    let outcome = null;

    if (!alreadyConfirmed) {
      outcome = confirmReviewDraft({
        doc,
        catalog: await getReviewCatalog(),
        userId: req.userId || null,
      });

      if (!outcome.ok) {
        return res.status(outcome.status).json({
          success: false,
          code: outcome.code,
          message: outcome.message,
          review: {
            status: doc.review?.status || REVIEW_STATUS.NOT_STARTED,
            lines: outcome.report.lines,
            report: {
              counts: outcome.report.counts,
              blockers: outcome.report.blockers,
              confirmable: false,
            },
            confirmed: null,
          },
        });
      }

      await doc.save();
    }

    /*
     * One-tap flow: the supplier asks for the order in the same action that
     * confirms the draft. It still goes through the bridge, so revalidation and
     * the duplicate guard apply exactly as they do for the separate step.
     */
    if (wantsOrder) {
      const { createOrderFromConfirmedPhoneCall } =
        await import("../services/phoneOrderBridgeService.js");

      const orderResult = await createOrderFromConfirmedPhoneCall({
        pilotCallId: String(doc._id),
        userId: req.userId || null,
        customerUserId: req.body?.customerUserId || null,
      });

      if (!orderResult.ok) {
        // The draft is confirmed and safe, so the call is "confirmed", not
        // "failed": nothing failed to process, the order step was refused.
        // That also keeps the call in the supplier's "ऑर्डर के लिए" list, which
        // is the only place a retry can be started from.
        if (doc.phoneCallId) {
          await setProcessingStatus({
            callId: doc.phoneCallId,
            processingStatus: REVIEW_STATUS.CONFIRMED,
            error: { message: orderResult.message, code: orderResult.code },
          });
        }

        return res.status(orderResult.status || 400).json({
          success: false,
          code: orderResult.code,
          message: orderResult.message,
          blockers: orderResult.blockers || [],
          // The draft is confirmed and safe. The supplier sees exactly why the
          // order did not happen instead of losing their work.
          review: publicReview(doc),
        });
      }

      // The bridge stamps orderCreated/orderId with its own update, so the
      // `doc` this handler is holding is stale by one write. Re-read before
      // replying, or the supplier is told the order exists while the review
      // payload still claims it does not.
      const settled = await PhoneCallPilot.findById(doc._id);

      // Link the Order onto the call itself, not just the pilot record. Without
      // this the call never leaves "needs review" and the supplier is never
      // shown that the order exists.
      if (doc.phoneCallId) {
        await setProcessingStatus({
          callId: doc.phoneCallId,
          orderId: orderResult.orderId,
        });
      }

      return res.status(200).json({
        success: true,
        review: publicReview(settled || doc),
        order: orderResult.order,
        orderId: orderResult.orderId,
        alreadyCreated: orderResult.alreadyCreated === true,
        merged: orderResult.merged === true,
        message: orderResult.message,
      });
    }

    return res.status(200).json({
      success: true,
      review: publicReview(doc),
      message: outcome.message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Lets a distributor reopen a draft they confirmed by mistake.
 *
 * This only clears the confirmed snapshot. It never creates an order, and it
 * never deletes one that was already created from this draft.
 */
export const reopenPilotDraft = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(req.params.id, req.userId);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "यह कॉल नहीं मिली।" });
    }
    if (doc.review?.status !== REVIEW_STATUS.CONFIRMED) {
      return res
        .status(409)
        .json({ success: false, message: "यह ड्राफ्ट कन्फर्म नहीं हुआ है।" });
    }

    const review = reopenReview({ doc });
    await doc.save();

    return res.status(200).json({ success: true, review });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
