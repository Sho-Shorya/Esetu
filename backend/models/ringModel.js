import mongoose from "mongoose";

const ringSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ["all", "morning", "evening", "custom"],
      required: true,
    },

    recipientUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    message: {
      type: String,
      default: "अभी ऑर्डर करें!",
    },
  },
  {
    timestamps: true,
  },
);

/*
Auto-delete rings after 2 hours.
60 * 60 * 2 = 7200 seconds.
*/
ringSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7200 },
);

export default mongoose.model("Ring", ringSchema);
