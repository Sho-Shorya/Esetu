import { Cart } from "../models/cartModel.js";
import { User } from "../models/userModel.js";
import { Order } from "../models/orderModel.js";

/* ============================================================
   ONLINE PAYMENT DISCOUNT
============================================================ */

const ONLINE_DISCOUNT_PERCENT = 2;

/* ============================================================
   GET TODAY RANGE - INDIA
============================================================ */

const getTodayDateRange = () => {
  const now = new Date();

  // Current date in India
  const indiaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, day] = indiaDate.split("-").map(Number);

  // Start of today in IST
  const start = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0",
    )}T00:00:00+05:30`,
  );

  // End of today in IST
  const end = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0",
    )}T23:59:59.999+05:30`,
  );

  return { start, end };
};

/* ============================================================
   GET TODAY CUTOFF
   Default: 11:00 AM IST

   If your cutoff is different, change only this function.
============================================================ */

const getTodayCutoff = () => {
  const now = new Date();

  const indiaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const [year, month, day] = indiaDate.split("-").map(Number);

  return new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
      2,
      "0",
    )}T11:00:00+05:30`,
  );
};

/* ============================================================
   CALCULATE ORDER TOTAL
============================================================ */

const calculateOrderTotal = (items = []) => {
  return items.reduce((total, item) => {
    const itemTotal = Number(item.total || 0);

    return total + (Number.isFinite(itemTotal) ? itemTotal : 0);
  }, 0);
};

/* ============================================================
   CHECK CUTOFF
============================================================ */

const isCutoffPassed = (cutoffTime) => {
  if (!cutoffTime) return false;

  return new Date() >= new Date(cutoffTime);
};

/* ============================================================
   CREATE ORDER AFTER SUCCESSFUL ONLINE PAYMENT
============================================================ */

export const createPaidOrderFromCart = async ({
  userId,
  transactionId,
  paymentTransactionId = null,
}) => {
  try {
    /* ========================================================
       1. BASIC VALIDATION
    ======================================================== */

    if (!userId) {
      throw new Error("User ID is required.");
    }

    if (!transactionId) {
      throw new Error("Payment transaction ID is required.");
    }

    /* ========================================================
       2. PREVENT DUPLICATE ORDER
    ======================================================== */

    const existingConditions = [{ transactionId }];

    if (paymentTransactionId) {
      existingConditions.push({
        paymentTransactionId,
      });
    }

    const existingOrder = await Order.findOne({
      $or: existingConditions,
    });

    if (existingOrder) {
      return {
        order: existingOrder,
        alreadyCreated: true,
      };
    }

    /* ========================================================
       3. GET USER + CART
    ======================================================== */

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

    /* ========================================================
       4. VALIDATE USER
    ======================================================== */

    if (!user) {
      throw new Error("User not found.");
    }

    /* ========================================================
       5. VALIDATE CART
    ======================================================== */

    if (!cart) {
      throw new Error("Cart not found.");
    }

    if (!Array.isArray(cart.items) || cart.items.length === 0) {
      throw new Error("Cart is empty.");
    }

    /* ========================================================
       6. GET TODAY'S PENDING ORDER
    ======================================================== */

    const { start, end } = getTodayDateRange();

    let order = await Order.findOne({
      userId,
      status: "Pending",
      isTodayOrder: true,
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    /* ========================================================
       7. CHECK CUTOFF FOR EXISTING ORDER
    ======================================================== */

    if (order && isCutoffPassed(order.cutoffTime)) {
      throw new Error("आज का ऑर्डर अब एडिट नहीं किया जा सकता।");
    }

    /* ========================================================
       8. CONVERT CART → ORDER ITEMS
    ======================================================== */

    const orderItems = cart.items.map((cartItem) => {
      const product = cartItem.productId;
      const company = cartItem.company;

      const qty = Number(cartItem.qty || 0);

      let price = Number(cartItem.price);

      /*
       * Old cart items may not have price.
       * Calculate from total / quantity.
       */

      if (!Number.isFinite(price)) {
        const oldTotal = Number(cartItem.total || 0);

        price = qty > 0 ? oldTotal / qty : 0;
      }

      let total = Number(cartItem.total);

      /*
       * If total doesn't exist, calculate it.
       */

      if (!Number.isFinite(total)) {
        total = price * qty;
      }

      return {
        productId: product?._id || null,

        name: product?.name || "Unknown Product",

        hinglishName: product?.hinglishName || "",

        image: product?.media?.[0] || "",

        companyId: company?._id || null,

        companyName: company?.name || "",

        categoryId: product?.category?._id || product?.category || null,

        categoryName: product?.category?.name || "",

        measurement: cartItem.measurement || "",

        qty,

        price,

        total,
      };
    });

    /* ========================================================
       9. VALIDATE ITEMS
    ======================================================== */

    const invalidItem = orderItems.find((item) => {
      return (
        !item.productId ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.price) ||
        item.price < 0 ||
        !Number.isFinite(item.total) ||
        item.total < 0
      );
    });

    if (invalidItem) {
      throw new Error("Some cart items contain invalid data.");
    }

    /* ========================================================
       10. CALCULATE ORIGINAL TOTAL
    ======================================================== */

    const cartOriginalTotal = Number(
      calculateOrderTotal(orderItems).toFixed(2),
    );

    if (!Number.isFinite(cartOriginalTotal) || cartOriginalTotal <= 0) {
      throw new Error("Invalid order amount.");
    }

    /* ========================================================
       11. 2% ONLINE DISCOUNT
    ======================================================== */

    const discountAmount = Number(
      ((cartOriginalTotal * ONLINE_DISCOUNT_PERCENT) / 100).toFixed(2),
    );

    const paidAmount = Number((cartOriginalTotal - discountAmount).toFixed(2));

    /* ========================================================
       12. EXISTING TODAY'S ORDER
    ======================================================== */

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

      /* ------------------------------------------------------
         Recalculate entire order
      ------------------------------------------------------ */

      const updatedOriginalTotal = Number(
        calculateOrderTotal(order.items).toFixed(2),
      );

      const updatedDiscount = Number(
        ((updatedOriginalTotal * ONLINE_DISCOUNT_PERCENT) / 100).toFixed(2),
      );

      const updatedPaidAmount = Number(
        (updatedOriginalTotal - updatedDiscount).toFixed(2),
      );

      order.originalTotalAmount = updatedOriginalTotal;

      order.discountAmount = updatedDiscount;

      order.totalAmount = updatedPaidAmount;

      order.paymentMethod = "Online";

      order.paymentStatus = "Paid";

      order.paymentTransactionId = paymentTransactionId || transactionId;

      order.transactionId = transactionId;

      order.paymentPaidAt = new Date();

      await order.save();
    } else {
      /* ========================================================
       13. CREATE NEW ORDER
    ======================================================== */
      const cutoffTime = getTodayCutoff();

      order = await Order.create({
        userId,

        items: orderItems,

        originalTotalAmount: cartOriginalTotal,

        discountAmount,

        totalAmount: paidAmount,

        shippingAddress: user.address || "",

        paymentMethod: "Online",

        paymentStatus: "Paid",

        paymentTransactionId: paymentTransactionId || transactionId,

        transactionId,

        paymentPaidAt: new Date(),

        status: "Pending",

        isTodayOrder: true,

        cutoffTime,
      });
    }

    /* ========================================================
       14. CLEAR CART
    ======================================================== */

    cart.items = [];

    cart.totalPrice = 0;

    await cart.save();

    /* ========================================================
       15. RETURN SUCCESS
    ======================================================== */

    return {
      order,
      alreadyCreated: false,
    };
  } catch (error) {
    console.error("createPaidOrderFromCart error:", error);

    throw error;
  }
};
