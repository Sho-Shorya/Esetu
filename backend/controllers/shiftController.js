import Shift from "../models/shiftModel.js";
import { User } from "../models/userModel.js";

export const getShifts = async (req, res) => {
  try {
    const shifts = await Shift.find().populate("userId", "firstName lastName phoneNumber");

    const morning = [];
    const evening = [];

    shifts.forEach((s) => {
      if (!s.userId) return;
      const user = {
        _id: s.userId._id,
        firstName: s.userId.firstName,
        lastName: s.userId.lastName,
        phoneNumber: s.userId.phoneNumber,
      };
      if (s.shift === "morning") morning.push(user);
      else evening.push(user);
    });

    return res.status(200).json({
      success: true,
      morning,
      evening,
    });
  } catch (error) {
    console.error("Get shifts error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const saveShifts = async (req, res) => {
  try {
    const { morning = [], evening = [] } = req.body;

    await Shift.deleteMany({});

    const ops = [];

    morning.forEach((userId) => {
      ops.push(Shift.create({ userId, shift: "morning" }));
    });

    evening.forEach((userId) => {
      ops.push(Shift.create({ userId, shift: "evening" }));
    });

    await Promise.all(ops);

    return res.status(200).json({
      success: true,
      message: "शिफ्ट सेव हो गई।",
    });
  } catch (error) {
    console.error("Save shifts error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRegularUsers = async (req, res) => {
  try {
    const users = await User.find({ role: "user" })
      .select("firstName lastName phoneNumber")
      .sort({ firstName: 1 });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
