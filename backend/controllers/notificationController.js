import { sendNotification } from "../services/oneSignalService.js";

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