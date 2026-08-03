import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const sendNotification = async ({ subscriptionId, title, message }) => {
  try {
    console.log("APP ID:", process.env.ONESIGNAL_APP_ID);
    console.log("REST KEY:", process.env.ONESIGNAL_REST_API_KEY);
    await axios.post(
      "https://api.onesignal.com/notifications",
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_subscription_ids: [subscriptionId],
        headings: {
          en: title,
          hi: title,
        },
        contents: {
          en: message,
          hi: message,
        },
      },
      {
        headers: {
          Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ Notification sent");
  } catch (err) {
    console.error("❌ OneSignal Error:", err.response?.data || err.message);
  }
};
