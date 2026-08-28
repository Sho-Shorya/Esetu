import { Cart } from "../models/cartModel.js";
import { User } from "../models/userModel.js";
import Payment from "../models/paymentModel.js";

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

const ONLINE_DISCOUNT_PERCENT = 2;

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
 * Calculate the online payment amount.
 *
 * Example:
 *
 * Cart = ₹1000
 * Discount = ₹20
 * Pay = ₹980
 */
const calculateOnlineAmount = (amount) => {
  const originalAmount = Number(amount);

  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  const discountAmount = Number(
    ((originalAmount * ONLINE_DISCOUNT_PERCENT) / 100).toFixed(2),
  );

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
 * 2% discount
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
       2. PHONEPE CONFIGURATION
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
       3. GET CART + USER
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
       7. APPLY 2% ONLINE DISCOUNT
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
    ======================================================== */

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required.",
      });
    }

    /* ========================================================
       3. OWNERSHIP CHECK
    ======================================================== */

    const paymentRecord = await Payment.findOne({
      merchantOrderId: transactionId,
    });

    if (paymentRecord && String(paymentRecord.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to check this payment.",
      });
    }

    /* ========================================================
       4. VERIFY WITH PHONEPE
    ======================================================== */

    const phonePeResult = await getPhonePePaymentStatus(transactionId);

    const phonePeData = phonePeResult?.data;

    /* ========================================================
       5. NORMALIZE STATUS
    ======================================================== */

    const paymentStatus = normalizePhonePeStatus(phonePeData);

    /* ========================================================
       6. GET GATEWAY TRANSACTION ID
    ======================================================== */

    const paymentTransactionId = extractPhonePeTransactionId(phonePeData);

    /* ========================================================
       7. SUCCESS
    ======================================================== */

    if (paymentStatus === "SUCCESS") {
      return res.status(200).json({
        success: true,

        paymentSuccessful: true,

        status: "SUCCESS",

        transactionId,

        paymentTransactionId: paymentTransactionId || transactionId,

        message: "Payment successful.",
      });
    }

    /* ========================================================
       8. FAILED
    ======================================================== */

    if (paymentStatus === "FAILED") {
      await markPaymentFailure(transactionId, "FAILED", "Payment failed.");

      return res.status(400).json({
        success: false,

        paymentSuccessful: false,

        status: "FAILED",

        transactionId,

        message: "Payment failed.",
      });
    }

    /* ========================================================
       9. EXPIRED
    ======================================================== */

    if (paymentStatus === "EXPIRED") {
      await markPaymentFailure(transactionId, "EXPIRED", "Payment session expired.");

      return res.status(400).json({
        success: false,

        paymentSuccessful: false,

        status: "EXPIRED",

        transactionId,

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

      transactionId,

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
    ======================================================== */

    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required.",
      });
    }

    /* ========================================================
       3. OWNERSHIP CHECK
    ======================================================== */

    const paymentRecord = await Payment.findOne({
      merchantOrderId: transactionId,
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
       4. VERIFY PAYMENT DIRECTLY WITH PHONEPE
    ======================================================== */

    const phonePeResult = await getPhonePePaymentStatus(transactionId);

    const phonePeData = phonePeResult?.data;

    /* ========================================================
       5. NORMALIZE PHONEPE STATUS
    ======================================================== */

    const paymentStatus = normalizePhonePeStatus(phonePeData);

    /* ========================================================
       6. PAYMENT NOT SUCCESSFUL
    ======================================================== */

    if (paymentStatus !== "SUCCESS") {
      const failReason =
        paymentStatus === "FAILED"
          ? "Payment failed."
          : paymentStatus === "EXPIRED"
            ? "Payment session expired."
            : "Payment is not completed yet.";

      await markPaymentFailure(transactionId, paymentStatus, failReason);

      return res.status(400).json({
        success: false,

        paymentSuccessful: false,

        status: paymentStatus,

        message: failReason,
      });
    }

    /* ========================================================
       7. AMOUNT RECONCILIATION
       Verify PhonePe charged the same amount we authorized.
    ======================================================== */

    const phonePeAmountPaise =
      phonePeData?.amount ||
      phonePeData?.paymentDetails?.[0]?.amount ||
      phonePeData?.data?.amount ||
      null;

    if (phonePeAmountPaise != null) {
      const authorizedPaise = rupeesToPaise(paymentRecord.amount);

      if (Number(phonePeAmountPaise) !== authorizedPaise) {
        console.error(
          `Amount mismatch for ${transactionId}: authorized=${authorizedPaise}p, charged=${phonePeAmountPaise}p`,
        );

        await markPaymentFailure(
          transactionId,
          "FAILED",
          `Amount mismatch: expected ${authorizedPaise}p, got ${phonePeAmountPaise}p`,
        );

        return res.status(400).json({
          success: false,
          message: "Payment amount mismatch. Please contact support.",
        });
      }
    }

    /* ========================================================
       8. GET PHONEPE TRANSACTION ID
    ======================================================== */

    const paymentTransactionId =
      extractPhonePeTransactionId(phonePeData) || transactionId;

    /* ========================================================
       9. CREATE PAID ORDER
    ======================================================== */

    const result = await createPaidOrderFromCart({
      userId,

      transactionId,

      paymentTransactionId,
    });

    /* ========================================================
       8. RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,

      paymentSuccessful: true,

      message: result.alreadyCreated
        ? "Payment already processed."
        : "Payment successful and order created.",

      order: result.order,

      alreadyCreated: result.alreadyCreated,

      transactionId,

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
