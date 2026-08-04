import cron from "node-cron";

import AppSetting from "../models/appSettingModel.js";
import { User } from "../models/userModel.js";
import { Order } from "../models/orderModel.js";
import ReminderLog from "../models/reminderLogModel.js";

import { sendNotification } from "./oneSignalService.js";

const getTodayDate = () => {
  return new Date().toISOString().split("T")[0];
};

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
  };
};

const getRemainingMinutes = (cutoffTime) => {
  const now = new Date();

  return Math.floor((cutoffTime.getTime() - now.getTime()) / 60000);
};

const alreadySent = async (userId, reminderType, date) => {
  const exists = await ReminderLog.findOne({
    userId,
    reminderType,
    date,
  });

  return !!exists;
};

const saveReminder = async (userId, reminderType, date) => {
  try {
    await ReminderLog.create({
      userId,
      reminderType,
      date,
    });
  } catch (err) {
    // duplicate reminder ignored
  }
};

export const startReminderCron = () => {
  console.log("🟢 Reminder Cron Started");

  cron.schedule("* * * * *", async () => {
    try {
      const setting = await AppSetting.findOne({
        key: "dailyOrderCutoff",
      });

      if (!setting) return;

      const [hour, minute] = setting.value.split(":").map(Number);

      const cutoff = new Date();

      cutoff.setHours(hour);
      cutoff.setMinutes(minute);
      cutoff.setSeconds(0);
      cutoff.setMilliseconds(0);

      const remainingMinutes = getRemainingMinutes(cutoff);

      // Only run at these times
      if (![60, 30, 10].includes(remainingMinutes)) {
        return;
      }

      console.log(`🔔 Sending ${remainingMinutes} minute reminder...`);

      const today = getTodayDate();

      const { start, end } = getTodayRange();

      const users = await User.find({
        role: "user",
        oneSignalSubscriptionId: {
          $ne: "",
        },
      });

      console.log(`👥 Users Found : ${users.length}`);

      // -------------------------
      // PART 2 STARTS HERE
      // -------------------------
    } catch (error) {
      console.error("Reminder Cron Error:", error);
    }

    for (const user of users) {
      const hasOrderToday = await Order.exists({
        userId: user._id,
        isTodayOrder: true,
        createdAt: {
          $gte: start,
          $lte: end,
        },
      });

      /* ============================================
           USERS WHO HAVEN'T ORDERED TODAY
        ============================================ */

      if (!hasOrderToday) {
        let reminderType = "";
        let title = "";
        let message = "";

        if (remainingMinutes === 60) {
          reminderType = "1hour-no-order";
          title = "⏰ सिर्फ 1 घंटा बाकी!";
          message =
            "आज के ऑर्डर का कट-ऑफ समय सिर्फ 1 घंटे में है। समय रहते अपना ऑर्डर पूरा करें।";
        }

        if (remainingMinutes === 30) {
          reminderType = "30min-no-order";
          title = "⚠️ सिर्फ 30 मिनट बाकी!";
          message =
            "जल्दी करें! आज के ऑर्डर का कट-ऑफ समय 30 मिनट में समाप्त हो जाएगा।";
        }

        if (remainingMinutes === 10) {
          reminderType = "10min-no-order";
          title = "🚨 अंतिम 10 मिनट!";
          message =
            "केवल 10 मिनट शेष हैं। अभी ऑर्डर करें ताकि आज की डिलीवरी में आपका ऑर्डर शामिल हो सके।";
        }

        const sent = await alreadySent(user._id, reminderType, today);

        if (!sent) {
          console.log(`📨 Sending ${reminderType} -> ${user.firstName}`);

          await sendNotification({
            subscriptionId: user.oneSignalSubscriptionId,
            title,
            message,
          });

          await saveReminder(user._id, reminderType, today);
        }

        continue;
      }

      /* ============================================
           USERS WHO ALREADY ORDERED
        ============================================ */

      if (remainingMinutes === 10) {
        const reminderType = "10min-edit-order";

        const sent = await alreadySent(user._id, reminderType, today);

        if (!sent) {
          console.log(`📝 Edit Reminder -> ${user.firstName}`);

          await sendNotification({
            subscriptionId: user.oneSignalSubscriptionId,
            title: "📝 अंतिम 10 मिनट",
            message:
              "यदि आपको अपने ऑर्डर में कोई बदलाव करना है, तो अभी कर लें। कट-ऑफ समय में केवल 10 मिनट शेष हैं।",
          });

          await saveReminder(user._id, reminderType, today);
        }
      }
    }

    console.log(`✅ ${remainingMinutes} minute reminder completed`);
  });
};
