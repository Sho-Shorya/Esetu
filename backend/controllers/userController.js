import { User } from "../models/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Session } from "../models/sessionMedel.js";
import { sendOptMail } from "../emailVerify/sendOptMail.js";
import cloudinary from "../utils/cloudinary.js";
import { generateToken } from "../utils/token.js";

export const register = async (req, res) => {
  try {
    const { firstName, lastName, phoneNumber, place, password } = req.body;
    if (!firstName || !lastName || !phoneNumber || !place || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }
    const user = await User.findOne({ phoneNumber });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "User already exists!",
      });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      firstName,
      lastName,
      phoneNumber,
      place,
      password: hashedPassword,
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message,
    }); //internal server error
  }
};

export const login = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    if (!phoneNumber || !password) {
      return res.status(400).json({
        message: "All fields are required!",
      });
    }
    const existingUser = await User.findOne({ phoneNumber });
    if (!existingUser) {
      return res.status(400).json({ message: "User don't exists!" });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      existingUser.password,
    );
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials!",
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

export const logout = async (req, res) => {
  try {
    const userId = req.userId;
    await User.findOneAndUpdate(userId, { isLoggedIn: false });
    await Session.deleteMany({ userId });
    return res.status(200).json({
      success: true,
      message: "User logged out succesfully",
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
    const users = await User.find({ role: "user" });
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
    //the id of the user we want to update
    const loggedInUser = req.user; //from isAuthenticated middleware

    // Validate that userIdToUpdate is provided and not "undefined"
    if (!userIdToUpdate || userIdToUpdate === "undefined") {
      return res.status(400).json({
        success: false,
        message: "User ID is required for profile update",
      });
    }

    const { firstName, lastName, address, city, zipCode, country, gender } =
      req.body;

    if (loggedInUser._id.toString() !== userIdToUpdate) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this profile",
      });
    }
    let user = await User.findById(userIdToUpdate);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found!",
      });
    }
    // use the fields that actually exist on the model
    let profilePicUrl = user.profilePic || "";
    let profilePicPublicId = user.profilePicPublicId || "";

    // if files are present, enforce a single-file upload for profile updates
    if (Array.isArray(req.files) && req.files.length > 1) {
      return res.status(400).json({
        success: false,
        message: "Only one file allowed for profile update",
      });
    }
    // accept either req.file (single) or the single element in req.files
    const fileToUpload =
      req.file ||
      (Array.isArray(req.files) && req.files.length === 1 && req.files[0]);
    if (fileToUpload) {
      if (profilePicPublicId) {
        await cloudinary.uploader.destroy(profilePicPublicId);
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "profile" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        stream.end(fileToUpload.buffer);
      });

      profilePicUrl = uploadResult.secure_url;
      profilePicPublicId = uploadResult.public_id;
    }

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.address = address || user.address;
    user.city = city || user.city;
    user.zipCode = zipCode || user.zipCode;
    user.country = country !== undefined ? country : user.country;
    user.gender = gender !== undefined ? gender : user.gender;
    user.profilePic = profilePicUrl;

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: "प्रोफ़ाइल अपडेट हो गई है।",
      user: updatedUser,
    });
  } catch (error) {
    console.error("प्रोफ़ाइल अपडेट करने में विफल : ", error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const saveSubscriptionId = async (req, res) => {
  try {
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        message: "Subscription ID is required",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        oneSignalSubscriptionId: subscriptionId,
      },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Subscription ID saved successfully",
    });
  } catch (error) {
    console.error("Save Subscription Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
