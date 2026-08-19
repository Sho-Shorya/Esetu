import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import { IoArrowBackOutline } from "react-icons/io5";

import { RiImageUploadLine } from "react-icons/ri";

import { Edit, Trash2, Plus, X, Tag, Loader2 } from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";

import { addProduct } from "@/redux/ProductSlice";

const AddProduct = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const fileInputRef = useRef(null);

  // =====================================================
  // MODALS
  // =====================================================

  const [openCategoryModal, setOpenCategoryModal] = useState(false);

  const [openCompanyModal, setOpenCompanyModal] = useState(false);

  // =====================================================
  // LOADING
  // =====================================================

  const [loading, setLoading] = useState(false);

  const [categoryLoading, setCategoryLoading] = useState(false);

  const [companyLoading, setCompanyLoading] = useState(false);

  // =====================================================
  // PRODUCT
  // =====================================================

  const [product, setProduct] = useState({
    name: "",
    hinglishName: "",
    category: "",
    media: null,
    variants: [],
    keywords: [],
  });

  // =====================================================
  // VARIANT
  // =====================================================

  const [variant, setVariant] = useState({
    company: "",
    measurement: "",
    price: "",
    isAvailable: true,
  });

  // =====================================================
  // KEYWORD
  // =====================================================

  const [keywordInput, setKeywordInput] = useState("");

  // =====================================================
  // IMAGE
  // =====================================================

  const [preview, setPreview] = useState("");

  // =====================================================
  // CATEGORIES
  // =====================================================

  const [categories, setCategories] = useState([]);

  // =====================================================
  // COMPANIES
  // =====================================================

  const [companies, setCompanies] = useState([]);

  const [filteredCompanies, setFilteredCompanies] = useState([]);

  // =====================================================
  // CATEGORY FORM
  // =====================================================

  const [categoryName, setCategoryName] = useState("");

  const [categoryImage, setCategoryImage] = useState(null);

  // =====================================================
  // COMPANY FORM
  // =====================================================

  const [companyName, setCompanyName] = useState("");

  const [companyLogo, setCompanyLogo] = useState(null);

  const [selectedCategories, setSelectedCategories] = useState([]);

  // =====================================================
  // AUTH CONFIG
  // =====================================================

  const getAuthConfig = () => ({
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  // =====================================================
  // PRODUCT INPUT CHANGE
  // =====================================================

  const handleProductChange = (e) => {
    const { name, value } = e.target;

    setProduct((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // VARIANT INPUT CHANGE
  // =====================================================

  const handleVariantChange = (e) => {
    const { name, value } = e.target;

    setVariant((prev) => ({
      ...prev,
      [name]: name === "isAvailable" ? value === "true" : value,
    }));
  };

  // =====================================================
  // CATEGORY CHANGE
  // =====================================================

  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;

    setProduct((prev) => ({
      ...prev,
      category: categoryId,
    }));

    // Reset company whenever category changes
    setVariant((prev) => ({
      ...prev,
      company: "",
    }));

    if (!categoryId) {
      setFilteredCompanies([]);
      return;
    }

    const filtered = companies.filter((company) =>
      company.categories?.some((category) => {
        if (typeof category === "object" && category !== null) {
          return String(category._id) === String(categoryId);
        }

        return String(category) === String(categoryId);
      }),
    );

    setFilteredCompanies(filtered);
  };

  // =====================================================
  // IMAGE SELECT
  // =====================================================

  const handleImage = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("कृपया केवल image चुनें");

      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("फोटो 5MB से कम होनी चाहिए");

      e.target.value = "";
      return;
    }

    // Clean previous object URL
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    const imageUrl = URL.createObjectURL(file);

    setPreview(imageUrl);

    setProduct((prev) => ({
      ...prev,
      media: file,
    }));
  };

  // =====================================================
  // REMOVE IMAGE
  // =====================================================

  const removeImage = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }

    setPreview("");

    setProduct((prev) => ({
      ...prev,
      media: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // =====================================================
  // KEYWORD
  // =====================================================

  const addKeyword = () => {
    const keyword = keywordInput.trim();

    if (!keyword) return;

    const alreadyExists = product.keywords.some(
      (existingKeyword) =>
        existingKeyword.toLowerCase() === keyword.toLowerCase(),
    );

    if (alreadyExists) {
      toast.error("यह keyword पहले से मौजूद है");

      setKeywordInput("");
      return;
    }

    setProduct((prev) => ({
      ...prev,
      keywords: [...prev.keywords, keyword],
    }));

    setKeywordInput("");
  };

  // =====================================================
  // KEYWORD KEYBOARD
  // =====================================================

  const handleKeywordKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();

      addKeyword();
    }
  };

  // =====================================================
  // REMOVE KEYWORD
  // =====================================================

  const removeKeyword = (index) => {
    setProduct((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((_, i) => i !== index),
    }));
  };

  // =====================================================
  // ADD VARIANT
  // =====================================================

  const addVariantHandler = () => {
    // -----------------------------------------------
    // CATEGORY
    // -----------------------------------------------

    if (!product.category) {
      toast.error("पहले कैटेगरी चुनें");
      return;
    }

    // -----------------------------------------------
    // COMPANY
    // -----------------------------------------------

    if (!variant.company) {
      toast.error("कंपनी चुनें");
      return;
    }

    // -----------------------------------------------
    // MEASUREMENT
    // -----------------------------------------------

    const measurement = variant.measurement.trim();

    if (!measurement) {
      toast.error("माप भरें");
      return;
    }

    // -----------------------------------------------
    // PRICE
    // -----------------------------------------------

    const price = Number(variant.price);

    if (!variant.price || !Number.isFinite(price) || price <= 0) {
      toast.error("सही कीमत भरें");
      return;
    }

    // -----------------------------------------------
    // DUPLICATE VARIANT
    // -----------------------------------------------

    const duplicate = product.variants.some(
      (existingVariant) =>
        String(existingVariant.company) === String(variant.company) &&
        existingVariant.measurement.trim().toLowerCase() ===
          measurement.toLowerCase(),
    );

    if (duplicate) {
      toast.error("यह कंपनी और माप वाला वेरिएंट पहले से मौजूद है");
      return;
    }

    // -----------------------------------------------
    // NEW VARIANT
    // -----------------------------------------------

    const newVariant = {
      company: variant.company,
      measurement,
      price,
      isAvailable: Boolean(variant.isAvailable),
    };

    setProduct((prev) => ({
      ...prev,
      variants: [...prev.variants, newVariant],
    }));

    // Reset variant form
    setVariant({
      company: "",
      measurement: "",
      price: "",
      isAvailable: true,
    });

    toast.success("वेरिएंट जोड़ दिया गया");
  };

  // =====================================================
  // REMOVE VARIANT
  // =====================================================

  const removeVariant = (index) => {
    setProduct((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  // =====================================================
  // GET CATEGORIES
  // =====================================================

  const getCategories = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/category/get-cat`);

      if (res.data.success) {
        setCategories(res.data.categories || []);
      }
    } catch (error) {
      console.error("Get categories error:", error);

      toast.error("कैटेगरी लोड नहीं हो सकीं");
    }
  };

  // =====================================================
  // GET COMPANIES
  // =====================================================

  const getCompanies = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/company/get-com`);

      if (res.data.success) {
        const companyList = res.data.companies || [];

        setCompanies(companyList);
      }
    } catch (error) {
      console.error("Get companies error:", error);

      toast.error("कंपनियां लोड नहीं हो सकीं");
    }
  };

  // =====================================================
  // LOAD DATA
  // =====================================================

  useEffect(() => {
    getCategories();
    getCompanies();
  }, []);

  // =====================================================
  // KEEP COMPANY LIST IN SYNC
  // =====================================================

  useEffect(() => {
    if (!product.category) {
      setFilteredCompanies([]);
      return;
    }

    const filtered = companies.filter((company) =>
      company.categories?.some((category) => {
        if (typeof category === "object" && category !== null) {
          return String(category._id) === String(product.category);
        }

        return String(category) === String(product.category);
      }),
    );

    setFilteredCompanies(filtered);
  }, [companies, product.category]);

  // =====================================================
  // ADD CATEGORY
  // =====================================================

  const addCategory = async () => {
    const trimmedName = categoryName.trim();

    if (!trimmedName) {
      toast.error("कैटेगरी का नाम भरें");
      return;
    }

    try {
      setCategoryLoading(true);

      const formData = new FormData();

      formData.append("name", trimmedName);

      if (categoryImage) {
        formData.append("image", categoryImage);
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/category/add-cat`,
        formData,
        getAuthConfig(),
      );

      if (!res.data.success) {
        throw new Error(res.data.message || "कैटेगरी नहीं बनी");
      }

      const newCategory = res.data.category;

      // Add locally
      setCategories((prev) => [...prev, newCategory]);

      // Automatically select it
      setProduct((prev) => ({
        ...prev,
        category: newCategory._id,
      }));

      // Reset modal
      setCategoryName("");
      setCategoryImage(null);
      setOpenCategoryModal(false);

      toast.success("कैटेगरी जोड़ दी गई");
    } catch (error) {
      console.error("Add category error:", error);

      toast.error(
        error.response?.data?.message ||
          error.message ||
          "कैटेगरी जोड़ने में कुछ गलत हो गया",
      );
    } finally {
      setCategoryLoading(false);
    }
  };

  // =====================================================
  // ADD COMPANY
  // =====================================================

  const addCompanyHandler = async () => {
    const trimmedName = companyName.trim();

    if (!trimmedName) {
      toast.error("कंपनी का नाम भरें");
      return;
    }

    if (selectedCategories.length === 0) {
      toast.error("कम से कम एक कैटेगरी चुनें");
      return;
    }

    try {
      setCompanyLoading(true);

      const formData = new FormData();

      formData.append("name", trimmedName);

      formData.append("categories", JSON.stringify(selectedCategories));

      if (companyLogo) {
        formData.append("logo", companyLogo);
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/company/add-com`,
        formData,
        getAuthConfig(),
      );

      if (!res.data.success) {
        throw new Error(res.data.message || "कंपनी नहीं बनी");
      }

      const newCompany = res.data.company;

      // Add to complete company list
      setCompanies((prev) => [...prev, newCompany]);

      // If current category is one
      // of company's categories,
      // select it automatically.
      const belongsToCurrentCategory = newCompany.categories?.some(
        (category) => {
          if (typeof category === "object" && category !== null) {
            return String(category._id) === String(product.category);
          }

          return String(category) === String(product.category);
        },
      );

      if (belongsToCurrentCategory) {
        setVariant((prev) => ({
          ...prev,
          company: newCompany._id,
        }));
      }

      // Reset
      setCompanyName("");
      setCompanyLogo(null);
      setSelectedCategories([]);

      setOpenCompanyModal(false);

      toast.success("कंपनी जोड़ दी गई");
    } catch (error) {
      console.error("Add company error:", error);

      toast.error(
        error.response?.data?.message ||
          error.message ||
          "कंपनी जोड़ने में कुछ गलत हो गया",
      );
    } finally {
      setCompanyLoading(false);
    }
  };

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    // -----------------------------------------------
    // BASIC VALIDATION
    // -----------------------------------------------

    if (!product.media) {
      toast.error("प्रोडक्ट की फोटो चुनें");
      return;
    }

    if (!product.name.trim()) {
      toast.error("प्रोडक्ट का नाम भरें");
      return;
    }

    if (!product.hinglishName.trim()) {
      toast.error("हिंग्लिश नाम भरें");
      return;
    }

    if (!product.category) {
      toast.error("कैटेगरी चुनें");
      return;
    }

    if (product.variants.length === 0) {
      toast.error("कम से कम एक वेरिएंट जोड़ें");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      // -----------------------------------------------
      // PRODUCT
      // -----------------------------------------------

      formData.append("name", product.name.trim());

      formData.append("hinglishName", product.hinglishName.trim());

      formData.append("category", product.category);

      // IMPORTANT:
      // Backend:
      // singleUpload("media")
      //
      // Therefore frontend MUST use:
      // "media"
      formData.append("media", product.media);

      // -----------------------------------------------
      // VARIANTS
      // -----------------------------------------------

      const cleanVariants = product.variants.map((item) => ({
        company: item.company,
        measurement: item.measurement.trim(),
        price: Number(item.price),
        isAvailable: Boolean(item.isAvailable),
      }));

      formData.append("variants", JSON.stringify(cleanVariants));

      // -----------------------------------------------
      // KEYWORDS
      // -----------------------------------------------

      const cleanKeywords = [
        ...new Set(
          product.keywords
            .map((keyword) => String(keyword).trim())
            .filter(Boolean),
        ),
      ];

      formData.append("keywords", JSON.stringify(cleanKeywords));

      // -----------------------------------------------
      // API
      // -----------------------------------------------

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/product/add`,
        formData,
        getAuthConfig(),
      );

      if (!res.data.success) {
        throw new Error(res.data.message || "Product creation failed");
      }

      const newProduct = res.data.product;

      // =================================================
      // ⭐ UPDATE EXISTING REDUX SLICE
      // =================================================
      //
      // DO NOT modify ProductSlice.
      //
      // Your slice already has:
      //
      // addProduct: (state, action) => {
      //   state.productData.unshift(action.payload);
      // }
      //
      // So use it directly.

      dispatch(addProduct(newProduct));

      toast.success("प्रोडक्ट सफलतापूर्वक जोड़ दिया गया");

      // -----------------------------------------------
      // RESET FORM
      // -----------------------------------------------

      if (preview) {
        URL.revokeObjectURL(preview);
      }

      setProduct({
        name: "",
        hinglishName: "",
        category: "",
        media: null,
        variants: [],
        keywords: [],
      });

      setVariant({
        company: "",
        measurement: "",
        price: "",
        isAvailable: true,
      });

      setKeywordInput("");
      setPreview("");
      setFilteredCompanies([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // -----------------------------------------------
      // NAVIGATE
      // -----------------------------------------------

      navigate("/product-page");
    } catch (error) {
      console.error("Add product error:", error);

      toast.error(
        error.response?.data?.message ||
          error.message ||
          "प्रोडक्ट जोड़ने में कुछ गलत हो गया",
      );
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // CLEAN IMAGE URL ON UNMOUNT
  // =====================================================

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-emerald-50 pt-20 pb-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="bg-emerald-600 text-white p-5 flex items-center justify-center relative">
          <button
            type="button"
            onClick={() => navigate("/product-page")}
            className="absolute left-5"
          >
            <IoArrowBackOutline className="text-2xl" />
          </button>

          <h1 className="text-2xl font-bold">नया प्रोडक्ट जोड़ें</h1>
        </div>

        {/* =================================================
            FORM
        ================================================= */}

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
          {/* =================================================
              IMAGE
          ================================================= */}

          <div className="flex items-center gap-5">
            <input
              ref={fileInputRef}
              id="product-image"
              type="file"
              hidden
              accept="image/*"
              onChange={handleImage}
            />

            <label
              htmlFor="product-image"
              className="w-40 h-40 md:w-48 md:h-48 border-2 border-dashed border-emerald-400 rounded-2xl overflow-hidden cursor-pointer flex items-center justify-center bg-emerald-50"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Product preview"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center px-3">
                  <RiImageUploadLine className="text-5xl text-emerald-600 mx-auto" />

                  <p className="mt-2 text-gray-600">फोटो चुनें</p>
                </div>
              )}
            </label>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition"
              >
                <Edit size={18} />
              </button>

              <button
                type="button"
                onClick={removeImage}
                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* =================================================
              PRODUCT NAME
          ================================================= */}

          <div>
            <label className="font-semibold text-gray-700">प्रोडक्ट नाम</label>

            <input
              name="name"
              value={product.name}
              onChange={handleProductChange}
              placeholder="जैसे: अमूल दूध"
              className="w-full p-3 mt-2 border-2 border-emerald-200 rounded-xl outline-none focus:border-emerald-500"
            />
          </div>

          {/* =================================================
              HINGLISH NAME
          ================================================= */}

          <div>
            <label className="font-semibold text-gray-700">Hinglish Name</label>

            <input
              name="hinglishName"
              value={product.hinglishName}
              onChange={handleProductChange}
              placeholder="Jaise: Amul Doodh"
              className="w-full p-3 mt-2 border-2 border-emerald-200 rounded-xl outline-none focus:border-emerald-500"
            />
          </div>

          {/* =================================================
              KEYWORDS
          ================================================= */}

          <div className="space-y-3">
            <div>
              <label className="font-semibold text-gray-700 flex items-center gap-2">
                <Tag size={18} className="text-emerald-600" />
                सर्च Keywords
              </label>

              <p className="text-sm text-gray-500 mt-1">
                Hindi, Hinglish और English में search करने के लिए keywords
                जोड़ें
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="milk, doodh, दूध..."
                className="flex-1 p-3 border-2 border-emerald-200 rounded-xl outline-none focus:border-emerald-500"
              />

              <button
                type="button"
                onClick={addKeyword}
                className="px-4 md:px-5 bg-emerald-600 text-white rounded-xl flex items-center gap-2 hover:bg-emerald-700 transition"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">जोड़ें</span>
              </button>
            </div>

            {/* KEYWORD CHIPS */}

            {product.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-emerald-50 rounded-2xl">
                {product.keywords.map((keyword, index) => (
                  <div
                    key={`${keyword}-${index}`}
                    className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-3 py-2 rounded-full text-sm"
                  >
                    <span>{keyword}</span>

                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr />

          {/* =================================================
              CATEGORY
          ================================================= */}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-700">कैटेगरी</label>

              <button
                type="button"
                onClick={() => setOpenCategoryModal(true)}
                className="flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
              >
                <Plus size={16} />
                नई कैटेगरी
              </button>
            </div>

            <select
              value={product.category}
              onChange={handleCategoryChange}
              className="w-full p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none bg-white"
            >
              <option value="">कैटेगरी चुनें</option>

              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <hr />

          {/* =================================================
              COMPANY
          ================================================= */}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-700">कंपनी</label>

              <button
                type="button"
                onClick={() => setOpenCompanyModal(true)}
                className="flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg"
              >
                <Plus size={16} />
                नई कंपनी
              </button>
            </div>

            <select
              name="company"
              value={variant.company}
              onChange={handleVariantChange}
              disabled={!product.category}
              className="w-full p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!product.category
                  ? "पहले कैटेगरी चुनें"
                  : filteredCompanies.length === 0
                    ? "इस कैटेगरी में कोई कंपनी नहीं है"
                    : "कंपनी चुनें"}
              </option>

              {filteredCompanies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>

            {product.category && filteredCompanies.length === 0 && (
              <p className="text-xs text-gray-500">
                इस कैटेगरी के लिए कंपनी नहीं मिली। ऊपर से नई कंपनी जोड़ सकते
                हैं।
              </p>
            )}
          </div>

          {/* =================================================
              VARIANT
          ================================================= */}

          <div className="grid md:grid-cols-3 gap-4">
            <input
              name="measurement"
              value={variant.measurement}
              onChange={handleVariantChange}
              placeholder="500g / 1kg / 1L"
              className="p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none"
            />

            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              value={variant.price}
              onChange={handleVariantChange}
              placeholder="₹40"
              className="p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none"
            />

            {/* AVAILABILITY */}
            <select
              name="isAvailable"
              value={variant.isAvailable ? "true" : "false"}
              onChange={handleVariantChange}
              className="p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none bg-white"
            >
              <option value="true">✓ उपलब्ध</option>

              <option value="false">✕ अनुपलब्ध</option>
            </select>
          </div>

          {/* =================================================
              ADD VARIANT
          ================================================= */}

          <button
            type="button"
            onClick={addVariantHandler}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <Plus size={18} />
            वेरिएंट जोड़ें
          </button>

          {/* =================================================
              VARIANTS
          ================================================= */}

          {product.variants.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-emerald-700">
                  जोड़े गए वेरिएंट
                </h3>

                <span className="text-sm text-gray-500">
                  {product.variants.length} variant
                  {product.variants.length > 1 ? "s" : ""}
                </span>
              </div>

              {product.variants.map((item, index) => {
                const company = companies.find(
                  (company) => String(company._id) === String(item.company),
                );

                return (
                  <div
                    key={`${item.company}-${item.measurement}-${index}`}
                    className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50 flex justify-between items-center gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {company?.logo ? (
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="w-12 h-12 rounded-xl object-cover border bg-white shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center font-bold text-emerald-600 shrink-0">
                          {company?.name?.charAt(0)?.toUpperCase() || "C"}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="font-semibold text-emerald-700 truncate">
                          {company?.name || "Unknown Company"}
                        </p>

                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="px-3 py-1 bg-white rounded-full text-sm border">
                            📦 {item.measurement}
                          </span>

                          <span className="px-3 py-1 bg-white rounded-full text-sm border">
                            ₹ {item.price}
                          </span>

                          <span
                            className={`px-3 py-1 rounded-full text-sm border ${
                              item.isAvailable
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            }`}
                          >
                            {item.isAvailable ? "✓ उपलब्ध" : "✕ अनुपलब्ध"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-red-500 hover:text-red-700 p-2 shrink-0"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* =================================================
              SUBMIT
          ================================================= */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed text-white py-4 rounded-xl mb-10 font-bold flex items-center justify-center gap-2 transition"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                प्रोडक्ट सेव हो रहा है...
              </>
            ) : (
              "प्रोडक्ट सेव करें"
            )}
          </button>
        </form>

        {/* =================================================
            CATEGORY MODAL
        ================================================= */}

        {openCategoryModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">नई कैटेगरी जोड़ें</h2>

                <button
                  type="button"
                  onClick={() => setOpenCategoryModal(false)}
                >
                  <X />
                </button>
              </div>

              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="कैटेगरी का नाम"
                className="w-full p-3 border rounded-xl outline-none focus:border-emerald-500"
              />

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCategoryImage(e.target.files?.[0] || null)}
                className="w-full text-sm"
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpenCategoryModal(false)}
                  className="flex-1 bg-gray-200 rounded-xl py-3"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={addCategory}
                  disabled={categoryLoading}
                  className="flex-1 bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl py-3 flex items-center justify-center gap-2"
                >
                  {categoryLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================
            COMPANY MODAL
        ================================================= */}

        {openCompanyModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">नई कंपनी जोड़ें</h2>

                <button
                  type="button"
                  onClick={() => setOpenCompanyModal(false)}
                >
                  <X />
                </button>
              </div>

              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="कंपनी का नाम"
                className="w-full p-3 border rounded-xl outline-none focus:border-emerald-500"
              />

              <div>
                <label className="font-semibold block mb-2">
                  कंपनी की फोटो
                </label>

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCompanyLogo(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>

              <div>
                <label className="font-semibold block mb-2">
                  कंपनी किन कैटेगरी में है?
                </label>

                <div className="space-y-2 max-h-40 overflow-y-auto border rounded-xl p-3">
                  {categories.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      पहले कोई कैटेगरी जोड़ें
                    </p>
                  ) : (
                    categories.map((category) => (
                      <label
                        key={category._id}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories((prev) => [
                                ...prev,
                                category._id,
                              ]);
                            } else {
                              setSelectedCategories((prev) =>
                                prev.filter(
                                  (id) => String(id) !== String(category._id),
                                ),
                              );
                            }
                          }}
                        />

                        <span>{category.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpenCompanyModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-200"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={addCompanyHandler}
                  disabled={companyLoading}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 disabled:bg-emerald-300 text-white flex items-center justify-center gap-2"
                >
                  {companyLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddProduct;
