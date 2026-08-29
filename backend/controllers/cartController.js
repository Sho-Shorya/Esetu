import { Cart } from "../models/cartModel.js";
import Product from "../models/productModel.js";
import { Order } from "../models/orderModel.js";
// removed sendOrderEmail import to avoid sending emails during checkout

/* ============================================================
   PER-USER LOCK
   Serializes each user's cart mutations so concurrent requests
   cannot overwrite each other's whole-document saves.
============================================================ */

const userCartLocks = new Map();

const withUserLock = async (userId, task) => {
  const previous = userCartLocks.get(userId) ?? Promise.resolve();

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

  userCartLocks.set(userId, current);

  try {
    return await current;
  } finally {
    if (userCartLocks.get(userId) === current) {
      userCartLocks.delete(userId);
    }
  }
};

/* ============================================================
   HELPERS
============================================================ */

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const itemMatches = (item, productId, company, measurement) => {
  const itemProductId = item?.productId?.toString?.();
  const itemCompany = item?.company?.toString?.();

  if (!itemProductId || !itemCompany) {
    return false;
  }

  return (
    itemProductId === String(productId) &&
    itemCompany === String(company) &&
    item?.measurement === measurement
  );
};

export const getCart = async (req, res) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ userId })
      .populate("items.productId")
      .populate("items.company");
    if (!cart) {
      return res.status(200).json({ success: true, cart: { items: [] } });
    }
    return res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addToCart = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please login first",
      });
    }

    const { productId, company, measurement } = req.body;
    const qty = Number(req.body.qty) || 1;

    if (!productId || !company || !measurement) {
      return res.status(400).json({
        success: false,
        message: "Missing cart details",
      });
    }

    // =========================================================
    // 1. GET PRODUCT
    // =========================================================

    const product = await Product.findById(productId).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // =========================================================
    // 2. FIND VARIANT
    // =========================================================

    const selectedVariant = product.variants.find(
      (variant) =>
        variant.company?.toString() === company &&
        variant.measurement === measurement,
    );

    if (!selectedVariant) {
      return res.status(404).json({
        success: false,
        message: "Selected variant not found",
      });
    }

    if (!selectedVariant.available) {
      return res.status(400).json({
        success: false,
        message: "This item is currently unavailable",
      });
    }

    const price = Number(selectedVariant.price);

    // =========================================================
    // 3-7. MUTATE CART (serialized per user)
    // =========================================================

    const savedCart = await withUserLock(userId, async () => {
      let cart = await Cart.findOne({ userId });

      if (!cart) {
        cart = new Cart({
          userId,
          items: [],
          totalPrice: 0,
        });
      }

      const existingItem = cart.items.find((item) =>
        itemMatches(item, productId, company, measurement),
      );

      if (existingItem) {
        existingItem.qty += qty;
        existingItem.price = price;
        existingItem.total = existingItem.qty * price;
      } else {
        cart.items.push({
          productId,
          company,
          measurement,
          qty,
          price,
          total: qty * price,
        });
      }

      cart.totalPrice = cart.items.reduce(
        (sum, item) => sum + Number(item?.total || 0),
        0,
      );

      await cart.save();

      return cart;
    });

    // =========================================================
    // 8. RETURN LIGHTWEIGHT RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,
      message: "कार्ट में जोड़ा गया!",
      cart: {
        items: savedCart.items,
        totalPrice: savedCart.totalPrice,
      },
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    return res.status(error?.status || 500).json({
      success: false,
      message: error?.status ? error.message : "कार्ट में जोड़ने में समस्या हुई",
    });
  }
};

export const UpdateQuantity = async (req, res) => {
  try {
    const userId = req.userId;

    const { productId, company, measurement, type } = req.body;

    const savedCart = await withUserLock(userId, async () => {
      let cart = await Cart.findOne({ userId });

      if (!cart) {
        throw httpError(404, "Cart not found");
      }

      const item = cart.items.find((cartItem) =>
        itemMatches(cartItem, productId, company, measurement),
      );

      if (!item) {
        throw httpError(404, "Item not found");
      }

      if (type === "increase") {
        item.qty += 1;
      }

      if (type === "decrease" && item.qty > 1) {
        item.qty -= 1;
      }

      const product = await Product.findById(productId);

      if (!product) {
        throw httpError(404, "Product not found");
      }

      const variant = product.variants.find(
        (variant) =>
          variant.company?.toString() === company &&
          variant.measurement === measurement,
      );

      if (!variant) {
        throw httpError(404, "Variant not found");
      }

      item.price = variant.price;
      item.total = variant.price * item.qty;
      cart.totalPrice = cart.items.reduce(
        (sum, item) => sum + Number(item?.total || 0),
        0,
      );

      await cart.save();

      cart = await cart.populate("items.productId");

      return cart;
    });

    return res.status(200).json({
      success: true,
      cart: savedCart,
    });
  } catch (error) {
    console.error("Update quantity error:", error);

    return res.status(error?.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const checkoutCart = async (req, res) => {
  try {
    return res.status(403).json({
      success: false,
      message: "Online checkout is required. Use the payment flow instead.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const removeFromCart = async (req, res) => {
  try {
    const userId = req.userId;

    const { productId, company, measurement } = req.body;

    if (!productId || !company || !measurement) {
      return res.status(400).json({
        success: false,
        message: "Missing cart details",
      });
    }

    const savedCart = await withUserLock(userId, async () => {
      let cart = await Cart.findOne({ userId });

      if (!cart) {
        throw httpError(404, "Cart not found");
      }

      const before = cart.items.length;

      cart.items = cart.items.filter(
        (item) => !itemMatches(item, productId, company, measurement),
      );

      const removed = before !== cart.items.length;

      cart.totalPrice = cart.items.reduce(
        (sum, item) => sum + Number(item?.total || 0),
        0,
      );

      await cart.save();

      cart = await Cart.findById(cart._id).populate("items.productId");

      return { cart, removed };
    });

    return res.status(200).json({
      success: true,
      cart: savedCart.cart,
      removed: savedCart.removed,
    });
  } catch (error) {
    console.error("Remove from cart error:", error);

    return res.status(error?.status || 500).json({
      success: false,
      message: error.message,
    });
  }
};