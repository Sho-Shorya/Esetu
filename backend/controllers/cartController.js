import { Cart } from "../models/cartModel.js";
import Product from "../models/productModel.js";
import { User } from "../models/userModel.js";
import { Order } from "../models/orderModel.js";
// removed sendOrderEmail import to avoid sending emails during checkout

export const getCart = async (req, res) => {
  try {
    const userId = req.userId;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
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
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity: 1, price: product.productPrice }],
        totalPrice: product.productPrice,
      });
    } else {
      const itemsIndex = cart.items.findIndex(
        (item) => item.productId.toString() === productId,
      );
      if (itemsIndex > -1) {
        cart.items[itemsIndex].quantity += 1;
      } else {
        cart.items.push({
          productId,
          quantity: 1,
          price: product.productPrice,
        });
      }

      cart.totalPrice = cart.items.reduce(
        (acc, item) => acc + (item.price || 0) * (item.quantity || 0),
        0,
      );
    }

    await cart.save();

    //populate product details before sending responce
    const populatedCart = await Cart.findById(cart._id).populate(
      "items.productId",
    );
    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      cart: populatedCart,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const UpdateQuantity = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId, type } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.find(
      (item) => item.productId.toString() === productId,
    );
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: "Item not found" });
    if (type === "increase") item.quantity += 1;
    if (type === "decrease" && item.quantity > 1) item.quantity -= 1;

    cart.totalPrice = cart.items.reduce(
      (acc, item) => acc + (item.price || 0) * (item.quantity || 0),
      0,
    );

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
    const { productId } = req.body;

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(400).json({
        success: false,
        message: "Cart not found",
      });
    }
    cart.items = cart.items.filter(
      (item) => item.productId.toString() != productId,
    );
    cart.totalPrice = cart.items.reduce(
      (acc, item) => acc + (item.price || 0) * (item.quantity || 0),
      0,
    );

    await cart.save();
    const populatedCart = await Cart.findById(cart._id).populate(
      "items.productId",
    );
    return res.status(200).json({
      success: true,
      cart: populatedCart,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
