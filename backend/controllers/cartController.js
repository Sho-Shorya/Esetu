import { Cart } from "../models/cartModel.js";
import Product from "../models/productModel.js";
// removed sendOrderEmail import to avoid sending emails during checkout

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
    // 3. GET CART
    // =========================================================

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        totalPrice: 0,
      });
    }

    // =========================================================
    // 4. FIND EXISTING ITEM
    // =========================================================

    const existingItem = cart.items.find(
      (item) =>
        item.productId.toString() === productId &&
        item.company.toString() === company &&
        item.measurement === measurement,
    );

    // =========================================================
    // 5. UPDATE / ADD
    // =========================================================

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

    // =========================================================
    // 6. RECALCULATE CART TOTAL
    // =========================================================

    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.total, 0);

    // =========================================================
    // 7. SAVE
    // =========================================================

    await cart.save();

    // =========================================================
    // 8. RETURN LIGHTWEIGHT RESPONSE
    // =========================================================

    return res.status(200).json({
      success: true,
      message: "कार्ट में जोड़ा गया!",
      cart: {
        items: cart.items,
        totalPrice: cart.totalPrice,
      },
    });
  } catch (error) {
    console.error("Add to cart error:", error);

    return res.status(500).json({
      success: false,
      message: "कार्ट में जोड़ने में समस्या हुई",
    });
  }
};
export const UpdateQuantity = async (req, res) => {
  try {
    const userId = req.userId;

    const { productId, company, measurement, type } = req.body;

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.find(
      (item) =>
        item.productId.toString() === productId &&
        item.company.toString() === company &&
        item.measurement === measurement,
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    if (type === "increase") {
      item.qty += 1;
    }

    if (type === "decrease" && item.qty > 1) {
      item.qty -= 1;
    }

    const product = await Product.findById(productId);

    const variant = product.variants.find(
      (v) => v.company.toString() === company && v.measurement === measurement,
    );

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    item.price = variant.price;
    item.total = variant.price * item.qty;
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.total, 0);

    await cart.save();

    cart = await cart.populate("items.productId");

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

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    cart.items = cart.items.filter(
      (item) =>
        !(
          item.productId.toString() === productId &&
          item.company.toString() === company &&
          item.measurement === measurement
        ),
    );

    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.total, 0);

    await cart.save();

    cart = await Cart.findById(cart._id).populate("items.productId");

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
