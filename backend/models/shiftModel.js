import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    shift: {
      type: String,
      enum: ["morning", "evening"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Shift", shiftSchema);
