import { sendNotification, sendToUsers } from "../services/oneSignalService.js";
import ScheduledNotification from "../models/scheduledNotificationModel.js";
import { User } from "../models/userModel.js";

export const notifyAllUsers = async (req, res) => {
  try {
    const { title, message } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "नोटिफिकेशन का टाइटल आवश्यक है।",
      });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "नोटिफिकेशन का मैसेज आवश्यक है।",
      });
    }

    await sendNotification({
      sendToAll: true,
      title: String(title).trim(),
      message: String(message).trim(),
    });

    return res.status(200).json({
      success: true,
      message: "सभी उपयोगकर्ताओं को नोटिफिकेशन भेज दिया गया।",
    });
  } catch (error) {
    console.error("Notify all error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const createScheduledNotification = async (req, res) => {
  try {
    const { title, message, recipientType, recipientUsers, scheduledAt, sendNow } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({
        success: false,
        message: "नोटिफिकेशन का टाइटल आवश्यक है।",
      });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({
        success: false,
        message: "नोटिफिकेशन का मैसेज आवश्यक है।",
      });
    }

    if (!recipientType || !["all", "custom"].includes(recipientType)) {
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

      const validUsers = await User.find({ _id: { $in: recipientUsers } });
      if (validUsers.length !== recipientUsers.length) {
        return res.status(400).json({
          success: false,
          message: "कुछ उपयोगकर्ता आईडी अमान्य हैं।",
        });
      }
    }

    if (sendNow) {
      const trimmedTitle = String(title).trim();
      const trimmedMessage = String(message).trim();

      if (recipientType === "all") {
        await sendNotification({
          sendToAll: true,
          title: trimmedTitle,
          message: trimmedMessage,
        });
      } else {
        await sendToUsers({
          userIds: recipientUsers,
          title: trimmedTitle,
          message: trimmedMessage,
        });
      }

      return res.status(200).json({
        success: true,
        message: "नोटिफिकेशन भेज दिया गया।",
      });
    }

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "शेड्यूल समय आवश्यक है।",
      });
    }

    const scheduleDate = new Date(scheduledAt);
    if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "शेड्यूल समय भविष्य का होना चाहिए।",
      });
    }

    const notification = await ScheduledNotification.create({
      title: String(title).trim(),
      message: String(message).trim(),
      recipientType,
      recipientUsers: recipientType === "custom" ? recipientUsers : [],
      scheduledAt: scheduleDate,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "नोटिफिकेशन शेड्यूल हो गया।",
      notification,
    });
  } catch (error) {
    console.error("Create scheduled notification error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getScheduledNotifications = async (req, res) => {
  try {
    const notifications = await ScheduledNotification.find({ status: "pending" })
      .sort({ scheduledAt: 1 })
      .populate("recipientUsers", "firstName lastName phoneNumber");

    const pendingCount = notifications.length;

    return res.status(200).json({
      success: true,
      notifications,
      pendingCount,
    });
  } catch (error) {
    console.error("Get scheduled notifications error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const editScheduledNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, recipientType, recipientUsers, scheduledAt } = req.body;

    const notification = await ScheduledNotification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "नोटिफिकेशन नहीं मिला।",
      });
    }

    if (notification.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "सिर्फ पेंडिंग नोटिफिकेशन एडिट हो सकता है।",
      });
    }

    if (new Date(notification.scheduledAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "शेड्यूल समय बीत चुका है, अब एडिट नहीं हो सकता।",
      });
    }

    if (title) notification.title = String(title).trim();
    if (message) notification.message = String(message).trim();

    if (recipientType) {
      if (!["all", "custom"].includes(recipientType)) {
        return res.status(400).json({
          success: false,
          message: "रिसीवर टाइप अमान्य है।",
        });
      }
      notification.recipientType = recipientType;
    }

    if (recipientType === "custom" && recipientUsers) {
      if (!Array.isArray(recipientUsers) || recipientUsers.length === 0) {
        return res.status(400).json({
          success: false,
          message: "कम से कम एक उपयोगकर्ता चुनें।",
        });
      }

      const validUsers = await User.find({ _id: { $in: recipientUsers } });
      if (validUsers.length !== recipientUsers.length) {
        return res.status(400).json({
          success: false,
          message: "कुछ उपयोगकर्ता आईडी अमान्य हैं।",
        });
      }
      notification.recipientUsers = recipientUsers;
    }

    if (recipientType === "all") {
      notification.recipientUsers = [];
    }

    if (scheduledAt) {
      const scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
        return res.status(400).json({
          success: false,
          message: "शेड्यूल समय भविष्य का होना चाहिए।",
        });
      }
      notification.scheduledAt = scheduleDate;
    }

    await notification.save();

    return res.status(200).json({
      success: true,
      message: "नोटिफिकेशन अपडेट हो गया।",
      notification,
    });
  } catch (error) {
    console.error("Edit scheduled notification error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const cancelScheduledNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await ScheduledNotification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "नोटिफिकेशन नहीं मिला।",
      });
    }

    if (notification.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "सिर्फ पेंडिंग नोटिफिकेशन रद्द हो सकता है।",
      });
    }

    notification.status = "cancelled";
    await notification.save();

    return res.status(200).json({
      success: true,
      message: "नोटिफिकेशन रद्द हो गया।",
    });
  } catch (error) {
    console.error("Cancel scheduled notification error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};