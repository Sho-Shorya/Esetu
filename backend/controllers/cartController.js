import { Cart } from "../models/cartModel.js";
import Product from "../models/productModel.js";
import { User } from "../models/userModel.js";
import { Order } from "../models/orderModel.js";
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
    const qty = Number(req.body.qty) || 1;
    const { productId, company, measurement } = req.body;
    // Check product
    const product =
      await Product.findById(productId).populate("variants.company");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Find selected variant
    const selectedVariant = product.variants.find(
      (variant) =>
        variant.company._id.toString() === company &&
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

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
      });
    }

    const existingIndex = cart.items.findIndex(
      (item) =>
        item.productId.toString() === productId &&
        item.company.toString() === company &&
        item.measurement === measurement,
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].qty += qty;
      cart.items[existingIndex].price = selectedVariant.price;
      cart.items[existingIndex].total =
        cart.items[existingIndex].qty * selectedVariant.price;
    } else {
      const total = selectedVariant.price * qty;

      cart.items.push({
        productId,
        company,
        measurement,
        qty,
        price: selectedVariant.price,
        total,
      });
    }
    const total = selectedVariant.price * qty;

    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.total, 0);

    await cart.save();

    const populatedCart = await Cart.findById(cart._id)
      .populate("items.productId")
      .populate("items.company");

    return res.status(200).json({
      success: true,
      message: "कार्ट में जोड़ा गया!",
      cart: populatedCart,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
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
    const userId = req.userId;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const orderItems = cart.items.map((item) => ({
      productId: item.productId?._id,
      name: item.productId?.productName || "Product",
      quantity: item.quantity,
      price: item.price,
      total: (item.price || 0) * (item.quantity || 0),
    }));

    const orderTotal = cart.items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0,
    );

    const order = await Order.create({
      userId,
      items: orderItems,
      totalAmount: orderTotal,
      status: "Processing",
      shippingAddress: user.address || "",
      paymentMethod: "COD",
    });

    cart.items = [];
    cart.totalPrice = 0;
    await cart.save();

    return res.status(200).json({
      success: true,
      message: "Order placed successfully. Thank you!",
      cart: { items: [] },
      order,
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
