import { Order } from "../models/orderModel.js";
import { Cart } from "../models/cartModel.js";
import { User } from "../models/userModel.js";
import Company from "../models/companiesModel.js";
import AppSetting from "../models/appSettingModel.js";
import { sendMobileNotification } from "../utils/sendMobileNotification.js";

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

/* ===========================================================
   Create / Merge Today's Order
=========================================================== */

export const addOrder = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first.",
      });
    }

    // Get User Cart
    const cart = await Cart.findOne({ userId })
      .populate({
        path: "items.productId",
        populate: { path: "category", select: "name" },
      })
      .populate("items.company");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    // Get User
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const { startToday, endToday } = getTodayDateRange();

    // Find Existing Pending Order for today only
    let order = await Order.findOne({
      userId,
      status: "Pending",
      isTodayOrder: true,
      createdAt: { $gte: startToday, $lte: endToday },
    });

    // If pending order exists check cutoff
    if (!(await isWithinOrderingWindow())) {
      return res.status(400).json({
        success: false,
        message: "ऑर्डर कटऑफ समय से पहले ही दिन में रखें।",
      });
    }

    if (order && isCutoffPassed(order.cutoffTime)) {
      return res.status(400).json({
        success: false,
        message: "आज का ऑर्डर अब एडिट नहीं किया जा सकता।",
      });
    }
    /* ===========================================
       MERGE INTO EXISTING ORDER
    =========================================== */

    if (order) {
      for (const cartItem of cart.items) {
        const existingItem = order.items.find(
          (item) =>
            item.productId.toString() === cartItem.productId._id.toString() &&
            item.companyId.toString() === cartItem.company._id.toString() &&
            item.measurement === cartItem.measurement,
        );

        // Same Product + Same Company + Same Variant
        if (existingItem) {
          existingItem.qty += cartItem.qty;
          existingItem.total += cartItem.total;
        }

        // New Variant
        else {
          order.items.push({
            productId: cartItem.productId._id,

            name: cartItem.productId.name,

            hinglishName: cartItem.productId.hinglishName || "",

            image: cartItem.productId.media?.[0] || "",

            companyId: cartItem.company._id,

            companyName: cartItem.company.name,

            categoryId:
              cartItem.productId.category?._id ||
              cartItem.productId.category ||
              null,

            categoryName:
              cartItem.productId.category?.name ||
              cartItem.productId.category ||
              "",

            measurement: cartItem.measurement,

            qty: cartItem.qty,

            price:
              cartItem.price ??
              (cartItem.qty ? cartItem.total / cartItem.qty : 0),

            total: cartItem.total,
          });
        }
      }

      order.totalAmount += cart.totalPrice;

      await order.save();
    } else {
      /* ===========================================
       CREATE NEW ORDER
    =========================================== */
      const orderItems = cart.items.map((cartItem) => ({
        productId: cartItem.productId._id,

        name: cartItem.productId.name,

        hinglishName: cartItem.productId.hinglishName || "",

        image: cartItem.productId.media?.[0] || "",

        companyId: cartItem.company._id,

        companyName: cartItem.company.name,

        categoryId:
          cartItem.productId.category?._id ||
          cartItem.productId.category ||
          null,

        categoryName:
          cartItem.productId.category?.name ||
          cartItem.productId.category ||
          "",

        measurement: cartItem.measurement,

        qty: cartItem.qty,

        price:
          cartItem.price ?? (cartItem.qty ? cartItem.total / cartItem.qty : 0),

        total: cartItem.total,
      }));

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

    /* ===========================================
       CLEAR USER CART
    =========================================== */

    cart.items = [];
    cart.totalPrice = 0;

    await cart.save();

    if (user?.phoneNumber) {
      await sendMobileNotification({
        phone: user.phoneNumber,
        title: "ऑर्डर सफलतापूर्वक रखा गया",
        body: `आपका ऑर्डर #${order._id?.slice(-6)} अब पेंडिंग है।`,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order placed successfully.",
      order,
    });
  } catch (error) {
    console.log("Add Order Error :", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
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

    return res.status(200).json({
      success: true,
      order,
      message: "Cutoff time updated successfully.",
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
        message: "Order is already locked.",
      });
    }

    if (isCutoffPassed(order.cutoffTime)) {
      return res.status(400).json({
        success: false,
        message: "Cutoff time has passed.",
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
      message: "Item removed successfully.",
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

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    // Valid status transitions
    if (!canMoveTo(order.status, status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change order from "${order.status}" to "${status}".`,
      });
    }

    order.status = status;

    switch (status) {
      case "Approved":
        order.approvedAt = new Date();
        break;

      case "Delivered":
        order.deliveredAt = new Date();
        order.isTodayOrder = false;
        break;

      case "Cancelled":
        order.cancelledAt = new Date();
        order.isTodayOrder = false;
        break;

      case "Declined":
        order.declinedAt = new Date();
        order.isTodayOrder = false;
        break;

      default:
        break;
    }

    await order.save();

    if (order.userId) {
      const notifiedUser = await User.findById(order.userId);
      if (notifiedUser?.phoneNumber) {
        await sendMobileNotification({
          phone: notifiedUser.phoneNumber,
          title: "ऑर्डर स्टेटस अपडेट",
          body: `ऑर्डर #${order._id?.slice(-6)} अब ${status} है।`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Order marked as ${status}.`,
      order,
    });
  } catch (error) {
    console.log("Update Order Status Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
