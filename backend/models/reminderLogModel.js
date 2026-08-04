import mongoose from "mongoose";

const reminderLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      ],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// One reminder of a type per user per day
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

export default mongoose.model("ReminderLog", reminderLogSchema);
