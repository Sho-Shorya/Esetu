import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL } from "@/lib/constants";
import {
  ArrowLeft,
  Edit,
  ImagePlus,
  Loader2,
  LucideEdit,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useDispatch, useSelector } from "react-redux";
import { setProductData } from "@/redux/ProductSlice";

// ======================================================
// API ROUTES
// ======================================================

const CATEGORY_API = `${API_BASE_URL}/api/v1/category/get-cat`;
const COMPANY_API = `${API_BASE_URL}/api/v1/company/get-com`;

// ======================================================
// COMPONENT
// ======================================================

const EditProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const dispatch = useDispatch();

  const { productData } = useSelector((state) => state.product);

  const fileInputRef = useRef(null);

  // ----------------------------------------------------
  // Loading states
  // ----------------------------------------------------

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // ----------------------------------------------------
  // Product
  // ----------------------------------------------------

  const [product, setProduct] = useState({
    name: "",
    hinglishName: "",
    category: "",
    image: "",
    keyword: [],
    description: "",
  });

  const [newKeyword, setNewKeyword] = useState("");

  // ----------------------------------------------------
  // Image
  // ----------------------------------------------------

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");

  // ----------------------------------------------------
  // Categories / Companies
  // ----------------------------------------------------

  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);

  // ----------------------------------------------------
  // Existing + new variants
  // ----------------------------------------------------

  const [variants, setVariants] = useState([]);

  // ----------------------------------------------------
  // New variant form
  // ----------------------------------------------------

  const [newVariant, setNewVariant] = useState({
    company: "",
    measurement: "",
    price: "",
    stock: "",
    available: true,
  });

  // ======================================================
  // DESCRIPTION NORMALIZER
  // ======================================================

  const getDescription = (productData) => {
    if (!productData) return "";

    const description =
      productData.description ??
      productData.desc ??
      productData.productDescription ??
      "";

    return typeof description === "string"
      ? description
      : String(description || "");
  };

  // ======================================================
  // FETCH PRODUCT
  // ======================================================

  useEffect(() => {
    if (!id) {
      toast.error("Invalid product ID");
      navigate("/product-page");
      return;
    }

    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${API_BASE_URL}/api/v1/product/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const fetchedProduct = res.data?.product;

      if (!fetchedProduct) {
        throw new Error("Product not found");
      }

      // ==================================================
      // IMPORTANT:
      // Properly get description from API response
      // ==================================================

      const fetchedDescription = getDescription(fetchedProduct);

      console.log("EDIT PRODUCT DESCRIPTION:", fetchedDescription);

      setProduct({
        name: fetchedProduct.name || "",

        hinglishName: fetchedProduct.hinglishName || "",

        category: fetchedProduct.category?._id || fetchedProduct.category || "",

        image: fetchedProduct.image || "",

        keyword: Array.isArray(fetchedProduct.keyword)
          ? fetchedProduct.keyword
          : [],

        description: fetchedDescription,
      });

      setPreview(fetchedProduct.image || "");

      setVariants(
        (fetchedProduct.variants || []).map((variant) => ({
          ...variant,

          company: variant.company?._id || variant.company || "",

          measurement: variant.measurement || "",

          price: variant.price ?? "",

          stock: variant.stock ?? 0,

          available:
            typeof variant.available === "boolean" ? variant.available : true,
        })),
      );
    } catch (error) {
      console.error("Fetch product error:", error);

      toast.error(error?.response?.data?.message || "Failed to load product");

      navigate("/product-page");
    } finally {
      setLoading(false);
    }
  };

  // ======================================================
  // FETCH CATEGORIES
  // ======================================================

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);

      const res = await axios.get(CATEGORY_API, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = res.data?.categories || res.data?.data || res.data || [];

      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Category fetch error:", error);

      toast.error("Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  // ======================================================
  // FETCH COMPANIES
  // ======================================================

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoadingCompanies(true);

      const res = await axios.get(COMPANY_API, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = res.data?.companies || res.data?.data || res.data || [];

      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Company fetch error:", error);

      toast.error("Failed to load companies");
    } finally {
      setLoadingCompanies(false);
    }
  };

  // ======================================================
  // IMAGE
  // ======================================================

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }

    setImage(file);

    const objectUrl = URL.createObjectURL(file);

    setPreview(objectUrl);
  };

  const removeImage = () => {
    setImage(null);
    setPreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ======================================================
  // PRODUCT INPUT
  // ======================================================

  const updateProduct = (field, value) => {
    setProduct((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ======================================================
  // UPDATE EXISTING VARIANT
  // ======================================================

  const updateVariant = (index, field, value) => {
    setVariants((prev) =>
      prev.map((variant, i) =>
        i === index
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    );
  };

  // ======================================================
  // DELETE VARIANT
  // ======================================================

  const removeVariant = (index) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  // ======================================================
  // NEW VARIANT INPUT
  // ======================================================

  const updateNewVariant = (field, value) => {
    setNewVariant((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // ======================================================
  // ADD NEW VARIANT
  // ======================================================

  const addVariant = () => {
    if (!newVariant.company) {
      toast.error("Please select a company");
      return;
    }

    if (!newVariant.measurement.trim()) {
      toast.error("Please enter measurement");
      return;
    }

    if (newVariant.price === "" || Number(newVariant.price) < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setVariants((prev) => [
      ...prev,
      {
        company: newVariant.company,
        measurement: newVariant.measurement.trim(),
        price: Number(newVariant.price),
        stock: newVariant.stock === "" ? 0 : Number(newVariant.stock),
        available: newVariant.available,
      },
    ]);

    setNewVariant({
      company: "",
      measurement: "",
      price: "",
      stock: "",
      available: true,
    });

    toast.success("वेरिएंट जोड़ा गया");
  };

  // ======================================================
  // SAVE PRODUCT
  // ======================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    const productName =
      typeof product.name === "string" ? product.name.trim() : "";

    const hinglishName =
      typeof product.hinglishName === "string"
        ? product.hinglishName.trim()
        : "";

    const description =
      typeof product.description === "string" ? product.description.trim() : "";

    // ==================================================
    // BASIC VALIDATION
    // ==================================================

    if (!productName) {
      toast.error("Product name is required");
      return;
    }

    if (!hinglishName) {
      toast.error("Hinglish name is required");
      return;
    }

    if (!product.category) {
      toast.error("Please select a category");
      return;
    }

    if (!description) {
      toast.error("Please add a description");
      return;
    }

    if (variants.length === 0) {
      toast.error("Product must have at least one variant");
      return;
    }

    // ==================================================
    // VALIDATE VARIANTS
    // ==================================================

    for (let i = 0; i < variants.length; i++) {
      const variant = variants[i];

      if (!variant.company) {
        toast.error(`Please select company for variant ${i + 1}`);
        return;
      }

      if (!variant.measurement?.trim()) {
        toast.error(`Please enter measurement for variant ${i + 1}`);
        return;
      }

      if (
        variant.price === "" ||
        variant.price === null ||
        variant.price === undefined ||
        Number.isNaN(Number(variant.price)) ||
        Number(variant.price) < 0
      ) {
        toast.error(`Please enter valid price for variant ${i + 1}`);
        return;
      }

      if (
        variant.stock === "" ||
        variant.stock === null ||
        variant.stock === undefined ||
        Number.isNaN(Number(variant.stock)) ||
        Number(variant.stock) < 0
      ) {
        toast.error(`Please enter valid stock for variant ${i + 1}`);
        return;
      }
    }

    // ==================================================
    // SAVE
    // ==================================================

    try {
      setSaving(true);

      const formData = new FormData();

      formData.append("name", productName);

      formData.append("hinglishName", hinglishName);

      // ==================================================
      // IMPORTANT DESCRIPTION
      // ==================================================

      formData.append("description", description);

      formData.append("category", product.category);

      formData.append("keyword", JSON.stringify(product.keyword || []));

      // ==================================================
      // VARIANTS
      // ==================================================

      formData.append(
        "variants",
        JSON.stringify(
          variants.map((variant) => ({
            ...(variant._id ? { _id: variant._id } : {}),

            company: variant.company?._id || variant.company,

            measurement: variant.measurement.trim(),

            price: Number(variant.price),

            stock: Number(variant.stock),

            available: variant.available !== false,
          })),
        ),
      );

      // ==================================================
      // IMAGE
      // ==================================================

      if (image) {
        formData.append("media", image);
      }

      // ==================================================
      // DEBUG
      // ==================================================

      console.log("Saving description:", description);

      // ==================================================
      // API
      // ==================================================

      const res = await axios.put(
        `${API_BASE_URL}/api/v1/product/edit-product/${id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      // ==================================================
      // SUCCESS
      // ==================================================

      if (res.data?.success) {
        const updatedProduct = res.data.product;

        // Update Redux
        dispatch(
          setProductData(
            productData.map((item) =>
              item._id === updatedProduct._id ? updatedProduct : item,
            ),
          ),
        );

        toast.success("प्रोडक्ट अपडेट हो गया।", {
          duration: 2000,
        });

        navigate("/product-page");
      } else {
        toast.error(res.data?.message || "Failed to update product");
      }
    } catch (error) {
      console.error("Update product error:", error);

      toast.error(error?.response?.data?.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // LOADING
  // ======================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={40} />

          <p className="text-gray-600 font-medium">Loading product...</p>
        </div>
      </div>
    );
  }

  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="min-h-screen bg-emerald-50 pt-20 px-4 pb-10">
      <div className="max-w-5xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden">
        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="bg-emerald-600 text-white p-5 flex items-center justify-center relative">
          <button
            type="button"
            onClick={() => navigate("/product-page")}
            className="absolute left-5 p-2 rounded-full hover:bg-emerald-700"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="text-center">
            <h1 className="text-2xl flex gap-2 items-center font-bold">
              <LucideEdit /> प्रोडक्ट एडिट करें
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
          {/* ==================================================
              IMAGE
          ================================================== */}

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              प्रोडक्ट की तस्वीर
            </h2>

            <div className="flex flex-cols-3 md:flex-row gap-5 items-start">
              <div className="relative">
                <div className="w-52 h-52 rounded-2xl border-2 border-dashed border-emerald-300 overflow-hidden bg-emerald-50 flex items-center justify-center">
                  {preview ? (
                    <img
                      src={preview}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center text-gray-500">
                      <ImagePlus
                        size={42}
                        className="mx-auto mb-2 text-emerald-600"
                      />

                      <p>चित्र उपलब्द नहीं है</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleImageChange}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                >
                  <Edit size={30} />
                </button>

                {preview && (
                  <button
                    type="button"
                    onClick={removeImage}
                    className="flex items-center justify-center gap-2 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600"
                  >
                    <Trash2 size={30} />
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ==================================================
              BASIC PRODUCT DETAILS
          ================================================== */}

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-4">
              प्रोडक्ट की जानकारी
            </h2>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Product name */}

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  प्रोडक्ट का नाम
                </label>

                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => updateProduct("name", e.target.value)}
                  placeholder="Product Name"
                  className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Hinglish name */}

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  हिंग्लिश नाम
                </label>

                <input
                  type="text"
                  value={product.hinglishName}
                  onChange={(e) =>
                    updateProduct("hinglishName", e.target.value)
                  }
                  placeholder="Dudh"
                  className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Description */}

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Description
                </label>

                <textarea
                  value={product.description}
                  onChange={(e) => updateProduct("description", e.target.value)}
                  placeholder="description"
                  rows="4"
                  cols="50"
                  className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Category */}

              <div className="md:col-span-2">
                <label className="block font-semibold text-gray-700 mb-2">
                  कैटेगरी
                </label>

                <select
                  value={product.category}
                  onChange={(e) => updateProduct("category", e.target.value)}
                  disabled={loadingCategories}
                  className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-emerald-500 outline-none bg-white"
                >
                  <option value="">
                    {loadingCategories
                      ? "कैटेगरी लोड हो रही हैं..."
                      : "कैटेगरी चुनें"}
                  </option>

                  {categories.map((category) => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Keywords */}

              <div>
                <label className="block font-semibold text-gray-700 mb-2">
                  Keywords
                </label>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="नया keyword डालें..."
                    className="flex-1 px-3 py-2 border rounded-xl outline-none focus:border-emerald-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();

                        const keyword = newKeyword.trim();

                        if (!keyword) return;

                        if (product.keyword?.includes(keyword)) {
                          setNewKeyword("");
                          return;
                        }

                        setProduct((prev) => ({
                          ...prev,
                          keyword: [...(prev.keyword || []), keyword],
                        }));

                        setNewKeyword("");
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const keyword = newKeyword.trim();

                      if (!keyword) return;

                      if (product.keyword?.includes(keyword)) {
                        setNewKeyword("");
                        return;
                      }

                      setProduct((prev) => ({
                        ...prev,
                        keyword: [...(prev.keyword || []), keyword],
                      }));

                      setNewKeyword("");
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                  >
                    Add
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {product.keyword?.map((word, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-700 text-white"
                    >
                      <span>{word}</span>

                      <button
                        type="button"
                        onClick={() => {
                          setProduct((prev) => ({
                            ...prev,
                            keyword: prev.keyword.filter((_, i) => i !== index),
                          }));
                        }}
                        className="hover:text-red-300"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================
              EXISTING VARIANTS
          ================================================== */}

          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800 mt-5">
                  प्रोडक्ट के वैरिएंट्स
                </h2>

                <p className="text-sm text-gray-500">
                  मौजूदा वैरिएंट्स को एडिट करें या उन्हें हटा दें
                </p>
              </div>

              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-sm font-semibold">
                {variants.length} Variants
              </span>
            </div>

            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div
                  key={variant._id || `new-${index}`}
                  className="border-2 border-gray-200 rounded-2xl p-5 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-800">
                      वैरिएंट् {index + 1}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-100"
                    >
                      <Trash2 size={19} />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Company */}

                    <div className="lg:col-span-1">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        कंपनी
                      </label>

                      <select
                        value={variant.company?._id || variant.company || ""}
                        onChange={(e) =>
                          updateVariant(index, "company", e.target.value)
                        }
                        disabled={loadingCompanies}
                        className="w-full p-3 rounded-xl border-2 border-gray-200 bg-white outline-none focus:border-emerald-500"
                      >
                        <option value="">
                          {loadingCompanies
                            ? "लोड हो रहा है..."
                            : "कंपनी चुनें"}
                        </option>

                        {companies.map((company) => (
                          <option key={company._id} value={company._id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Measurement */}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        माप
                      </label>

                      <input
                        type="text"
                        value={variant.measurement || ""}
                        onChange={(e) =>
                          updateVariant(index, "measurement", e.target.value)
                        }
                        placeholder="500g / 1kg"
                        className="w-full p-3 rounded-xl border-2 border-gray-200 outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Price */}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        कीमत
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={variant.price ?? ""}
                        onChange={(e) =>
                          updateVariant(index, "price", e.target.value)
                        }
                        placeholder="₹40"
                        className="w-full p-3 rounded-xl border-2 border-gray-200 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Availability */}

                  <div className="mt-4 flex items-center justify-between bg-white border rounded-xl p-3">
                    <div>
                      <p className="font-semibold text-gray-800">
                        वेरिएंट की उपलब्धता
                      </p>

                      <p className="text-xs text-gray-500">
                        खरीददार इस वैरिएंट का ऑर्डर दे सकते हैं।
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateVariant(index, "available", !variant.available)
                      }
                      className={`relative w-12 h-6 rounded-full transition ${
                        variant.available ? "bg-emerald-500" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition ${
                          variant.available ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}

              {variants.length === 0 && (
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                  <p className="text-gray-500">कोई वैरिएंट नहीं जोड़ा गया।</p>
                </div>
              )}
            </div>
          </section>

          {/* ==================================================
              ADD NEW VARIANT
          ================================================== */}

          <section className="border-2 border-emerald-200 rounded-2xl p-5 bg-emerald-50">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 rounded-lg bg-emerald-600 text-white">
                <Plus size={20} />
              </div>

              <div>
                <h2 className="font-bold text-gray-800">नया वैरिएंट जोड़ें</h2>

                <p className="text-sm text-gray-500">
                  नई कंपनी, साइज़ और कीमत जोड़ें
                </p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Company */}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  कंपनी
                </label>

                <select
                  value={newVariant.company}
                  onChange={(e) => updateNewVariant("company", e.target.value)}
                  className="w-full p-3 rounded-xl border-2 border-white bg-white outline-none focus:border-emerald-500"
                >
                  <option value="">कंपनी चुनें</option>

                  {companies.map((company) => (
                    <option key={company._id} value={company._id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Measurement */}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  माप
                </label>

                <input
                  type="text"
                  value={newVariant.measurement}
                  onChange={(e) =>
                    updateNewVariant("measurement", e.target.value)
                  }
                  placeholder="500g / 1kg"
                  className="w-full p-3 rounded-xl border-2 border-white outline-none focus:border-emerald-500"
                />
              </div>

              {/* Price */}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  कीमत
                </label>

                <input
                  type="number"
                  min="0"
                  value={newVariant.price}
                  onChange={(e) => updateNewVariant("price", e.target.value)}
                  placeholder="₹40"
                  className="w-full p-3 rounded-xl border-2 border-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    updateNewVariant("available", !newVariant.available)
                  }
                  className={`relative w-12 h-6 rounded-full ${
                    newVariant.available ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full ${
                      newVariant.available ? "left-7" : "left-1"
                    }`}
                  />
                </button>

                <span className="text-sm font-semibold">उपलब्ध है</span>
              </div>

              <button
                type="button"
                onClick={addVariant}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold"
              >
                <Plus size={18} />
                Variant जोड़ें
              </button>
            </div>
          </section>

          {/* ==================================================
              SAVE
          ================================================== */}

          <div className="flex flex-col md:flex-row gap-3 pt-3">
            <button
              type="button"
              onClick={() => navigate("/product-page")}
              className="md:w-1/3 py-4 rounded-xl border-2 border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="md:flex-1 flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProduct;
