import Category from "../models/categoryModel.js";
import { uploadOnCloudinary } from "../utils/uploadOnCloudinary.js";

export const listCategories = async (_, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return res.status(200).json({ success: true, categories });
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
    return res.status(200).json({ success: true, category });
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

    let image = "";

    if (req.file) {
      // Upload to Cloudinary
      const uploaded = await uploadOnCloudinary(req.file.buffer);

      image = uploaded.secure_url;
    }

    const category = await Category.create({
      name,
      image,
      createdBy: req.userId,
    });

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
    const { name, description } = req.body;
    const category = await Category.findById(id);
    if (!category)
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    if (name) {
      category.name = name;
      category.slug = name.toLowerCase().trim().replace(/\s+/g, "-");
    }
    if (description !== undefined) category.description = description;
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
    await Category.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
