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

    originalTotalAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

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
     * Only ONLINE orders need a transactionId.
     *
     * COD orders do not have a transactionId.
     *
     * sparse + unique means:
     *
     * COD:
     * transactionId -> null / missing
     *
     * ONLINE:
     * transactionId -> unique value
     */

    transactionId: {
      type: String,

      default: undefined,

      unique: true,

      sparse: true,

      trim: true,
    },

    /*
     * Gateway transaction/reference ID.
     *
     * Populated after PhonePe returns
     * the actual gateway transaction ID.
     */

    paymentTransactionId: {
      type: String,

      default: undefined,

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
 * Find today's orders for a user.
 */

orderSchema.index({
  userId: 1,
  status: 1,
  isTodayOrder: 1,
  createdAt: -1,
});

/*
 * Admin "today's Approved orders" daily rollup.
 */

orderSchema.index({
  status: 1,
  createdAt: -1,
});

/*
 * Admin date-filtered order list.
 */

orderSchema.index({
  createdAt: -1,
});

/*
 * User order history (sorted newest first).
 */

orderSchema.index({
  userId: 1,
  createdAt: -1,
});

/*
 * IMPORTANT:
 *
 * transactionId must be unique ONLY when it exists.
 *
 * Multiple COD orders can therefore exist without
 * transactionId.
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
