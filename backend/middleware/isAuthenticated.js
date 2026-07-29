import jwt from "jsonwebtoken";
import { User } from "../models/userModel.js";
import "dotenv/config";

export const isAuthenticated = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(400).json({
        success: false,
        message: "Authorization token is missing or invalid",
      });
    }
    const token = authHeader.split(" ")[1];

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({
          success: true,
          message: "The registration Token expired",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Token is missing or invalid",
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }
    req.userId = user._id;
    req.user = user;

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const isSupp = async (req, res, next) => {
  if (req.user && req.user.role == "supplier") {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied: Admin only",
    });
  }
};
