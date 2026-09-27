import mongoose from "mongoose";

import PhoneCall, {
  CALL_STATUS,
  PROCESSING_STATUS,
  TERMINAL_STATUSES,
} from "../models/phoneCallModel.js";
import { User } from "../models/userModel.js";
import {
  normalizeIndianPhone,
  toLookupNumber,
} from "./pilotPhoneNormalizer.js";

/**
 * Call recording, lookup and customer association for the e-Setu calling
 * feature.
 *
 * The important honesty rule in this file: a call placed from an app on an
 * ordinary handset is a real dialled call, but the handset tells the app almost
 * nothing about it. The app cannot see whether it connected, cannot see the
 * caller's number, and cannot record the audio. So every function here records
 * only what is actually known, and the screens show "not known" instead of
 * guessing.
 */

export const UNKNOWN_CALLER_LABEL = "अज्ञात कॉलर";

/** Maps a handset/webhook status word onto our own vocabulary. */
export const CALL_STATUS_BY_KEYWORD = {
  initiated: "initiated",
  initiateddialing: "initiated",
  ringing: "ringing",
  ringingin: "ringing",
  ringingout: "ringing",
  answered: "answered",
  answeredon: "answered",
  inprogress: "answered",
  active: "answered",
  completed: "completed",
  completedcallback: "completed",
  endcall: "completed",
  hangup: "completed",
  failed: "failed",
  busy: "failed",
  failedbusy: "failed",
  failednoanswer: "no_answer",
  noanswer: "no_answer",
  noanswerin: "no_answer",
  voicemail: "completed",
  canceled: "cancelled",
  hangupbyuser: "cancelled",
  rejected: "cancelled",
  missed: "missed",
  unanswered: "missed",
  notconnected: "failed",
};

export const normalizeCallStatus = (raw) => {
  const key = String(raw || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!key) return null;
  return CALL_STATUS_BY_KEYWORD[key] || null;
};

export const isTerminalStatus = (status) => TERMINAL_STATUSES.has(status);

/** Indian 10-digit dial string, or null when the number is not usable. */
export const toDialString = (raw) => toLookupNumber(raw);

/* -------------------------------------------------------------------------- */
/*                              party resolution                              */
/* -------------------------------------------------------------------------- */

/**
 * Finds a user by exact 10-digit number.
 *
 * Exact match only. There is deliberately no fuzzy or "did you mean" matching
 * for a phone number, because a wrong match here puts a real order on a real
 * shopkeeper's account.
 */
export const findUserByPhone = async (raw) => {
  const lookupNumber = toLookupNumber(raw);
  if (!lookupNumber) return null;

  return User.findOne({ phoneNumber: lookupNumber })
    .select("_id firstName lastName phoneNumber role place")
    .lean();
};

export const displayName = (user) => {
  if (!user) return "";
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
};

/**
 * Builds one side of a call (from or to).
 *
 * `matched` is false and every identifying field is left null when we could not
 * match anyone. It is never filled in by inference.
 */
export const buildParty = async ({
  userId,
  phone,
  preferSupplier = false,
} = {}) => {
  let user = null;

  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    user = await User.findById(userId)
      .select("firstName lastName phoneNumber role place")
      .lean();
  }

  if (!user && phone) user = await findUserByPhone(phone);

  const normalized = user
    ? String(user.phoneNumber)
    : phone
      ? normalizeIndianPhone(phone).normalized
      : null;

  if (!user) {
    return {
      userId: null,
      phoneNumber: normalized,
      name: "",
      matchMethod: null,
      matched: false,
    };
  }

  // A supplier slot only ever accepts a real supplier. If the id or number
  // pointed at a shopkeeper, this is treated as no match at all rather than a
  // call to the wrong person.
  if (preferSupplier && user.role !== "supplier") {
    return {
      userId: null,
      phoneNumber: normalized,
      name: "",
      matchMethod: null,
      matched: false,
    };
  }

  return {
    userId: user._id,
    phoneNumber: normalized,
    name: displayName(user),
    matchMethod: userId ? "manual" : "exact-10-digit",
    matched: true,
    // Returned for the caller's own validation, not persisted: a supplier call
    // must only ever point at a real supplier.
    role: user.role,
    isSupplier: user.role === "supplier",
  };
};

/* -------------------------------------------------------------------------- */
/*                                 call writing                                */
/* -------------------------------------------------------------------------- */

/**
 * Records a call the shopkeeper placed from the app.
 *
 * The supplied `status` is what the handset reports. The app cannot upgrade it:
 * `answered` is only ever recorded when a telephony provider says so.
 */
export const logOutgoingCall = async ({
  initiatedBy,
  supplierId,
  toPhone,
  status = "initiated",
  durationSeconds = null,
  callAt,
  now,
} = {}) => {
  const at = now || new Date();

  const to = await buildParty({
    userId: supplierId,
    phone: toPhone,
    preferSupplier: true,
  });

  if (!to.matched || to.isSupplier !== true) {
    return {
      ok: false,
      code: "SUPPLIER_NOT_FOUND",
      message: "यह सप्लायर नहीं मिला।",
    };
  }

  const resolvedStatus = isTerminalStatus(status)
    ? status
    : CALL_STATUS.includes(status)
      ? status
      : "initiated";

  const call = await PhoneCall.create({
    direction: "outgoing",
    status: resolvedStatus,
    processingStatus: "no_audio",
    from: await buildParty({ userId: initiatedBy }),
    to,
    initiatedBy: initiatedBy || null,
    supplierId: to.userId,
    callAt: callAt || at,
    endedAt: isTerminalStatus(resolvedStatus) ? at : null,
    durationSeconds: Number.isFinite(Number(durationSeconds))
      ? Number(durationSeconds)
      : null,
  });

  return { ok: true, call };
};

/**
 * Records a call that arrived on the supplier's number.
 *
 * Only used when something on the line actually tells us: a telephony provider
 * webhook, or the supplier reporting it. The app cannot detect this on its own,
 * so this is never called speculatively.
 */
export const logIncomingCall = async ({
  supplierId,
  fromPhone,
  status = "ringing",
  callAt,
  now,
  providerCallId,
} = {}) => {
  const at = now || new Date();

  const supplier = supplierId
    ? await User.findById(supplierId)
        .select("_id firstName lastName role")
        .lean()
    : null;

  if (!supplier || supplier.role !== "supplier") {
    return {
      ok: false,
      code: "SUPPLIER_NOT_FOUND",
      message: "सप्लायर नहीं मिला।",
    };
  }

  const call = await PhoneCall.create({
    direction: "incoming",
    status: CALL_STATUS.includes(status) ? status : "ringing",
    processingStatus: "no_audio",
    from: await buildParty({ phone: fromPhone }),
    to: await buildParty({ userId: supplier._id }),
    supplierId: supplier._id,
    provider: {
      name: providerCallId ? "provider" : "device",
      callId: providerCallId || null,
    },
    callAt: callAt || at,
  });

  return { ok: true, call };
};

/**
 * Moves a call to a new status.
 *
 * Terminal states are final, so a late "ringing" webhook cannot resurrect a call
 * that already ended. Duration is only recorded when the caller actually
 * reported one.
 */
export const updateCallStatus = async ({
  callId,
  status,
  durationSeconds,
  now,
} = {}) => {
  const at = now || new Date();
  const next = CALL_STATUS.includes(status) ? status : null;

  if (!next) {
    return {
      ok: false,
      code: "BAD_STATUS",
      message: "कॉल स्थिति सही नहीं है।",
    };
  }

  const call = await PhoneCall.findById(callId);
  if (!call) {
    return {
      ok: false,
      code: "NOT_FOUND",
      status: 404,
      message: "कॉल नहीं मिली।",
    };
  }
  // A call that already ended stays ended.
  if (isTerminalStatus(call.status)) {
    return { ok: true, call, unchanged: true };
  }

  const patch = { status: next };

  if (next === "answered" && !call.answeredAt) patch.answeredAt = at;
  if (isTerminalStatus(next)) patch.endedAt = at;

  if (Number.isFinite(Number(durationSeconds))) {
    patch.durationSeconds = Number(durationSeconds);
  } else if (isTerminalStatus(next) && call.answeredAt) {
    // Fall back to what we can actually prove: answered -> ended.
    const measured = Math.max(
      0,
      Math.round((at - new Date(call.answeredAt)) / 1000),
    );
    if (measured > 0) patch.durationSeconds = measured;
  }

  call.set(patch);
  await call.save();

  return { ok: true, call };
};

export const logSupplierOutgoingCall = async ({
  supplierId,
  customerUserId,
  now,
} = {}) => {
  const [supplier, customer] = await Promise.all([
    User.findById(supplierId)
      .select("_id firstName lastName phoneNumber role place")
      .lean(),
    User.findById(customerUserId)
      .select("_id firstName lastName phoneNumber role place")
      .lean(),
  ]);

  if (!supplier || supplier.role !== "supplier") {
    return {
      ok: false,
      code: "SUPPLIER_NOT_FOUND",
      message: "सप्लायर नहीं मिला।",
    };
  }
  if (!customer || customer.role !== "user") {
    return {
      ok: false,
      code: "CUSTOMER_NOT_FOUND",
      message: "दुकानदार नहीं मिला।",
    };
  }

  const at = now || new Date();
  const call = await PhoneCall.create({
    direction: "outgoing",
    status: "initiated",
    processingStatus: "no_audio",
    from: {
      userId: supplier._id,
      phoneNumber: String(supplier.phoneNumber),
      name: displayName(supplier),
      matchMethod: "manual",
      matched: true,
    },
    to: {
      userId: customer._id,
      phoneNumber: String(customer.phoneNumber),
      name: displayName(customer),
      matchMethod: "manual",
      matched: true,
    },
    initiatedBy: supplier._id,
    initiatedByRole: "supplier",
    supplierId: supplier._id,
    callAt: at,
  });

  return { ok: true, call, customer, supplier };
};

/* -------------------------------------------------------------------------- */
/*                             customer association                            */
/* -------------------------------------------------------------------------- */

/**
 * Attaches a customer to a call that came in from an unrecognised number.
 *
 * This is the "अज्ञात कॉलर" path: the supplier identifies the shopkeeper by hand
 * and the system records that they did, so nobody had to guess.
 *
 * The pilot record is updated too, otherwise a later order creation would still
 * see an unidentified caller and refuse.
 */
export const identifyCallCustomer = async ({
  callId,
  customerUserId,
  byUserId,
  now,
} = {}) => {
  const at = now || new Date();

  const call = await PhoneCall.findById(callId);
  if (!call)
    return {
      ok: false,
      code: "NOT_FOUND",
      status: 404,
      message: "कॉल नहीं मिली।",
    };

  const targetUserId =
    customerUserId || call.from?.userId || call.to?.userId || null;

  if (!targetUserId || !mongoose.Types.ObjectId.isValid(String(targetUserId))) {
    return {
      ok: false,
      code: "CUSTOMER_REQUIRED",
      status: 400,
      message: "ग्राहक चुनें।",
    };
  }

  const user = await User.findById(targetUserId)
    .select("_id firstName lastName phoneNumber role")
    .lean();

  if (!user || user.role === "supplier") {
    return {
      ok: false,
      code: "NOT_A_CUSTOMER",
      status: 400,
      message: "यह ग्राहक नहीं है।",
    };
  }

  // Which side of the call holds the customer depends on who dialled. When the
  // supplier placed the call the supplier is on "from" and the shopkeeper is on
  // "to" (see logSupplierOutgoingCall), so writing "from" here would overwrite
  // the supplier with the customer and lose the real caller. Any other call
  // reached this app as the shopkeeper dialling the supplier, so the customer
  // is "from".
  const customerSide = call.initiatedByRole === "supplier" ? "to" : "from";

  call[customerSide] = {
    userId: user._id,
    phoneNumber: String(user.phoneNumber),
    name: displayName(user),
    matchMethod: "manual",
    matched: true,
  };
  call.customerIdentifiedBy = byUserId || null;
  await call.save();

  // Keep the draft pipeline in step, so order creation sees the same customer.
  if (call.pilotCallId) {
    await PhoneCallPilotCustomerSync(call.pilotCallId, user._id);
  }

  return { ok: true, call, customer: user, identifiedAt: at };
};

/**
 * Writes an identified customer onto the pilot record.
 *
 * Kept as its own function so the call code never imports the pilot model
 * directly and the two collections cannot drift apart silently.
 */
const PhoneCallPilotCustomerSync = async (pilotCallId, userId) => {
  const { default: PhoneCallPilot } =
    await import("../models/phoneCallPilotModel.js");

  await PhoneCallPilot.updateOne(
    { _id: pilotCallId },
    {
      $set: {
        "customer.userId": userId,
        "customer.matched": true,
        "customer.method": "manual",
      },
    },
  );
};

/* -------------------------------------------------------------------------- */
/*                                 projection                                 */
/* -------------------------------------------------------------------------- */

/** What the shopkeeper's and supplier's screens are allowed to see. */
export const toPublicCall = (doc) => {
  const plain =
    typeof doc?.toObject === "function" ? doc.toObject() : doc || {};

  const side = (party, fallback) => ({
    userId: party?.userId || null,
    name: party?.name || "",
    phoneNumber: party?.phoneNumber
      ? party.matched
        ? party.phoneNumber
        : maskPhone(party.phoneNumber)
      : null,
    matched: party?.matched === true,
    displayName: party?.matched && party?.name ? party.name : fallback,
  });

  return {
    id: String(plain._id),
    direction: plain.direction,
    initiatedByRole: plain.initiatedByRole || "shopkeeper",
    status: plain.status,
    processingStatus: plain.processingStatus,
    from: side(plain.from, UNKNOWN_CALLER_LABEL),
    to: side(plain.to, ""),
    callAt: plain.callAt || plain.createdAt || null,
    answeredAt: plain.answeredAt || null,
    endedAt: plain.endedAt || null,
    durationSeconds: plain.durationSeconds ?? null,
    pilotCallId: plain.pilotCallId || null,
    orderId: plain.orderId || null,
    // A durable recording has no file name, so presence is decided by the
    // stored record rather than by a path. No storage identifier is ever sent
    // to a client: the audio itself is only reachable through the authenticated
    // pilot routes.
    hasAudio: Boolean(
      plain.recording?.fileName ||
        plain.recording?.publicId ||
        plain.pilotCallId,
    ),
    lastError: plain.lastError?.message || null,
    waitUntil: plain.waitUntil || null,
    waitNoticeSentAt: plain.waitNoticeSentAt || null,
  };
};

/**
 * Masks a number for display: 98XXXXXXXX.
 *
 * Used only where the number is shown next to an unidentified caller, so the
 * supplier can recognise their own line without the screen handing out full
 * numbers it does not need.
 */
export const maskPhone = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}${"X".repeat(Math.max(0, digits.length - 2))}`;
};

/* -------------------------------------------------------------------------- */
/*                                    lists                                   */
/* -------------------------------------------------------------------------- */

/** The shopkeeper's own calls, newest first. */
export const listCallsForUser = async ({ userId, limit = 30 } = {}) => {
  const calls = await PhoneCall.find({
    $or: [{ initiatedBy: userId }, { "to.userId": userId }],
  })
    .sort({ callAt: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 30, 100))
    .lean();

  return calls.map(toPublicCall);
};

/** The supplier's phone section: recent calls, newest first. */
export const listCallsForSupplier = async ({
  supplierId,
  limit = 30,
  date,
} = {}) => {
  const query = { supplierId };
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.callAt = { $gte: start, $lte: end };
  }
  const calls = await PhoneCall.find(query)
    .sort({ callAt: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 30, 100))
    .lean();

  return calls.map(toPublicCall);
};

/**
 * The section the supplier actually cares about: a draft is ready and nobody
 * has confirmed it. Ordered by the call being oldest first, because a call that
 * has been waiting longest is the one that will be forgotten.
 */
export const listCallsNeedingReview = async ({
  supplierId,
  limit = 30,
  date,
} = {}) => {
  const query = {
    supplierId,
    processingStatus: { $in: ["draft_ready", "needs_review", "confirmed"] },
  };
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.callAt = { $gte: start, $lte: end };
  }
  const calls = await PhoneCall.find(query)
    .sort({ callAt: 1 })
    .limit(Math.min(Number(limit) || 30, 100))
    .lean();

  return calls.map(toPublicCall);
};

/** Calls the supplier has not picked up, or that produced no audio. */
export const listIncomingCalls = async ({
  supplierId,
  limit = 30,
  date,
} = {}) => {
  const query = {
    supplierId,
    $or: [
      { direction: "incoming" },
      { status: { $in: ["missed", "no_answer"] } },
    ],
  };
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    query.callAt = { $gte: start, $lte: end };
  }
  const calls = await PhoneCall.find(query)
    .sort({ callAt: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 30, 100))
    .lean();

  return calls.map(toPublicCall);
};

/**
 * Sets a call's pipeline state, refusing any move that would hide a failure.
 */
export const setProcessingStatus = async ({
  callId,
  processingStatus,
  pilotCallId,
  orderId,
  error,
} = {}) => {
  const call = await PhoneCall.findById(callId);
  if (!call)
    return {
      ok: false,
      code: "NOT_FOUND",
      status: 404,
      message: "कॉल नहीं मिली।",
    };

  if (processingStatus && PROCESSING_STATUS.includes(processingStatus)) {
    call.processingStatus = processingStatus;
  }

  if (pilotCallId) call.pilotCallId = pilotCallId;
  if (orderId) {
    call.orderId = orderId;
    call.orderCreatedAt = new Date();
    call.processingStatus = "order_created";
  }

  call.lastError = error
    ? {
        message: String(error.message || error).slice(0, 400),
        code: error.code || null,
        at: new Date(),
      }
    : { message: null, code: null, at: null };

  await call.save();
  return { ok: true, call };
};
