import Ring from "../models/ringModel.js";
import Shift from "../models/shiftModel.js";
import { User } from "../models/userModel.js";

export const sendRing = async (req, res) => {
  try {
    const { recipientType, recipientUsers, message } = req.body;

    if (!recipientType || !["all", "morning", "evening", "custom"].includes(recipientType)) {
      return res.status(400).json({
        success: false,
        message: "रिसीवर टाइप आवश्यक है।",
      });
    }

    if (recipientType === "custom") {
      if (!recipientUsers || !Array.isArray(recipientUsers) || recipientUsers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "कम से कम एक उपयोगकर्ता चुनें।",
        });
      }
    }

    let targetUserIds = [];

    if (recipientType === "all") {
      const users = await User.find({ role: "user" }).select("_id");
      targetUserIds = users.map((u) => u._id);
    } else if (recipientType === "morning" || recipientType === "evening") {
      const shifts = await Shift.find({ shift: recipientType }).select("userId");
      targetUserIds = shifts.map((s) => s.userId);

      if (targetUserIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: `${recipientType === "morning" ? "मॉर्निंग" : "इवनिंग"} शिफ्ट में कोई उपयोगकर्ता नहीं है।`,
        });
      }
    } else {
      targetUserIds = recipientUsers;
    }

    const ring = await Ring.create({
      recipientType,
      recipientUsers: targetUserIds,
      message: message || "अभी ऑर्डर करें!",
    });

    return res.status(201).json({
      success: true,
      message: `रिंग भेज दी गई — ${targetUserIds.length} उपयोगकर्ताओं को`,
      ring,
      sentTo: targetUserIds.length,
    });
  } catch (error) {
    console.error("Send ring error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const pollRings = async (req, res) => {
  try {
    const userId = req.userId;

    const recentRings = await Ring.find({
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
      $or: [
        { recipientType: "all" },
        { recipientUsers: userId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("recipientType message createdAt _id");

    return res.status(200).json({
      success: true,
      rings: recentRings,
    });
  } catch (error) {
    console.error("Poll rings error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
