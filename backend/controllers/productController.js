import Product from "../models/productModel.js";
import cloudinary from "../utils/cloudinary.js";
import getDataUri from "../utils/dataUri.js";
import { uploadOnCloudinary } from "../utils/uploadOnCloudinary.js";

export const addProduct = async (req, res) => {
  try {
    const { name, hinglishName, category } = req.body;

    let { variants } = req.body;

    if (!name || !hinglishName || !category || !variants) {
      return res.status(400).json({
        success: false,
        message: "सभी जानकारी भरें",
      });
    }

    variants = JSON.parse(variants);

    let image = "";

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.buffer);

      image = uploaded?.secure_url || "";
    }

    const newProduct = await Product.create({
      name,
      hinglishName,
      category,
      image,
      variants,
    });

    return res.status(201).json({
      success: true,
      message: "Product Added Successfully",
      product: newProduct,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getallproducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("category")
      .populate("variants.company")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product Not Found",
      });
    }

    await Product.findByIdAndDelete(productId);

    return res.status(200).json({
      success: true,
      message: "Product Deleted Successfully",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;

    const { name, hinglishName, category } = req.body;

    let { variants } = req.body;

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product Not Found",
      });
    }

    let image = product.image;

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.path);

      image = uploaded?.secure_url || product.image;
    }

    if (variants) {
      variants = JSON.parse(variants);
    }

    product.name = name || product.name;
    product.hinglishName = hinglishName || product.hinglishName;
    product.category = category || product.category;
    product.image = image;
    product.variants = variants || product.variants;

    await product.save();

    return res.status(200).json({
      success: true,
      message: "Product Updated Successfully",
      product,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
