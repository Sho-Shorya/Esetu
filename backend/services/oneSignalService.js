import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

import { User } from "../models/userModel.js";

export const sendNotification = async ({
  subscriptionId,
  sendToAll = false,
  title,
  message,
  url = "https://esetu.vercel.app/",
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

      // 👇 User will be navigated here when notification is tapped
      url,
    };

    if (sendToAll) {
      // Get all users having a valid OneSignal subscription ID
      const users = await User.find({
        oneSignalSubscriptionId: {
          $exists: true,
          $ne: null,
        },
      });

      const subscriptionIds = users
        .map((user) => user.oneSignalSubscriptionId)
        .filter(Boolean);

      if (subscriptionIds.length === 0) {
        console.log("⚠️ No OneSignal subscribers found");
        return;
      }

      body.include_subscription_ids = subscriptionIds;
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
    console.log("🔗 URL:", url);
    console.log("📨 OneSignal:", response.data);
  } catch (err) {
    console.error("❌ OneSignal Error:", err.response?.data || err.message);
  }
};

export const sendToUsers = async ({
  userIds = [],
  title,
  message,
  url = "https://esetu.vercel.app/",
}) => {
  try {
    if (!userIds || userIds.length === 0) {
      console.log("⚠️ No user IDs provided for targeted notification");
      return;
    }

    const users = await User.find({
      _id: { $in: userIds },
      oneSignalSubscriptionId: {
        $exists: true,
        $ne: null,
      },
    });

    const subscriptionIds = users
      .map((user) => user.oneSignalSubscriptionId)
      .filter(Boolean);

    if (subscriptionIds.length === 0) {
      console.log("⚠️ No OneSignal subscribers found for these users");
      return;
    }

    const body = {
      app_id: process.env.ONESIGNAL_APP_ID,
      headings: {
        en: title,
      },
      contents: {
        en: message,
      },
      url,
      include_subscription_ids: subscriptionIds,
    };

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

    console.log("✅ Targeted Notification Sent");
    console.log("🔗 URL:", url);
    console.log("👥 Recipients:", subscriptionIds.length);
    console.log("📨 OneSignal:", response.data);
  } catch (err) {
    console.error("❌ OneSignal Targeted Error:", err.response?.data || err.message);
  }
};
