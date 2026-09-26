import mongoose from "mongoose";

import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import PhoneCall from "../models/phoneCallModel.js";
import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";
import Product from "../models/productModel.js";
import Company from "../models/companiesModel.js";
import {
  calculateOrderTotal,
  getIndiaDateRange,
  getTodayCutoff,
  sendOrderNotifications,
  withUserOrderLock,
} from "./orderCommonService.js";

/**
 * The controlled bridge from a confirmed phone call to a real e-Setu Order.
 *
 * This is the only place in the codebase allowed to turn a phone-call draft
 * into an Order, and it reuses the production order primitives from
 * orderCommonService (cutoff rules, total maths, per-user lock, notifications)
 * rather than re-implementing any of them.
 *
 * Nothing here guesses. If a product is gone, a variant no longer exists, a
 * quantity is missing or the caller was never identified, the function refuses
 * and records why. A wrong order is always worse than no order.
 */

export const BRIDGE_CODES = {
  NOT_FOUND: "PHONE_CALL_NOT_FOUND",
  CALL_REQUIRED: "PHONE_CALL_RECORD_REQUIRED",
  CALL_NOT_OWNED: "PHONE_CALL_SUPPLIER_MISMATCH",
  CONFIRMER_MISMATCH: "PHONE_CALL_CONFIRMER_MISMATCH",
  CUSTOMER_MISMATCH: "PHONE_CALL_CUSTOMER_MISMATCH",
  NOT_CONFIRMED: "PHONE_CALL_NOT_CONFIRMED",
  NO_CONFIRMED_DRAFT: "PHONE_CALL_NO_CONFIRMED_DRAFT",
  EMPTY_DRAFT: "PHONE_CALL_EMPTY_DRAFT",
  ALREADY_ORDERED: "PHONE_CALL_ALREADY_ORDERED",
  ORDER_IN_PROGRESS: "PHONE_CALL_ORDER_IN_PROGRESS",
  UNKNOWN_CUSTOMER: "PHONE_CALL_CUSTOMER_UNKNOWN",
  ORDER_CUTOFF_CLOSED: "PHONE_CALL_ORDER_CUTOFF_CLOSED",
  INVALID_ITEM: "PHONE_CALL_ITEM_INVALID",
  UNKNOWN_PRODUCT: "PHONE_CALL_PRODUCT_UNKNOWN",
  UNKNOWN_VARIANT: "PHONE_CALL_VARIANT_UNKNOWN",
  VARIANT_UNAVAILABLE: "PHONE_CALL_VARIANT_UNAVAILABLE",
  INVALID_QUANTITY: "PHONE_CALL_QUANTITY_INVALID",
  DUPLICATE_BLOCKED: "PHONE_CALL_DUPLICATE_BLOCKED",
  CREATE_FAILED: "PHONE_CALL_ORDER_CREATE_FAILED",
};

const isObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || ""));

const audioAuditReference = (pilotDoc) => ({
  pilotCallId: String(pilotDoc?._id || ""),
  available: Boolean(pilotDoc?.audio?.fileName),
  source: pilotDoc?.audio?.source || null,
  contentType: pilotDoc?.audio?.contentType || null,
  bytes: pilotDoc?.audio?.bytes ?? null,
  storedAt: pilotDoc?.audio?.storedAt || null,
});

/**
 * A claim older than this is assumed dead. A crashed request must not lock a
 * call out of ordering forever.
 */
const CLAIM_TIMEOUT_MS = Number(
  process.env.PHONE_ORDER_CLAIM_TIMEOUT_MS || 5 * 60 * 1000,
);

/* -------------------------------------------------------------------------- */
/*                              product revalidation                           */
/* -------------------------------------------------------------------------- */

/**
 * Rebuilds every confirmed line against the live catalog.
 *
 * The pilot deliberately stores no prices and no ObjectIds, so nothing the AI
 * produced is trusted here: product identity, variant identity, availability
 * and price all come from MongoDB right now, the same way cartController
 * resolves a variant when an item is added to the cart.
 */
export const revalidateConfirmedItems = async (items = []) => {
  const lines = Array.isArray(items) ? items : [];
  if (lines.length === 0) {
    return {
      ok: false,
      code: BRIDGE_CODES.EMPTY_DRAFT,
      message: "The confirmed order has no items.",
      blockers: [],
      orderItems: [],
      sources: [],
    };
  }

  const blockers = [];
  const resolved = [];

  // One query for the whole draft instead of one per line.
  const productIds = lines
    .map((line) => line?.productId)
    .filter((id) => isObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(String(id)));

  const uniqueIds = [...new Set(productIds.map((id) => String(id)))];
  const products = await Product.find({ _id: { $in: uniqueIds } })
    .populate("category", "name")
    .lean();

  const byId = new Map(
    products.map((product) => [String(product._id), product]),
  );

  const companyIds = [
    ...new Set(
      lines
        .map((line) => line?.company)
        .filter((value) => isObjectId(value))
        .map((value) => new mongoose.Types.ObjectId(String(value))),
    ),
  ];

  const companies = companyIds.length
    ? await Company.find({ _id: { $in: companyIds } }).lean()
    : [];

  const companyById = new Map(
    companies.map((company) => [String(company._id), company]),
  );

  lines.forEach((line, index) => {
    const label = line?.productName || line?.spokenName || `item ${index + 1}`;

    if (!isObjectId(line?.productId)) {
      blockers.push({
        index,
        productName: label,
        code: BRIDGE_CODES.UNKNOWN_PRODUCT,
        message: `${label}: product is not in the current catalog.`,
      });
      return;
    }

    const product = byId.get(String(line.productId));

    if (!product || product.isActive === false) {
      blockers.push({
        index,
        productName: label,
        code: BRIDGE_CODES.UNKNOWN_PRODUCT,
        message: `${label}: product is no longer in the catalog.`,
      });
      return;
    }

    const quantity = Number(line?.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      blockers.push({
        index,
        productName: label,
        code: BRIDGE_CODES.INVALID_QUANTITY,
        message: `${label}: quantity is not a positive number.`,
      });
      return;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];

    // The confirmed line holds a company ObjectId and a free-text measurement,
    // exactly the pair the cart uses to price an item.
    const variant = variants.find(
      (candidate) =>
        candidate.measurement === line.variantMeasurement &&
        String(candidate.company?._id ?? candidate.company) ===
          String(line.company),
    );

    if (!variant) {
      const measurementHint = line.variantMeasurement
        ? ` (${line.variantMeasurement})`
        : "";
      blockers.push({
        index,
        productName: label,
        code: BRIDGE_CODES.UNKNOWN_VARIANT,
        message: `${label}: that variant${measurementHint} no longer exists.`,
      });
      return;
    }

    if (variant.available === false) {
      blockers.push({
        index,
        productName: label,
        code: BRIDGE_CODES.VARIANT_UNAVAILABLE,
        message: `${label}: that variant is currently unavailable.`,
      });
      return;
    }

    const price = Number(variant.price);

    if (!Number.isFinite(price) || price < 0) {
      blockers.push({
        index,
        productName: label,
        code: BRIDGE_CODES.INVALID_ITEM,
        message: `${label}: the catalog price is not usable.`,
      });
      return;
    }

    const companyId = variant.company?._id ?? variant.company;
    const companyDoc =
      companyById.get(String(companyId)) ||
      (variant.company && typeof variant.company === "object"
        ? variant.company
        : null);

    resolved.push({
      source: line,
      orderItem: {
        productId: product._id,
        name: product.name || "",
        hinglishName: product.hinglishName || "",
        image:
          typeof product.image === "string"
            ? product.image
            : product.image?.[0] || "",
        companyId: companyId || null,
        companyName: companyDoc?.name || "",
        categoryId: product.category?._id ?? product.category ?? null,
        categoryName: product.category?.name || "",
        measurement: variant.measurement,
        qty: Math.round(quantity * 1000) / 1000,
        price,
        total: Math.round(price * quantity * 100) / 100,
      },
    });
  });

  if (blockers.length > 0) {
    return {
      ok: false,
      code: blockers[0].code,
      message:
        blockers.length === 1
          ? blockers[0].message
          : `${blockers.length} items cannot be ordered: ${blockers
              .slice(0, 3)
              .map((blocker) => blocker.message)
              .join(" ")}`,
      blockers,
      orderItems: [],
      sources: [],
    };
  }

  return {
    ok: true,
    code: null,
    message: null,
    blockers: [],
    // Real order items, ready to be written. These are what gets stored, so
    // they must never be wrapped in anything.
    orderItems: resolved.map((entry) => entry.orderItem),
    // The confirmed lines behind them, for the audit trail.
    sources: resolved.map((entry) => entry.source),
  };
};

/* -------------------------------------------------------------------------- */
/*                                   claiming                                  */
/* -------------------------------------------------------------------------- */

/**
 * Atomically claims the right to create the order for this call.
 *
 * A conditional single-document update, so exactly one concurrent confirmation
 * can win. A winner that then crashes leaves a stale claim, which the next
 * attempt is allowed to take over after the timeout.
 */
export const claimOrderCreation = async ({ pilotCallId, userId, now } = {}) => {
  const at = now || new Date();
  const staleBefore = new Date(at.getTime() - CLAIM_TIMEOUT_MS);

  return PhoneCallPilot.findOneAndUpdate(
    {
      _id: pilotCallId,
      "review.status": "confirmed",
      "review.confirmed": { $ne: null },
      "review.confirmed.orderCreated": { $ne: true },
      $or: [
        { "review.confirmed.orderClaimedAt": null },
        { "review.confirmed.orderClaimedAt": { $exists: false } },
        { "review.confirmed.orderClaimedAt": { $lte: staleBefore } },
      ],
    },
    {
      $set: {
        "review.confirmed.orderClaimedAt": at,
        "review.confirmed.orderClaimedBy": userId || null,
        "review.confirmed.orderCreationError": null,
      },
    },
    { new: true },
  );
};

export const releaseOrderClaim = async ({ pilotCallId, userId } = {}) => {
  return PhoneCallPilot.updateOne(
    {
      _id: pilotCallId,
      "review.confirmed.orderCreated": { $ne: true },
      "review.confirmed.orderClaimedBy": userId || null,
    },
    {
      $set: {
        "review.confirmed.orderClaimedAt": null,
        "review.confirmed.orderClaimedBy": null,
      },
    },
  );
};

const markOrderCreated = async ({ pilotCallId, orderId, at }) => {
  return PhoneCallPilot.updateOne(
    { _id: pilotCallId, "review.confirmed.orderCreated": { $ne: true } },
    {
      $set: {
        "review.confirmed.orderCreated": true,
        "review.confirmed.orderId": String(orderId),
        "review.confirmed.orderCreatedAt": at,
        "review.confirmed.orderCreationError": null,
        "review.confirmed.orderClaimedAt": null,
        "review.confirmed.orderClaimedBy": null,
      },
    },
  );
};

const markOrderFailed = async ({ pilotCallId, message, code, at }) => {
  return PhoneCallPilot.updateOne(
    { _id: pilotCallId, "review.confirmed.orderCreated": { $ne: true } },
    {
      $set: {
        "review.confirmed.orderCreationError": {
          message: String(message || "Order creation failed.").slice(0, 500),
          code: code || BRIDGE_CODES.CREATE_FAILED,
          at,
        },
        "review.confirmed.orderClaimedAt": null,
        "review.confirmed.orderClaimedBy": null,
      },
    },
  );
};

/* -------------------------------------------------------------------------- */
/*                                  customer                                   */
/* -------------------------------------------------------------------------- */

/**
 * Resolves the customer the order belongs to.
 *
 * Only three sources are accepted, in this order:
 *   1. a customer a human explicitly picked on the call
 *   2. the caller number the existing pipeline already matched exactly
 *   3. the same number matched again here
 *
 * The supplier who reviewed the call is never the customer. Anything else is a
 * refusal, because an order attached to the wrong shop is a real-world problem.
 */
export const resolveOrderCustomer = async ({
  pilotDoc,
  phoneCall,
  customerUserId,
} = {}) => {
  const select = "firstName lastName address";
  const partyIds = [phoneCall?.from, phoneCall?.to]
    .filter((party) => party?.matched && party?.userId)
    .map((party) => party.userId);
  const parties = await Promise.all(
    partyIds.map(async (id) => ({
      id,
      user: await User.findById(id).select(`${select} role`),
    })),
  );
  const customers = parties.filter((entry) => entry.user?.role === "user");
  if (customers.length !== 1) return null;
  const callerUserId = customers[0].id;

  if (customerUserId && String(customerUserId) !== String(callerUserId)) {
    return null;
  }

  const pilotCustomerId = pilotDoc?.customer?.userId;
  if (pilotCustomerId && String(pilotCustomerId) !== String(callerUserId)) {
    return null;
  }

  if (!isObjectId(callerUserId)) return null;
  return customers[0].user;
};

/* -------------------------------------------------------------------------- */
/*                              the order itself                               */
/* -------------------------------------------------------------------------- */

/**
 * Creates the Order document for an already-validated, already-claimed call.
 *
 * Runs inside the shared per-customer order lock, so a phone order and a cart
 * order placed at the same moment cannot both decide they own the customer's
 * single "today" order.
 */
export const persistOrderForCall = async ({
  pilotDoc,
  orderItems,
  user,
  userId,
  supplierId,
  phoneCallId,
  now,
} = {}) => {
  const at = now || new Date();
  const confirmed = pilotDoc?.review?.confirmed || {};
  const totalAmount = calculateOrderTotal(orderItems);
  const cutoffTime = await getTodayCutoff();

  const audit = {
    callerNumber: pilotDoc?.caller?.normalized || pilotDoc?.caller?.raw || null,
    callAt: pilotDoc?.provider?.answeredAt || pilotDoc?.createdAt || at,
    transcript: pilotDoc?.stt?.transcript || "",
    aiDraft: pilotDoc?.extraction?.draft || null,
    aiConfidence: Array.isArray(pilotDoc?.extraction?.draft?.items)
      ? pilotDoc.extraction.draft.items.map((item) => ({
          productName: item?.productName || item?.spokenName || "",
          confidence: item?.confidence ?? null,
        }))
      : [],
    audioReferences: [audioAuditReference(pilotDoc)],
    confirmedAt: confirmed.at || null,
    confirmedBy: confirmed.by || null,
    corrections: Array.isArray(confirmed.corrections)
      ? confirmed.corrections
      : [],
    removedItems: Array.isArray(confirmed.removed) ? confirmed.removed : [],
    addedItems: confirmed.items
      ? confirmed.items.filter((item) => item?.origin === "manual")
      : [],
    finalItems: Array.isArray(confirmed.items) ? confirmed.items : [],
  };

  return withUserOrderLock(String(userId), async () => {
    const { start, end } = getIndiaDateRange();

    const existing = await Order.findOne({
      userId,
      status: "Pending",
      isTodayOrder: true,
      createdAt: { $gte: start, $lte: end },
    });

    // The cart flow merges into the customer's existing pending order so a
    // customer never has two orders on the same day. A phone order is a real
    // order, so it follows exactly the same rule.
    if (existing) {
      for (const orderItem of orderItems) {
        const match = existing.items.find(
          (item) =>
            String(item.productId) === String(orderItem.productId) &&
            String(item.companyId) === String(orderItem.companyId) &&
            item.measurement === orderItem.measurement,
        );

        if (match) {
          match.qty = Number(match.qty || 0) + Number(orderItem.qty || 0);
          match.total = Number(match.total || 0) + Number(orderItem.total || 0);
          if (match.qty > 0) match.price = match.total / match.qty;
        } else {
          existing.items.push(orderItem);
        }
      }

      existing.totalAmount = calculateOrderTotal(existing.items);
      // A cart order has no supplier recorded. The first phone order to touch
      // today's order is what identifies it, and it is never overwritten after.
      if (!existing.supplierId && supplierId) existing.supplierId = supplierId;
      existing.source = "phone-call";

      // Every contributing call is kept. `phoneCallPilotId` stays as the call
      // that created the order, because that is the value the unique index on it
      // depends on.
      if (
        phoneCallId &&
        !existing.phoneCallIds?.some((id) => String(id) === String(phoneCallId))
      ) {
        existing.phoneCallIds = [...(existing.phoneCallIds || []), phoneCallId];
      }
      if (
        !existing.phoneCallPilotIds?.some(
          (id) => String(id) === String(pilotDoc._id),
        )
      ) {
        existing.phoneCallPilotIds = [
          ...(existing.phoneCallPilotIds || []),
          pilotDoc._id,
        ];
      }

      appendPhoneOrderProvenance(existing, {
        pilotDoc,
        phoneCallId,
        orderItems,
        at,
      });

      await existing.save();
      return { order: existing, merged: true };
    }

    const order = await Order.create({
      userId,
      supplierId: supplierId || null,
      items: orderItems,
      originalTotalAmount: totalAmount,
      totalAmount,
      shippingAddress: user?.address || "",
      paymentMethod: "COD",
      paymentStatus: "Pending",
      status: "Pending",
      isTodayOrder: true,
      source: "phone-call",
      phoneCallId: phoneCallId || null,
      phoneCallIds: phoneCallId ? [phoneCallId] : [],
      phoneCallPilotId: pilotDoc._id,
      phoneCallPilotIds: [pilotDoc._id],
      phoneCallAudit: audit,
      cutoffTime,
    });

    return { order, merged: false };
  });
};

const appendPhoneOrderProvenance = (
  order,
  { pilotDoc, phoneCallId, orderItems, at },
) => {
  const audit = order.phoneCallAudit || {};
  const existingItems = Array.isArray(audit.finalItems) ? audit.finalItems : [];
  const existingTranscripts = audit.transcript
    ? String(audit.transcript).trim()
    : "";
  const nextTranscript = pilotDoc?.stt?.transcript || "";

  order.phoneCallAudit = {
    ...audit,
    callerNumber: pilotDoc?.caller?.normalized || pilotDoc?.caller?.raw || null,
    callAt: pilotDoc?.createdAt || at,
    // Two calls on the same order each keep their own transcript, separated,
    // so a merged order is still traceable back to either call.
    transcript: [existingTranscripts, nextTranscript]
      .filter(Boolean)
      .join("\n\n---\n\n"),
    aiDraft: audit.aiDraft || pilotDoc?.extraction?.draft || null,
    audioReferences: [
      ...(audit.audioReferences || []),
      audioAuditReference(pilotDoc),
    ],
    corrections: [
      ...(audit.corrections || []),
      ...(pilotDoc?.review?.confirmed?.corrections || []),
    ],
    removedItems: [
      ...(audit.removedItems || []),
      ...(pilotDoc?.review?.confirmed?.removed || []),
    ],
    addedItems: [
      ...(audit.addedItems || []),
      ...(pilotDoc?.review?.confirmed?.items || []).filter(
        (item) => item?.origin === "manual",
      ),
    ],
    finalItems: [...existingItems, ...orderItems],
  };
};

/* -------------------------------------------------------------------------- */
/*                              the public entry                               */
/* -------------------------------------------------------------------------- */

/**
 * createOrderFromConfirmedPhoneCall()
 *
 * The single controlled bridge from a confirmed phone-call draft to a real
 * e-Setu Order.
 *
 * Order of checks, each of which refuses rather than improvising:
 *   1. the call exists
 *   2. the supplier confirmed it
 *   3. a confirmed draft exists and has items
 *   4. it has not already produced an order
 *   5. nobody else is creating the order right now
 *   6. the customer can be identified
 *   7. every item still exists in the live catalog at a valid price
 *   8. only then is the order written
 */
export const createOrderFromConfirmedPhoneCall = async ({
  pilotCallId,
  userId,
  customerUserId,
  now,
  notify = true,
} = {}) => {
  const at = now || new Date();

  if (!isObjectId(pilotCallId)) {
    return {
      ok: false,
      status: 400,
      code: BRIDGE_CODES.NOT_FOUND,
      message: "That call id is not valid.",
    };
  }

  const pilotDoc = await PhoneCallPilot.findById(pilotCallId);

  if (!pilotDoc) {
    return {
      ok: false,
      status: 404,
      code: BRIDGE_CODES.NOT_FOUND,
      message: "Call not found.",
    };
  }

  if (!isObjectId(pilotDoc.phoneCallId)) {
    return {
      ok: false,
      status: 409,
      code: BRIDGE_CODES.CALL_REQUIRED,
      message: "असली कॉल का रिकॉर्ड नहीं मिला। इस ड्राफ्ट से ऑर्डर नहीं बनेगा।",
    };
  }

  const phoneCall = await PhoneCall.findOne({
    _id: pilotDoc.phoneCallId,
    supplierId: userId,
    pilotCallId: pilotDoc._id,
  });

  if (!phoneCall) {
    return {
      ok: false,
      status: 403,
      code: BRIDGE_CODES.CALL_NOT_OWNED,
      message: "यह कॉल इस सप्लायर की नहीं है।",
    };
  }

  if (pilotDoc.review?.status !== "confirmed" || !pilotDoc.review?.confirmed) {
    return {
      ok: false,
      status: 409,
      code: BRIDGE_CODES.NOT_CONFIRMED,
      message: "पहले ऑर्डर जाँच करके कन्फर्म करें।",
    };
  }

  const confirmed = pilotDoc.review.confirmed;

  if (String(confirmed.by || "") !== String(userId || "")) {
    return {
      ok: false,
      status: 403,
      code: BRIDGE_CODES.CONFIRMER_MISMATCH,
      message: "इस ड्राफ्ट की पुष्टि करने वाला सप्लायर अलग है।",
    };
  }

  if (confirmed.orderCreated === true && confirmed.orderId) {
    // A duplicate confirmation is a no-op, not an error: the supplier tapping
    // twice must never produce a second order.
    const existing = await Order.findOne({ phoneCallPilotId: pilotDoc._id });

    return {
      ok: true,
      status: 200,
      alreadyCreated: true,
      order: existing,
      orderId: confirmed.orderId,
      code: BRIDGE_CODES.ALREADY_ORDERED,
      message: "इस कॉल का ऑर्डर पहले ही बन चुका है।",
    };
  }

  const claim = await claimOrderCreation({ pilotCallId, userId, now: at });

  if (!claim) {
    // Someone else holds the claim. If an order already exists, report it.
    const settled = await PhoneCallPilot.findById(pilotCallId).select(
      "review.confirmed.orderCreated review.confirmed.orderId",
    );

    if (settled?.review?.confirmed?.orderCreated === true) {
      const existing = await Order.findOne({ phoneCallPilotId: pilotDoc._id });
      return {
        ok: true,
        status: 200,
        alreadyCreated: true,
        order: existing,
        orderId: settled.review.confirmed.orderId,
        code: BRIDGE_CODES.ALREADY_ORDERED,
        message: "इस कॉल का ऑर्डर पहले ही बन चुका है।",
      };
    }

    return {
      ok: false,
      status: 409,
      code: BRIDGE_CODES.ORDER_IN_PROGRESS,
      message: "यह ऑर्डर अभी बनाया जा रहा है। थोड़ी देर बाद देखें।",
    };
  }

  try {
    const user = await resolveOrderCustomer({
      pilotDoc,
      phoneCall,
      customerUserId,
    });

    if (!user) {
      await releaseOrderClaim({ pilotCallId, userId });

      return {
        ok: false,
        status: 422,
        code:
          customerUserId &&
          String(customerUserId) !== String(phoneCall.from?.userId || "")
            ? BRIDGE_CODES.CUSTOMER_MISMATCH
            : BRIDGE_CODES.UNKNOWN_CUSTOMER,
        message:
          "ग्राहक पहचान नहीं पाया। कॉल पर ग्राहक चुनें, फिर ऑर्डर बनाएँ।",
      };
    }

    const revalidated = await revalidateConfirmedItems(confirmed.items);

    if (!revalidated.ok) {
      await releaseOrderClaim({ pilotCallId, userId });
      await markOrderFailed({
        pilotCallId,
        message: revalidated.message,
        code: revalidated.code,
        at,
      });

      return {
        ok: false,
        status: 422,
        code: revalidated.code,
        message: revalidated.message,
        blockers: revalidated.blockers,
      };
    }

    const phoneCallId = pilotDoc.phoneCallId || null;

    const { order, merged } = await persistOrderForCall({
      pilotDoc,
      orderItems: revalidated.orderItems,
      user,
      userId: user._id,
      supplierId: userId || null,
      phoneCallId,
      now: at,
    });

    await markOrderCreated({ pilotCallId, orderId: order._id, at });

    if (notify) {
      // Same notification the cart path fires. Fire-and-forget so a OneSignal
      // outage can never roll back a real order.
      sendOrderNotifications({ user }).catch((error) => {
        console.error("Phone order notification error:", error);
      });
    }

    return {
      ok: true,
      status: 201,
      order,
      orderId: order._id,
      merged,
      code: null,
      message: "ऑर्डर बन गया।",
    };
  } catch (error) {
    await markOrderFailed({
      pilotCallId,
      message: error?.message,
      code:
        error?.code === 11000
          ? BRIDGE_CODES.DUPLICATE_BLOCKED
          : BRIDGE_CODES.CREATE_FAILED,
      at,
    });

    // A unique-index violation means the order already exists: the database
    // refused the duplicate, so this is a success from the caller's point of
    // view, not a failure.
    if (error?.code === 11000) {
      const existing = await Order.findOne({ phoneCallPilotId: pilotDoc._id });

      return {
        ok: true,
        status: 200,
        alreadyCreated: true,
        order: existing,
        orderId: existing?._id,
        code: BRIDGE_CODES.DUPLICATE_BLOCKED,
        message: "इस कॉल का ऑर्डर पहले ही बन चुका है।",
      };
    }

    console.error("Phone order creation failed:", error);

    return {
      ok: false,
      status: 500,
      code: BRIDGE_CODES.CREATE_FAILED,
      message: "ऑर्डर नहीं बन पाया। दोबारा कोशिश करें।",
    };
  }
};
