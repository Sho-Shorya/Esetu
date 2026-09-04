import mongoose from "mongoose";

const scheduledNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    recipientType: {
      type: String,
      enum: ["all", "custom"],
      required: true,
      default: "all",
    },

    recipientUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    scheduledAt: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "sent", "cancelled"],
      default: "pending",
    },

    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

scheduledNotificationSchema.index({ status: 1, scheduledAt: 1 });

/*
Auto-delete sent/cancelled notifications
after 1 hour to keep database clean.
Only pending notifications are kept.
TTL index runs on "updatedAt" field.
*/
scheduledNotificationSchema.index(
  { updatedAt: 1 },
  {
    expireAfterSeconds: 3600,
    partialFilterExpression: {
      status: { $in: ["sent", "cancelled"] },
    },
  },
);

export default mongoose.model(
  "ScheduledNotification",
  scheduledNotificationSchema,
);
