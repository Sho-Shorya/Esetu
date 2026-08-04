import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Package, CircleCheck, X, ShoppingCart } from "lucide-react";
import axios from "axios";
import { setCartData } from "@/redux/ProductSlice";
import { API_BASE_URL } from "@/lib/constants";
import { toast } from "sonner";

const ProductsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { productData } = useSelector((state) => state.product);

  const location = useLocation();

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [qty, setQty] = useState(1);

  const [selectedCompany, setSelectedCompany] = useState("");

  const [selectedType, setSelectedType] = useState("");

  const [selectedMeasurement, setSelectedMeasurement] = useState("");

  const searchQuery =
    new URLSearchParams(location.search).get("search")?.trim().toLowerCase() ||
    "";

  const products = useMemo(() => {
    if (!Array.isArray(productData)) return [];

    if (!searchQuery) return productData;

    const terms = searchQuery.split(/\s+/).filter(Boolean);

    return productData.filter((product) => {
      const searchable = [
        product?.name,
        product?.hinglishName,
        ...(product?.companies || []),
        ...(product?.measurement || []),
        ...(product?.type || []),
      ]
        .join(" ")
        .toLowerCase();

      return terms.every((term) => searchable.includes(term));
    });
  }, [productData, searchQuery]);

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setQty(1);

    const firstVariant = product?.variants?.[0];
    setSelectedCompany(firstVariant?.company || "");
    setSelectedMeasurement(firstVariant?.measurement || "");
  };
  const selectedVariant = selectedProduct?.variants.find(
    (variant) =>
      variant.company._id === selectedCompany?._id &&
      variant.measurement === selectedMeasurement,
  );

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedVariant) {
      toast.error("Please select company and measurement", { duration: 1000 });
      return;
    }

    const cartItem = {
      productId: selectedProduct._id,
      company: selectedCompany._id,
      measurement: selectedMeasurement,
      qty,
    };
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/cart/add-cart`,
        cartItem,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data.success) {
        dispatch(setCartData(res.data.cart));
        setSelectedProduct(null);
        setQty(1);

        setSelectedCompany("");
        setSelectedMeasurement("");
        toast.success("कार्ट में जोड़ा गया", { duration: 800 });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const currentPrice = (selectedVariant?.price || 0) * qty;

  // Fake MRP (25% higher)
  const fakeMrp = Math.round(currentPrice * 1.15);

  // Fake discount percentage
  const discount = Math.round(((fakeMrp - currentPrice) / fakeMrp) * 100);

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Search Result */}

      {searchQuery && (
        <div className="flex items-center justify-center gap-2 py-3 text-gray-600">
          <Search size={18} />

          <p>
            Results for
            <span className="font-semibold text-red-600 ml-1">
              {searchQuery}
            </span>
          </p>
        </div>
      )}

      {/* Empty */}

      {productData.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-28">
          <Package size={70} className="text-gray-300" />

          <h2 className="mt-4 text-lg font-semibold">कोई उत्पाद नहीं मिला</h2>

          <p className="text-gray-500">Try searching something else.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-4 p-4">
          {productData.map((item) => (
            <motion.div
              key={item._id}
              layout
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => handleProductClick(item)}
              className="bg-white rounded-3xl shadow-sm hover:shadow-lg cursor-pointer overflow-hidden"
            >
              <div className="overflow-hidden bg-gray-100 h-36 flex justify-center items-center">
                <motion.img
                  whileHover={{ scale: 1.08 }}
                  transition={{ duration: 0.25 }}
                  src={item.image || "./sample_img.png"}
                  alt={item.name}
                  className="h-35 object-contain"
                />
              </div>

              <div className="p-3">
                <h2 className="font-semibold text-[16px] line-clamp-1">
                  {item.name}
                </h2>

                <p className="text-xs text-gray-500 line-clamp-1">
                  {item.hinglishName}
                </p>
                <div className="flex gap-[10px]">
                  {[
                    ...new Map(
                      item.variants.map((variant) => [
                        variant.company._id,
                        variant,
                      ]),
                    ).values(),
                  ].map((variant) => (
                    <span
                      key={variant.company._id}
                      className={`inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200
        ${
          variant.available
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-red-100 text-red-700 border-red-200"
        }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          variant.available ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      {variant.company.name}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <>
            {/* Background */}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0  bg-black/40 backdrop-blur-sm z-40"
            />

            {/* Bottom Sheet */}

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 28,
              }}
              className="fixed bottom-0 left-0 right-0 mb-15 z-50 bg-white rounded-t-[30px] p-5 max-h-[85vh] overflow-y-auto"
            >
              <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-5" />

              <div className="flex gap-5">
                <div className="bg-gray-100 rounded-2xl p-3">
                  <img
                    src={selectedProduct.image || "./sample_img.png"}
                    className="h-24 w-24 object-contain"
                  />
                </div>

                <div className="flex-1">
                  <h1 className="text-xl font-bold">{selectedProduct.name}</h1>

                  <p className="text-gray-500">
                    {selectedProduct.hinglishName}
                  </p>
                  <div className="flex gap-[10px]">
                    {[
                      ...new Map(
                        selectedProduct.variants.map((variant) => [
                          variant.company._id,
                          variant,
                        ]),
                      ).values(),
                    ].map((variant) => (
                      <span
                        key={variant.company._id}
                        className={`inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200
        ${
          variant.available
            ? "bg-green-100 text-green-700 border-green-200"
            : "bg-red-100 text-red-700 border-red-200"
        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            variant.available ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        {variant.company.name}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setSelectedCompany("");
                    setSelectedMeasurement("");
                  }}
                  className="h-10 w-10 absolute right-4 top-11 rounded-full bg-gray-100 flex justify-center items-center"
                >
                  <X />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                {[
                  ...new Map(
                    selectedProduct.variants.map((variant) => [
                      variant.company._id,
                      variant,
                    ]),
                  ).values(),
                ].length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Company</h3>

                    <div className="flex flex-wrap gap-2">
                      {[
                        ...new Map(
                          selectedProduct.variants.map((variant) => [
                            variant.company._id,
                            variant,
                          ]),
                        ).values(),
                      ].map((variant) => (
                        <button
                          key={variant.company._id}
                          type="button"
                          onClick={() => setSelectedCompany(variant.company)}
                          className={`px-4 py-2 rounded-full border ${
                            selectedCompany?._id === variant.company._id
                              ? "bg-red-600 text-white border-red-600"
                              : "bg-gray-100"
                          }`}
                        >
                          {variant.company.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedCompany && (
                  <div>
                    <h3 className="font-semibold mb-2">Measurement</h3>

                    <div className="flex flex-wrap gap-2">
                      {selectedProduct.variants
                        .filter(
                          (variant) =>
                            variant.company._id === selectedCompany._id,
                        )
                        .map((variant) => (
                          <button
                            key={variant.measurement}
                            type="button"
                            onClick={() =>
                              setSelectedMeasurement(variant.measurement)
                            }
                            className={`px-4 py-2 rounded-full border ${
                              selectedMeasurement === variant.measurement
                                ? "bg-red-600 text-white"
                                : "bg-gray-100"
                            }`}
                          >
                            {variant.measurement}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
                {/* Quantity */}

                <div>
                  <h3 className="font-semibold mb-3">Quantity</h3>

                  <div className="flex items-center justify-between bg-gray-100 rounded-2xl p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setQty((prev) => (prev > 10 ? prev - 10 : 1))
                      }
                      className="w-13 h-11 rounded-xl bg-white shadow text-xl font-bold"
                    >
                      −10
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setQty((prev) => (prev > 1 ? prev - 1 : 1))
                      }
                      className="w-11 h-11 rounded-xl bg-white shadow text-xl font-bold"
                    >
                      −
                    </button>

                    <span className="text-2xl flex items-center justify-center min-w-[100px] font-bold">
                      {qty}
                    </span>

                    <button
                      type="button"
                      onClick={() => setQty((prev) => prev + 1)}
                      className="w-11 h-11 rounded-xl bg-red-600 text-white shadow text-xl font-bold"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setQty((prev) => prev + 10)}
                      className="w-13 h-11 rounded-xl bg-red-600 text-white shadow text-xl font-bold"
                    >
                      +10
                    </button>
                  </div>
                </div>

                {/* Price */}

                <div className="flex justify-between items-center rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-2xl">
                  <div>
                    <p className="text-gray-500 text-sm">Total Price</p>

                    <div className="flex items-center gap-2 mt-1">
                      <h2 className="text-3xl font-bold text-red-600">
                        ₹{currentPrice}
                      </h2>

                      <span className="text-gray-400 line-through text-lg">
                        ₹{fakeMrp}
                      </span>

                      {discount && (
                        <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                          {discount}% OFF
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-green-700 font-medium mt-1">
                      You save ₹{fakeMrp - currentPrice}
                    </p>
                  </div>

                  <ShoppingCart size={36} className="text-red-600" />
                </div>

                {/* Order Button */}

                <div className="sticky bottom-0 bg-white pt-3 pb-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.01 }}
                    type="submit"
                    className="w-full h-14 rounded-2xl bg-red-600 text-white text-lg font-semibold shadow-lg hover:bg-red-700 transition"
                  >
                    ऑर्डर करें • ₹{(selectedVariant?.price || 0) * qty}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductsList;
