import {
  DefaultApi,
  Configuration,
  Notification,
} from "@onesignal/node-onesignal";

const configuration = new Configuration({
  appKey: process.env.ONESIGNAL_REST_API_KEY,
});

const client = new DefaultApi(configuration);

export const sendNotification = async ({ subscriptionId, title, message }) => {
  try {
    const notification = new Notification();

    notification.app_id = process.env.ONESIGNAL_APP_ID;

    // Send to one specific device/subscription
    notification.include_subscription_ids = [subscriptionId];

    notification.headings = {
      en: title,
      hi: title,
    };

    notification.contents = {
      en: message,
      hi: message,
    };

    await client.createNotification(notification);

    console.log("✅ Notification sent");
  } catch (error) {
    console.error("❌ OneSignal Error:", error.body || error);
  }
};
