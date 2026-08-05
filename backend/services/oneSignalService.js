import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
import { User } from "../models/userModel.js";
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
      // Get all users
      const users = await User.find({
        oneSignalSubscriptionId: { $exists: true, $ne: null },
      });

      body.include_subscription_ids = users.map(
        (user) => user.oneSignalSubscriptionId,
      );
    } else {
      if (!subscriptionId) {
        console.log("❌ Subscription ID missing");
        return;
      }

      body.include_subscription_ids = [subscriptionId];
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
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
};
