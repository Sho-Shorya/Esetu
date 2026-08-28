import mongoose from "mongoose";

/*
====================================================
ORDER RECEIPT SCHEMA
====================================================

A per-order receipt that the admin generates manually
from the Money Control page.

This is separate from the DailyInvoice (which aggregated
an entire day). One order can have one receipt.
====================================================
*/

const orderReceiptSchema = new mongoose.Schema(
  {
    /* ====================================================
       ORDER
    ==================================================== */

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },

    /* ====================================================
       USER
    ==================================================== */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ====================================================
       RECEIPT NUMBER
    ==================================================== */

    receiptNumber: {
      type: String,
      required: true,
      trim: true,
    },

    /* ====================================================
       AMOUNT SNAPSHOT
    ==================================================== */

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /* ====================================================
       STATUS
    ==================================================== */

    /*
     * Generated = receipt exists but user not notified
     * Notified  = receipt generated + OneSignal push sent
     */
    status: {
      type: String,
      enum: ["Generated", "Notified"],
      default: "Generated",
    },

    /* ====================================================
       TIMESTAMPS
    ==================================================== */

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    notifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const OrderReceipt = mongoose.model(
  "OrderReceipt",
  orderReceiptSchema,
);
