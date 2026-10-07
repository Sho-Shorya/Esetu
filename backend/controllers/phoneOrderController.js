import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";
import {
  getAudioDigest,
  getMaxAudioBytes,
  removeAudio,
  saveAudioBuffer,
  storageColumns,
} from "../services/pilotAudioStorage.js";
import {
  probeAudioDurationSeconds,
  validateManualAudio,
} from "../services/sttService.js";
import { buildParty } from "../services/phoneCallService.js";
import { startPipelineInBackground } from "./phoneCallPilotController.js";

/**
 * Supplier recording upload: the entry point of the whole phone-order flow.
 *
 * The supplier calls the shopkeeper with their own phone's dialler, records the
 * conversation with the phone's recorder, then uploads that recording here with
 * the shopkeeper already picked. Everything after the upload — transcription,
 * extraction, review, order creation — is the existing pipeline, untouched.
 *
 * Guard rails kept in this one place:
 *   - supplier-only (route level: isAuthenticated + isSupp)
 *   - a customer must be chosen: the order bridge refuses an unidentified call
 *   - the file must be readable audio, and at most MAX_RECORDING_SECONDS long
 *   - the same recording (sha256) is never processed twice
 */

/** Hard cap on a recording, enforced before anything is stored. */
export const MAX_RECORDING_SECONDS = 600;

/** What the upload form is allowed to offer, reported by getUploadConfig. */
export const SUPPORTED_RECORDING_FORMATS = [
  "mp3",
  "m4a",
  "wav",
  "aac",
  "webm",
];

const ok = (res, body) => res.status(200).json({ success: true, ...body });
const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, code, message });

/**
 * Everything the upload form needs to describe its own limits, so the screen
 * never hardcodes a size or a format that the server may change.
 */
export const getUploadConfig = async (_req, res) => {
  try {
    return ok(res, {
      maxAudioBytes: getMaxAudioBytes(),
      maxDurationSeconds: MAX_RECORDING_SECONDS,
      formats: SUPPORTED_RECORDING_FORMATS,
    });
  } catch (error) {
    return fail(res, 500, "CONFIG_FAILED", error.message);
  }
};

/**
 * Creates the call + pipeline record for one uploaded recording and starts the
 * existing STT -> draft pipeline in the background.
 *
 * Returns 202 as soon as the bytes are safely stored, so a slow phone network
 * is not held open by transcription.
 */
export const uploadRecording = async (req, res) => {
  const supplierId = req.userId;
  let saved = null;
  let call = null;

  try {
    if (!req.file || !req.file.buffer?.length) {
      return fail(res, 400, "AUDIO_REQUIRED", "रिकॉर्डिंग फ़ाइल चुनें।");
    }

    const customerUserId = String(req.body?.customerUserId || "").trim();
    if (!customerUserId) {
      return fail(
        res,
        400,
        "CUSTOMER_REQUIRED",
        "किस दुकानदार की रिकॉर्डिंग है? पहले वह चुनें।",
      );
    }

    const customer = await User.findById(customerUserId)
      .select("_id firstName lastName phoneNumber role place")
      .lean();

    if (!customer || customer.role !== "user") {
      return fail(
        res,
        400,
        "CUSTOMER_NOT_FOUND",
        "दुकानदार नहीं मिला। कृपया दोबारा चुनें।",
      );
    }

    const buffer = req.file.buffer;
    const digest = getAudioDigest(buffer);

    /*
     * Duplicate protection. The unique index on supplierId + recording.sha256
     * is the hard guard; this read is the friendly one, so a double tap or a
     * re-selected file answers with the existing call instead of an error.
     */
    const existing = await PhoneCall.findOne({
      supplierId,
      "recording.sha256": digest,
    })
      .select("_id pilotCallId")
      .lean();

    if (existing) {
      const pilotId = existing.pilotCallId?._id || existing.pilotCallId || null;
      const pilot = pilotId
        ? await PhoneCallPilot.findById(pilotId)
            .select("pipeline.stage review.confirmed.orderCreated")
            .lean()
        : null;

      return res.status(200).json({
        success: true,
        duplicate: true,
        callId: existing._id,
        pilotCallId: pilotId,
        stage: pilot?.pipeline?.stage || null,
        orderCreated: pilot?.review?.confirmed?.orderCreated === true,
        message: "यह रिकॉर्डिंग पहले से अपलोड हो चुकी है।",
      });
    }

    // Readable audio of a supported type, or a translated refusal below.
    await validateManualAudio({
      buffer,
      fileName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const durationSeconds = await probeAudioDurationSeconds({
      buffer,
      fileName: req.file.originalname,
    });

    if (durationSeconds === null) {
      return fail(
        res,
        400,
        "AUDIO_DURATION_UNKNOWN",
        "रिकॉर्डिंग की लंबाई नहीं चल पाई। कृपया दूसरी रिकॉर्डिंग चुनें।",
      );
    }

    if (durationSeconds > MAX_RECORDING_SECONDS) {
      return fail(
        res,
        413,
        "AUDIO_TOO_LONG",
        "यह रिकॉर्डिंग 10 मिनट से ज़्यादा है। कृपया 10 मिनट या उससे कम की रिकॉर्डिंग अपलोड करें।",
      );
    }

    // Stored before either document exists, so a failed write leaves nothing
    // half-made; the catch below removes the bytes if a document fails.
    saved = await saveAudioBuffer({
      buffer,
      contentType: req.file.mimetype,
      originalName: req.file.originalname,
      prefix: "call",
    });

    const now = new Date();

    /*
     * Both parties, both known. `from` is the supplier (they placed the call on
     * their own phone) and `to` is the shopkeeper picked above — exactly the
     * shape resolveOrderCustomer requires: exactly one matched customer side.
     */
    const [from, to] = await Promise.all([
      buildParty({ userId: supplierId, preferSupplier: true }),
      buildParty({ userId: customerUserId }),
    ]);

    if (!from.matched || !to.matched || to.userId == null) {
      return fail(
        res,
        400,
        "CUSTOMER_NOT_FOUND",
        "दुकानदार नहीं मिला। कृपया दोबारा चुनें।",
      );
    }

    call = await PhoneCall.create({
      direction: "outgoing",
      status: "completed",
      processingStatus: "processing",
      from,
      to,
      initiatedBy: supplierId,
      initiatedByRole: "supplier",
      supplierId,
      customerIdentifiedBy: supplierId,
      recording: {
        ...storageColumns(saved),
        capturedBy: "supplier",
        storedAt: now,
      },
      callAt: now,
      endedAt: now,
      durationSeconds: Math.round(durationSeconds),
    });

    const pilot = await PhoneCallPilot.create({
      source: "live",
      supplierId,
      phoneCallId: call._id,
      caller: {
        raw: String(customer.phoneNumber),
        normalized: String(customer.phoneNumber),
        method: "supplier-selected",
      },
      customer: {
        matched: true,
        userId: customer._id,
        method: "supplier-selected",
      },
      audio: {
        ...storageColumns(saved),
        source: "upload",
        storedAt: now,
      },
      pipeline: {
        stage: "transcribing",
        startedAt: now,
        // Doubles as the run token: the first pipeline run owns the document
        // from this stamp, exactly like a claim.
        recordingReadyAt: now,
      },
    });

    call.pilotCallId = pilot._id;
    await call.save();

    res.status(202).json({
      success: true,
      callId: call._id,
      pilotCallId: pilot._id,
      stage: "transcribing",
      durationSeconds: Math.round(durationSeconds),
      audio: {
        bytes: saved.bytes,
        contentType: saved.contentType,
        maxBytes: getMaxAudioBytes(),
      },
      message: "रिकॉर्डिंग अपलोड हो गई। अब ऑर्डर तैयार हो रहा है।",
    });

    startPipelineInBackground(pilot._id);
  } catch (error) {
    // Nothing points at these bytes now, so drop them instead of leaving an
    // asset behind that retention would have to find later.
    if (saved) await removeAudio(saved);
    if (call?._id && !call.pilotCallId) {
      await PhoneCall.deleteOne({ _id: call._id, pilotCallId: null });
    }

    if (error?.code === 11000) {
      return fail(
        res,
        409,
        "DUPLICATE_AUDIO",
        "यह रिकॉर्डिंग पहले से अपलोड हो चुकी है।",
      );
    }
    if (error?.code === "AUDIO_CLOUD_UPLOAD_FAILED") {
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
        "यह फ़ाइल नहीं चलेगी। कृपया MP3, M4A, WAV, AAC या WEBM रिकॉर्डिंग चुनें।",
      );
    }
    return fail(res, 500, "UPLOAD_FAILED", error.message);
  }
};

/**
 * The orders this supplier's recordings produced, newest first.
 *
 * Read straight off the Order documents the bridge wrote, so the tab shows the
 * real orders with their real status — never a second, diverging copy.
 */
export const listCreatedOrders = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);

    const orders = await Order.find({
      supplierId: req.userId,
      $or: [
        { phoneCallPilotId: { $ne: null } },
        { "phoneCallPilotIds.0": { $exists: true } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select(
        "userId status totalAmount items createdAt paymentStatus shippingAddress",
      )
      .populate("userId", "firstName lastName place")
      .lean();

    return ok(res, {
      count: orders.length,
      orders: orders.map((order) => ({
        _id: order._id,
        status: order.status,
        paymentStatus: order.paymentStatus || null,
        totalAmount: order.totalAmount ?? 0,
        itemCount: Array.isArray(order.items) ? order.items.length : 0,
        createdAt: order.createdAt,
        customer: {
          userId: order.userId?._id || null,
          name: order.userId
            ? [order.userId.firstName, order.userId.lastName]
                .filter(Boolean)
                .join(" ")
                .trim()
            : "",
          place: order.userId?.place || "",
        },
      })),
    });
  } catch (error) {
    return fail(res, 500, "ORDERS_FAILED", error.message);
  }
};
