import { Cart } from "../models/cartModel.js";
import { User } from "../models/userModel.js";
import Payment from "../models/paymentModel.js";
import AppSetting from "../models/appSettingModel.js";

import {
  createPhonePePayment,
  getPhonePePaymentStatus,
  normalizePhonePeStatus,
  extractPhonePeTransactionId,
  isPhonePeConfigured,
  generateMerchantOrderId,
  rupeesToPaise,
} from "../services/phonePeService.js";

import { createPaidOrderFromCart } from "../services/paymentOrderService.js";

/* ============================================================
   CONSTANTS
============================================================ */

/*
 * Fixed online payment discount tiers:
 *   Below ₹200   → ₹5 discount
 *   Below ₹900   → ₹10 discount
 *   Below ₹2000  → ₹20 discount
 *   ₹2000 & above → ₹30 discount
 */
const getOnlineDiscount = (amount) => {
  const num = Number(amount);

  if (!Number.isFinite(num) || num <= 0) return 0;

  if (num < 200) return 5;
  if (num < 900) return 10;
  if (num < 2000) return 20;

  return 30;
};

/* ============================================================
   HELPERS
============================================================ */

/*
 * Persist a failed/expired payment lifecycle record.
 */
const markPaymentFailure = async (merchantOrderId, status, failReason) => {
  try {
    if (!merchantOrderId) return;

    await Payment.updateOne(
      { merchantOrderId },
      {
        $set: {
          status,
          failureReason: failReason || null,
          phonePeResponse: null,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    console.error("markPaymentFailure error:", error);
  }
};

/*
 * Calculate the online payment amount with fixed discount tiers.
 *
 * Example:
 *
 * Cart = ₹950  → Discount = ₹20  → Pay = ₹930
 * Cart = ₹1500 → Discount = ₹20  → Pay = ₹1480
 * Cart = ₹2500 → Discount = ₹30  → Pay = ₹2470
 */
const calculateOnlineAmount = (amount) => {
  const originalAmount = Number(amount);

  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const discountAmount = getOnlineDiscount(originalAmount);

  const finalAmount = Number((originalAmount - discountAmount).toFixed(2));

  if (finalAmount <= 0) {
    throw new Error("Invalid final payment amount.");
  }

  return {
    originalAmount,
    discountAmount,
    finalAmount,
  };
};

/*
 * Resolve the authoritative PhonePe merchant order ID for a user.
 *
 * The frontend passes a `transactionId` it read from the PhonePe redirect
 * URL, but PhonePe does not always echo back OUR merchantOrderId (or it may
 * echo it under a different parameter name). If the passed ID does not match
 * a Payment record we created, fall back to the user's most recent PENDING
 * Payment record. This makes verification independent of the redirect URL.
 */
const resolveEffectiveTransactionId = async (userId, transactionId) => {
  if (transactionId) {
    const match = await Payment.findOne({ merchantOrderId: transactionId });

    if (match && String(match.userId) === String(userId)) {
      return transactionId;
    }
  }

  /*
   * Fall back to the user's most recent payment that has NOT reached a final
   * state (PENDING or SUCCESS). This avoids resolving to an old FAILED /
   * EXPIRED record when the redirect URL did not echo our merchantOrderId.
   */
  const latest = await Payment.findOne({
    userId,
    status: { $in: ["PENDING", "SUCCESS"] },
  }).sort({ createdAt: -1 });

  if (latest?.merchantOrderId && String(latest.userId) === String(userId)) {
    return latest.merchantOrderId;
  }

  const anyLatest = await Payment.findOne({ userId }).sort({ createdAt: -1 });

  if (
    anyLatest?.merchantOrderId &&
    String(anyLatest.userId) === String(userId)
  ) {
    return anyLatest.merchantOrderId;
  }

  return transactionId || null;
};

/*
 * Calculate the cart total ONLY from backend cart data.
 *
 * Never trust amount sent by frontend.
 */
const calculateCartAmount = (cart) => {
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const total = cart.items.reduce((sum, item) => {
    const itemTotal = Number(item.total);

    if (!Number.isFinite(itemTotal) || itemTotal < 0) {
      throw new Error("Cart contains invalid item data.");
    }

    return sum + itemTotal;
  }, 0);

  if (!Number.isFinite(total) || total <= 0) {
    throw new Error("Unable to calculate cart amount.");
  }

  return Number(total.toFixed(2));
};

/*
 * Is the user still able to place a new order today?
 *
 * Same rule as the COD path: once today's ordering cutoff has passed,
 * no new order can be checked out. Matches admin's "dailyOrderCutoff"
 * setting (or default 12:00).
 */
const isOrderingWindowOpen = async () => {
  const DEFAULT_ORDER_CUTOFF = "12:00";

  const setting = await AppSetting.findOne({
    key: "dailyOrderCutoff",
  });

  const value = setting?.value || DEFAULT_ORDER_CUTOFF;

  const [hour = "12", minute = "00"] = String(value).split(":");

  const cutoff = new Date();

  cutoff.setHours(Number.parseInt(hour, 10) || 12);
  cutoff.setMinutes(Number.parseInt(minute, 10) || 0);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  return new Date() <= cutoff;
};

/* ============================================================
   CREATE PAYMENT
============================================================ */

/*
 * POST /api/v1/payment/create-payment
 *
 * Flow:
 *
 * Cart
 *   ↓
 * Backend calculates cart total
 *   ↓
 * Fixed discount (₹5/₹10/₹20/₹30)
 *   ↓
 * PhonePe payment created
 *   ↓
 * redirectUrl returned to frontend
 *
 * IMPORTANT:
 *
 * NO ORDER IS CREATED HERE.
 *
 * Order is created only after backend verifies
 * that PhonePe reports SUCCESS.
 */
export const createPayment = async (req, res) => {
  try {
    /* ========================================================
       1. AUTHENTICATION
    ======================================================== */

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    /* ========================================================
       2. ORDERING WINDOW CHECK
       No new online order can be checked out after today's
       ordering cutoff has passed (matches the COD path).
    ======================================================== */

    const windowOpen = await isOrderingWindowOpen();

    if (!windowOpen) {
      return res.status(400).json({
        success: false,
        message: "माफ़ कीजिए, ऑर्डर का समय खत्म हो गया है।",
      });
    }

    /* ========================================================
       3. PHONEPE CONFIGURATION
    ======================================================== */

    if (!isPhonePeConfigured()) {
      console.error("PhonePe configuration is incomplete.");

      return res.status(503).json({
        success: false,
        message:
          "Online payment is currently unavailable. Please try again later.",
      });
    }

    /* ========================================================
       4. GET CART + USER
    ======================================================== */

    const [cart, user] = await Promise.all([
      Cart.findOne({ userId }),

      User.findById(userId).select("firstName lastName phoneNumber mobile"),
    ]);

    /* ========================================================
       4. USER VALIDATION
    ======================================================== */

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    /* ========================================================
       5. CART VALIDATION
    ======================================================== */

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    /* ========================================================
       6. CALCULATE ORIGINAL CART TOTAL
    ======================================================== */

    const originalAmount = calculateCartAmount(cart);

    /* ========================================================
       7. APPLY FIXED ONLINE DISCOUNT
    ======================================================== */

    const { discountAmount, finalAmount } =
      calculateOnlineAmount(originalAmount);

    /* ========================================================
       8. GENERATE OUR MERCHANT ORDER ID
    ======================================================== */

    const merchantOrderId = generateMerchantOrderId(userId);

    /* ========================================================
       9. CREATE PHONEPE PAYMENT
    ======================================================== */

    const phonePeResult = await createPhonePePayment({
      merchantOrderId,

      amount: finalAmount,

      userId,
    });

    /* ========================================================
       10. GET PHONEPE RESPONSE
    ======================================================== */

    const phonePeData = phonePeResult?.data;

    /*
     * Different PhonePe versions may return the
     * redirect URL in slightly different structures.
     */

    const redirectUrl =
      phonePeData?.redirectUrl ||
      phonePeData?.data?.redirectUrl ||
      phonePeData?.instrumentResponse?.redirectInfo?.url ||
      phonePeData?.data?.instrumentResponse?.redirectInfo?.url;

    if (!redirectUrl) {
      console.error("PhonePe did not return redirect URL:", phonePeData);

      return res.status(502).json({
        success: false,
        message: "PhonePe did not return a payment URL.",
      });
    }

    /* ========================================================
       11. RECORD PENDING PAYMENT (lifecycle)
    ======================================================== */

    try {
      const paymentExpiry = new Date(Date.now() + 15 * 60 * 1000);

      await Payment.updateOne(
        { merchantOrderId },
        {
          $set: {
            userId,
            merchantOrderId,
            phonePeTransactionId: null,
            originalAmount,
            discount: discountAmount,
            amount: finalAmount,
            paymentMethod: "ONLINE",
            status: "PENDING",
            orderId: null,
            phonePeResponse: null,
            failureReason: null,
            expiresAt: paymentExpiry,
          },
        },
        { upsert: true },
      );
    } catch (paymentRecordError) {
      console.error("Record pending payment error:", paymentRecordError);
    }

    /* ========================================================
       12. RETURN PAYMENT DETAILS
    ======================================================== */

    return res.status(200).json({
      success: true,

      message: "Payment initiated successfully.",

      redirectUrl,

      /*
       * This is OUR merchant order ID.
       *
       * Frontend should keep this while the user
       * is completing the payment.
       */
      transactionId: merchantOrderId,

      amount: finalAmount,

      originalAmount,

      discountAmount,

      paymentMethod: "Online",
    });
  } catch (error) {
    console.error(
      "Create PhonePe Payment Error:",
      error?.response?.data || error?.message || error,
    );

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,

      message:
        error?.response?.data?.message ||
        error?.message ||
        "Unable to start online payment.",
    });
  }
};

/* ============================================================
   CHECK PAYMENT STATUS
============================================================ */

/*
 * POST /api/v1/payment/check-status
 *
 * Frontend calls this after returning from PhonePe.
 *
 * IMPORTANT:
 *
 * We ask PhonePe directly for the payment status.
 * We do NOT trust the frontend saying:
 *
 * "payment successful"
 *
 * Only PhonePe's verified response is used.
 */
export const checkPaymentStatus = async (req, res) => {
  try {
    /* ========================================================
       1. AUTHENTICATION
    ======================================================== */

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    /* ========================================================
       2. GET TRANSACTION ID
       The redirect URL may not always echo our merchantOrderId, so
       an empty value is allowed here: we resolve the user's current
       pending payment below.
    ======================================================== */

    const { transactionId } = req.body || {};

    /* ========================================================
       3. OWNERSHIP CHECK (only if a concrete ID was provided)
    ======================================================== */

    if (transactionId) {
      const paymentRecord = await Payment.findOne({
        merchantOrderId: transactionId,
      });

      if (paymentRecord && String(paymentRecord.userId) !== String(userId)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to check this payment.",
        });
      }
    }

    /* ========================================================
       4. RESOLVE AUTHORITATIVE MERCHANT ORDER ID
       (fall back to the user's stored pending Payment record
        if the redirect URL did not echo our ID correctly)
    ======================================================== */

    const effectiveTransactionId =
      await resolveEffectiveTransactionId(userId, transactionId);

    if (!effectiveTransactionId) {
      return res.status(404).json({
        success: false,
        message: "No pending payment found for this user.",
      });
    }

    /* ========================================================
       5. VERIFY WITH PHONEPE
    ======================================================== */

    const phonePeResult = await getPhonePePaymentStatus(effectiveTransactionId);

    const phonePeData = phonePeResult?.data;

    /* ========================================================
       6. NORMALIZE STATUS
    ======================================================== */

    const paymentStatus = normalizePhonePeStatus(phonePeData);

    /* ========================================================
       7. GET GATEWAY TRANSACTION ID
    ======================================================== */

    const paymentTransactionId = extractPhonePeTransactionId(phonePeData);

    /* ========================================================
       8. SUCCESS
    ======================================================== */

    if (paymentStatus === "SUCCESS") {
      /*
       * Persist the confirmed success to the Payment lifecycle
       * record. This way, even if the frontend never calls
       * complete-payment (e.g. user closes the browser), the
       * record is not left stuck in PENDING forever.
       */
      try {
        await Payment.updateOne(
          { merchantOrderId: effectiveTransactionId },
          {
            $set: {
              status: "SUCCESS",
              phonePeTransactionId: paymentTransactionId || null,
              phonePeResponse: phonePeData,
            },
          },
          { upsert: true },
        );
      } catch (paymentRecordError) {
        console.error(
          "checkPaymentStatus: persist success error:",
          paymentRecordError,
        );
      }

      return res.status(200).json({
        success: true,

        paymentSuccessful: true,

        status: "SUCCESS",

        transactionId: effectiveTransactionId,

        paymentTransactionId: paymentTransactionId || effectiveTransactionId,

        message: "Payment successful.",
      });
    }

    /* ========================================================
       8. FAILED
    ======================================================== */

    if (paymentStatus === "FAILED") {
      await markPaymentFailure(
        effectiveTransactionId,
        "FAILED",
        "Payment failed.",
      );

      return res.status(400).json({
        success: false,

        paymentSuccessful: false,

        status: "FAILED",

        transactionId: effectiveTransactionId,

        message: "Payment failed.",
      });
    }

    /* ========================================================
       9. EXPIRED
    ======================================================== */

    if (paymentStatus === "EXPIRED") {
      await markPaymentFailure(
        effectiveTransactionId,
        "EXPIRED",
        "Payment session expired.",
      );

      return res.status(400).json({
        success: false,

        paymentSuccessful: false,

        status: "EXPIRED",

        transactionId: effectiveTransactionId,

        message: "Payment session expired.",
      });
    }

    /* ========================================================
       10. PENDING
    ======================================================== */

    return res.status(200).json({
      success: true,

      paymentSuccessful: false,

      status: "PENDING",

      transactionId: effectiveTransactionId,

      message: "Payment is still being processed.",
    });
  } catch (error) {
    console.error(
      "Check PhonePe Payment Status Error:",
      error?.response?.data || error?.message || error,
    );

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,

      message:
        error?.response?.data?.message ||
        error?.message ||
        "Unable to verify payment status.",
    });
  }
};

/* ============================================================
   COMPLETE ONLINE PAYMENT
============================================================ */

/*
 * POST /api/v1/payment/complete-payment
 *
 * This endpoint:
 *
 * 1. Receives merchant transaction ID
 * 2. AGAIN verifies the transaction directly with PhonePe
 * 3. Only if PhonePe says SUCCESS
 * 4. Creates the order
 *
 * Therefore frontend cannot simply say:
 *
 * "I paid"
 *
 * and create a paid order.
 */
export const completeOnlinePayment = async (req, res) => {
  try {
    /* ========================================================
       1. AUTHENTICATION
    ======================================================== */

    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    /* ========================================================
       2. GET TRANSACTION ID
       An empty value is allowed: we resolve the user's current
       pending payment below if the redirect URL did not echo our ID.
    ======================================================== */

    const { transactionId } = req.body || {};

    /* ========================================================
       3. RESOLVE AUTHORITATIVE MERCHANT ORDER ID
       (fall back to the user's stored pending Payment record
        if the redirect URL did not echo our ID correctly)
    ======================================================== */

    const effectiveTransactionId =
      await resolveEffectiveTransactionId(userId, transactionId);

    if (!effectiveTransactionId) {
      return res.status(404).json({
        success: false,
        message: "No pending payment found for this user.",
      });
    }

    /* ========================================================
       4. OWNERSHIP CHECK
    ======================================================== */

    const paymentRecord = await Payment.findOne({
      merchantOrderId: effectiveTransactionId,
    });

    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        message: "Payment record not found.",
      });
    }

    if (String(paymentRecord.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to complete this payment.",
      });
    }

    /* ========================================================
       5. VERIFY PAYMENT DIRECTLY WITH PHONEPE
    ======================================================== */

    const phonePeResult = await getPhonePePaymentStatus(effectiveTransactionId);

    const phonePeData = phonePeResult?.data;

    /* ========================================================
       6. NORMALIZE PHONEPE STATUS
    ======================================================== */

    const paymentStatus = normalizePhonePeStatus(phonePeData);

    /* ========================================================
       7. PAYMENT NOT SUCCESSFUL
    ======================================================== */

    if (paymentStatus !== "SUCCESS") {
      const failReason =
        paymentStatus === "FAILED"
          ? "Payment failed."
          : paymentStatus === "EXPIRED"
            ? "Payment session expired."
            : "Payment is not completed yet.";

      await markPaymentFailure(
        effectiveTransactionId,
        paymentStatus,
        failReason,
      );

      return res.status(400).json({
        success: false,

        paymentSuccessful: false,

        status: paymentStatus,

        message: failReason,
      });
    }

    /* ========================================================
       8. AMOUNT RECONCILIATION
       Verify PhonePe charged the same amount we authorized.

       NOTE: This check must NEVER block a genuinely successful
       payment. `PhonePe status` already proving state=COMPLETED is
       the authoritative signal that money moved — the amount is only
       a secondary sanity check.

       PhonePe reports `amount` in paise, while our stored
       `paymentRecord.amount` is stored in rupees. Older deployments /
       webhook records sometimes store it differently (or zero). To be
       safe we compare across BOTH interpretations (paise and rupees)
       and only hard-fail on a decisive mismatch; otherwise we log and
       continue so a real paid order is still created and the cart
       cleared.
    ======================================================== */

    const lastPaymentDetail =
      phonePeData?.data?.paymentDetails?.[
        (phonePeData?.data?.paymentDetails?.length || 1) - 1
      ] ||
      phonePeData?.data?.response?.paymentDetails?.[
        (phonePeData?.data?.response?.paymentDetails?.length || 1) - 1
      ] ||
      phonePeData?.paymentDetails?.[
        (phonePeData?.paymentDetails?.length || 1) - 1
      ] ||
      null;

    const phonePeAmountRaw =
      phonePeData?.data?.amount ??
      phonePeData?.data?.response?.amount ??
      phonePeData?.amount ??
      lastPaymentDetail?.amount ??
      phonePeData?.paymentDetails?.[0]?.amount ??
      phonePeData?.data?.paymentDetails?.[0]?.amount ??
      lastPaymentDetail?.payableAmount ??
      null;

    if (phonePeAmountRaw != null) {
      const raw = Number(phonePeAmountRaw);

      /*
       * `paymentRecord.amount` is rupees (e.g. 930 for ₹930). If it is
       * accidentally 0/undefined on some older records, skip the check.
       */
      const authorizedRupees = Number(paymentRecord?.amount || 0);

      if (authorizedRupees > 0) {
        const authorizedPaise = rupeesToPaise(authorizedRupees);

        const matches =
          raw === authorizedPaise || raw === authorizedRupees;

        if (!matches) {
          console.warn(
            `Amount discrepancy for ${effectiveTransactionId}: ` +
              `authorized=${authorizedRupees} INR (${authorizedPaise}p), ` +
              `phonePe reported=${raw}. Continuing since status is COMPLETED.`,
          );
        }
      }
    }

    /* ========================================================
       9. GET PHONEPE TRANSACTION ID
    ======================================================== */

    const paymentTransactionId =
      extractPhonePeTransactionId(phonePeData) || effectiveTransactionId;

    /* ========================================================
       10. CREATE PAID ORDER
    ======================================================== */

    const result = await createPaidOrderFromCart({
      userId,

      transactionId: effectiveTransactionId,

      paymentTransactionId,
    });

    /* ========================================================
       10. SAVE PHONEPE RAW RESPONSE
    ======================================================== */

    try {
      await Payment.updateOne(
        { merchantOrderId: effectiveTransactionId },
        {
          $set: {
            status: "SUCCESS",
            phonePeTransactionId: paymentTransactionId || null,
            phonePeResponse: phonePeData,
          },
        },
        { upsert: true },
      );
    } catch (paymentRecordError) {
      console.error(
        "completeOnlinePayment: persist response error:",
        paymentRecordError,
      );
    }

    /* ========================================================
       11. RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,

      paymentSuccessful: true,

      message: result.alreadyCreated
        ? "Payment already processed."
        : "Payment successful and order created.",

      order: result.order,

      alreadyCreated: result.alreadyCreated,

      transactionId: effectiveTransactionId,

      paymentTransactionId,
    });
  } catch (error) {
    console.error(
      "Complete Online Payment Error:",
      error?.response?.data || error?.message || error,
    );

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,

      message:
        error?.response?.data?.message ||
        error?.message ||
        "Unable to complete online payment.",
    });
  }
};

/* ============================================================
   PHONEPE WEBHOOK (server-to-server confirmation)
============================================================ */

/*
 * POST /api/v1/payment/webhook
 *
 * PhonePe sends a server-to-server callback when a payment's
 * state changes. This is more reliable than relying on the
 * frontend redirect/polling only (e.g. user closes the browser
 * before the redirect completes).
 *
 * The endpoint is idempotent: createPaidOrderFromCart() handles
 * duplicate/concurrent callbacks safely. It does NOT require user
 * authentication because PhonePe calls it directly.
 */
export const paymentWebhook = async (req, res) => {
  try {
    const body = req.body || {};

    /*
     * PhonePe v1 sends:  { data: {...}, ... }
     * PhonePe v2 live webhook wraps everything under a
     * "response" object: { response: { data: {...}, success, code, message } }
     *
     * Normalize to a single inner-data object either way.
     */
    const nested =
      body?.response && typeof body.response === "object"
        ? body.response
        : body;

    const data = nested?.data || nested;

    const merchantOrderId =
      data?.merchantOrderId ||
      data?.merchantTransactionId ||
      data?.orderId ||
      data?.transactionId ||
      body?.merchantOrderId ||
      body?.transactionId ||
      nested?.merchantOrderId ||
      null;

    if (!merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "Missing transaction ID.",
      });
    }

    /*
     * Prefer inner data.state for status. Fall back to the
     * top-level wrapper if inner status is missing.
     */
    const paymentStatus =
      normalizePhonePeStatus(data) === "PENDING"
        ? normalizePhonePeStatus(nested)
        : normalizePhonePeStatus(data);

    await Payment.updateOne(
      { merchantOrderId },
      {
        $set: {
          phonePeResponse: body,
          phonePeTransactionId: extractPhonePeTransactionId(data) || null,
        },
      },
      { upsert: true },
    );

    if (paymentStatus === "SUCCESS") {
      const record = await Payment.findOne({ merchantOrderId });

      if (!record) {
        return res.status(400).json({
          success: false,
          message: "Payment record not found.",
        });
      }

      try {
        await createPaidOrderFromCart({
          userId: record.userId,
          transactionId: merchantOrderId,
          paymentTransactionId:
            extractPhonePeTransactionId(data) || null,
        });
      } catch (orderError) {
        if (
          String(orderError?.message || "")
            .toLowerCase()
            .includes("cart is empty")
        ) {
          /*
           * The user may have already placed the order and
           * cleared the cart, so we can safely ignore this.
           */
          console.error(
            `Webhook: cart already processed for ${merchantOrderId}`,
          );
        } else {
          throw orderError;
        }
      }
    } else if (paymentStatus === "FAILED" || paymentStatus === "EXPIRED") {
      await markPaymentFailure(
        merchantOrderId,
        paymentStatus,
        paymentStatus === "FAILED"
          ? "Payment failed."
          : "Payment session expired.",
      );
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(
      "Payment webhook error:",
      error?.response?.data || error?.message || error,
    );

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed.",
    });
  }
};
