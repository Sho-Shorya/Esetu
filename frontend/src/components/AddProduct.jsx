import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { IoArrowBackOutline } from "react-icons/io5";
import { RiImageUploadLine } from "react-icons/ri";
import { Edit, Trash2, Plus } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";

const AddProduct = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [openCategoryModal, setOpenCategoryModal] = useState(false);
  const [openCompanyModal, setOpenCompanyModal] = useState(false);

  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState("");
  const [product, setProduct] = useState({
    name: "",
    hinglishName: "",
    category: "",
    media: null,
    variants: [],
  });

  const [variant, setVariant] = useState({
    company: "",
    measurement: "",
    price: "",
    stock: "",
  });
  const [categories, setCategories] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [categoryName, setCategoryName] = useState("");
  const [categoryImage, setCategoryImage] = useState(null);

  const addCategory = async () => {
    if (!categoryName.trim()) {
      return toast.error("कैटेगरी का नाम भरें");
    }

    try {
      const formData = new FormData();

      formData.append("name", categoryName);

      if (categoryImage) {
        formData.append("image", categoryImage);
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/category/add-cat`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data.success) {
        toast.success("कैटेगरी जोड़ दी गई");

        setCategories((prev) => [...prev, res.data.category]);

        setCategoryName("");
        setCategoryImage(null);
        setOpenCategoryModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "कुछ गलत हो गया");
    }
  };
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);

  const addCompany = async () => {
    if (!companyName.trim()) {
      return toast.error("कंपनी का नाम भरें");
    }

    if (selectedCategories.length === 0) {
      return toast.error("कम से कम एक कैटेगरी चुनें");
    }

    try {
      const formData = new FormData();

      formData.append("name", companyName);

      formData.append("categories", JSON.stringify(selectedCategories));

      if (companyLogo) {
        formData.append("logo", companyLogo);
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/company/add-com`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data.success) {
        toast.success("कंपनी जोड़ दी गई");

        setCompanies((prev) => [...prev, res.data.company]);

        setCompanyName("");
        setCompanyLogo(null);
        setSelectedCategories([]);
        setOpenCompanyModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "कुछ गलत हो गया");
    }
  };

  const handleProductChange = (e) => {
    const { name, value } = e.target;

    setProduct((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVariantChange = (e) => {
    const { name, value } = e.target;

    setVariant((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCategoryChange = (e) => {
    const categoryId = e.target.value;

    setProduct((prev) => ({
      ...prev,
      category: categoryId,
    }));

    setVariant((prev) => ({
      ...prev,
      company: "",
    }));

    const filtered = companies.filter((company) =>
      company.categories.some((cat) => cat._id === categoryId),
    );

    setFilteredCompanies(filtered);
  };

  const handleImage = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setProduct((prev) => ({
      ...prev,
      media: file,
    }));

    setPreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setPreview("");

    setProduct((prev) => ({
      ...prev,
      media: null,
    }));

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addVariant = () => {
    if (!variant.company || !variant.measurement || !variant.price) {
      return toast.error("सभी जानकारी भरें");
    }

    setProduct((prev) => ({
      ...prev,
      variants: [...prev.variants, variant],
    }));

    setVariant({
      company: "",
      measurement: "",
      price: "",
    });
  };

  const removeVariant = (index) => {
    setProduct((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index),
    }));
  };

  const getCategories = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/category/get-cat`);

      if (res.data.success) {
        setCategories(res.data.categories);
      }
    } catch (err) {
      console.log(err);
    }
  };
  const getCompanies = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/company/get-com`);

      if (res.data.success) {
        setCompanies(res.data.companies);
      }
    } catch (err) {
      console.log(err);
    }
  };
  useEffect(() => {
    getCategories();
    getCompanies();
  }, []);
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!product.media) return toast.error("प्रोडक्ट की फोटो चुनें");

    if (!product.name.trim()) return toast.error("प्रोडक्ट का नाम भरें");

    if (!product.hinglishName.trim()) return toast.error("हिंग्लिश नाम भरें");

    if (!product.category) return toast.error("कैटेगरी चुनें");

    if (product.variants.length === 0)
      return toast.error("कम से कम एक वेरिएंट जोड़ें");

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("name", product.name);
      formData.append("hinglishName", product.hinglishName);
      formData.append("category", product.category);
      formData.append("media", product.media);

      formData.append("variants", JSON.stringify(product.variants));

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/product/add`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data.success) {
        toast.success("प्रोडक्ट सफलतापूर्वक जोड़ा गया");

        setProduct({
          name: "",
          hinglishName: "",
          category: "",
          media: null,
          variants: [],
        });

        setVariant({
          company: "",
          measurement: "",
          price: "",
          stock: "",
        });

        setPreview("");

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        navigate("/product-page");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "कुछ गलत हो गया");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-emerald-50 pt-20 pb-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl">
        <div className="bg-emerald-600 text-white p-5 flex items-center justify-center relative">
          <IoArrowBackOutline
            onClick={() => navigate("/product-page")}
            className="absolute left-5 text-2xl cursor-pointer"
          />

          <h1 className="text-2xl font-bold">नया प्रोडक्ट जोड़ें</h1>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Image */}

          <div className="flex items-center gap-5">
            <input
              ref={fileInputRef}
              id="image"
              type="file"
              hidden
              accept="image/*"
              onChange={handleImage}
            />

            <label
              htmlFor="image"
              className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-2xl overflow-hidden cursor-pointer flex items-center justify-center bg-emerald-50"
            >
              {preview ? (
                <img src={preview} className="w-full h-full object-cover" />
              ) : (
                <div className="text-center">
                  <RiImageUploadLine className="text-5xl text-emerald-600 mx-auto" />
                  <p>फोटो चुनें</p>
                </div>
              )}
            </label>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="p-3 rounded-full bg-emerald-600 text-white"
              >
                <Edit size={18} />
              </button>

              <button
                type="button"
                onClick={removeImage}
                className="p-3 rounded-full bg-red-500 text-white"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {/* Product */}

          <input
            name="name"
            value={product.name}
            onChange={handleProductChange}
            placeholder="प्रोडक्ट नाम"
            className="w-full p-3 border rounded-xl"
          />

          <input
            name="hinglishName"
            value={product.hinglishName}
            onChange={handleProductChange}
            placeholder="Hinglish Name"
            className="w-full p-3 border rounded-xl"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-700">कैटेगरी</label>

              <button
                type="button"
                onClick={() => {
                  setOpenCategoryModal(true);
                }}
                className="flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg"
              >
                <Plus size={16} />
                नई कैटेगरी
              </button>
            </div>

            <select
              name="category"
              value={product.category}
              onChange={handleCategoryChange}
              className="w-full p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none bg-white"
            >
              <option value="">कैटेगरी चुनें</option>

              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <hr />

          {/* ================= COMPANY ================= */}

          <div className="space-y-2 mt-6">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-700">कंपनी</label>

              <button
                type="button"
                onClick={() => {
                  setOpenCompanyModal(true);
                }}
                className="flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg"
              >
                <Plus size={16} />
                नई कंपनी
              </button>
            </div>

            <select
              name="company"
              value={variant.company}
              onChange={handleVariantChange}
              className="w-full p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none bg-white"
            >
              <option value="">कंपनी चुनें</option>

              {filteredCompanies.map((company) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-5">
            <input
              name="measurement"
              value={variant.measurement}
              onChange={handleVariantChange}
              placeholder="500g / 1kg"
              className="p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none"
            />

            <input
              name="price"
              type="number"
              value={variant.price}
              onChange={handleVariantChange}
              placeholder="₹40"
              className="p-3 rounded-xl border-2 border-emerald-200 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            type="button"
            onClick={addVariant}
            className="mt-5 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            वेरिएंट जोड़ें
          </button>
          {product.variants.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="text-lg font-bold text-emerald-700">
                जोड़े गए वेरिएंट
              </h3>

              {product.variants.map((v, index) => {
                const company = companies.find((c) => c._id === v.company);

                return (
                  <div
                    key={index}
                    className="border border-emerald-200 rounded-2xl p-4 bg-emerald-50 flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      {company?.logo && (
                        <img
                          src={company.logo}
                          alt={company.name}
                          className="w-12 h-12 rounded-xl object-cover border"
                        />
                      )}

                      <div>
                        <p className="font-semibold text-emerald-700">
                          {company?.name}
                        </p>

                        <div className="flex gap-2 mt-1 flex-wrap">
                          <span className="px-3 py-1 bg-white rounded-full text-sm border">
                            📦 {v.measurement}
                          </span>

                          <span className="px-3 py-1 bg-white rounded-full text-sm border">
                            ₹ {v.price}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-red-600 text-white py-4 rounded-xl mb-10 font-bold hover:bg-red-700"
          >
            प्रोडक्ट सेव करें
          </button>
        </form>
        {openCategoryModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm space-y-4">
              <h2 className="text-xl font-bold text-center">
                नई कैटेगरी जोड़ें
              </h2>

              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="कैटेगरी का नाम"
                className="w-full p-3 border rounded-xl"
              />

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCategoryImage(e.target.files[0])}
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setOpenCategoryModal(false)}
                  className="flex-1 bg-gray-300 rounded-xl py-3"
                >
                  Cancel
                </button>

                <button
                  onClick={addCategory}
                  className="flex-1 bg-emerald-600 text-white rounded-xl py-3"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {openCompanyModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[90%] max-w-sm space-y-4">
              <h2 className="text-xl font-bold text-center">नई कंपनी जोड़ें</h2>

              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="कंपनी का नाम"
                className="w-full p-3 border rounded-xl"
              />

              <label className="font-semibold">कंपनी की फोटो</label>

              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCompanyLogo(e.target.files[0])}
              />

              <label className="font-semibold">कंपनी किन कैटेगरी में है?</label>

              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-xl p-3">
                {categories.map((cat) => (
                  <label
                    key={cat._id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(cat._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategories((prev) => [...prev, cat._id]);
                        } else {
                          setSelectedCategories((prev) =>
                            prev.filter((id) => id !== cat._id),
                          );
                        }
                      }}
                    />

                    {cat.name}
                  </label>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setOpenCompanyModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-300"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={addCompany}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white"
                >
                  Save
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
