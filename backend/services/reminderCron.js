import cron from "node-cron";

import AppSetting from "../models/appSettingModel.js";
import { User } from "../models/userModel.js";
import { Order } from "../models/orderModel.js";
import ReminderLog from "../models/reminderLogModel.js";

import { sendNotification } from "./oneSignalService.js";

import { generateDailyInvoices } from "../services/dailyInvoiceService.js";

const INDIA_TIMEZONE = "Asia/Kolkata";

/*
====================================================
DATE HELPERS
====================================================
*/

const getTodayDate = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
};

const getTodayRange = () => {
  const today = getTodayDate();

  const start = new Date(`${today}T00:00:00+05:30`);

  const end = new Date(`${today}T23:59:59.999+05:30`);

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
    // Duplicate reminder ignored
  }
};

/*
====================================================
SEND DAILY RECEIPT NOTIFICATION
====================================================
*/

const sendDailyReceiptNotification = async () => {
  try {
    const today = getTodayDate();

    console.log("📢 Preparing daily receipt notifications...");

    /*
    --------------------------------------------------
    FIND USERS WHO HAVE ONESIGNAL
    --------------------------------------------------
    */

    const users = await User.find({
      oneSignalSubscriptionId: {
        $exists: true,
        $ne: "",
      },
    });

    console.log(`👥 Users with OneSignal: ${users.length}`);

    let sentCount = 0;
    let skippedCount = 0;

    /*
    --------------------------------------------------
    SEND NOTIFICATION
    --------------------------------------------------
    */

    for (const user of users) {
      /*
      Prevent duplicate notification.

      The same ReminderLog system is being reused,
      but with a different reminderType.
      */

      const reminderType = "daily-receipt";

      const sent = await alreadySent(user._id, reminderType, today);

      if (sent) {
        console.log(
          `⏭️ Receipt notification already sent -> ${user.firstName}`,
        );

        skippedCount++;

        continue;
      }

      /*
      ------------------------------------------------
      SEND ONESIGNAL NOTIFICATION
      ------------------------------------------------
      */

      console.log(`📨 Sending receipt notification -> ${user.firstName}`);

      await sendNotification({
        subscriptionId: user.oneSignalSubscriptionId,

        title: "📜 आज की रसीद तैयार है",

        message: "रसीद देखने और डाउनलोड करने के लिए यहाँ टैप करें।",

        /*
        IMPORTANT:
        Your OneSignal service needs to pass this
        URL into the notification payload.

        If your current sendNotification function
        doesn't support `url` yet, we'll update it.
        */

        url: "https://esetu.vercel.app/invoice-history",
      });

      /*
      ------------------------------------------------
      SAVE NOTIFICATION LOG
      ------------------------------------------------
      */

      await saveReminder(user._id, reminderType, today);

      sentCount++;
    }

    console.log(
      `✅ Daily receipt notifications completed | Sent: ${sentCount} | Skipped: ${skippedCount}`,
    );

    return {
      success: true,
      sentCount,
      skippedCount,
    };
  } catch (error) {
    console.error("❌ Daily Receipt Notification Error:", error);

    return {
      success: false,
      sentCount: 0,
      skippedCount: 0,
    };
  }
};

/*
====================================================
START CRONS
====================================================
*/

export const startReminderCron = () => {
  console.log("🟢 e-Setu Cron System Started");

  /*
  ==================================================
  EXISTING REMINDER CRON
  ==================================================
  */

  cron.schedule(
    "* * * * *",

    async () => {
      try {
        const setting = await AppSetting.findOne({
          key: "dailyOrderCutoff",
        });

        if (!setting) return;

        const [hour, minute] = setting.value.split(":").map(Number);

        const cutoff = new Date();

        cutoff.setHours(hour, minute, 0, 0);

        const remainingMinutes = getRemainingMinutes(cutoff);

        /*
         * Only run exactly at:
         *
         * 60
         * 30
         * 10
         */

        if (![60, 30, 10].includes(remainingMinutes)) {
          return;
        }

        console.log(`🔔 Sending ${remainingMinutes} minute reminder...`);

        const today = getTodayDate();

        const { start, end } = getTodayRange();

        const users = await User.find({
          role: "user",

          oneSignalSubscriptionId: {
            $exists: true,
            $ne: "",
          },
        });

        console.log(`👥 Users Found : ${users.length}`);

        for (const user of users) {
          const hasOrderToday = await Order.exists({
            userId: user._id,

            isTodayOrder: true,

            createdAt: {
              $gte: start,
              $lte: end,
            },
          });

          /*
          ============================================
          USERS WHO HAVEN'T ORDERED TODAY
          ============================================
          */

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

          /*
          ============================================
          USERS WHO ALREADY ORDERED
          ============================================
          */

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
      } catch (error) {
        console.error("Reminder Cron Error:", error);
      }
    },

    {
      timezone: INDIA_TIMEZONE,
    },
  );

  /*
  ==================================================
  10 PM DAILY INVOICE CRON
  ==================================================
  */

  cron.schedule(
    "0 22 * * *",

    async () => {
      console.log("🧾 10 PM Daily Invoice Cron Started");

      try {
        /*
        ------------------------------------------------
        1. GENERATE RECEIPTS
        ------------------------------------------------
        */

        const result = await generateDailyInvoices();

        console.log("📊 Daily Invoice Result:", result);

        /*
        ------------------------------------------------
        2. ONLY AFTER SUCCESS → SEND NOTIFICATION
        ------------------------------------------------
        */

        console.log("📢 Daily receipts generated successfully.");

        const notificationResult = await sendDailyReceiptNotification();

        console.log("📨 Receipt Notification Result:", notificationResult);

        console.log("✅ 10 PM Invoice + Notification process completed");
      } catch (error) {
        /*
        IMPORTANT:
        If invoice generation fails,
        NO notification is sent.
        */

        console.error("❌ Daily Invoice Cron Error:", error);
      }
    },

    {
      timezone: INDIA_TIMEZONE,
    },
  );

  console.log("⏰ Daily invoice scheduled for 10:00 PM IST");
};
