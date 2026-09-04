import Category from "../models/categoryModel.js";
import Product from "../models/productModel.js";

export const listCategories = async (_, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    const categoryIds = categories.map((c) => c._id);

    const productCounts = await Product.aggregate([
      { $match: { category: { $in: categoryIds } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    productCounts.forEach((p) => {
      countMap[p._id.toString()] = p.count;
    });

    const result = categories.map((c) => ({
      _id: c._id,
      name: c.name,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      productCount: countMap[c._id.toString()] || 0,
    }));

    return res.status(200).json({ success: true, categories: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const products = await Product.find({ category: id })
      .select("name hinglishName isActive")
      .sort({ name: 1 });

    return res.status(200).json({ success: true, category, products });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    const existing = await Category.findOne({ name });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }

    const category = await Category.create({ name });

    return res.status(201).json({
      success: true,
      category,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const category = await Category.findById(id);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    if (name) category.name = name;

    await category.save();
    return res.status(200).json({ success: true, category });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });

    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `इस कैटेगरी में ${productCount} प्रोडक्ट हैं। पहले प्रोडक्ट हटाएँ।`,
      });
    }

    await Category.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
