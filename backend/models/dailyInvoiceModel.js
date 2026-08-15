import mongoose from "mongoose";

const invoiceItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    hinglishName: {
      type: String,
      default: "",
    },

    companyName: {
      type: String,
      default: "",
    },

    measurement: {
      type: String,
      required: true,
    },

    qty: {
      type: Number,
      required: true,
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
    _id: false,
  },
);

const dailyInvoiceSchema = new mongoose.Schema(
  {
    // Shopkeeper who owns this invoice
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // All approved orders included in this invoice
    orderIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],

    // YYYY-MM-DD in Asia/Kolkata
    dateKey: {
      type: String,
      required: true,
    },

    items: [invoiceItemSchema],

    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },

    totalOrders: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Generated", "WhatsApp Sent", "Failed"],
      default: "Generated",
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    whatsappSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// VERY IMPORTANT
// One shopkeeper can have only ONE daily invoice.
dailyInvoiceSchema.index(
  {
    userId: 1,
    dateKey: 1,
  },
  {
    unique: true,
  },
);

export const DailyInvoice = mongoose.model("DailyInvoice", dailyInvoiceSchema);
