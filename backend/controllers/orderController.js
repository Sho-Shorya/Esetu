import { Order } from "../models/orderModel.js";
import { Cart } from "../models/cartModel.js";
import { User } from "../models/userModel.js";
import Company from "../models/companiesModel.js";
import AppSetting from "../models/appSettingModel.js";
import { sendNotification } from "../services/oneSignalService.js";

const DEFAULT_ORDER_CUTOFF = "12:00";

const getAppSetting = async (key) => {
  const record = await AppSetting.findOne({ key });
  return record?.value ?? null;
};

const parseCutoffValue = (value) => {
  const [hour = "12", minute = "00"] = String(value).split(":");
  const cutoff = new Date();
  cutoff.setHours(parseInt(hour, 10) || 12);
  cutoff.setMinutes(parseInt(minute, 10) || 0);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);
  return cutoff;
};

const getTodayCutoff = async () => {
  const settingValue = await getAppSetting("dailyOrderCutoff");
  const cutoff = parseCutoffValue(settingValue || DEFAULT_ORDER_CUTOFF);
  return cutoff;
};

const getTodayDateRange = () => {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);

  return { startToday, endToday };
};

const isCutoffPassed = (cutoffTime) => {
  return new Date() > cutoffTime;
};

const isWithinOrderingWindow = async () => {
  const cutoffTime = await getTodayCutoff();
  return new Date() <= cutoffTime;
};

export const syncTodayOrderFlags = async () => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const result = await Order.updateMany(
      { createdAt: { $lt: startOfToday }, isTodayOrder: true },
      { $set: { isTodayOrder: false } },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[order-sync] Moved ${result.modifiedCount} orders to history`,
      );
    }

    return result;
  } catch (error) {
    console.error("[order-sync] Failed to update today order flags:", error);
    throw error;
  }
};
/* ===========================================================
   Create / Merge Today's Order
=========================================================== */

export const addOrder = async (req, res) => {
  try {
    const userId = req.userId;

    // ========================================================
    // 1. AUTH CHECK
    // ========================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    // ========================================================
    // 2. GET CART + USER IN PARALLEL
    // ========================================================

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

    // ========================================================
    // 3. VALIDATE CART
    // ========================================================

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    // ========================================================
    // 4. VALIDATE USER
    // ========================================================

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // ========================================================
    // 5. CHECK ORDERING WINDOW
    // ========================================================

    const withinWindow = await isWithinOrderingWindow();

    if (!withinWindow) {
      return res.status(400).json({
        success: false,
        message: "ऑर्डर कटऑफ समय से पहले ही रखें।",
      });
    }

    // ========================================================
    // 6. TODAY RANGE
    // ========================================================

    const { startToday, endToday } = getTodayDateRange();

    // ========================================================
    // 7. FIND EXISTING TODAY'S PENDING ORDER
    // ========================================================

    let order = await Order.findOne({
      userId,
      status: "Pending",
      isTodayOrder: true,
      createdAt: {
        $gte: startToday,
        $lte: endToday,
      },
    });

    // ========================================================
    // 8. CHECK CUTOFF
    // ========================================================

    if (order && isCutoffPassed(order.cutoffTime)) {
      return res.status(400).json({
        success: false,
        message: "आज का ऑर्डर अब एडिट नहीं किया जा सकता।",
      });
    }

    // ========================================================
    // 9. BUILD ORDER ITEMS
    // ========================================================

    const orderItems = cart.items.map((cartItem) => ({
      productId: cartItem.productId._id,

      name: cartItem.productId.name,

      hinglishName: cartItem.productId.hinglishName || "",

      image: cartItem.productId.media?.[0] || "",

      companyId: cartItem.company._id,

      companyName: cartItem.company.name,

      categoryId:
        cartItem.productId.category?._id || cartItem.productId.category || null,

      categoryName: cartItem.productId.category?.name || "",

      measurement: cartItem.measurement,

      qty: cartItem.qty,

      price:
        cartItem.price ?? (cartItem.qty ? cartItem.total / cartItem.qty : 0),

      total: cartItem.total,
    }));

    // ========================================================
    // 10. CREATE / MERGE ORDER
    // ========================================================

    if (order) {
      for (const newItem of orderItems) {
        const existingItem = order.items.find(
          (item) =>
            item.productId.toString() === newItem.productId.toString() &&
            item.companyId.toString() === newItem.companyId.toString() &&
            item.measurement === newItem.measurement,
        );

        if (existingItem) {
          existingItem.qty += newItem.qty;

          existingItem.total += newItem.total;
        } else {
          order.items.push(newItem);
        }
      }

      order.totalAmount += cart.totalPrice;

      await order.save();
    } else {
      // ------------------------------------------------------
      // ONLY GET CUTOFF WHEN CREATING NEW ORDER
      // ------------------------------------------------------

      const cutoffTime = await getTodayCutoff();

      order = await Order.create({
        userId,

        items: orderItems,

        totalAmount: cart.totalPrice,

        shippingAddress: user.address,

        paymentMethod: "COD",

        cutoffTime,
      });
    }

    // ========================================================
    // 11. CLEAR CART
    // ========================================================

    cart.items = [];

    cart.totalPrice = 0;

    await cart.save();

    // ========================================================
    // 12. SEND RESPONSE IMMEDIATELY
    // ========================================================

    res.status(200).json({
      success: true,

      message: "ऑर्डर हो गया। ✅",

      order,
    });

    // ========================================================
    // 13. BACKGROUND NOTIFICATIONS
    //
    // IMPORTANT:
    // Everything below happens AFTER the response.
    // Notification failure will NOT affect the order.
    // ========================================================

    setImmediate(() => {
      sendOrderNotifications({
        user,
      }).catch((error) => {
        console.error("❌ Order notification background error:", error);
      });
    });
  } catch (error) {
    console.error("Add Order Error:", error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===========================================================
   ORDER NOTIFICATIONS
=========================================================== */

const sendOrderNotifications = async ({ user }) => {
  try {
    // ========================================================
    // CUSTOMER NOTIFICATION
    // ========================================================

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
          console.error("❌ Customer notification error:", error);
        }
      }, 3000);
    }

    // ========================================================
    // GET SUPPLIERS
    // ========================================================

    const suppliers = await User.find({
      role: "supplier",

      oneSignalSubscriptionId: {
        $exists: true,

        $nin: [null, ""],
      },
    }).select("firstName lastName oneSignalSubscriptionId");

    // ========================================================
    // NO SUPPLIERS
    // ========================================================

    if (suppliers.length === 0) {
      console.log("ℹ️ No suppliers with OneSignal subscription found.");

      return;
    }

    // ========================================================
    // CUSTOMER NAME
    // ========================================================

    const customerName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const displayCustomerName = customerName || "एक ग्राहक";

    // ========================================================
    // SUPPLIER NOTIFICATIONS
    // ========================================================

    await Promise.allSettled(
      suppliers.map(async (supplier) => {
        try {
          if (!supplier.oneSignalSubscriptionId) {
            return;
          }

          await sendNotification({
            subscriptionId: supplier.oneSignalSubscriptionId,

            title: `🟢 ${displayCustomerName} का ऑर्डर आया है`,

            message: "कृपया चेक करके, मंज़ूर या अस्वीकार करें।",

            sendToAll: false,
          });

          console.log(
            `✅ Supplier notification sent to ${supplier.firstName || "supplier"}`,
          );
        } catch (error) {
          console.error(
            `❌ Supplier notification failed for ${supplier._id}:`,
            error,
          );
        }
      }),
    );

    console.log(`📢 Supplier notifications processed: ${suppliers.length}`);
  } catch (error) {
    console.error("❌ sendOrderNotifications error:", error);
  }
};
/* ===========================================================
   Recalculate Order Total
=========================================================== */

const calculateOrderTotal = (items) => {
  return items.reduce((sum, item) => sum + item.total, 0);
};

/* ===========================================================
   Get Today's Orders (User)
=========================================================== */

export const getTodayOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { startToday, endToday } = getTodayDateRange();

    const orders = await Order.find({
      userId,
      createdAt: { $gte: startToday, $lte: endToday },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const { startToday, endToday } = getTodayDateRange();
    const orders = await Order.find({
      createdAt: { $gte: startToday, $lte: endToday },
    })
      .sort({ createdAt: -1 })
      .populate(
        "userId",
        "firstName lastName phoneNumber address place zipCode",
      );

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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

    const user = await User.findById(order.userId);

    const formattedTime = new Date(order.cutoffTime).toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      },
    );
    await sendNotification({
      sendToAll: true,
      title: `⏰ ${formattedTime} नया कट-ऑफ़ `,
      message: `ऑर्डर का कट-ऑफ़ समय ${formattedTime} कर दिया गया है।`,
    });
    return res.status(200).json({
      success: true,
      order,
      message: "कट-ऑफ़ समय अपडेट कर दिया गया है।.",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===========================================================
   Order History
=========================================================== */

export const getOrderHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { startToday } = getTodayDateRange();

    const orders = await Order.find({
      userId,
      createdAt: { $lt: startToday },
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* ===========================================================
   Remove Item From Pending Order
=========================================================== */

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

    // If no items remain, delete the order
    if (order.items.length === 0) {
      await Order.findByIdAndDelete(orderId);

      return res.status(200).json({
        success: true,
        deleted: true,
        message: "Order deleted because it became empty.",
      });
    }

    // Recalculate Total
    order.totalAmount = calculateOrderTotal(order.items);

    await order.save();

    return res.status(200).json({
      success: true,
      deleted: false,
      message: "आइटम हटा दिया गया।",
      order,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Admin can only approve or decline
    if (!["Approved", "Declined"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Only Approved or Declined status is allowed.",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Already processed
    if (order.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be updated.",
      });
    }

    order.status = status;

    if (status === "Approved") {
      order.approvedAt = new Date();
    }

    if (status === "Declined") {
      order.declinedAt = new Date();
      order.isTodayOrder = false;
    }

    await order.save();

    // Fetch populated order
    const updatedOrder = await Order.findById(order._id)
      .populate({
        path: "userId",
        select: "firstName lastName phoneNumber place profilePic",
      })
      .populate({
        path: "items.productId",
      });

    const user = await User.findById(order.userId);

    if (user?.oneSignalSubscriptionId) {
      if (status === "Approved") {
        await sendNotification({
          subscriptionId: user.oneSignalSubscriptionId,
          title: "🟢 ऑर्डर Approve हो गया!",
          message: "ऑर्डर जल्द ही आपकी लोकेशन पर डिलीवर कर दिया जाएगा!",
        });
      }

      if (status === "Declined") {
        await sendNotification({
          subscriptionId: user.oneSignalSubscriptionId,
          title: "🔴 ऑर्डर Decline कर दिया गया",
          message:
            "क्षमा करें, आपका ऑर्डर स्वीकार नहीं किया जा सका। अधिक जानकारी के लिए कृपया एडमिन से संपर्क करें।",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order ${status.toLowerCase()} successfully.`,
      order: updatedOrder,
    });
  } catch (error) {
    console.log("Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
