import AppSetting from "../models/appSettingModel.js";

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

    const setting = await AppSetting.findOneAndUpdate(
      { key },
      { value: String(value) },
      {
        new: true,
        upsert: true,
      },
    );

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
