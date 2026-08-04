import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const sendNotification = async ({
  subscriptionId,
  title,
  message,
  sendToAll = false,
}) => {
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
    body.include_subscription_ids = [subscriptionId];
  }

  await axios.post("https://api.onesignal.com/notifications", body, {
    headers: {
      Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}`,
      "Content-Type": "application/json",
    },
  });
};
