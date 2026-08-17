import mongoose from "mongoose";

/* ============================================================
   ORDER ITEM
============================================================ */

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    /* Product snapshot */

    name: {
      type: String,
      required: true,
    },

    hinglishName: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    /* Company snapshot */

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    companyName: {
      type: String,
      default: "",
    },

    /* Category snapshot */

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    categoryName: {
      type: String,
      default: "",
    },

    /* Variant */

    measurement: {
      type: String,
      required: true,
    },

    qty: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
  },
);

/* ============================================================
   ORDER
============================================================ */

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Preparing",
        "Out For Delivery",
        "Delivered",
        "Cancelled",
        "Declined",
      ],
      default: "Pending",
    },

    shippingAddress: {
      type: String,
      default: "",
    },

    /* ========================================================
       PAYMENT
    ======================================================== */

    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },

    paymentPaidAt: {
      type: Date,
      default: null,
    },

    /* ========================================================
       ORDER EDIT TRACKING
    ======================================================== */

    modificationCount: {
      type: Number,
      default: 0,
    },

    lastModifiedAt: {
      type: Date,
      default: null,
    },

    /* ========================================================
       TODAY ORDER
    ======================================================== */

    isTodayOrder: {
      type: Boolean,
      default: true,
    },

    cutoffTime: {
      type: Date,
      required: true,
    },

    /* ========================================================
       STATUS TIMES
    ======================================================== */

    approvedAt: {
      type: Date,
      default: null,
    },

    deliveredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    declinedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const Order = mongoose.model("Order", orderSchema);
