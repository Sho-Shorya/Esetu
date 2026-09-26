import fs from "fs";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import PhoneCall from "../models/phoneCallModel.js";
import { User } from "../models/userModel.js";
import { getTelephonyProvider } from "../services/telephony/telephonyProvider.js";
import {
  ensureAudioDir,
  getMaxAudioBytes,
  removeAudio,
  resolveAudioPath,
  saveAudioBuffer,
} from "../services/pilotAudioStorage.js";
import { transcribePilotAudio } from "../services/sttService.js";
import {
  buildCatalogProjection,
  extractOrderDraft,
} from "../services/orderExtractionService.js";
import { normalizeIndianPhone } from "../services/pilotPhoneNormalizer.js";
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
 * Webhooks are authenticated by provider signature, not by JWT, because a
 * telephony provider cannot send our supplier token. The supplier UI routes use
 * isAuthenticated + isSupp.
 */

export const PILOT_ROUTE_PATHS = {
  answer: "/api/v1/pilot/phone-call/answer",
  status: "/api/v1/pilot/phone-call/status",
  recordingReady: "/api/v1/pilot/phone-call/recording-ready",
};

const REPROCESSABLE_STAGES = [
  "new",
  "call_answered",
  "call_ended",
  "recording_ready",
  "failed",
];

const STALE_CLAIM_MS = Number(
  process.env.PILOT_CLAIM_TIMEOUT_MS || 10 * 60 * 1000,
);

const isTestAudioEnabled = () =>
  String(process.env.PILOT_TEST_AUDIO_ENABLED || "").toLowerCase() === "true" &&
  process.env.NODE_ENV !== "production";

const findOwnedPilotCall = async (id, supplierId, select = null) => {
  let query = PhoneCallPilot.findById(id);
  if (select) query = query.select(select);
  const doc = await query;
  if (!doc) return null;

  if (String(doc.supplierId || "") === String(supplierId || "")) return doc;
  if (
    doc.source === "test" &&
    String(doc.testUpload?.uploadedBy || "") === String(supplierId || "")
  ) {
    return doc;
  }
  if (doc.phoneCallId) {
    const call = await PhoneCall.findOne({
      _id: doc.phoneCallId,
      supplierId,
    }).select("_id");
    if (call) return doc;
  }
  return null;
};

const xmlError = (message) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Speak>${message}</Speak></Response>`;

const rejectInvalidSignature = (res, result) =>
  res.status(403).json({
    success: false,
    message: `Rejected unsigned or invalid provider callback (${result.reason}).`,
  });

/** Exact 10-digit lookup only. Never fuzzy, never writes to User. */
const matchCustomer = async (rawFrom) => {
  const caller = normalizeIndianPhone(rawFrom);

  if (!caller.normalized) {
    return {
      caller,
      customer: { matched: false, userId: null, method: "unavailable" },
    };
  }

  const user = await User.findOne({ phoneNumber: Number(caller.normalized) })
    .select("_id")
    .lean();

  return {
    caller,
    customer: {
      matched: Boolean(user),
      userId: user?._id || null,
      method: "exact-10-digit",
    },
  };
};

const recordPipelineError = async (pilotId, error) => {
  await PhoneCallPilot.updateOne(
    { _id: pilotId },
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
 * Runs download -> STT -> extraction. Fire-and-forget from the webhook so Plivo
 * always gets a fast 200 and never retries a long job.
 *
 * A test upload already has its audio on disk, so the provider download is
 * skipped. Only a live call needs the recording pulled down first.
 */
const runPilotPipeline = async (pilotId) => {
  let doc;
  try {
    doc = await PhoneCallPilot.findById(pilotId);
    if (!doc) return;

    const provider = getTelephonyProvider();
    await ensureAudioDir();

    let fileName = doc.audio?.fileName || null;
    let contentType = doc.audio?.contentType || null;

    if (fileName) {
      await PhoneCallPilot.updateOne(
        { _id: pilotId },
        { $set: { "pipeline.stage": "transcribing" } },
      );
    } else {
      if (!doc.provider?.recordingUrl) {
        const missing = new Error(
          "This call has no provider recording URL and no stored audio, so there is nothing to transcribe.",
        );
        missing.code = "NO_AUDIO_AVAILABLE";
        throw missing;
      }

      await PhoneCallPilot.updateOne(
        { _id: pilotId },
        { $set: { "pipeline.stage": "downloading_recording" } },
      );

      const { buffer, contentType: downloadedType } =
        await provider.downloadRecording(doc.provider.recordingUrl);

      const saved = await saveAudioBuffer({
        buffer,
        contentType: downloadedType,
        originalName: doc.provider.recordingId,
        prefix: doc.provider.callId || "call",
      });

      fileName = saved.fileName;
      contentType = saved.contentType;

      await PhoneCallPilot.updateOne(
        { _id: pilotId },
        {
          $set: {
            "audio.fileName": saved.fileName,
            "audio.contentType": saved.contentType,
            "audio.bytes": saved.bytes,
            "audio.originalName": saved.originalName,
            "audio.source": doc.source,
            "audio.storedAt": new Date(),
            "pipeline.stage": "transcribing",
          },
        },
      );
    }

    const transcript = await transcribePilotAudio({
      filePath: resolveAudioPath(fileName),
      fileName,
      contentType,
    });

    await PhoneCallPilot.updateOne(
      { _id: pilotId },
      {
        $set: {
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
        },
      },
    );

    const catalog = await buildCatalogProjection();
    const extraction = await extractOrderDraft({
      transcript: transcript.transcript,
      catalog,
    });

    await PhoneCallPilot.updateOne(
      { _id: pilotId },
      {
        $set: {
          "extraction.status": "completed",
          "extraction.model": extraction.model,
          "extraction.draft": extraction.draft,
          "extraction.validationErrors": extraction.validationErrors,
          "extraction.needsReview": extraction.needsReview,
          "extraction.error": null,
          "pipeline.stage": "completed",
          "pipeline.completedAt": new Date(),
          "pipeline.error": null,
        },
      },
    );

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
    await recordPipelineError(pilotId, error);
  }
};

/**
 * Kicks the STT -> draft pipeline off without blocking the HTTP response.
 *
 * Exported so the calling feature reuses this exact runner when a call
 * recording is attached, instead of growing a second copy of the pipeline.
 */
export const startPipelineInBackground = (pilotId) => {
  setImmediate(() => {
    runPilotPipeline(pilotId).catch((error) =>
      console.error("Pilot pipeline crashed:", pilotId, error?.message),
    );
  });
};

/* ----------------------------- provider webhooks ---------------------------- */

export const handleAnswerWebhook = async (req, res) => {
  let provider;
  try {
    provider = getTelephonyProvider();
  } catch (error) {
    return res
      .status(503)
      .type("text/xml")
      .send(xmlError("Pilot provider unavailable."));
  }

  const signature = provider.verifyWebhookSignature(
    req,
    PILOT_ROUTE_PATHS.answer,
  );
  if (!signature.valid) return rejectInvalidSignature(res, signature);

  const callId = provider.getCallId(req);
  const from = provider.getFromNumber(req);
  const to = provider.getToNumber(req);

  if (!callId) {
    return res
      .status(400)
      .type("text/xml")
      .send(xmlError("Missing call identifier."));
  }

  const { caller, customer } = await matchCustomer(from);

  await PhoneCallPilot.findOneAndUpdate(
    { "provider.callId": callId },
    {
      $setOnInsert: {
        source: "live",
        "provider.name": provider.PROVIDER_NAME,
        "provider.callId": callId,
        "provider.from": from,
        "provider.to": to,
        "provider.direction": provider.getDirection(req),
        "provider.callStatus": provider.getCallStatus(req) || "in-progress",
        caller,
        customer,
        "pipeline.stage": "call_answered",
        "pipeline.startedAt": new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return res.status(200).type("text/xml").send(provider.buildAnswerXml());
};

export const handleStatusWebhook = async (req, res) => {
  let provider;
  try {
    provider = getTelephonyProvider();
  } catch {
    return res
      .status(503)
      .json({ success: false, message: "Pilot provider unavailable." });
  }

  const signature = provider.verifyWebhookSignature(
    req,
    PILOT_ROUTE_PATHS.status,
  );
  if (!signature.valid) return rejectInvalidSignature(res, signature);

  const callId = provider.getCallId(req);
  if (!callId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing call identifier." });
  }

  const updates = {};
  const callStatus = provider.getCallStatus(req);
  const duration = provider.getDurationSeconds(req);
  const direction = provider.getDirection(req);

  if (callStatus) updates["provider.callStatus"] = callStatus;
  if (direction) updates["provider.direction"] = direction;
  // Plivo sends -1 or omits duration until the call is truly finished.
  if (duration !== null) updates["provider.durationSeconds"] = duration;

  if (callStatus) {
    const stage = [
      "completed",
      "failed",
      "busy",
      "no-answer",
      "canceled",
    ].includes(callStatus)
      ? "call_ended"
      : "call_answered";
    updates["pipeline.stage"] = stage;
  }

  if (Object.keys(updates).length) {
    await PhoneCallPilot.updateOne(
      { "provider.callId": callId },
      { $set: updates },
    );
  }

  return res.status(200).json({ success: true });
};

export const handleRecordingWebhook = async (req, res) => {
  let provider;
  try {
    provider = getTelephonyProvider();
  } catch {
    return res
      .status(503)
      .json({ success: false, message: "Pilot provider unavailable." });
  }

  const signature = provider.verifyWebhookSignature(
    req,
    PILOT_ROUTE_PATHS.recordingReady,
  );
  if (!signature.valid) return rejectInvalidSignature(res, signature);

  const callId = provider.getCallId(req);
  if (!callId) {
    return res
      .status(400)
      .json({ success: false, message: "Missing call identifier." });
  }

  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS);

  // Atomic claim so duplicate Plivo callbacks cannot start two pipelines.
  const doc = await PhoneCallPilot.findOneAndUpdate(
    {
      "provider.callId": callId,
      $or: [
        { "pipeline.stage": { $in: REPROCESSABLE_STAGES } },
        {
          "pipeline.stage": "processing_recording",
          "pipeline.recordingReadyAt": { $lt: staleBefore },
        },
      ],
    },
    {
      $set: {
        "provider.name": provider.PROVIDER_NAME,
        "provider.recordingId": provider.getRecordingId(req),
        "provider.recordingUrl": provider.getRecordingUrl(req),
        "provider.callStatus": provider.getCallStatus(req) || "completed",
        "pipeline.stage": "processing_recording",
        "pipeline.recordingReadyAt": new Date(),
      },
    },
    { new: true },
  );

  if (!doc) {
    return res.status(200).json({
      success: true,
      message: "Recording already queued or processed.",
    });
  }

  // Acknowledge first, then do the slow work.
  res.status(200).json({ success: true, pilotCallId: doc._id });
  startPipelineInBackground(doc._id);
};

/* ----------------------------- supplier pilot UI ---------------------------- */

const toPublicCall = (doc) => {
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;

  return {
    _id: plain._id,
    source: plain.source,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    provider: {
      name: plain.provider?.name || null,
      callId: plain.provider?.callId || null,
      recordingId: plain.provider?.recordingId || null,
      from: plain.provider?.from || null,
      to: plain.provider?.to || null,
      direction: plain.provider?.direction || null,
      callStatus: plain.provider?.callStatus || null,
      durationSeconds: plain.provider?.durationSeconds ?? null,
      // The provider-hosted URL is intentionally never returned.
    },
    caller: plain.caller || null,
    customer: plain.customer || null,
    audio: {
      available: Boolean(plain.audio?.fileName),
      bytes: plain.audio?.bytes ?? null,
      contentType: plain.audio?.contentType || null,
      storedAt: plain.audio?.storedAt || null,
      endpoint: plain.audio?.fileName
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
    testUpload: plain.testUpload || null,
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
        .json({ success: false, message: "Pilot call not found." });
    }
    return res.status(200).json({ success: true, call: toPublicCall(doc) });
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
      "audio supplierId phoneCallId source testUpload.uploadedBy",
    );
    const fileName = doc?.audio?.fileName;

    if (!fileName) {
      return res
        .status(404)
        .json({ success: false, message: "No audio stored for this call." });
    }

    const filePath = resolveAudioPath(fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(410).json({
        success: false,
        message: "Stored audio is no longer available on this server.",
      });
    }

    const stats = fs.statSync(filePath);
    const contentType = doc.audio.contentType || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", stats.size);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "private, no-store");

    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPilotCapability = async (_req, res) =>
  res.status(200).json({
    success: true,
    testAudioEnabled: isTestAudioEnabled(),
    maxAudioBytes: getMaxAudioBytes(),
  });

/**
 * Development-only path for exercising the pipeline with a real recording.
 * Requires an actual audio file; it never synthesises a transcript.
 */
export const uploadTestAudio = async (req, res) => {
  if (!isTestAudioEnabled()) {
    return res.status(403).json({
      success: false,
      message:
        "Test audio is disabled. Set PILOT_TEST_AUDIO_ENABLED=true outside production.",
    });
  }

  if (!req.file || !req.file.buffer?.length) {
    return res.status(400).json({
      success: false,
      message: "Attach an audio file in the `audio` field.",
    });
  }

  let saved = null;
  try {
    saved = await saveAudioBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
      prefix: "test",
    });

    const doc = await PhoneCallPilot.create({
      source: "test",
      supplierId: req.userId,
      provider: { name: "test" },
      audio: {
        fileName: saved.fileName,
        contentType: saved.contentType,
        bytes: saved.bytes,
        originalName: saved.originalName,
        source: "test",
        storedAt: new Date(),
      },
      testUpload: {
        uploadedBy: req.userId || null,
        originalName: saved.originalName,
      },
      pipeline: { stage: "transcribing", startedAt: new Date() },
    });

    res.status(202).json({
      success: true,
      pilotCallId: doc._id,
      audio: { bytes: saved.bytes, contentType: saved.contentType },
    });

    startPipelineInBackground(doc._id);
  } catch (error) {
    if (saved?.fileName) await removeAudio(saved.fileName);
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
        .json({ success: false, message: "Pilot call not found." });
    }

    if (doc.extraction?.status !== "completed" || !doc.extraction?.draft) {
      return res.status(409).json({
        success: false,
        message: "This call has no AI draft to review yet.",
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
  if (!doc) return { status: 404, message: "Pilot call not found." };
  if (doc.extraction?.status !== "completed" || !doc.extraction?.draft) {
    return { status: 409, message: "This call has no AI draft to review yet." };
  }
  if (doc.review?.status === REVIEW_STATUS.CONFIRMED) {
    return { status: 409, message: "This draft is already confirmed." };
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
        message: "Send the whole review as { lines: [...] }.",
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
 * result is written to PhoneCallPilot.review.confirmed and nowhere else. No
 * Order is created, imported or referenced.
 */
export const confirmPilotDraft = async (req, res) => {
  try {
    const doc = await findOwnedPilotCall(req.params.id, req.userId);
    if (!doc) {
      return res
        .status(404)
        .json({ success: false, message: "Pilot call not found." });
    }
    if (doc.extraction?.status !== "completed" || !doc.extraction?.draft) {
      return res.status(409).json({
        success: false,
        message: "This call has no AI draft to confirm.",
      });
    }
    if (doc.review?.status === REVIEW_STATUS.CONFIRMED) {
      return res.status(200).json({
        success: true,
        alreadyConfirmed: true,
        review: publicReview(doc),
        message: "यह ड्राफ्ट पहले ही कन्फर्म है।",
      });
    }

    const outcome = confirmReviewDraft({
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

    /*
     * One-tap flow: the supplier asks for the order in the same action that
     * confirms the draft. It still goes through the bridge, so revalidation and
     * the duplicate guard apply exactly as they do for the separate step.
     */
    if (req.body?.createOrder === true) {
      const { createOrderFromConfirmedPhoneCall } =
        await import("../services/phoneOrderBridgeService.js");

      const orderResult = await createOrderFromConfirmedPhoneCall({
        pilotCallId: String(doc._id),
        userId: req.userId || null,
        customerUserId: req.body?.customerUserId || null,
      });

      if (!orderResult.ok) {
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

      return res.status(200).json({
        success: true,
        review: publicReview(doc),
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
        .json({ success: false, message: "Pilot call not found." });
    }
    if (doc.review?.status !== REVIEW_STATUS.CONFIRMED) {
      return res
        .status(409)
        .json({ success: false, message: "This draft is not confirmed." });
    }

    const review = reopenReview({ doc });
    await doc.save();

    return res.status(200).json({ success: true, review });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
