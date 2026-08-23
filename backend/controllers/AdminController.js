import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Session } from "../models/sessionMedel.js";
import { sendOptMail } from "../emailVerify/sendOptMail.js";
import cloudinary from "../utils/cloudinary.js";
import { generateToken } from "../utils/token.js";
import { sendNotification } from "../services/oneSignalService.js";

export const adminRegister = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, password } = req.body;
    if (!firstName || !lastName || !phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    const user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "Supplier already exists!",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      firstName,
      lastName,
      phoneNumber,
      password: hashedPassword,
    });
    newUser.role = "supplier";
    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "Supplier registered successfully",
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    }); //internal server error
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({
        message: "All fields are required!",
      });
    }
    const existingUser = await User.findOne({ phoneNumber });
    if (!existingUser) {
      return res.status(400).json({ message: "Supplier don't exists!" });
    }
    if (existingUser.role !== "supplier") {
      return res.status(400).json({
        message: "आप सप्लायर नहीं हैं, दुकानदार के तौर पर लॉग इन करें।",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password,
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "डाला गया पासवर्ड गलत है। ❌",
      });
    }

    const userId = existingUser._id;
    //generate Token
    const token = await generateToken(userId);

    existingUser.token = token;
    existingUser.isVerified = true;
    existingUser.isLoggedIn = true;
    await existingUser.save();

    return res.status(200).json({
      success: true,
      message: `Welcome back ${existingUser.firstName}`,
      user: existingUser,
      token,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const adminLogout = async (req, res) => {
  try {
    const userId = req.userId;
    await User.findOneAndUpdate(userId, { isLoggedIn: false });
    return res.status(200).json({
      success: true,
      message: "Supplier logged out!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const getCurrentUser = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { newPassword, confirmPassword } = req.body;
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Please enter new password and confirm",
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password do not match",
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();
    return res.status(200).json({
      success: true,
      message: "Password changed successfully!",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const allUser = async (_, res) => {
  try {
    const users = await User.find();
    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const userId = req.params.userId || req.params.id;
    // extracting user ID from request params (supports both :userId and :id)
    const user = await User.findById(userId).select(
      "-password -otp -otpExpiry -token",
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const userIdToUpdate = req.params.userId;
    const loggedInUser = req.user;

    if (!userIdToUpdate || userIdToUpdate === "undefined") {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const {
      firstName,
      lastName,
      address,
      place,
      zipCode,
      phoneNumber,
      role,
      country,
      gender,
    } = req.body;

    // User can update only their own profile.
    // Supplier/Admin can update anyone.
    if (
      loggedInUser._id.toString() !== userIdToUpdate &&
      loggedInUser.role !== "supplier"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this profile.",
      });
    }

    const user = await User.findById(userIdToUpdate);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    let profilePicUrl = user.profilePic || "";
    let profilePicPublicId = user.profilePicPublicId || "";

    // Only one image allowed
    if (Array.isArray(req.files) && req.files.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Only one profile image is allowed.",
      });
    }

    const fileToUpload =
      req.file ||
      (Array.isArray(req.files) && req.files.length === 1
        ? req.files[0]
        : null);

    if (fileToUpload) {
      // Delete previous image
      if (profilePicPublicId) {
        try {
          await cloudinary.uploader.destroy(profilePicPublicId);
        } catch (err) {
          console.log("Old image delete failed:", err.message);
        }
      }

      // Upload new image
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "profile",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        );

        stream.end(fileToUpload.buffer);
      });

      profilePicUrl = uploadResult.secure_url;
      profilePicPublicId = uploadResult.public_id;
    }

    // Update fields
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (address !== undefined) user.address = address;
    if (place !== undefined) user.place = place;
    if (zipCode !== undefined) user.zipCode = zipCode;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (country !== undefined) user.country = country;
    if (gender !== undefined) user.gender = gender;

    // Only supplier/admin can change role
    if (loggedInUser.role === "supplier" && role) {
      user.role = role;
    }

    user.profilePic = profilePicUrl;
    user.profilePicPublicId = profilePicPublicId;

    const updatedUser = await user.save();

    // Notification
    if (updatedUser.oneSignalSubscriptionId) {
      const updatedBy = loggedInUser.role === "supplier" ? "एडमिन" : "आपने";

      await sendNotification({
        subscriptionId: updatedUser.oneSignalSubscriptionId,
        title: "👤 प्रोफ़ाइल अपडेट हुई",
        message: `${updatedBy} आपकी प्रोफ़ाइल सफलतापूर्वक अपडेट की है।`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "प्रोफ़ाइल सफलतापूर्वक अपडेट हो गई। ✅",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update User Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
