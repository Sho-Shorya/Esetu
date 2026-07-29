import mongoose from "mongoose"

const offerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  discountPercent: { type: Number, required: true },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "product" }],
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true })

export const Offer = mongoose.model("Offer", offerSchema)
