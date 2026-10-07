import AppSetting from "../models/appSettingModel.js";
import { User } from "../models/userModel.js";
import { sendNotification } from "./oneSignalService.js";

/**
 * Order primitives shared by every order-creating path.
 *
 * These were previously private to controllers/orderController.js. They live
 * here so a new order source (the phone-call bridge) reuses the exact same
 * cutoff rules, total maths, per-user lock and notifications as the cart flow
 * instead of re-implementing them. orderController.js imports from this module.
 */

const DEFAULT_ORDER_CUTOFF = "12:00";

/* ============================================================
   SETTINGS
   ============================================================ */

export const getAppSetting = async (key) => {
  const record = await AppSetting.findOne({ key });
  return record?.value ?? null;
};

export const parseCutoffValue = (value) => {
  const [hour = "12", minute = "00"] = String(value).split(":");

  const cutoff = new Date();

  cutoff.setHours(Number.parseInt(hour, 10) || 12);
  cutoff.setMinutes(Number.parseInt(minute, 10) || 0);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  return cutoff;
};

export const getTodayCutoff = async () => {
  const settingValue = await getAppSetting("dailyOrderCutoff");

  return parseCutoffValue(settingValue || DEFAULT_ORDER_CUTOFF);
};

/* ============================================================
   DATE HELPERS
   ============================================================ */

/*
  Your users/admin are in India.

  We explicitly use +05:30 here so date filtering doesn't
  accidentally shift when Railway/server is running in UTC.
*/

export const getIndiaDateRange = (dateString) => {
  let dateKey = dateString;

  if (!dateKey) {
    const now = new Date();

    const indiaString = now.toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    dateKey = indiaString;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid date. Use YYYY-MM-DD.");
  }

  const start = new Date(`${dateKey}T00:00:00+05:30`);

  const nextDay = new Date(start);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return {
    start,
    end: new Date(nextDay.getTime() - 1),
    dateKey,
  };
};

export const getTodayDateRange = () => {
  return getIndiaDateRange();
};

/* ============================================================
   ORDER HELPERS
   ============================================================ */

export const isCutoffPassed = (cutoffTime) => {
  if (!cutoffTime) return false;

  return new Date() > new Date(cutoffTime);
};

export const isWithinOrderingWindow = async () => {
  const cutoffTime = await getTodayCutoff();

  return new Date() <= cutoffTime;
};

export const calculateOrderTotal = (items = []) => {
  return items.reduce((sum, item) => {
    return sum + Number(item.total || 0);
  }, 0);
};

export const getOrderItemCount = (items = []) => {
  return items.reduce((sum, item) => {
    return sum + Number(item.qty || 0);
  }, 0);
};

/* ============================================================
   PER-USER ORDER LOCK
   ============================================================ */

/*
 * Serializes order placement per user so simultaneous
 * requests (double-tap, deadline burst) cannot create
 * duplicate "today's" orders.
 */

const userOrderLocks = new Map();

export const withUserOrderLock = async (userId, task) => {
  const previous = userOrderLocks.get(userId) ?? Promise.resolve();

  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });

  const current = previous
    .catch(() => {})
    .then(task)
    .then(
      (value) => {
        release();
        return value;
      },
      (error) => {
        release();
        throw error;
      },
    );

  userOrderLocks.set(userId, current);

  try {
    return await current;
  } finally {
    if (userOrderLocks.get(userId) === current) {
      userOrderLocks.delete(userId);
    }
  }
};

/* ============================================================
   ORDER NOTIFICATIONS
   ============================================================ */

export const sendOrderNotifications = async ({ user, autoAccepted }) => {
  try {
    if (user.oneSignalSubscriptionId) {
      setTimeout(async () => {
        try {
          await sendNotification({
            subscriptionId: user.oneSignalSubscriptionId,

            title: "🟠 ऑर्डर सफल",

            message: "आपका ऑर्डर सफलतापूर्वक प्राप्त हो गया है।",

            sendToAll: false,
          });
        } catch (error) {
          console.error("Customer notification error:", error);
        }
      }, 3000);
    }

    const suppliers = await User.find({
      role: "supplier",

      oneSignalSubscriptionId: {
        $exists: true,
        $nin: [null, ""],
      },
    }).select("firstName lastName oneSignalSubscriptionId");

    if (!suppliers.length) {
      return;
    }

    const customerName =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      "एक ग्राहक";

    await Promise.allSettled(
      suppliers.map(async (supplier) => {
        if (!supplier.oneSignalSubscriptionId) {
          return;
        }

        try {
          await sendNotification({
            subscriptionId: supplier.oneSignalSubscriptionId,

            title: `🟢 ${customerName} का ऑर्डर आया है`,

            message: autoAccepted
              ? "ऑर्डर अपने आप मंज़ूर हो गया है।"
              : "कृपया चेक करके, मंज़ूर या अस्वीकार करें।",

            sendToAll: false,
          });
        } catch (error) {
          console.error("Supplier notification failed:", error);
        }
      }),
    );
  } catch (error) {
    console.error("sendOrderNotifications error:", error);
  }
};
