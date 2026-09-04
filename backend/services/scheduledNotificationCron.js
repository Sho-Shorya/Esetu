import cron from "node-cron";
import ScheduledNotification from "../models/scheduledNotificationModel.js";
import { sendNotification, sendToUsers } from "./oneSignalService.js";

const processDueNotifications = async () => {
  try {
    const now = new Date();

    const dueNotifications = await ScheduledNotification.find({
      status: "pending",
      scheduledAt: { $lte: now },
    });

    if (dueNotifications.length === 0) {
      return;
    }

    for (const notification of dueNotifications) {
      try {
        const { title, message, recipientType, recipientUsers } = notification;

        if (recipientType === "all") {
          await sendNotification({
            sendToAll: true,
            title,
            message,
          });
        } else {
          await sendToUsers({
            userIds: recipientUsers,
            title,
            message,
          });
        }

        notification.status = "sent";
        notification.sentAt = new Date();
        await notification.save();

        console.log(`✅ Scheduled notification sent: ${notification._id}`);
      } catch (err) {
        console.error(
          `❌ Failed to send scheduled notification ${notification._id}:`,
          err.message
        );
      }
    }
  } catch (error) {
    console.error("Scheduled notification cron error:", error);
  }
};

export const startScheduledNotificationCron = () => {
  cron.schedule("* * * * *", processDueNotifications);
  console.log("⏰ Scheduled notification cron started (every minute)");
};