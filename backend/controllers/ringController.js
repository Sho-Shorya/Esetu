import Shift from "../models/shiftModel.js";
import { User } from "../models/userModel.js";
import { sendOrderRing } from "../services/oneSignalService.js";

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

    /* OS-level "incoming call" style push notification.
       Rings the phone even when the app is closed; tapping it opens the app. */
    const { sentTo } = await sendOrderRing({
      userIds: targetUserIds,
      title: message?.trim() || "अभी ऑर्डर करें!",
      message: "ऑर्डर का समय है!",
    });

    return res.status(200).json({
      success: true,
      message: `रिंग भेज दी गई — ${sentTo} उपयोगकर्ताओं को`,
      sentTo,
    });
  } catch (error) {
    console.error("Send ring error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};