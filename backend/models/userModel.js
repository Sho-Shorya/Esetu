import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    profilePic: { type: String, default: "" }, //Clouduinary image url
    phoneNumber: { type: Number, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["user", "supplier"],
      default: "user",
    },
    token: { type: String, default: null },
    isVerified: { type: Boolean, default: false },
    isLoggedIn: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    address: { type: String, default: "" },
    place: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    gender: { type: String, default: "" },
  },
  { timestamps: true },
); //gives timeStamps for "Created at" and "updated at"

export const User = mongoose.model("User", userSchema);
