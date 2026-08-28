import { Order } from "../models/orderModel.js";
import { Cart } from "../models/cartModel.js";
import { User } from "../models/userModel.js";
import AppSetting from "../models/appSettingModel.js";
import { OrderReceipt } from "../models/orderReceiptModel.js";
import { sendNotification } from "../services/oneSignalService.js";
import { generateOrderReceiptPDF } from "../services/orderReceiptPdfService.js";

const DEFAULT_ORDER_CUTOFF = "12:00";

/* ============================================================
   SETTINGS
============================================================ */

const getAppSetting = async (key) => {
  const record = await AppSetting.findOne({ key });
  return record?.value ?? null;
};

const parseCutoffValue = (value) => {
  const [hour = "12", minute = "00"] = String(value).split(":");

  const cutoff = new Date();

  cutoff.setHours(Number.parseInt(hour, 10) || 12);
  cutoff.setMinutes(Number.parseInt(minute, 10) || 0);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);

  return cutoff;
};

const getTodayCutoff = async () => {
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

const getIndiaDateRange = (dateString) => {
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

const getTodayDateRange = () => {
  return getIndiaDateRange();
};

/* ============================================================
   ORDER HELPERS
============================================================ */

const isCutoffPassed = (cutoffTime) => {
  if (!cutoffTime) return false;

  return new Date() > new Date(cutoffTime);
};

const isWithinOrderingWindow = async () => {
  const cutoffTime = await getTodayCutoff();

  return new Date() <= cutoffTime;
};

const calculateOrderTotal = (items = []) => {
  return items.reduce((sum, item) => {
    return sum + Number(item.total || 0);
  }, 0);
};

const getOrderItemCount = (items = []) => {
  return items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
};

/* ============================================================
   POPULATED ORDER
============================================================ */

const getPopulatedOrder = async (orderId) => {
  return Order.findById(orderId)
    .populate(
      "userId",
      "firstName lastName phoneNumber address place zipCode profilePic",
    )
    .populate("items.productId");
};

/* ============================================================
   SYNC TODAY FLAGS
============================================================ */

export const syncTodayOrderFlags = async () => {
  try {
    const { start } = getIndiaDateRange();

    const result = await Order.updateMany(
      {
        createdAt: {
          $lt: start,
        },
        isTodayOrder: true,
      },
      {
        $set: {
          isTodayOrder: false,
        },
      },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[order-sync] Moved ${result.modifiedCount} orders to history`,
      );
    }

    return result;
  } catch (error) {
    console.error("[order-sync] Failed:", error);

    throw error;
  }
};

/* ============================================================
   ADD ORDER
============================================================ */
export const addOrder = async (req, res) => {
  try {
    // ---------------------------------------
    // 1. Get authenticated user ID
    // ---------------------------------------
    const userId = req.userId;

    const { paymentMethod } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    // ---------------------------------------
    // 2. COD ONLY
    // ---------------------------------------
    const normalizedPaymentMethod = String(paymentMethod || "").toUpperCase();

    if (normalizedPaymentMethod !== "COD") {
      return res.status(400).json({
        success: false,
        message:
          "Online payment orders must be created after successful payment.",
      });
    }

    // ---------------------------------------
    // 3. Get cart + user
    // ---------------------------------------
    const [cart, user] = await Promise.all([
      Cart.findOne({ userId })
        .populate({
          path: "items.productId",
          select: "name hinglishName media category",
          populate: {
            path: "category",
            select: "name",
          },
        })
        .populate({
          path: "items.company",
          select: "name",
        }),

      User.findById(userId).select(
        "firstName lastName address oneSignalSubscriptionId",
      ),
    ]);

    // ---------------------------------------
    // 4. Validate cart
    // ---------------------------------------
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    // ---------------------------------------
    // 5. Validate user
    // ---------------------------------------
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // ---------------------------------------
    // 6. Check ordering window
    // ---------------------------------------
    const withinWindow = await isWithinOrderingWindow();

    if (!withinWindow) {
      return res.status(400).json({
        success: false,
        message: "माफ़ कीजिए, ऑर्डर का समय खत्म हो गया है।",
      });
    }

    // ---------------------------------------
    // 7. Today's date range
    // ---------------------------------------
    const { start, end } = getTodayDateRange();

    // ---------------------------------------
    // 8. Find today's pending order
    // ---------------------------------------
    let order = await Order.findOne({
      userId,

      status: "Pending",

      isTodayOrder: true,

      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    // ---------------------------------------
    // 9. Check cutoff
    // ---------------------------------------
    if (order && isCutoffPassed(order.cutoffTime)) {
      return res.status(400).json({
        success: false,
        message: "आज का ऑर्डर अब एडिट नहीं किया जा सकता।",
      });
    }

    // ---------------------------------------
    // 10. Convert cart → order items
    // ---------------------------------------
    const orderItems = cart.items.map((cartItem) => {
      const product = cartItem.productId;
      const company = cartItem.company;

      const qty = Number(cartItem.qty || 0);

      let price = Number(cartItem.price);

      if (!Number.isFinite(price)) {
        price = qty > 0 ? Number(cartItem.total || 0) / qty : 0;
      }

      let total = Number(cartItem.total);

      if (!Number.isFinite(total)) {
        total = price * qty;
      }

      return {
        productId: product?._id || null,

        name: product?.name || "",

        hinglishName: product?.hinglishName || "",

        image: product?.media?.[0] || "",

        companyId: company?._id || null,

        companyName: company?.name || "",

        categoryId: product?.category?._id || product?.category || null,

        categoryName: product?.category?.name || "",

        measurement: cartItem.measurement || "",

        qty: Number.isFinite(qty) ? qty : 0,

        price: Number.isFinite(price) ? price : 0,

        total: Number.isFinite(total) ? total : 0,
      };
    });

    // ---------------------------------------
    // 11. Validate items
    // ---------------------------------------
    const invalidItem = orderItems.find(
      (item) =>
        !item.productId ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isFinite(item.total) ||
        item.total < 0,
    );

    if (invalidItem) {
      return res.status(400).json({
        success: false,
        message: "Some cart items contain invalid data.",
      });
    }

    // ---------------------------------------
    // 12. Existing today's order
    // ---------------------------------------
    if (order) {
      for (const newItem of orderItems) {
        const existingItem = order.items.find(
          (item) =>
            item.productId?.toString() === newItem.productId?.toString() &&
            item.companyId?.toString() === newItem.companyId?.toString() &&
            item.measurement === newItem.measurement,
        );

        if (existingItem) {
          existingItem.qty =
            Number(existingItem.qty || 0) + Number(newItem.qty || 0);

          existingItem.total =
            Number(existingItem.total || 0) + Number(newItem.total || 0);

          if (existingItem.qty > 0) {
            existingItem.price = existingItem.total / existingItem.qty;
          }
        } else {
          order.items.push(newItem);
        }
      }

      order.totalAmount = calculateOrderTotal(order.items);

      order.paymentMethod = "COD";

      order.paymentStatus = "Pending";

      await order.save();
    } else {
      // ---------------------------------------
      // 13. Create new COD order
      // ---------------------------------------
      const cutoffTime = await getTodayCutoff();

      const totalAmount = calculateOrderTotal(orderItems);

      order = await Order.create({
        userId,

        items: orderItems,

        totalAmount,

        originalTotalAmount: totalAmount,

        shippingAddress: user.address || "",

        paymentMethod: "COD",

        paymentStatus: "Pending",

        status: "Pending",

        isTodayOrder: true,

        cutoffTime,
      });
    }

    // ---------------------------------------
    // 14. Clear cart
    // ---------------------------------------
    cart.items = [];

    cart.totalPrice = 0;

    await cart.save();

    // ---------------------------------------
    // 15. Send notification
    // ---------------------------------------
    setImmediate(() => {
      sendOrderNotifications({
        user,
        order,
      }).catch((error) => {
        console.error("Order notification error:", error);
      });
    });

    // ---------------------------------------
    // 16. Response
    // ---------------------------------------
    return res.status(200).json({
      success: true,

      message: "ऑर्डर हो गया। ✅",

      order,
    });
  } catch (error) {
    console.error("Add Order Error:", error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,

      message: "Something went wrong while placing the order.",

      error: error.message,
    });
  }
};

/* ============================================================
   ORDER NOTIFICATIONS
============================================================ */

const sendOrderNotifications = async ({ user }) => {
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

            message: "कृपया चेक करके, मंज़ूर या अस्वीकार करें।",

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

/* ============================================================
   GET TODAY ORDERS - USER
============================================================ */

export const getTodayOrders = async (req, res) => {
  try {
    const userId = req.userId;

    const { start, end } = getTodayDateRange();

    const orders = await Order.find({
      userId,

      createdAt: {
        $gte: start,
        $lte: end,
      },
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   GET ALL ORDERS - ADMIN
============================================================ */

/* ============================================================
   GET ALL ORDERS
   ADMIN
============================================================ */

export const getAllOrders = async (req, res) => {
  try {
    const { date } = req.query;

    let startDate;
    let endDate;

    if (date) {
      const selectedDate = new Date(`${date}T00:00:00`);

      startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    const orders = await Order.find({
      createdAt: {
        $gte: startDate,
        $lte: endDate,
      },
    })
      .sort({ createdAt: -1 })
      .populate(
        "userId",
        "firstName lastName phoneNumber address place zipCode profilePic",
      )
      .lean();

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log("GET ALL ORDERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   GET ORDERS BY USER
   ADMIN
============================================================ */

export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required.",
      });
    }

    const orders = await Order.find({
      userId,
    })
      .sort({ createdAt: -1 })
      .populate(
        "userId",
        "firstName lastName phoneNumber address place zipCode profilePic",
      )
      .lean();

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log("GET USER ORDERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
/* ============================================================
   SET ORDER CUTOFF
============================================================ */

export const setOrderCutoffTime = async (req, res) => {
  try {
    const { orderId } = req.params;

    const { cutoffTime } = req.body;

    if (!cutoffTime) {
      return res.status(400).json({
        success: false,
        message: "Cutoff time is required.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can have cutoff time updated.",
      });
    }

    if (isCutoffPassed(order.cutoffTime)) {
      return res.status(400).json({
        success: false,
        message: "This order is already locked by cutoff.",
      });
    }

    const newCutoff = new Date(cutoffTime);

    if (Number.isNaN(newCutoff.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid cutoff time.",
      });
    }

    order.cutoffTime = newCutoff;

    await order.save();

    await sendNotification({
      sendToAll: true,

      title: "⏰ नया कट-ऑफ समय",

      message: `ऑर्डर का कट-ऑफ समय ${newCutoff.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })} कर दिया गया है।`,
    });

    return res.status(200).json({
      success: true,
      order,
      message: "कट-ऑफ समय अपडेट कर दिया गया।",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   ORDER HISTORY - USER
============================================================ */

export const getOrderHistory = async (req, res) => {
  try {
    const userId = req.userId;

    const { start } = getTodayDateRange();

    const orders = await Order.find({
      userId,

      createdAt: {
        $lt: start,
      },
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   REMOVE ITEM - USER
============================================================ */

export const removeOrderItem = async (req, res) => {
  try {
    const { orderId, itemId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    if (order.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "ऑर्डर पहले ही लॉक हो चुका है।",
      });
    }

    if (isCutoffPassed(order.cutoffTime)) {
      return res.status(400).json({
        success: false,
        message: "समय बीत चुका है।",
      });
    }

    const item = order.items.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found.",
      });
    }

    order.items.pull(itemId);

    if (!order.items.length) {
      await Order.findByIdAndDelete(orderId);

      return res.status(200).json({
        success: true,
        deleted: true,
        message: "Order deleted because it became empty.",
      });
    }

    order.totalAmount = calculateOrderTotal(order.items);

    await order.save();

    return res.status(200).json({
      success: true,
      deleted: false,
      message: "आइटम हटा दिया गया।",
      order,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   UPDATE ORDER STATUS
============================================================ */

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // ==========================================================
    // ALLOWED STATUSES
    // ==========================================================

    if (!["Pending", "Approved", "Declined"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status.",
      });
    }

    // ==========================================================
    // FIND ORDER
    // ==========================================================

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const currentStatus = order.status;

    // ==========================================================
    // ALLOWED TRANSITIONS
    //
    // Pending  → Approved
    // Pending  → Declined
    //
    // Approved → Pending   (mistake correction)
    // Declined → Pending   (mistake correction)
    //
    // Everything else is blocked.
    // ==========================================================

    const allowedTransitions = {
      Pending: ["Approved", "Declined"],
      Approved: ["Pending"],
      Declined: ["Pending"],
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be changed from ${currentStatus} to ${status}.`,
      });
    }

    // ==========================================================
    // PENDING
    // ==========================================================

    if (status === "Pending") {
      order.status = "Pending";

      // The order becomes an active today's order again.
      order.isTodayOrder = true;

      // Remove previous decision timestamps.
      order.approvedAt = null;
      order.declinedAt = null;
    }

    // ==========================================================
    // APPROVED
    // ==========================================================

    if (status === "Approved") {
      order.status = "Approved";

      order.approvedAt = new Date();

      // Approved order remains today's order.
      order.isTodayOrder = true;

      // Make sure declined timestamp is removed.
      order.declinedAt = null;
    }

    // ==========================================================
    // DECLINED
    // ==========================================================

    if (status === "Declined") {
      order.status = "Declined";

      order.declinedAt = new Date();

      // Declined orders are no longer today's active orders.
      order.isTodayOrder = false;

      // Make sure approved timestamp is removed.
      order.approvedAt = null;
    }

    // ==========================================================
    // SAVE
    // ==========================================================

    await order.save();

    // ==========================================================
    // POPULATE UPDATED ORDER
    // ==========================================================

    const updatedOrder = await getPopulatedOrder(order._id);

    // ==========================================================
    // USER
    // ==========================================================

    const user = await User.findById(order.userId);

    // ==========================================================
    // NOTIFICATIONS
    //
    // Only notify when actually Approved / Declined.
    // Returning to Pending should NOT send a customer
    // notification.
    // ==========================================================

    if (user?.oneSignalSubscriptionId) {
      if (status === "Approved" && currentStatus === "Pending") {
        await sendNotification({
          subscriptionId: user.oneSignalSubscriptionId,

          title: "🟢 ऑर्डर Approve हो गया!",

          message: "ऑर्डर जल्द ही आपकी लोकेशन पर डिलीवर कर दिया जाएगा!",
        });
      }

      if (status === "Declined" && currentStatus === "Pending") {
        await sendNotification({
          subscriptionId: user.oneSignalSubscriptionId,

          title: "🔴 ऑर्डर Decline कर दिया गया",

          message: "क्षमा करें, आपका ऑर्डर स्वीकार नहीं किया जा सका।",
        });
      }
    }

    // ==========================================================
    // RESPONSE MESSAGE
    // ==========================================================

    let message = "";

    if (currentStatus === "Pending" && status === "Approved") {
      message = "Order approved successfully.";
    } else if (currentStatus === "Pending" && status === "Declined") {
      message = "Order declined successfully.";
    } else if (currentStatus === "Approved" && status === "Pending") {
      message = "Order वापस Pending कर दिया गया।";
    } else if (currentStatus === "Declined" && status === "Pending") {
      message = "Order वापस Pending कर दिया गया।";
    }

    // ==========================================================
    // RESPONSE
    // ==========================================================

    return res.status(200).json({
      success: true,
      message,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   SUPPLIER FINALIZE / MODIFY ORDER
============================================================ */

export const finalizeOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const { items, modificationNote = "" } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Items must be an array.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    /*
      Don't allow changes after the order is fully finished.
    */
    if (["Cancelled", "Declined"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "यह ऑर्डर अब बदला नहीं जा सकता।",
      });
    }

    /*
      We deliberately don't allow supplier to create
      arbitrary new products/items here.

      Only existing order item IDs can be modified.
    */

    const requestedMap = new Map();

    for (const entry of items) {
      if (!entry?.itemId) {
        continue;
      }

      const qty = Number(entry.qty);

      if (!Number.isFinite(qty) || qty < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid quantity.",
        });
      }

      requestedMap.set(String(entry.itemId), Math.floor(qty));
    }

    /*
      Store original total only the first time
      the supplier modifies the order.
    */
    if (!order.orderModified) {
      order.originalTotalAmount = Number(order.totalAmount || 0);
    }

    const updatedItems = [];

    for (const item of order.items) {
      const key = String(item._id);

      const hasRequestedQty = requestedMap.has(key);

      /*
        If frontend sends an item, use its new qty.
        Otherwise keep its existing qty.
      */
      const newQty = hasRequestedQty
        ? requestedMap.get(key)
        : Number(item.qty || 0);

      /*
        Zero means remove.
      */
      if (newQty <= 0) {
        continue;
      }

      /*
        Save original values only once.
      */
      if (item.originalQty === null || item.originalQty === undefined) {
        item.originalQty = Number(item.qty || 0);
      }

      if (item.originalTotal === null || item.originalTotal === undefined) {
        item.originalTotal = Number(item.total || 0);
      }

      item.qty = newQty;

      item.total = Number((Number(item.price || 0) * newQty).toFixed(2));

      updatedItems.push(item);
    }

    /*
      Don't allow an empty order.
    */
    if (!updatedItems.length) {
      return res.status(400).json({
        success: false,
        message: "कम से कम एक आइटम रखना जरूरी है।",
      });
    }

    order.items = updatedItems;

    order.totalAmount = Number(calculateOrderTotal(updatedItems).toFixed(2));

    order.orderModified = true;

    order.modifiedAt = new Date();

    order.modificationNote = String(modificationNote || "").trim();

    order.billVersion = Number(order.billVersion || 1) + 1;

    /*
      If the amount changed after payment was marked,
      payment must go back to pending.

      This prevents a supplier from changing
      ₹500 -> ₹300 while the order still says Paid.
    */
    if (order.paymentStatus === "Paid") {
      order.paymentStatus = "Pending";

      order.paymentPaidAt = null;
    }

    await order.save();

    const updatedOrder = await getPopulatedOrder(order._id);

    /*
      Notify customer that the final order changed.
    */
    try {
      const user = await User.findById(order.userId).select(
        "oneSignalSubscriptionId",
      );

      if (user?.oneSignalSubscriptionId) {
        await sendNotification({
          subscriptionId: user.oneSignalSubscriptionId,

          title: "🟡 आपके ऑर्डर में बदलाव हुआ",

          message: `आपका नया ऑर्डर कुल ₹${Number(
            order.totalAmount || 0,
          ).toLocaleString("en-IN")} है।`,
        });
      }
    } catch (notificationError) {
      console.error(
        "Order modification notification failed:",
        notificationError,
      );
    }

    return res.status(200).json({
      success: true,

      message: "ऑर्डर का हिसाब अपडेट हो गया।",

      order: updatedOrder,

      totalAmount: order.totalAmount,

      billVersion: order.billVersion,
    });
  } catch (error) {
    console.error("Finalize Order Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   MARK PAYMENT PAID
============================================================ */

export const markOrderPaymentPaid = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (["Cancelled", "Declined"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message:
          "Cancelled/declined order का payment update नहीं किया जा सकता।",
      });
    }

    order.paymentStatus = "Paid";

    order.paymentPaidAt = new Date();

    await order.save();

    /*
      IMPORTANT:
      Return populated order.

      This prevents the frontend from replacing
      userId with an incomplete object and showing
      "Unknown User".
    */
    const updatedOrder = await getPopulatedOrder(order._id);

    return res.status(200).json({
      success: true,
      message: "Payment marked as paid.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Mark Payment Paid Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   MARK PAYMENT PENDING
============================================================ */

/* ============================================================
   MARK ORDER PAYMENT PENDING
   ADMIN
============================================================ */

export const markOrderPaymentPending = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    order.paymentStatus = "Pending";
    order.paymentPaidAt = null;

    await order.save();

    const updatedOrder = await Order.findById(order._id)
      .populate(
        "userId",
        "firstName lastName phoneNumber address place zipCode profilePic",
      )
      .lean();

    return res.status(200).json({
      success: true,
      message: "Payment marked as pending.",
      order: updatedOrder,
    });
  } catch (error) {
    console.log("MARK PAYMENT PENDING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   GENERATE ORDER RECEIPT
   ADMIN / SUPPLIER
============================================================ */

export const generateOrderReceipt = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (["Cancelled", "Declined"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Cancelled/declined order के लिए रसीद नहीं बनाई जा सकती।",
      });
    }

    if (!order.userId) {
      return res.status(400).json({
        success: false,
        message: "इस ऑर्डर से कोई उपयोगकर्ता जुड़ा नहीं है।",
      });
    }

    /* ========================================================
       GENERATE RECEIPT NUMBER
    ======================================================== */

    const datePart = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

    const receiptNumber = `RC-${datePart}-${String(order._id)
      .slice(-6)
      .toUpperCase()}`;

    /* ========================================================
       UPSERT ORDER RECEIPT
    ======================================================== */

    const existing = await OrderReceipt.findOne({ orderId: order._id });

    const receiptData = {
      orderId: order._id,
      userId: order.userId,
      receiptNumber,
      totalAmount: Number(order.totalAmount || 0),
      discountAmount: Number(order.discountAmount || 0),
    };

    let receipt;

    if (existing) {
      Object.assign(existing, receiptData);
      receipt = await existing.save();
    } else {
      receipt = await OrderReceipt.create(receiptData);
    }

    /* ========================================================
       NOTIFY USER VIA ONESIGNAL
    ======================================================== */

    let notified = false;

    const user = await User.findById(order.userId);

    if (user && user.oneSignalSubscriptionId) {
      try {
        await sendNotification({
          subscriptionId: user.oneSignalSubscriptionId,
          title: "🧾 आपकी रसीद तैयार है",
          message:
            "अपने ऑर्डर की रसीद देखने और डाउनलोड करने के लिए यहाँ टैप करें।",
          url: `https://esetu.vercel.app/orders?receipt=${order._id}`,
        });

        receipt.notifiedAt = new Date();
        receipt.status = "Notified";
        await receipt.save();

        notified = true;
      } catch (notificationError) {
        console.error("Receipt notification failed:", notificationError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "रसीद बना दी गई है।",
      notified,
      receipt,
    });
  } catch (error) {
    console.error("Generate Order Receipt Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   GET ORDER RECEIPT (ON-SCREEN VIEW)
   USER
============================================================ */

export const getOrderReceipt = async (req, res) => {
  try {
    const { orderId } = req.params;

    const userId = req.userId;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "आप इस रसीद को देखने के लिए अधिकृत नहीं हैं।",
      });
    }

    const receipt = await OrderReceipt.findOne({ orderId: order._id });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "इस ऑर्डर के लिए अभी रसीद नहीं बनी है।",
      });
    }

    const populatedOrder = await Order.findById(order._id)
      .populate(
        "userId",
        "firstName lastName phoneNumber address place zipCode",
      )
      .lean();

    return res.status(200).json({
      success: true,
      receipt: {
        receiptNumber: receipt.receiptNumber,
        generatedAt: receipt.generatedAt,
        notifiedAt: receipt.notifiedAt,
        status: receipt.status,
        totalAmount: receipt.totalAmount,
        discountAmount: receipt.discountAmount,
      },
      order: {
        ...populatedOrder,
        _id: populatedOrder._id,
      },
    });
  } catch (error) {
    console.error("Get Order Receipt Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   DOWNLOAD ORDER RECEIPT PDF
   USER
============================================================ */

export const downloadOrderReceiptPdf = async (req, res) => {
  try {
    const { orderId } = req.params;

    const userId = req.userId;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (String(order.userId) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "आप इस रसीद को डाउनलोड करने के लिए अधिकृत नहीं हैं।",
      });
    }

    const receipt = await OrderReceipt.findOne({ orderId: order._id });

    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "इस ऑर्डर के लिए अभी रसीद नहीं बनी है।",
      });
    }

    const pdfBuffer = await generateOrderReceiptPDF(order._id);

    res.setHeader("Content-Type", "application/pdf");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${receipt.receiptNumber}.pdf"`,
    );

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Download Order Receipt Pdf Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ============================================================
   UPDATE ORDER ITEMS
   ADMIN / SUPPLIER
============================================================ */

export const updateOrderItems = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { items } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required.",
      });
    }

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "Items must be an array.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.status === "Cancelled" || order.status === "Declined") {
      return res.status(400).json({
        success: false,
        message: "This order cannot be modified.",
      });
    }

    /* ========================================================
       OLD ITEMS
    ======================================================== */

    const oldItems = order.items.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      companyName: item.companyName || "",
      qty: Number(item.qty),
      price: Number(item.price),
      total: Number(item.total),
      measurement: item.measurement,
    }));

    /* ========================================================
       BUILD NEW ITEMS
    ======================================================== */

    const updatedItems = [];

    for (const item of items) {
      const qty = Number(item.qty);
      const price = Number(item.price);

      /*
       * qty 0 means remove item
       */

      if (!Number.isFinite(qty) || qty <= 0) {
        continue;
      }

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid price for ${item.name || "product"}.`,
        });
      }

      updatedItems.push({
        productId: item.productId,

        name: item.name || "",

        hinglishName: item.hinglishName || "",

        image: item.image || "",

        companyId: item.companyId || null,

        companyName: item.companyName || "",

        categoryId: item.categoryId || null,

        categoryName: item.categoryName || "",

        measurement: item.measurement || "",

        qty,

        price,

        total: qty * price,
      });
    }

    if (updatedItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item.",
      });
    }

    /* ========================================================
       DETECT CHANGES
    ======================================================== */

    const changedItems = [];

    /*
     * Existing / removed / quantity changed
     */

    for (const oldItem of oldItems) {
      const newItem = items.find(
        (item) => item.originalItemId?.toString() === oldItem.id,
      );

      /*
       * Removed
       */

      if (!newItem || Number(newItem.qty) <= 0) {
        changedItems.push({
          type: "removed",
          name: oldItem.name,
          companyName: oldItem.companyName,
          oldQty: oldItem.qty,
          newQty: 0,
        });

        continue;
      }

      /*
       * Quantity changed
       */

      if (Number(newItem.qty) !== oldItem.qty) {
        changedItems.push({
          type: "quantity",
          name: oldItem.name,
          companyName: oldItem.companyName,
          oldQty: oldItem.qty,
          newQty: Number(newItem.qty),
        });
      }
    }

    /*
     * New items
     */

    for (const item of items) {
      if (!item.originalItemId && Number(item.qty) > 0) {
        changedItems.push({
          type: "added",
          name: item.name,
          companyName: item.companyName || "",
          oldQty: 0,
          newQty: Number(item.qty),
        });
      }
    }

    /* ========================================================
       NEW TOTAL
    ======================================================== */

    const newTotalAmount = updatedItems.reduce(
      (sum, item) => sum + Number(item.total || 0),
      0,
    );

    /* ========================================================
       SAVE
    ======================================================== */

    order.items = updatedItems;

    order.totalAmount = newTotalAmount;

    order.modificationCount = Number(order.modificationCount || 0) + 1;

    order.lastModifiedAt = new Date();

    await order.save();

    /* ========================================================
       GET UPDATED ORDER WITH USER
    ======================================================== */

    const updatedOrder = await Order.findById(order._id)
      .populate(
        "userId",
        "firstName lastName phoneNumber address place zipCode profilePic oneSignalSubscriptionId",
      )
      .lean();

    /* ========================================================
       USER NOTIFICATION
    ======================================================== */

    if (changedItems.length > 0) {
      try {
        const user = await User.findById(order.userId).select(
          "firstName lastName oneSignalSubscriptionId",
        );

        if (user?.oneSignalSubscriptionId) {
          const orderDate = new Date(order.createdAt).toLocaleDateString(
            "hi-IN",
            {
              day: "numeric",
              month: "long",
              year: "numeric",
            },
          );

          const orderIdShort = order._id.toString().slice(-6).toUpperCase();

          let changeText = "आपके ऑर्डर में कुछ बदलाव किए गए हैं।";

          if (changedItems.length === 1) {
            const change = changedItems[0];

            if (change.type === "removed") {
              changeText = `${change.name} ऑर्डर से हटा दिया गया है।`;
            }

            if (change.type === "quantity") {
              changeText = `${change.name} की मात्रा ${change.oldQty} से ${change.newQty} कर दी गई है।`;
            }

            if (change.type === "added") {
              changeText = `${change.name} ऑर्डर में जोड़ा गया है।`;
            }
          } else {
            changeText = `आपके ऑर्डर में ${changedItems.length} बदलाव किए गए हैं।`;
          }

          await sendNotification({
            subscriptionId: user.oneSignalSubscriptionId,

            title: "🔔 ऑर्डर में बदलाव हुआ",

            message:
              `${orderDate} के ऑर्डर #${orderIdShort} में बदलाव किया गया है। ` +
              `${changeText} नया कुल ₹${newTotalAmount.toLocaleString(
                "en-IN",
              )}.`,

            data: {
              type: "ORDER_UPDATED",
              action: "VIEW_UPDATED_ORDER",
              orderId: order._id.toString(),
              updatedAt: new Date().toISOString(),
            },
          });
        }
      } catch (notificationError) {
        console.log(
          "Order updated but notification failed:",
          notificationError.message,
        );
      }
    }

    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,
      message: "Order updated successfully.",
      order: updatedOrder,
      changedItems,
      newTotalAmount,
    });
  } catch (error) {
    console.log("UPDATE ORDER ITEMS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDailyApprovedItems = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    /* ========================================================
       VALIDATE DATE FORMAT
    ======================================================== */

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD",
      });
    }

    /* ========================================================
       DATE RANGE - ASIA/KOLKATA
    ======================================================== */

    const startOfDay = new Date(`${date}T00:00:00+05:30`);

    const endOfDay = new Date(`${date}T23:59:59.999+05:30`);

    if (
      Number.isNaN(startOfDay.getTime()) ||
      Number.isNaN(endOfDay.getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    /* ========================================================
       AGGREGATION
    ======================================================== */

    const items = await Order.aggregate([
      /* ======================================================
         1. ONLY APPROVED ORDERS FOR SELECTED DAY
      ====================================================== */

      {
        $match: {
          status: "Approved",

          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        },
      },

      /* ======================================================
         2. UNWIND ITEMS
      ====================================================== */

      {
        $unwind: "$items",
      },

      /* ======================================================
         3. LOOKUP USER

         IMPORTANT:
         Order.userId may be stored as String while
         User._id is ObjectId.

         Therefore convert userId to ObjectId safely.
      ====================================================== */

      {
        $lookup: {
          from: "users",

          let: {
            userObjectId: {
              $convert: {
                input: "$userId",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },

          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$userObjectId"],
                },
              },
            },

            {
              $project: {
                _id: 1,
                firstName: 1,
                lastName: 1,
                name: 1,
                fullName: 1,
                shopName: 1,
                profilePic: 1,
                phoneNumber: 1,
                email: 1,
                address: 1,
              },
            },
          ],

          as: "user",
        },
      },

      /* ======================================================
         4. USER ARRAY -> OBJECT
      ====================================================== */

      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* ======================================================
         5. GROUP PRODUCT + USER

         Same user + same product + same company +
         same measurement = one entry.
      ====================================================== */

      {
        $group: {
          _id: {
            productId: "$items.productId",
            companyId: "$items.companyId",
            measurement: "$items.measurement",
            userId: "$userId",
          },

          /* ==================================================
             PRODUCT INFORMATION
          ================================================== */

          productName: {
            $first: "$items.name",
          },

          hinglishName: {
            $first: "$items.hinglishName",
          },

          image: {
            $first: "$items.image",
          },

          companyName: {
            $first: "$items.companyName",
          },

          categoryName: {
            $first: "$items.categoryName",
          },

          measurement: {
            $first: "$items.measurement",
          },

          /* ==================================================
             USER INFORMATION
          ================================================== */

          firstName: {
            $first: "$user.firstName",
          },

          lastName: {
            $first: "$user.lastName",
          },

          userName: {
            $first: {
              $ifNull: [
                "$user.name",
                {
                  $ifNull: ["$user.fullName", "$user.shopName"],
                },
              ],
            },
          },

          userProfilePic: {
            $first: "$user.profilePic",
          },

          /* ==================================================
             USER QUANTITY
          ================================================== */

          userQuantity: {
            $sum: "$items.qty",
          },

          /* ==================================================
             USER TOTAL
          ================================================== */

          userTotal: {
            $sum: "$items.total",
          },
        },
      },

      /* ======================================================
         6. GROUP PRODUCT AGAIN
      ====================================================== */

      {
        $group: {
          _id: {
            productId: "$_id.productId",
            companyId: "$_id.companyId",
            measurement: "$_id.measurement",
          },

          /* ==================================================
             PRODUCT INFORMATION
          ================================================== */

          productName: {
            $first: "$productName",
          },

          hinglishName: {
            $first: "$hinglishName",
          },

          image: {
            $first: "$image",
          },

          companyName: {
            $first: "$companyName",
          },

          categoryName: {
            $first: "$categoryName",
          },

          measurement: {
            $first: "$measurement",
          },

          /* ==================================================
             TOTAL QUANTITY
          ================================================== */

          totalQuantity: {
            $sum: "$userQuantity",
          },

          /* ==================================================
             TOTAL AMOUNT
          ================================================== */

          totalAmount: {
            $sum: "$userTotal",
          },

          /* ==================================================
             NUMBER OF USERS
          ================================================== */

          userCount: {
            $sum: 1,
          },

          /* ==================================================
             USERS
          ================================================== */

          orderedBy: {
            $push: {
              userId: "$_id.userId",

              firstName: {
                $ifNull: ["$firstName", ""],
              },

              lastName: {
                $ifNull: ["$lastName", ""],
              },

              userName: {
                $ifNull: ["$userName", "Unknown User"],
              },

              profilePic: "$userProfilePic",

              quantity: "$userQuantity",

              total: "$userTotal",
            },
          },
        },
      },

      /* ======================================================
         7. SORT PRODUCTS
      ====================================================== */

      {
        $sort: {
          categoryName: 1,
          productName: 1,
          companyName: 1,
          measurement: 1,
        },
      },

      /* ======================================================
         8. FINAL RESPONSE
      ====================================================== */

      {
        $project: {
          _id: 0,

          productId: "$_id.productId",

          companyId: "$_id.companyId",

          productName: 1,

          hinglishName: 1,

          image: 1,

          companyName: 1,

          categoryName: 1,

          measurement: 1,

          totalQuantity: 1,

          totalAmount: 1,

          userCount: 1,

          orderedBy: 1,
        },
      },
    ]);

    /* ========================================================
       RESPONSE
    ======================================================== */

    return res.status(200).json({
      success: true,

      date,

      count: items.length,

      items,
    });
  } catch (error) {
    console.error("Get daily approved items error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch daily approved items",
    });
  }
};
