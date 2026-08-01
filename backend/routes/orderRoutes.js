import express from "express";

import {
  addOrder,
  getTodayOrders,
  getAllOrders,
  getOrdersByUser,
  setOrderCutoffTime,
  getOrderHistory,
  removeOrderItem,
  updateOrderStatus,
} from "../controllers/orderController.js";

import { isAuthenticated, isSupp } from "../middleware/isAuthenticated.js";

const router = express.Router();

/* ============================================
                USER
============================================ */

router.post("/add-order", isAuthenticated, addOrder);

router.get("/today-orders", isAuthenticated, getTodayOrders);

router.get("/order-history", isAuthenticated, getOrderHistory);

router.delete(
  "/remove-item/:orderId/:itemId",
  isAuthenticated,
  removeOrderItem,
);

/* ============================================
                ADMIN
============================================ */

router.put(
  "/update-status/:orderId",
  isAuthenticated,
  isSupp,
  updateOrderStatus,
);

router.put("/set-cutoff/:orderId", isAuthenticated, isSupp, setOrderCutoffTime);

router.get("/all-orders", isAuthenticated, isSupp, getAllOrders);
router.get("/user-orders/:userId", isAuthenticated, isSupp, getOrdersByUser);

export default router;
