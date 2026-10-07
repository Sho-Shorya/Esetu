import mongoose from "mongoose";

import PhoneCall, { PROCESSING_STATUS } from "../models/phoneCallModel.js";
import { User } from "../models/userModel.js";
import {
  normalizeIndianPhone,
  toLookupNumber,
} from "./pilotPhoneNormalizer.js";

/**
 * Customer association and call projection for e-Setu phone orders.
 *
 * A call is always created by the supplier upload route, so this file only
 * handles what comes after: who is on each side of the call, fixing the
 * customer by hand when it was not recognised, the pipeline state written onto
 * the call, and the projection the screens are allowed to see.
 *
 * The honesty rule still applies: nothing here invents a fact the system does
 * not actually know about a call — a number is only ever shown matched, or
 * masked.
 */

export const UNKNOWN_CALLER_LABEL = "अज्ञात कॉलर";

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
 * Which side of a call holds the customer.
 *
 * A call the supplier uploaded has the customer on "to"; any other call reached
 * this app as a shopkeeper dialling a supplier, so the customer is "from".
 * Every reader of a call's parties must use this rule — picking a side by hand
 * is how a supplier ends up overwritten with a customer, or vice versa.
 */
export const customerSideOf = (call) =>
  call?.initiatedByRole === "supplier" ? "to" : "from";

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

  const pilotId = call.pilotCallId?._id || call.pilotCallId || null;
  if (pilotId) {
    // Once a real Order exists for the call, the customer behind it is part of
    // that order's record. Re-identifying afterwards would silently change who
    // the order writer believes it sold to.
    const { default: PhoneCallPilot } =
      await import("../models/phoneCallPilotModel.js");
    const pilot = await PhoneCallPilot.findById(pilotId)
      .select("review.confirmed.orderCreated")
      .lean();
    if (pilot?.review?.confirmed?.orderCreated === true) {
      return {
        ok: false,
        code: "ORDER_CREATED",
        status: 409,
        message: "इस कॉल का ऑर्डर बन चुका है। ग्राहक नहीं बदला जा सकता।",
      };
    }
  }

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

  // Which side of the call holds the customer depends on who placed it: an
  // uploaded call has the supplier on "from" and the shopkeeper on "to", so
  // writing "from" here would overwrite the supplier with the customer and lose
  // the real caller.
  const customerSide = customerSideOf(call);

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
/*                              pipeline state                                 */
/* -------------------------------------------------------------------------- */

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
