import express from "express";

import {
  createPayment,
  checkPaymentStatus,
  completeOnlinePayment,
  paymentWebhook,
} from "../controllers/paymentController.js";

import { isAuthenticated } from "../middleware/isAuthenticated.js";

const paymentRouter = express.Router();

/* ============================================================
   CREATE ONLINE PAYMENT
============================================================ */

/*
 * POST /api/v1/payment/create-payment
 *
 * User clicks:
 * Online → Pay
 *
 * Backend:
 * 1. Authenticates user
 * 2. Reads user's cart
 * 3. Calculates cart total
 * 4. Applies fixed online discount (₹5/₹10/₹20/₹30)
 * 5. Creates PhonePe payment
 * 6. Returns PhonePe redirect URL
 *
 * IMPORTANT:
 * No order is created here.
 */

paymentRouter.post("/create-payment", isAuthenticated, createPayment);

/* ============================================================
   CHECK PAYMENT STATUS
============================================================ */

/*
 * POST /api/v1/payment/check-status
 *
 * Called after the user returns from PhonePe.
 *
 * Backend asks PhonePe for the REAL payment status.
 *
 * The frontend cannot declare a payment successful
 * by itself.
 */

paymentRouter.post("/check-status", isAuthenticated, checkPaymentStatus);

/* ============================================================
   COMPLETE ONLINE PAYMENT
============================================================ */

/*
 * POST /api/v1/payment/complete-payment
 *
 * Backend verifies the payment AGAIN with PhonePe.
 *
 * Only after PhonePe confirms SUCCESS:
 *
 *    PhonePe SUCCESS
 *          ↓
 *    createPaidOrderFromCart()
 *          ↓
 *    Order created
 *          ↓
 *    Cart cleared
 *
 * This prevents fake paid orders.
 */

paymentRouter.post("/complete-payment", isAuthenticated, completeOnlinePayment);

/* ============================================================
   PHONEPE WEBHOOK
============================================================ */

/*
 * POST /api/v1/payment/webhook
 *
 * PhonePe server-to-server callback for payment state changes.
 *
 * IMPORTANT: NOT user authenticated. PhonePe calls it directly.
 * Configure the PhonePe webhook URL to:
 *
 *   https://your-backend.railway.app/api/v1/payment/webhook
 */

paymentRouter.post("/webhook", paymentWebhook);

export default paymentRouter;
