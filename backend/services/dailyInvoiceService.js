import { Order } from "../models/orderModel.js";
import { DailyInvoice } from "../models/dailyInvoiceModel.js";

/*
====================================================
INDIA DATE HELPERS
====================================================
*/

const INDIA_TIMEZONE = "Asia/Kolkata";

export const getIndiaDateKey = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
};

export const getIndiaTodayRange = () => {
  const dateKey = getIndiaDateKey();

  /*
   * India uses UTC+05:30.
   *
   * Example:
   * 2026-08-15 00:00 IST
   * =
   * 2026-08-14 18:30 UTC
   */

  const start = new Date(`${dateKey}T00:00:00+05:30`);

  const end = new Date(`${dateKey}T23:59:59.999+05:30`);

  return {
    dateKey,
    start,
    end,
  };
};

/*
====================================================
CREATE DAILY INVOICES
====================================================
*/

export const generateDailyInvoices = async () => {
  const { dateKey, start, end } = getIndiaTodayRange();

  console.log(`🧾 Generating daily invoices for ${dateKey}`);

  /*
   * Only APPROVED orders count.
   *
   * Declined / Pending orders are ignored.
   */

  const orders = await Order.find({
    status: "Approved",

    createdAt: {
      $gte: start,
      $lte: end,
    },

    isTodayOrder: true,
  }).lean();

  console.log(`📦 Approved orders found: ${orders.length}`);

  /*
   * Nothing ordered today.
   */

  if (!orders.length) {
    console.log("ℹ️ No approved orders today. No invoices generated.");

    return {
      success: true,
      dateKey,
      ordersFound: 0,
      invoicesGenerated: 0,
    };
  }

  /*
   * Group orders by shopkeeper.
   *
   * Example:
   *
   * userA → order1, order2
   * userB → order3
   * userC → order4, order5
   */

  const ordersByUser = new Map();

  for (const order of orders) {
    const userId = String(order.userId);

    if (!ordersByUser.has(userId)) {
      ordersByUser.set(userId, []);
    }

    ordersByUser.get(userId).push(order);
  }

  console.log(`👥 Shopkeepers with orders: ${ordersByUser.size}`);

  let invoicesGenerated = 0;

  /*
   * Generate one invoice for every shopkeeper.
   */

  for (const [userId, userOrders] of ordersByUser) {
    try {
      /*
       * Combine all items from this user's orders.
       */

      const items = [];

      let totalAmount = 0;

      for (const order of userOrders) {
        for (const item of order.items || []) {
          items.push({
            productId: item.productId,

            name: item.name,

            hinglishName: item.hinglishName || "",

            companyName: item.companyName || "",

            measurement: item.measurement,

            qty: Number(item.qty) || 0,

            price: Number(item.price) || 0,

            total: Number(item.total) || 0,
          });
        }

        totalAmount += Number(order.totalAmount) || 0;
      }

      /*
       * UPSERT
       *
       * This makes the cron safe if:
       *
       * - server restarts
       * - cron runs twice
       * - you manually run it again
       *
       * It will NOT create duplicate invoices.
       */

      const invoice = await DailyInvoice.findOneAndUpdate(
        {
          userId,
          dateKey,
        },

        {
          $set: {
            orderIds: userOrders.map((order) => order._id),

            items,

            totalAmount,

            totalOrders: userOrders.length,

            status: "Generated",

            generatedAt: new Date(),
          },

          $setOnInsert: {
            userId,

            dateKey,
          },
        },

        {
          new: true,

          upsert: true,

          setDefaultsOnInsert: true,
        },
      );

      invoicesGenerated++;

      console.log(`✅ Invoice generated → User ${userId} | ₹${totalAmount}`);
    } catch (error) {
      console.error(`❌ Invoice generation failed for user ${userId}:`, error);
    }
  }

  console.log(`🎉 Daily invoice generation completed: ${invoicesGenerated}`);

  return {
    success: true,
    dateKey,
    ordersFound: orders.length,
    invoicesGenerated,
  };
};
