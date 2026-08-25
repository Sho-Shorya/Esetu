import mongoose from "mongoose";

/* ============================================================
   ORDER ITEM SCHEMA
============================================================ */

const orderItemSchema = new mongoose.Schema(
  {
    /* ========================================================
       PRODUCT
    ======================================================== */

    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    /* ========================================================
       PRODUCT SNAPSHOT
    ======================================================== */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    hinglishName: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    /* ========================================================
       COMPANY SNAPSHOT
    ======================================================== */

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },

    companyName: {
      type: String,
      default: "",
      trim: true,
    },

    /* ========================================================
       CATEGORY SNAPSHOT
    ======================================================== */

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    categoryName: {
      type: String,
      default: "",
      trim: true,
    },

    /* ========================================================
       VARIANT
    ======================================================== */

    measurement: {
      type: String,
      required: true,
      trim: true,
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
   ORDER SCHEMA
============================================================ */

const orderSchema = new mongoose.Schema(
  {
    /* ========================================================
       USER
    ======================================================== */

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ========================================================
       ITEMS
    ======================================================== */

    items: {
      type: [orderItemSchema],
      default: [],
    },

    /* ========================================================
       AMOUNTS
    ======================================================== */

    /*
     * Original amount before online discount.
     *
     * Example:
     *
     * Cart = ₹1000
     *
     * originalTotalAmount = 1000
     */

    originalTotalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    /*
     * Discount given for online payment.
     *
     * Example:
     *
     * ₹1000 × 2% = ₹20
     */

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
     * Final payable amount.
     *
     * COD:
     * ₹1000
     *
     * ONLINE:
     * ₹980
     */

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    /* ========================================================
       ORDER STATUS
    ======================================================== */

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

      index: true,
    },

    /* ========================================================
       SHIPPING
    ======================================================== */

    shippingAddress: {
      type: String,
      default: "",
      trim: true,
    },

    /* ========================================================
       PAYMENT METHOD
    ======================================================== */

    paymentMethod: {
      type: String,

      enum: ["COD", "Online"],

      default: "COD",

      index: true,
    },

    /* ========================================================
       PAYMENT STATUS
    ======================================================== */

    paymentStatus: {
      type: String,

      enum: ["Pending", "Paid"],

      default: "Pending",

      index: true,
    },

    /* ========================================================
       PAYMENT TRANSACTION
    ======================================================== */

    /*
     * Your own unique payment transaction ID.
     *
     * Example:
     *
     * ESETU_1756123456789_123456_A1B2C3D4
     *
     * This is generated BEFORE sending the
     * payment request to PhonePe.
     */

    transactionId: {
      type: String,

      default: null,

      unique: true,

      sparse: true,

      index: true,

      trim: true,
    },

    /*
     * Gateway transaction/reference ID.
     *
     * This is populated after PhonePe gives
     * us the actual gateway transaction ID.
     */

    paymentTransactionId: {
      type: String,

      default: null,

      index: true,

      trim: true,
    },

    /*
     * Time at which payment was successfully
     * verified.
     */

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

      min: 0,
    },

    lastModifiedAt: {
      type: Date,

      default: null,
    },

    /* ========================================================
       TODAY'S ORDER
    ======================================================== */

    isTodayOrder: {
      type: Boolean,

      default: true,

      index: true,
    },

    /*
     * User can modify today's order only
     * before this cutoff time.
     */

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

/* ============================================================
   INDEXES
============================================================ */

/*
 * Find today's pending order for a user.
 */

orderSchema.index({
  userId: 1,
  status: 1,
  isTodayOrder: 1,
  createdAt: -1,
});

/*
 * Payment lookup.
 *
 * transactionId already has an index because
 * of `index: true`, but keeping the explicit
 * unique sparse index here makes the intention
 * very clear.
 */

orderSchema.index(
  {
    transactionId: 1,
  },
  {
    unique: true,
    sparse: true,
  },
);

/*
 * Useful for finding gateway transactions.
 */

orderSchema.index({
  paymentTransactionId: 1,
});

/* ============================================================
   MODEL
============================================================ */

export const Order = mongoose.model("Order", orderSchema);
