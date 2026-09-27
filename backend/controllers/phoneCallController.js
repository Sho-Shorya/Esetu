import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { User } from "../models/userModel.js";
import {
  getAudioDigest,
  getMaxAudioBytes,
  hasAudioRecord,
  removeAudio,
  saveAudioBuffer,
  storageColumns,
} from "../services/pilotAudioStorage.js";
import { validateManualAudio } from "../services/sttService.js";
import { startPipelineInBackground } from "./phoneCallPilotController.js";
import { createOrderFromConfirmedPhoneCall } from "../services/phoneOrderBridgeService.js";
import {
  displayName,
  identifyCallCustomer,
  logSupplierOutgoingCall,
  listCallsForSupplier,
  listCallsForUser,
  listCallsNeedingReview,
  listIncomingCalls,
  logOutgoingCall,
  normalizeCallStatus,
  setProcessingStatus,
  toPublicCall,
  updateCallStatus,
} from "../services/phoneCallService.js";
import {
  getShopkeeperWaitState,
  sendSupplierWaitNotice,
} from "../services/phoneWaitService.js";

/**
 * HTTP layer for the e-Setu calling feature.
 *
 * Nothing here invents telephony. The shopkeeper's "कॉल करें" button dials a real
 * number through the device; this controller only records what really happened
 * and serves the two screens.
 */

const ok = (res, body) => res.status(200).json({ success: true, ...body });
const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, code, message });

/* -------------------------------------------------------------------------- */
/*                                   calling                                  */
/* -------------------------------------------------------------------------- */

/**
 * The suppliers this shopkeeper can call.
 *
 * Same source as the existing "choose your supplier" flow, so the Calling screen
 * and the ordering flow can never disagree about who the supplier is.
 */
export const listCallSuppliers = async (req, res) => {
  try {
    const selectedSupplierId = req.user?.selectedSupplier || null;

    const suppliers = await User.find({ role: "supplier" })
      .select("_id firstName lastName place phoneNumber")
      .sort({ firstName: 1 })
      .lean();

    const calls = await PhoneCall.find({ initiatedBy: req.userId })
      .select("to.userId to.phoneNumber callAt")
      .sort({ callAt: -1 })
      .limit(400)
      .lean();

    // Last call time per supplier, so the screen can show who was called last
    // without loading every call.
    const lastCallAt = new Map();
    calls.forEach((call) => {
      const key = String(call.to?.userId || call.to?.phoneNumber || "");
      if (!key) return;
      if (!lastCallAt.has(key)) lastCallAt.set(key, call.callAt);
    });

    return ok(res, {
      suppliers: suppliers.map((supplier) => ({
        _id: supplier._id,
        name: displayName(supplier),
        // The User model has no shop name field, so a supplier is shown by name
        // and place rather than by an invented business name.
        shopName: null,
        place: supplier.place || "",
        phoneNumber: supplier.phoneNumber,
        lastCallAt: lastCallAt.get(String(supplier._id)) || null,
      })),
      selectedSupplierId,
    });
  } catch (error) {
    return fail(res, 500, "SUPPLIERS_FAILED", error.message);
  }
};

/**
 * Records a call the shopkeeper just placed.
 *
 * The dialling itself happens on the device through a `tel:` link. The app then
 * reports the outcome the handset knows about. If it knows nothing, the call is
 * stored as "initiated", which is the truth.
 */
export const recordOutgoingCall = async (req, res) => {
  try {
    const now = new Date();
    const callAllowed = await User.findOneAndUpdate(
      {
        _id: req.userId,
        role: "user",
        $or: [
          { phoneOrderWaitUntil: null },
          { phoneOrderWaitUntil: { $exists: false } },
          { phoneOrderWaitUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          phoneOrderWaitUntil: null,
          phoneOrderWaitSupplierId: null,
          phoneOrderWaitCallId: null,
        },
      },
      { new: true },
    ).select("_id");

    if (!callAllowed) {
      const wait = await getShopkeeperWaitState({ userId: req.userId, now });
      if (!wait.active) {
        return fail(
          res,
          404,
          "SHOPKEEPER_NOT_FOUND",
          "दुकानदार का खाता नहीं मिला।",
        );
      }
      return res.status(423).json({
        success: false,
        code: "PHONE_ORDER_WAIT_ACTIVE",
        message: "सप्लायर ने 10 मिनट रुकने को कहा है।",
        wait,
      });
    }

    const { supplierId, toPhone, status, durationSeconds, callAt } =
      req.body || {};

    const result = await logOutgoingCall({
      initiatedBy: req.userId,
      supplierId: supplierId || null,
      toPhone: toPhone || null,
      status: normalizeCallStatus(status) || "initiated",
      durationSeconds,
      callAt: callAt || null,
    });

    if (!result.ok) {
      return fail(res, 404, result.code, result.message);
    }

    return res.status(201).json({
      success: true,
      call: toPublicCall(result.call),
    });
  } catch (error) {
    return fail(res, 500, "CALL_LOG_FAILED", error.message);
  }
};

/** "हाल की कॉल" for the shopkeeper. */
export const getMyCalls = async (req, res) => {
  try {
    const [calls, wait] = await Promise.all([
      listCallsForUser({ userId: req.userId, limit: req.query.limit }),
      getShopkeeperWaitState({ userId: req.userId }),
    ]);
    return ok(res, { calls, wait });
  } catch (error) {
    return fail(res, 500, "CALLS_FAILED", error.message);
  }
};

export const startSupplierCall = async (req, res) => {
  try {
    const result = await logSupplierOutgoingCall({
      supplierId: req.userId,
      customerUserId: req.body?.customerUserId,
    });
    if (!result.ok) return fail(res, 404, result.code, result.message);
    return res.status(201).json({
      success: true,
      call: toPublicCall(result.call),
      phoneNumber: result.customer.phoneNumber,
    });
  } catch (error) {
    return fail(res, 500, "SUPPLIER_CALL_START_FAILED", error.message);
  }
};

export const sendSupplierWait = async (req, res) => {
  try {
    const result = await sendSupplierWaitNotice({
      callId: req.params.id,
      supplierId: req.userId,
    });
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        code: result.code,
        message: result.message,
        wait: result.wait,
      });
    }
    return ok(res, { call: result.call, wait: result.wait });
  } catch (error) {
    return fail(res, 500, "WAIT_NOTICE_FAILED", error.message);
  }
};

/* -------------------------------------------------------------------------- */
/*                                  supplier                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything the supplier's phone section needs, in one request.
 *
 * The section is deliberately three small lists rather than a dashboard, and
 * this keeps it to a single round trip on a slow connection.
 */
export const getSupplierPhoneSection = async (req, res) => {
  try {
    const supplierId = req.user._id;
    const limit = req.query.limit;
    const date = req.query.date;

    const [incoming, recent, needsReview] = await Promise.all([
      listIncomingCalls({ supplierId, limit, date }),
      listCallsForSupplier({ supplierId, limit, date }),
      listCallsNeedingReview({ supplierId, limit, date }),
    ]);

    return ok(res, {
      incoming,
      recent,
      needsReview,
      // An unidentified caller has to be resolvable before an order can exist,
      // so the supplier is told plainly when this will block them.
      unknownCallerCount: recent.filter((call) => !call.from.matched).length,
    });
  } catch (error) {
    return fail(res, 500, "SUPPLIER_CALLS_FAILED", error.message);
  }
};

export const getSupplierCall = async (req, res) => {
  try {
    const call = await PhoneCall.findOne({
      _id: req.params.id,
      supplierId: req.user._id,
    })
      .populate("pilotCallId")
      .lean();

    if (!call) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    return ok(res, { call: toPublicCall(call) });
  } catch (error) {
    return fail(res, 500, "CALL_FAILED", error.message);
  }
};

/** The supplier records how a call ended. */
export const reportCallStatus = async (req, res) => {
  try {
    const call = await PhoneCall.findOne({
      _id: req.params.id,
      supplierId: req.user._id,
    });

    if (!call) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    const result = await updateCallStatus({
      callId: call._id,
      status: normalizeCallStatus(req.body?.status),
      durationSeconds: req.body?.durationSeconds,
    });

    if (!result.ok) {
      return fail(res, 400, result.code, result.message);
    }

    return ok(res, { call: toPublicCall(result.call) });
  } catch (error) {
    return fail(res, 500, "STATUS_FAILED", error.message);
  }
};

/**
 * Attaches a customer to an unidentified call.
 *
 * This is the only way a customer gets onto a call that arrived from a number we
 * did not recognise. The system never picks one on its own.
 */
export const identifyCustomer = async (req, res) => {
  try {
    const call = await PhoneCall.findOne({
      _id: req.params.id,
      supplierId: req.user._id,
    }).select("_id");

    if (!call) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    const result = await identifyCallCustomer({
      callId: call._id,
      customerUserId: req.body?.customerUserId,
      byUserId: req.userId,
    });

    if (!result.ok) {
      return fail(res, result.status || 400, result.code, result.message);
    }

    return ok(res, {
      call: toPublicCall(result.call),
      customer: result.customer,
    });
  } catch (error) {
    return fail(res, 500, "IDENTIFY_FAILED", error.message);
  }
};

/** Customers the supplier may attach to an unknown caller. */
export const listIdentifyCandidates = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("_id firstName lastName phoneNumber place")
      .sort({ firstName: 1 })
      .limit(200)
      .lean();

    return ok(res, { customers: users });
  } catch (error) {
    return fail(res, 500, "CUSTOMERS_FAILED", error.message);
  }
};

/* -------------------------------------------------------------------------- */
/*                                 the audio                                  */
/* -------------------------------------------------------------------------- */

/**
 * Attaches the call recording and starts the existing pipeline.
 *
 * This is the honest bridge between a handset call and the STT/draft/review
 * system: whoever holds the recording uploads it here, and everything after
 * that is the working pilot pipeline, untouched.
 */
export const attachCallAudio = async (req, res) => {
  if (!req.file || !req.file.buffer?.length) {
    return fail(res, 400, "AUDIO_REQUIRED", "ऑडियो फाइल जोड़ें।");
  }

  const maxBytes = getMaxAudioBytes();
  let saved = null;

  try {
    const call = await PhoneCall.findById(req.params.id);

    if (!call) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    const isOwner = String(call.supplierId || "") === String(req.userId || "");
    const isCaller =
      String(call.initiatedBy || "") === String(req.userId || "");

    if (!isOwner && !isCaller) {
      return fail(res, 403, "FORBIDDEN", "यह कॉल आपकी नहीं है।");
    }

    const digest = getAudioDigest(req.file.buffer);
    const linkedPilotCallId = call.pilotCallId?._id || call.pilotCallId || null;
    const pilot = linkedPilotCallId
      ? await PhoneCallPilot.findById(linkedPilotCallId).select(
          "audio.fileName audio.publicId audio.sha256 review.confirmed.orderCreated",
        )
      : null;
    const existingDigest =
      call.recording?.sha256 || pilot?.audio?.sha256 || null;

    if (existingDigest === digest) {
      return res.status(200).json({
        success: true,
        alreadyUploaded: true,
        call: toPublicCall(call),
        pilotCallId: linkedPilotCallId,
      });
    }

    if (
      existingDigest ||
      hasAudioRecord(call.recording) ||
      linkedPilotCallId ||
      hasAudioRecord(pilot?.audio) ||
      pilot?.review?.confirmed?.orderCreated
    ) {
      return fail(
        res,
        409,
        "RECORDING_EXISTS",
        "इस कॉल की रिकॉर्डिंग पहले से जुड़ी है। पुरानी रिकॉर्डिंग नहीं बदली गई।",
      );
    }

    const duplicate = await PhoneCall.findOne({
      supplierId: call.supplierId,
      "recording.sha256": digest,
      _id: { $ne: call._id },
    }).select("_id");
    if (duplicate) {
      return fail(
        res,
        409,
        "DUPLICATE_AUDIO",
        "यह रिकॉर्डिंग दूसरी कॉल में पहले से जुड़ी है।",
      );
    }

    await validateManualAudio({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    saved = await saveAudioBuffer({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
      prefix: "call",
    });

    // Reuse the pilot record: one call, one transcript, one draft.
    let linkedPilotId = call.pilotCallId;
    const customerParty =
      call.initiatedByRole === "supplier" ? call.to : call.from;

    if (!linkedPilotId) {
      const pilot = await PhoneCallPilot.create({
        source: "live",
        supplierId: call.supplierId,
        provider: { name: "device" },
        phoneCallId: call._id,
        customer: {
          matched: customerParty?.matched === true,
          userId: customerParty?.userId || null,
          method: customerParty?.matchMethod || "unknown",
        },
        caller: {
          raw: customerParty?.phoneNumber || null,
          normalized: customerParty?.phoneNumber || null,
          method: customerParty?.matchMethod || "unknown",
        },
        audio: {
          ...storageColumns(saved),
          source: "call-upload",
          storedAt: new Date(),
        },
        pipeline: { stage: "transcribing", startedAt: new Date() },
      });

      linkedPilotId = pilot._id;
    } else {
      linkedPilotId = linkedPilotId._id ? linkedPilotId._id : linkedPilotId;
      await PhoneCallPilot.updateOne(
        { _id: linkedPilotId },
        {
          $set: {
            supplierId: call.supplierId,
            "audio.storage": saved.storage,
            "audio.publicId": saved.publicId || null,
            "audio.format": saved.format || null,
            "audio.fileName": saved.fileName || null,
            "audio.contentType": saved.contentType,
            "audio.bytes": saved.bytes,
            "audio.sha256": saved.sha256,
            "audio.originalName": saved.originalName,
            "audio.source": "call-upload",
            "audio.storedAt": new Date(),
            "pipeline.stage": "transcribing",
            "pipeline.startedAt": new Date(),
          },
        },
      );
    }

    call.recording = {
      ...storageColumns(saved),
      capturedBy: isOwner ? "supplier" : "shopkeeper",
      storedAt: new Date(),
    };
    call.pilotCallId = linkedPilotId;
    call.processingStatus = "processing";
    call.lastError = { message: null, code: null, at: null };
    await call.save();

    res.status(202).json({
      success: true,
      call: toPublicCall(call),
      pilotCallId: linkedPilotId,
      audio: { bytes: saved.bytes, contentType: saved.contentType, maxBytes },
    });

    // Same background runner the pilot already uses. No second pipeline.
    startPipelineInBackground(linkedPilotId);
  } catch (error) {
    // The call or pilot document was never linked, so the recording is an
    // orphan: remove it from whichever backend took it.
    if (saved) await removeAudio(saved);
    if (error?.code === 11000) {
      return fail(
        res,
        409,
        "DUPLICATE_AUDIO",
        "यह रिकॉर्डिंग दूसरी कॉल में पहले से जुड़ी है।",
      );
    }
    if (error?.code === "AUDIO_CLOUD_UPLOAD_FAILED") {
      // Nothing was stored and no processing was started, so say exactly that
      // rather than letting the supplier believe the call is being handled.
      return fail(
        res,
        503,
        error.code,
        "रिकॉर्डिंग सुरक्षित जगह सेव नहीं हो पाई। प्रोसेसिंग शुरू नहीं हुई। फिर कोशिश करें।",
      );
    }
    if (
      error?.code === "AUDIO_FORMAT_UNSUPPORTED" ||
      error?.code === "AUDIO_MIME_UNSUPPORTED" ||
      error?.code === "AUDIO_UNREADABLE"
    ) {
      return fail(
        res,
        415,
        error.code,
        "WAV, MP3 या M4A की सही रिकॉर्डिंग चुनें।",
      );
    }
    return fail(res, 500, "AUDIO_FAILED", error.message);
  }
};

/* -------------------------------------------------------------------------- */
/*                            confirmed call -> order                          */
/* -------------------------------------------------------------------------- */

/**
 * Turns a confirmed phone-call draft into a real e-Setu Order.
 *
 * All of the decision-making lives in phoneOrderBridgeService; this only maps the
 * result onto HTTP.
 */
export const createOrderFromCall = async (req, res) => {
  try {
    const pilotCallId = req.params.id;

    const pilot = await PhoneCallPilot.findById(pilotCallId).select(
      "_id phoneCallId supplierId",
    );

    if (!pilot) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    // A supplier may only order from a call addressed to them.
    let ownsCall = String(pilot.supplierId || "") === String(req.userId || "");
    if (!ownsCall && pilot.phoneCallId) {
      ownsCall = Boolean(
        await PhoneCall.findOne({
          _id: pilot.phoneCallId,
          supplierId: req.userId,
        }).select("_id"),
      );
    }
    if (!ownsCall) return fail(res, 403, "FORBIDDEN", "यह कॉल आपकी नहीं है।");

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId,
      userId: req.userId,
      customerUserId: req.body?.customerUserId || null,
    });

    if (!result.ok) {
      // A failure on a call that has a linked PhoneCall is recorded there too,
      // so the supplier's list shows why instead of silently showing nothing.
      // "confirmed" rather than "failed": the draft is confirmed and the order
      // step is what was refused, and only "confirmed" keeps the call in the
      // "ऑर्डर के लिए" list where the supplier can actually retry it.
      if (pilot.phoneCallId) {
        await setProcessingStatus({
          callId: pilot.phoneCallId,
          processingStatus: "confirmed",
          error: { message: result.message, code: result.code },
        });
      }

      return res.status(result.status || 400).json({
        success: false,
        code: result.code,
        message: result.message,
        blockers: result.blockers || [],
      });
    }

    if (pilot.phoneCallId) {
      await setProcessingStatus({
        callId: pilot.phoneCallId,
        orderId: result.orderId,
      });
    }

    return res.status(result.status || 201).json({
      success: true,
      order: result.order,
      orderId: result.orderId,
      alreadyCreated: result.alreadyCreated === true,
      merged: result.merged === true,
      message: result.message,
    });
  } catch (error) {
    return fail(res, 500, "ORDER_FAILED", error.message);
  }
};

/**
 * Reports what the calling feature can and cannot actually do.
 *
 * The screen uses this to tell the truth about the current implementation
 * instead of implying a call is being captured when it is not.
 */
export const getCallingCapability = async (_req, res) => {
  const { getTelephonyProvider, SUPPORTED_PROVIDERS } =
    await import("../services/telephony/telephonyProvider.js");

  let providerName = "device";
  let providerConfigured = false;

  try {
    const provider = getTelephonyProvider();
    providerName = provider.PROVIDER_NAME;
    providerConfigured = provider.isConfigured();
  } catch {
    providerConfigured = false;
  }

  return ok(res, {
    // How a call is actually placed today.
    dialling: "device",
    canCaptureAudio: providerConfigured,
    canDetectCallerId: providerConfigured,
    maxAudioBytes: getMaxAudioBytes(),
    supportedProviders: SUPPORTED_PROVIDERS,
    activeProvider: providerName,
    providerConfigured,
  });
};
