import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Product snapshot
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

    // Company snapshot
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
    },

    companyName: {
      type: String,
      default: "",
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    categoryName: {
      type: String,
      default: "",
    },

    // Variant
    measurement: {
      type: String,
      required: true,
    },

    qty: {
      type: Number,
      required: true,
      default: 1,
    },
    price: {
      type: Number,
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
  },
  {
    _id: true,
  },
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    items: [orderItemSchema],

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

    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      default: "COD",
    },

    // Active today's order
    isTodayOrder: {
      type: Boolean,
      default: true,
    },

    // User can edit before this
    cutoffTime: {
      type: Date,
      required: true,
    },

    approvedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    declinedAt: Date,
  },
  {
    timestamps: true,
  },
);

export const Order = mongoose.model("Order", orderSchema);
