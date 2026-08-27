import Product from "../models/productModel.js";
import cloudinary from "../utils/cloudinary.js";
import getDataUri from "../utils/dataUri.js";
import { uploadOnCloudinary } from "../utils/uploadOnCloudinary.js";
export const addProduct = async (req, res) => {
  try {
    // =====================================================
    // GET BASIC PRODUCT DATA
    // =====================================================

    const { name, hinglishName, category, description } = req.body;

    let { variants, keywords } = req.body;

    // =====================================================
    // BASIC VALIDATION
    // =====================================================

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "प्रोडक्ट का नाम भरें",
      });
    }

    if (!hinglishName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "हिंग्लिश नाम भरें",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "कैटेगरी चुनें",
      });
    }

    if (!variants) {
      return res.status(400).json({
        success: false,
        message: "कम से कम एक वेरिएंट जोड़ें",
      });
    }

    // =====================================================
    // PARSE VARIANTS
    // =====================================================

    try {
      variants = typeof variants === "string" ? JSON.parse(variants) : variants;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Variants data गलत है",
      });
    }

    // =====================================================
    // VALIDATE VARIANTS
    // =====================================================

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        message: "कम से कम एक वेरिएंट जोड़ें",
      });
    }

    // =====================================================
    // PARSE KEYWORDS
    // =====================================================

    try {
      keywords = typeof keywords === "string" ? JSON.parse(keywords) : keywords;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Keywords data गलत है",
      });
    }

    // =====================================================
    // CLEAN KEYWORDS
    // =====================================================

    if (!Array.isArray(keywords)) {
      keywords = [];
    }

    keywords = [
      ...new Set(
        keywords.map((keyword) => String(keyword).trim()).filter(Boolean),
      ),
    ];

    // =====================================================
    // UPLOAD PRODUCT IMAGE
    // =====================================================

    let image = "";

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.buffer);

      image = uploaded?.secure_url || "";
    }

    // =====================================================
    // CREATE PRODUCT
    // =====================================================

    const newProduct = await Product.create({
      name: name.trim(),
      hinglishName: hinglishName.trim(),
      category,
      image,
      variants,
      keyword: keywords,
      description,
    });

    // =====================================================
    // SUCCESS RESPONSE
    // =====================================================

    return res.status(201).json({
      success: true,
      message: "Product Added Successfully",
      product: newProduct,
    });
  } catch (error) {
    console.error("Add Product Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "कुछ गलत हो गया",
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
      message: "प्रोडक्ट सफलतापूर्वक डिलीट हो गया।",
      productId,
    });
  } catch (error) {
    console.log("Delete Product Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, hinglishName, category, keyword } = req.body;

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
      const uploaded = await uploadOnCloudinary(req.file.buffer);

      image = uploaded?.secure_url || product.image;
    }

    if (variants) {
      variants = JSON.parse(variants);
    }

    product.name = name || product.name;
    product.hinglishName = hinglishName || product.hinglishName;
    product.category = category || product.category;
    if (keyword) {
      product.keyword = JSON.parse(keyword);
    }
    product.image = image;
    product.variants = variants || product.variants;

    await product.save();

    const updatedProduct = await Product.findById(product._id)
      .populate("category")
      .populate("variants.company");

    return res.status(200).json({
      success: true,
      message: "प्रोडक्ट अपडेट हो गया।",
      product: updatedProduct,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate("category")
      .populate("variants.company");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get Product Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
