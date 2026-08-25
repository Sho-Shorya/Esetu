import mongoose from "mongoose";

const reminderLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    date: {
      type: String,
      required: true,
    },

    reminderType: {
      type: String,
      enum: [
        "1hour-no-order",
        "30min-no-order",
        "10min-no-order",
        "10min-edit-order",
        "daily-receipt",
      ],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

/*
One reminder of the same type
per user per day.
*/
reminderLogSchema.index(
  {
    userId: 1,
    date: 1,
    reminderType: 1,
  },
  {
    unique: true,
  },
);

/*
Automatically delete reminder logs
after 7 days.

604800 seconds = 7 days.
*/
reminderLogSchema.index(
  {
    createdAt: 1,
  },
  {
    expireAfterSeconds: 604800,
  },
);

export default mongoose.model("ReminderLog", reminderLogSchema);
