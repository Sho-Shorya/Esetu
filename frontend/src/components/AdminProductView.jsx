import { API_BASE_URL } from "@/lib/constants";
import { setProductData } from "@/redux/ProductSlice";
import Fuse from "fuse.js";
import { CheckCircle2, Edit, Package, Search, Trash2, X } from "lucide-react";
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

  // =========================================================
  // FUSE SEARCH
  // =========================================================

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

      threshold: 0.4,
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

  // =========================================================
  // STATS
  // =========================================================

  const totalProducts = productData?.length || 0;

  const totalVariants =
    productData?.reduce(
      (total, product) => total + (product.variants?.length || 0),
      0,
    ) || 0;

  // =========================================================
  // DELETE PRODUCT
  // =========================================================

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

  // =========================================================
  // CLEAR SEARCH
  // =========================================================

  const clearSearch = () => {
    setSearch("");
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="w-full pb-10">
      {/* =====================================================
          TOP CONTROL BAR
      ====================================================== */}

      <div className="sticky top-0 z-30 -mx-1 bg-gray-50/95 px-1 pb-4 pt-2 backdrop-blur-md">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* SEARCH */}

            <div className="relative flex-1">
              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="प्रोडक्ट, कंपनी या साइज खोजें..."
                className="
                  h-12
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  pl-11
                  pr-11
                  text-[15px]
                  font-medium
                  text-gray-800
                  outline-none
                  transition
                  placeholder:text-gray-400
                  focus:border-emerald-400
                  focus:bg-white
                  focus:ring-4
                  focus:ring-emerald-50
                "
              />

              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="
                    absolute
                    right-3
                    top-1/2
                    flex
                    h-8
                    w-8
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-lg
                    text-gray-400
                    transition
                    hover:bg-gray-200
                    hover:text-gray-700
                  "
                >
                  <X size={17} />
                </button>
              )}
            </div>

            {/* PRODUCT COUNT */}

            <div className="flex items-center gap-2">
              <div className="flex h-12 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4">
                <Package size={17} className="text-emerald-600" />

                <div className="leading-none">
                  <p className="text-[11px] font-medium text-gray-400">
                    प्रोडक्ट
                  </p>

                  <p className="mt-1 text-sm font-bold text-gray-800">
                    {search.trim()
                      ? `${filteredProducts.length} / ${totalProducts}`
                      : totalProducts}
                  </p>
                </div>
              </div>

              <div className="hidden h-12 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 sm:flex">
                <CheckCircle2 size={17} className="text-blue-600" />

                <div className="leading-none">
                  <p className="text-[11px] font-medium text-gray-400">
                    वेरिएंट
                  </p>

                  <p className="mt-1 text-sm font-bold text-gray-800">
                    {totalVariants}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH RESULT MESSAGE */}

          {search.trim() && (
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-xs font-medium text-gray-500">
                <span className="font-bold text-gray-800">
                  {filteredProducts.length}
                </span>{" "}
                प्रोडक्ट मिले
              </p>

              <button
                onClick={clearSearch}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
              >
                सर्च हटाएं
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          PRODUCT AREA
      ====================================================== */}

      <div className="mt-2">
        {/* ===================================================
            EMPTY STATE
        ==================================================== */}

        {filteredProducts.length === 0 && (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-300 bg-white px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Search size={28} className="text-gray-400" />
            </div>

            <h2 className="mt-5 text-lg font-bold text-gray-800">
              कोई प्रोडक्ट नहीं मिला
            </h2>

            <p className="mt-1 max-w-sm text-sm text-gray-400">
              दूसरा नाम, कंपनी, कैटेगरी या साइज खोजकर देखें।
            </p>

            {search && (
              <button
                onClick={clearSearch}
                className="
                  mt-5
                  rounded-xl
                  bg-gray-900
                  px-5
                  py-2.5
                  text-sm
                  font-semibold
                  text-white
                  transition
                  hover:bg-gray-800
                "
              >
                सभी प्रोडक्ट देखें
              </button>
            )}
          </div>
        )}

        {/* ===================================================
            PRODUCT LIST
        ==================================================== */}

        <div className="space-y-3">
          {filteredProducts.map((product) => {
            const variants = product.variants || [];

            return (
              <div
                key={product._id}
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  shadow-sm
                  transition
                  hover:border-gray-300
                  hover:shadow-md
                "
              >
                {/* =================================================
                    PRODUCT MAIN ROW
                ================================================== */}

                <div className="p-3 sm:p-4">
                  <div className="flex gap-3 sm:gap-4">
                    {/* IMAGE */}

                    <div className="relative shrink-0">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="
                          h-[72px]
                          w-[72px]
                          rounded-xl
                          border
                          border-gray-200
                          bg-gray-50
                          object-cover
                          sm:h-20
                          sm:w-20
                        "
                      />

                      {/* VARIANT COUNT */}

                      <div
                        className="
                          absolute
                          -bottom-2
                          -right-2
                          flex
                          h-7
                          min-w-7
                          items-center
                          justify-center
                          rounded-full
                          border-2
                          border-white
                          bg-gray-900
                          px-1.5
                          text-[10px]
                          font-bold
                          text-white
                        "
                      >
                        {variants.length}
                      </div>
                    </div>

                    {/* PRODUCT INFO */}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start gap-2">
                        <h2 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                          {product.name}
                        </h2>

                        {product.hinglishName && (
                          <span className="hidden text-sm font-medium text-gray-400 sm:block">
                            / {product.hinglishName}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {product.category?.name && (
                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                            {product.category.name}
                          </span>
                        )}

                        <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                          {variants.length}{" "}
                          {variants.length === 1 ? "वेरिएंट" : "वेरिएंट्स"}
                        </span>
                      </div>
                    </div>

                    {/* ACTIONS */}

                    <div className="flex shrink-0 items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/edit-product/${product._id}`)}
                        title="प्रोडक्ट एडिट करें"
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-gray-200
                          bg-white
                          text-gray-600
                          transition
                          hover:border-emerald-200
                          hover:bg-emerald-50
                          hover:text-emerald-600
                        "
                      >
                        <Edit size={17} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setProductToDelete(product)}
                        title="प्रोडक्ट डिलीट करें"
                        className="
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-xl
                          border
                          border-gray-200
                          bg-white
                          text-gray-500
                          transition
                          hover:border-red-200
                          hover:bg-red-50
                          hover:text-red-600
                        "
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* =================================================
                    VARIANTS
                ================================================== */}

                {variants.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-3 sm:px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                        उपलब्ध वेरिएंट
                      </p>

                      <p className="text-[11px] font-semibold text-gray-400">
                        {variants.length} विकल्प
                      </p>
                    </div>

                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                      {variants.map((variant, index) => (
                        <div
                          key={index}
                          className="
                            flex
                            min-w-[190px]
                            shrink-0
                            items-center
                            gap-2.5
                            rounded-xl
                            border
                            border-gray-200
                            bg-white
                            px-2.5
                            py-2
                            shadow-sm
                          "
                        >
                          {/* COMPANY LOGO */}

                          {variant.company?.logo ? (
                            <img
                              src={variant.company.logo}
                              alt={variant.company.name || "Company"}
                              className="
                                h-9
                                w-9
                                shrink-0
                                rounded-lg
                                border
                                border-gray-100
                                bg-white
                                object-contain
                              "
                            />
                          ) : (
                            <div
                              className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-lg
                                bg-gray-100
                                text-xs
                                font-bold
                                text-gray-400
                              "
                            >
                              {variant.company?.name
                                ?.charAt(0)
                                ?.toUpperCase() || "?"}
                            </div>
                          )}

                          {/* COMPANY + MEASUREMENT */}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-gray-800">
                              {variant.company?.name || "Company"}
                            </p>

                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                                {variant.measurement}
                              </span>

                              <span className="text-xs font-bold text-gray-900">
                                ₹{variant.price}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NO VARIANTS */}

                {variants.length === 0 && (
                  <div className="border-t border-gray-100 bg-amber-50 px-4 py-2.5">
                    <p className="text-xs font-semibold text-amber-700">
                      ⚠️ इस प्रोडक्ट में अभी कोई वेरिएंट नहीं है।
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* =====================================================
          DELETE CONFIRMATION MODAL
      ====================================================== */}

      {productToDelete && (
        <div
          className="
            fixed
            inset-0
            z-[60]
            flex
            items-center
            justify-center
            bg-black/60
            px-4
            backdrop-blur-sm
          "
          onClick={() => !deleting && setProductToDelete(null)}
        >
          <div
            className="
              w-full
              max-w-sm
              overflow-hidden
              rounded-3xl
              border
              border-gray-200
              bg-white
              shadow-2xl
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}

            <div className="px-6 pb-2 pt-6 text-center">
              <div
                className="
                  mx-auto
                  flex
                  h-14
                  w-14
                  items-center
                  justify-center
                  rounded-2xl
                  bg-red-50
                  text-red-600
                "
              >
                <Trash2 size={24} />
              </div>

              <h2 className="mt-4 text-xl font-bold text-gray-900">
                प्रोडक्ट हटाएं?
              </h2>

              <p className="mt-2 text-sm leading-5 text-gray-500">
                यह प्रोडक्ट आपकी प्रोडक्ट लिस्ट से हटा दिया जाएगा।
              </p>
            </div>

            {/* PRODUCT */}

            <div className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
              <img
                src={productToDelete.image}
                alt={productToDelete.name}
                className="h-12 w-12 rounded-xl border border-gray-200 object-cover"
              />

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900">
                  {productToDelete.name}
                </p>

                {productToDelete.hinglishName && (
                  <p className="truncate text-xs text-gray-400">
                    {productToDelete.hinglishName}
                  </p>
                )}
              </div>
            </div>

            {/* ACTIONS */}

            <div className="flex gap-2 p-5">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setProductToDelete(null)}
                className="
                  h-11
                  flex-1
                  rounded-xl
                  border-gray-200
                  font-semibold
                "
              >
                नहीं
              </Button>

              <Button
                disabled={deleting}
                onClick={handleDeleteProduct}
                className="
                  h-11
                  flex-1
                  rounded-xl
                  bg-red-600
                  font-semibold
                  text-white
                  hover:bg-red-700
                "
              >
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
