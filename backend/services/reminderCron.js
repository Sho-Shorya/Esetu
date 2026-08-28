import cron from "node-cron";

import AppSetting from "../models/appSettingModel.js";
import { User } from "../models/userModel.js";
import { Order } from "../models/orderModel.js";
import ReminderLog from "../models/reminderLogModel.js";

import { sendNotification } from "./oneSignalService.js";

const INDIA_TIMEZONE = "Asia/Kolkata";

/*
====================================================
DATE HELPERS
====================================================
*/

/*
Get today's date according to India time.

Returns:
YYYY-MM-DD
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

/*
Get today's start and end according to IST.
*/
const getTodayRange = () => {
  const today = getTodayDate();

  const start = new Date(`${today}T00:00:00+05:30`);

  const end = new Date(`${today}T23:59:59.999+05:30`);

  return {
    start,
    end,
  };
};

/*
Calculate remaining minutes until cutoff.

Math.ceil() is intentional.

Example:

10:00:01 → 59.98 minutes → 60
10:30:01 → 29.98 minutes → 30
10:50:01 → 9.98 minutes → 10

This prevents the reminder from becoming 59/29/9
because of a few milliseconds of execution delay.
*/
const getRemainingMinutes = (cutoffTime) => {
  const now = new Date();

  return Math.ceil((cutoffTime.getTime() - now.getTime()) / 60000);
};

/*
====================================================
REMINDER LOG HELPERS
====================================================
*/

/*
Check whether this reminder has already been sent
to this user today.
*/
const alreadySent = async (userId, reminderType, date) => {
  const exists = await ReminderLog.findOne({
    userId,
    reminderType,
    date,
  });

  return !!exists;
};

/*
Save reminder log.

Duplicate reminder errors are ignored because
the unique MongoDB index protects us from duplicates.

Other database errors are logged.
*/
const saveReminder = async (userId, reminderType, date) => {
  try {
    await ReminderLog.create({
      userId,
      reminderType,
      date,
    });
  } catch (error) {
    /*
    MongoDB duplicate key error.

    This is expected if two cron executions
    happen at almost the same time.
    */
    if (error.code === 11000) {
      return;
    }

    console.error("❌ ReminderLog save error:", error);
  }
};

/* ============================================================
   START CRONS
============================================================ */

export const startReminderCron = () => {
  console.log("🟢 e-Setu Cron System Started");

  /*
  ==================================================
  ORDER REMINDER CRON
  ==================================================

  Runs every minute.

  Checks whether we are exactly around:

  60 minutes
  30 minutes
  10 minutes

  before today's order cutoff.
  */

  cron.schedule(
    "* * * * *",

    async () => {
      try {
        /*
        ------------------------------------------------
        GET ORDER CUTOFF SETTING
        ------------------------------------------------
        */

        const setting = await AppSetting.findOne({
          key: "dailyOrderCutoff",
        });

        if (!setting) {
          console.log("⚠️ dailyOrderCutoff setting not found");

          return;
        }

        /*
        ------------------------------------------------
        PARSE CUTOFF TIME
        ------------------------------------------------
        */

        const cutoffTime = setting.value;

        /*
        IMPORTANT:

        We explicitly create the cutoff in IST.

        This prevents Railway/server UTC timezone
        from causing incorrect reminder times.
        */

        const today = getTodayDate();

        const cutoff = new Date(`${today}T${cutoffTime}:00+05:30`);

        /*
        ------------------------------------------------
        CALCULATE REMAINING MINUTES
        ------------------------------------------------
        */

        const remainingMinutes = getRemainingMinutes(cutoff);

        /*
        ------------------------------------------------
        ONLY RUN AT:
        ------------------------------------------------

        60 minutes
        30 minutes
        10 minutes
        */

        if (![60, 30, 10].includes(remainingMinutes)) {
          return;
        }

        console.log(`🔔 Sending ${remainingMinutes} minute reminder...`);

        /*
        ------------------------------------------------
        TODAY RANGE
        ------------------------------------------------
        */

        const { start, end } = getTodayRange();

        /*
        ------------------------------------------------
        FIND USERS
        ------------------------------------------------
        */

        const users = await User.find({
          role: "user",

          oneSignalSubscriptionId: {
            $exists: true,
            $ne: "",
          },
        });

        console.log(`👥 Users Found : ${users.length}`);

        /*
        ------------------------------------------------
        PROCESS USERS
        ------------------------------------------------
        */

        for (const user of users) {
          try {
            /*
            --------------------------------------------
            CHECK WHETHER USER ALREADY ORDERED TODAY
            --------------------------------------------
            */

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
            USER HAS NOT ORDERED TODAY
            ============================================
            */

            if (!hasOrderToday) {
              let reminderType = "";
              let title = "";
              let message = "";

              /*
              ------------------------------------------
              60 MINUTES
              ------------------------------------------
              */

              if (remainingMinutes === 60) {
                reminderType = "1hour-no-order";

                title = "⏰ सिर्फ 1 घंटा बाकी!";

                message =
                  "आज के ऑर्डर का कट-ऑफ समय सिर्फ 1 घंटे में है। समय रहते अपना ऑर्डर पूरा करें।";
              }

              /*
              ------------------------------------------
              30 MINUTES
              ------------------------------------------
              */

              if (remainingMinutes === 30) {
                reminderType = "30min-no-order";

                title = "⚠️ सिर्फ 30 मिनट बाकी!";

                message =
                  "जल्दी करें! आज के ऑर्डर का कट-ऑफ समय 30 मिनट में समाप्त हो जाएगा।";
              }

              /*
              ------------------------------------------
              10 MINUTES
              ------------------------------------------
              */

              if (remainingMinutes === 10) {
                reminderType = "10min-no-order";

                title = "🚨 अंतिम 10 मिनट!";

                message =
                  "केवल 10 मिनट शेष हैं। अभी ऑर्डर करें ताकि आज की डिलीवरी में आपका ऑर्डर शामिल हो सके।";
              }

              /*
              ------------------------------------------
              CHECK DUPLICATE
              ------------------------------------------
              */

              const sent = await alreadySent(user._id, reminderType, today);

              if (sent) {
                console.log(
                  `⏭️ Already sent ${reminderType} -> ${user.firstName}`,
                );

                continue;
              }

              /*
              ------------------------------------------
              SEND NOTIFICATION
              ------------------------------------------
              */

              console.log(`📨 Sending ${reminderType} -> ${user.firstName}`);

              await sendNotification({
                subscriptionId: user.oneSignalSubscriptionId,

                title,

                message,
              });

              /*
              ------------------------------------------
              SAVE LOG
              ------------------------------------------
              */

              await saveReminder(user._id, reminderType, today);

              continue;
            }

            /*
            ============================================
            USER HAS ALREADY ORDERED TODAY
            ============================================

            At 10 minutes before cutoff, allow the
            user to remember that they can still edit
            their order.
            ============================================
            */

            if (remainingMinutes === 10) {
              const reminderType = "10min-edit-order";

              /*
              ------------------------------------------
              CHECK DUPLICATE
              ------------------------------------------
              */

              const sent = await alreadySent(user._id, reminderType, today);

              if (sent) {
                console.log(
                  `⏭️ Edit reminder already sent -> ${user.firstName}`,
                );

                continue;
              }

              /*
              ------------------------------------------
              SEND EDIT REMINDER
              ------------------------------------------
              */

              console.log(`📝 Edit Reminder -> ${user.firstName}`);

              await sendNotification({
                subscriptionId: user.oneSignalSubscriptionId,

                title: "📝 अंतिम 10 मिनट",

                message:
                  "यदि आपको अपने ऑर्डर में कोई बदलाव करना है, तो अभी कर लें। कट-ऑफ समय में केवल 10 मिनट शेष हैं।",
              });

              /*
              ------------------------------------------
              SAVE LOG
              ------------------------------------------
              */

              await saveReminder(user._id, reminderType, today);
            }
          } catch (userError) {
            /*
            One user's notification/database error
            should NOT stop notifications for everyone.
            */

            console.error(
              `❌ Reminder failed for ${user.firstName}:`,
              userError,
            );
          }
        }

        console.log(`✅ ${remainingMinutes} minute reminder completed`);
      } catch (error) {
        console.error("❌ Reminder Cron Error:", error);
      }
    },

    {
      timezone: INDIA_TIMEZONE,
    },
  );

  /*
  ==================================================
  CRON STARTUP LOGS
  ==================================================
  */

  console.log("⏰ Order reminder cron: Every minute");

  console.log("⏰ Order reminders: 60 / 30 / 10 minutes before cutoff");
};
