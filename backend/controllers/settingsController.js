import AppSetting from "../models/appSettingModel.js";
import { Order } from "../models/orderModel.js";
import { sendNotification } from "../services/oneSignalService.js";

export const getAppSettings = async (req, res) => {
  try {
    const settings = await AppSetting.find();
    const response = settings.reduce((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      settings: response,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getPublicAppSettings = async (req, res) => {
  try {
    const setting = await AppSetting.findOne({ key: "dailyOrderCutoff" });
    return res.status(200).json({
      success: true,
      settings: {
        dailyOrderCutoff: setting?.value || "12:00",
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
export const updateAppSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!key || typeof value === "undefined") {
      return res.status(400).json({
        success: false,
        message: "की और मूल्य दोनों आवश्यक हैं।",
      });
    }

    // Update the setting
    const setting = await AppSetting.findOneAndUpdate(
      { key },
      { value: String(value) },
      {
        returnDocument: "after",
        upsert: true,
      },
    );

    // If the cutoff time was changed, update today's active orders
    if (key === "dailyOrderCutoff") {
      const [hour, minute] = value.split(":").map(Number);

      const cutoffTime = new Date();
      cutoffTime.setHours(hour, minute, 0, 0);

      await Order.updateMany(
        { isTodayOrder: true },
        {
          $set: {
            cutoffTime,
          },
        },
      );
      const formattedTime = new Date(cutoffTime).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      await sendNotification({
        sendToAll: true,
        title: `⏰ ${formattedTime} नया कट-ऑफ़ `,
        message: `आज का ऑर्डर कट-ऑफ़ समय ${formattedTime} कर दिया गया है।`,
      });
    }

    return res.status(200).json({
      success: true,
      setting,
      message: "सेटिंग सफलतापूर्वक अपडेट कर दी गई।",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
