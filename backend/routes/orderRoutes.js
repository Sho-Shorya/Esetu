import express from "express";

import {
  addOrder,
  getTodayOrders,
  getAllOrders,
  getOrdersByUser,
  setOrderCutoffTime,
  getOrderHistory,
  removeOrderItem,
  updateMyOrderItems,
  updateOrderStatus,
  updateOrderItems,
  markOrderPaymentPaid,
  markOrderPaymentPending,
  getDailyApprovedItems,
  generateOrderReceipt,
  getOrderReceipt,
  downloadOrderReceiptPdf,
  getMyOrderReceipts,
} from "../controllers/orderController.js";

import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";

const router = express.Router();

/* ============================================================
                        USER
============================================================ */

router.post("/add-order", isAuthenticated, addOrder);

router.get("/today-orders", isAuthenticated, getTodayOrders);

router.get("/order-history", isAuthenticated, getOrderHistory);

router.delete(
  "/remove-item/:orderId/:itemId",
  isAuthenticated,
  removeOrderItem,
);

router.put(
  "/user/update-items/:orderId",
  isAuthenticated,
  updateMyOrderItems,
);

/* ============================================================
                        ADMIN
============================================================ */

router.put(
  "/update-status/:orderId",
  isAuthenticated,
  isSupp,
  updateOrderStatus,
);

router.put("/set-cutoff/:orderId", isAuthenticated, isSupp, setOrderCutoffTime);

/* ============================================================
                        ALL ORDERS
============================================================ */

router.get("/all-orders", isAuthenticated, isSupp, getAllOrders);

router.get("/user-orders/:userId", isAuthenticated, isSupp, getOrdersByUser);

/* ============================================================
                     ADMIN - PAYMENT
============================================================ */
router.get(
  "/daily-approved-items",
  isAuthenticated,
  isSupp,
  getDailyApprovedItems,
);

router.put(
  "/payment/:orderId/paid",
  isAuthenticated,
  isSupp,
  markOrderPaymentPaid,
);

router.put(
  "/payment/:orderId/pending",
  isAuthenticated,
  isSupp,
  markOrderPaymentPending,
);

/* ============================================================
                     RECEIPTS
============================================================ */

router.post("/receipt/generate", isAuthenticated, isSupp, generateOrderReceipt);

router.get("/receipt/:orderId", isAuthenticated, getOrderReceipt);

router.get(
  "/receipt/:orderId/pdf",
  isAuthenticated,
  downloadOrderReceiptPdf,
);

router.get("/my-receipts", isAuthenticated, getMyOrderReceipts);

/* ============================================================
                     ADMIN - EDIT ORDER
============================================================ */

router.put("/update-items/:orderId", isAuthenticated, isSupp, updateOrderItems);

export default router;
