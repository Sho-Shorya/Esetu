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

/**
 * "Order Ring" — push notification that behaves like an incoming call.
 * High priority so Android shows it immediately as a heads-up notification,
 * wakes the app in the background, and tapping it opens the app (products page).
 * No DB storage, no polling, no in-app overlay.
 */
export const sendOrderRing = async ({
  userIds = [],
  title = "अभी ऑर्डर करें!",
  message = "ऑर्डर का समय है!",
  url = undefined,
}) => {
  if (!userIds || userIds.length === 0) {
    throw new Error("No target users provided");
  }

  const users = await User.find({
    _id: { $in: userIds },
    oneSignalSubscriptionId: { $exists: true, $ne: null },
  });

  const subscriptionIds = users
    .map((user) => user.oneSignalSubscriptionId)
    .filter(Boolean);

  if (subscriptionIds.length === 0) {
    throw new Error(
      "इन यूज़र के फ़ोन पर push notification सक्षम नहीं है — " +
        "उन्होंने browser में notification permission नहीं दी है या iOS पर Home Screen से app install नहीं की है।",
    );
  }

  const body = {
    app_id: process.env.ONESIGNAL_APP_ID,
    headings: { en: title, hi: title },
    contents: { en: message, hi: message },

    // Tap "Order Kare" → opens the app
    url: url || process.env.RING_TAP_URL || "https://esetu.vercel.app/products",

    include_subscription_ids: subscriptionIds,

    // Custom data — the app listens for type === "order-ring"
    // and plays /orderRing.mp3 when the app is open.
    data: { type: "order-ring" },

    chrome_web_icon:
      process.env.RING_ICON_URL || "https://esetu.vercel.app/logo2.png",
    firefox_icon:
      process.env.RING_ICON_URL || "https://esetu.vercel.app/logo2.png",
    big_picture:
      process.env.RING_ICON_URL || "https://esetu.vercel.app/logo2.png",

    // ── Call-like behaviour ─────────────────────────────
    priority: 10, //          Android: heads-up, like a call
    content_available: true, // Wake app in background
    android_visibility: 1, //  Show full content on lock screen
    android_accent_color: "#DC2626",
    android_led_color: "#DC2626",
    // ─────────────────────────────────────────────────────
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

  console.log("🔔 Order Ring sent");
  console.log("👥 Recipients:", subscriptionIds.length);
  console.log("📨 OneSignal:", response.data?.id || response.data);

  return { sentTo: subscriptionIds.length };
};
