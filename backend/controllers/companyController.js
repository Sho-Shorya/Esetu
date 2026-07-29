import Company from "../models/companiesModel.js";
import { uploadOnCloudinary } from "../utils/uploadOnCloudinary.js";

// ================= ADD COMPANY =================

export const addCompany = async (req, res) => {
  try {
    const { name } = req.body;
    let { categories } = req.body;

    if (!name || !categories) {
      return res.status(400).json({
        success: false,
        message: "सभी जानकारी भरें",
      });
    }

    categories = JSON.parse(categories);

    const alreadyExists = await Company.findOne({
      name: name.trim(),
    });

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: "कंपनी पहले से मौजूद है",
      });
    }

    let logo = "";

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.buffer);
      logo = uploaded?.secure_url || "";
    }

    const company = await Company.create({
      name,
      logo,
      categories,
    });

    return res.status(201).json({
      success: true,
      message: "कंपनी जोड़ दी गई",
      company,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ALL =================

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find()
      .populate("categories", "name")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      companies,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= GET ONE =================

export const getCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId).populate("categories");

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "कंपनी नहीं मिली",
      });
    }

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= UPDATE =================

export const updateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name } = req.body;

    let { categories } = req.body;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "कंपनी नहीं मिली",
      });
    }

    if (categories) {
      categories = JSON.parse(categories);
    }

    let logo = company.logo;

    if (req.file) {
      const uploaded = await uploadOnCloudinary(req.file.path);
      logo = uploaded?.secure_url || company.logo;
    }

    company.name = name || company.name;
    company.logo = logo;
    company.categories = categories || company.categories;

    await company.save();

    return res.status(200).json({
      success: true,
      message: "कंपनी अपडेट हो गई",
      company,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= DELETE =================

export const deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "कंपनी नहीं मिली",
      });
    }

    await Company.findByIdAndDelete(companyId);

    return res.status(200).json({
      success: true,
      message: "कंपनी हटा दी गई",
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
