import { API_BASE_URL } from "@/lib/constants";
import { setProductData } from "@/redux/ProductSlice";
import Fuse from "fuse.js";
import { Edit, MoveLeft, Search, Trash2, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "./ui/button";

const AdminProductView = ({ tailwind, condition }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { productData } = useSelector((state) => state.product);

  const [search, setSearch] = useState("");
  const [productToDelete, setProductToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // =========================================
  // FUSE SEARCH
  // =========================================

  const fuse = useMemo(() => {
    return new Fuse(productData || [], {
      keys: [
        {
          name: "name",
          weight: 0.4,
        },
        {
          name: "hinglishName",
          weight: 0.3,
        },
        {
          name: "category.name",
          weight: 0.1,
        },
        {
          name: "keyword",
          weight: 0.9,
        },
        {
          name: "variants.company.name",
          weight: 0.05,
        },
        {
          name: "variants.measurement",
          weight: 0.05,
        },
      ],

      // Lower = stricter
      threshold: 0.4,

      // Helps with words such as:
      // dudh -> doodh
      // shampoo -> sampoo
      // baraf -> barf
      ignoreLocation: true,

      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [productData]);

  const filteredProducts = useMemo(() => {
    if (!search.trim()) {
      return productData || [];
    }

    return fuse.search(search.trim()).map((result) => result.item);
  }, [search, fuse, productData]);

  // =========================================
  // DELETE PRODUCT
  // =========================================

  const handleDeleteProduct = async () => {
    if (!productToDelete?._id) return;

    try {
      setDeleting(true);

      const res = await axios.delete(
        `${API_BASE_URL}/api/v1/product/delete/${productToDelete._id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data.success) {
        toast.success("प्रोडक्ट डिलीट हो गया");

        dispatch(
          setProductData(
            productData.filter(
              (product) => product._id !== productToDelete._id,
            ),
          ),
        );

        setProductToDelete(null);
      }
    } catch (err) {
      console.error("Delete product error:", err);

      toast.error(err.response?.data?.message || "प्रोडक्ट डिलीट नहीं हो पाया");
    } finally {
      setDeleting(false);
    }
  };

  // =========================================
  // CLEAR SEARCH
  // =========================================

  const clearSearch = () => {
    setSearch("");
  };

  // =========================================
  // UI
  // =========================================

  return (
    <div className="relative">
      {/* ================================= */}
      {/* HEADER */}
      {/* ================================= */}

      {tailwind === "mt-18" && (
        <div className="relative flex items-center justify-center mb-4">
          <MoveLeft
            onClick={() => navigate("/admin-dashboard")}
            className="absolute left-3 cursor-pointer"
          />

          <h1 className="text-xl font-bold">प्रोडक्ट्स</h1>
        </div>
      )}

      {/* ================================= */}
      {/* FUSE SEARCH */}
      {/* ================================= */}

      <div className="relative mb-4">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={20}
        />

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="प्रोडक्ट खोजें..."
          className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-12 pr-12 outline-none text-base focus:border-emerald-500"
        />

        {search && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* ================================= */}
      {/* SEARCH RESULT COUNT */}
      {/* ================================= */}

      {search.trim() && (
        <div className="mb-3 px-1 text-sm text-gray-500">
          {filteredProducts.length} प्रोडक्ट मिले
        </div>
      )}

      {/* ================================= */}
      {/* PRODUCTS */}
      {/* ================================= */}

      <div className="min-h-screen w-full bg-gray-100 shadow-xl rounded-4xl mt-2">
        <div className="mt-8 overflow-x-auto">
          <div className="space-y-2">
            {/* NO RESULT */}

            {filteredProducts.length === 0 && (
              <div className="bg-white rounded-2xl p-10 text-center">
                <Search size={40} className="mx-auto text-gray-300 mb-3" />

                <h2 className="font-bold text-gray-700">
                  कोई प्रोडक्ट नहीं मिला
                </h2>

                <p className="text-sm text-gray-400 mt-1">
                  दूसरा नाम या शब्द खोजकर देखें
                </p>
              </div>
            )}

            {/* PRODUCT LIST */}

            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* ========================= */}
                {/* PRODUCT HEADER */}
                {/* ========================= */}

                <div className="relative flex gap-4 p-4">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-20 h-20 rounded-xl object-cover border"
                  />

                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-gray-800">
                      {product.name} / {product.hinglishName}
                    </h2>

                    {product.category?.name && (
                      <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm">
                        {product.category.name}
                      </div>
                    )}
                  </div>

                  {/* EDIT + DELETE */}

                  <div className="flex flex-col gap-2">
                    {/* EDIT */}

                    <button
                      type="button"
                      onClick={() => navigate(`/edit-product/${product._id}`)}
                      className="p-3 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Edit size={18} />
                    </button>

                    {/* DELETE */}

                    <button
                      type="button"
                      onClick={() => setProductToDelete(product)}
                      className="p-3 rounded-full bg-red-500 text-white hover:bg-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* ========================= */}
                {/* VARIANTS */}
                {/* ========================= */}

                <div className="px-4 pb-4">
                  <h3 className="font-semibold mb-3">
                    उपलब्ध वेरिएंट ({product.variants?.length || 0})
                  </h3>

                  <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                    {product.variants?.map((variant, index) => (
                      <div
                        key={index}
                        className="border rounded-xl p-3 flex justify-between items-center bg-gray-50"
                      >
                        <div className="flex gap-3 items-center">
                          {variant.company?.logo && (
                            <img
                              src={variant.company.logo}
                              alt={variant.company.name}
                              className="w-12 h-12 rounded-lg border object-cover"
                            />
                          )}

                          <div>
                            <h4 className="font-semibold">
                              {variant.company?.name}
                            </h4>

                            <div className="flex gap-2 mt-1 flex-wrap">
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">
                                📦 {variant.measurement}
                              </span>

                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs">
                                ₹ {variant.price}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================================= */}
      {/* DELETE CONFIRMATION */}
      {/* ================================= */}

      {productToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-emerald-50 p-6 shadow-2xl">
            <h2 className="text-center text-xl font-bold text-gray-900">
              प्रोडक्ट हटाएं?
            </h2>

            <p className="mt-3 text-center font-semibold text-gray-800">
              {productToDelete.name}
            </p>

            <p className="mt-2 text-center text-gray-500">
              क्या आप सच में इस प्रोडक्ट को डिलीट करना चाहते हैं?
            </p>

            <div className="mt-6 flex justify-center gap-4">
              {/* NO */}

              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setProductToDelete(null)}
                className="flex-1"
              >
                नहीं
              </Button>

              {/* YES */}

              <Button
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700"
                onClick={handleDeleteProduct}
              >
                <Trash2 className="h-4 w-4 text-white" />

                {deleting ? "डिलीट हो रहा है..." : "हाँ, हटाएं"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductView;
