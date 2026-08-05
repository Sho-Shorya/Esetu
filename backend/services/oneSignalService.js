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
      },
      contents: {
        en: message,
      },
    };

    if (sendToAll) {
      body.included_segments = ["Subscribed Users"];

      console.log("📢 Sending notification to ALL subscribed users");
    } else {
      if (!subscriptionId) {
        console.log("❌ Subscription ID missing");
        return false;
      }

      body.include_subscription_ids = [subscriptionId];

      console.log(`📨 Sending notification to ${subscriptionId}`);
    }

    const response = await axios.post(
      "https://api.onesignal.com/notifications",
      body,
      {
        headers: {
          Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ Notification Sent");
    console.log(response.data);

    return response.data;
  } catch (err) {
    console.error("❌ OneSignal Error");
    console.error(err.response?.data || err.message);

    return null;
  }
};
