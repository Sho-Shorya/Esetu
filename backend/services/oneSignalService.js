import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export const sendNotification = async ({
  subscriptionId,
  sendToAll = false,
  title,
  message,
}) => {
  try {
    const body = {
      app_id: process.env.ONESIGNAL_APP_ID,
      headings: {
        en: title,
        hi: title,
      },
      contents: {
        en: message,
        hi: message,
      },
    };

    if (sendToAll) {
      body.included_segments = ["Subscribed Users"];
    } else {
      if (!subscriptionId) {
        console.log("❌ Subscription ID missing");
        return;
      }

      body.include_subscription_ids = [subscriptionId];
    }

    await axios.post("https://api.onesignal.com/notifications", body, {
      headers: {
        Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Notification sent");
  } catch (err) {
    console.error("❌ OneSignal Error:", err.response?.data || err.message);
  }
};
