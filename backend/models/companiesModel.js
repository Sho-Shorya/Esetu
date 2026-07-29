import mongoose from "mongoose";

const companySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    logo: {
      type: String,
      default: "",
    },

    active: {
      type: Boolean,
      default: true,
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Company", companySchema);
