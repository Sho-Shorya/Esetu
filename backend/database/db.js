import mongoose from "mongoose"
import dotenv from "dotenv";
dotenv.config();
export const connectDb = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      family: 4,
    });
    console.log("MongoDB connected successfully");
  }
  catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }
}