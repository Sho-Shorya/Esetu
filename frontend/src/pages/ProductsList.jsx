// import React, { useMemo, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { useDispatch, useSelector } from "react-redux";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Search,
//   Package,
//   CircleCheck,
//   X,
//   ShoppingCart,
//   Loader2,
// } from "lucide-react";
// import axios from "axios";
// import { setCartData } from "@/redux/ProductSlice";
// import { API_BASE_URL } from "@/lib/constants";
// import { toast } from "sonner";
// import SearchBar from "@/components/home/Searchbar";
// import WelcomeCard from "@/components/home/WelcomeCard";
// import CategoryScroller from "@/components/home/CategoryScroller";

// const ProductsList = () => {
//   const dispatch = useDispatch();
//   const navigate = useNavigate();
//   const { productData, prodLoading } = useSelector((state) => state.product);

//   const location = useLocation();

//   const [selectedProduct, setSelectedProduct] = useState(null);

//   const [qty, setQty] = useState(1);

//   const [selectedCompany, setSelectedCompany] = useState("");

//   const [selectedType, setSelectedType] = useState("");

//   const [selectedMeasurement, setSelectedMeasurement] = useState("");

//   const searchQuery =
//     new URLSearchParams(location.search).get("search")?.trim().toLowerCase() ||
//     "";
//   const products = useMemo(() => {
//     if (!Array.isArray(productData)) return [];

//     if (!searchQuery) return productData;

//     const terms = searchQuery.split(/\s+/).filter(Boolean);

//     return productData.filter((product) => {
//       const searchable = [
//         product?.name,
//         product?.hinglishName,
//         ...(product?.companies || []),
//         ...(product?.measurement || []),
//         ...(product?.type || []),
//       ]
//         .join(" ")
//         .toLowerCase();

//       return terms.every((term) => searchable.includes(term));
//     });
//   }, [productData, searchQuery]);

//   const handleProductClick = (product) => {
//     setSelectedProduct(product);
//     setQty(1);

//     const firstVariant = product?.variants?.[0];
//     setSelectedCompany("");
//     setSelectedMeasurement("");
//   };
//   const selectedVariant = selectedProduct?.variants.find(
//     (variant) =>
//       variant.company._id === selectedCompany?._id &&
//       variant.measurement === selectedMeasurement,
//   );
//   const [addLoading, setAddLoading] = useState(false);

//   if (prodLoading) {
//     return (
//       <div className=" flex h-[80vh] items-center justify-center">
//         <div className="mt-8 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-red-600"></div>
//       </div>
//     );
//   }
//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (!selectedVariant) {
//       toast.error("कृपया कंपनी और माप चुनें।", { duration: 2000 });
//       return;
//     }
//     setAddLoading(true);

//     const cartItem = {
//       productId: selectedProduct._id,
//       company: selectedCompany._id,
//       measurement: selectedMeasurement,
//       qty,
//     };
//     try {
//       const res = await axios.post(
//         `${API_BASE_URL}/api/v1/cart/add-cart`,
//         cartItem,
//         {
//           headers: {
//             Authorization: `Bearer ${localStorage.getItem("token")}`,
//           },
//         },
//       );

//       if (res.data.success) {
//         dispatch(setCartData(res.data.cart));
//         setSelectedProduct(null);
//         setQty(1);

//         setSelectedCompany("");
//         setSelectedMeasurement("");
//         toast.success("कार्ट में जोड़ा गया", { duration: 800 });
//       }
//     } catch (error) {
//       console.log(error);
//     } finally {
//       setAddLoading(false);
//     }
//   };
//   const handleCross = () => {
//     setSelectedProduct(null);
//     setSelectedCompany("");
//     setSelectedMeasurement("");
//   };

//   const currentPrice = (selectedVariant?.price || 0) * qty;

//   // Fake MRP (25% higher)
//   const fakeMrp = Math.round(currentPrice * 1.15);

//   // Fake discount percentage
//   const discount = Math.round(((fakeMrp - currentPrice) / fakeMrp) * 100);

//   return (
//     <div className="min-h-screen bg-gray-100 pb-24 ">
//       {/* Empty */}

//       {products.length === 0 ? (
//         <div className="flex flex-col items-center justify-center mt-28">
//           <Package size={70} className="text-gray-300" />

//           <h2 className="mt-4 text-lg font-semibold">कोई उत्पाद नहीं मिला</h2>

//           <p className="text-gray-500">Try searching something else.</p>
//         </div>
//       ) : (
//         <motion.div layout className="grid grid-cols-2 gap-4 p-4">
//           {products.map((item) => (
//             <motion.div
//               key={item._id}
//               layout
//               whileHover={{ y: -3 }}
//               whileTap={{ scale: 0.96 }}
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.25 }}
//               onClick={() => handleProductClick(item)}
//               className="bg-white rounded-3xl shadow-sm hover:shadow-lg cursor-pointer overflow-hidden"
//             >
//               <div className="overflow-hidden bg-gray-100 h-36 flex justify-center items-center">
//                 <motion.img
//                   whileHover={{ scale: 1.08 }}
//                   transition={{ duration: 0.25 }}
//                   src={item.image || "./sample_img.png"}
//                   alt={item.name}
//                   className="h-35 object-contain"
//                 />
//               </div>

//               <div className="p-3">
//                 <h2 className="font-semibold text-[16px] line-clamp-1">
//                   {item.name}
//                 </h2>

//                 <p className="text-xs text-gray-500 line-clamp-1">
//                   {item.hinglishName}
//                 </p>
//                 <div className="flex gap-[10px]">
//                   {[
//                     ...new Map(
//                       item.variants.map((variant) => [
//                         variant.company._id,
//                         variant,
//                       ]),
//                     ).values(),
//                   ].map((variant) => (
//                     <span
//                       key={variant.company._id}
//                       className={`inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200
//         ${
//           variant.available
//             ? "bg-green-100 text-green-700 border-green-200"
//             : "bg-red-100 text-red-700 border-red-200"
//         }`}
//                     >
//                       <span
//                         className={`w-2 h-2 rounded-full ${
//                           variant.available ? "bg-green-500" : "bg-red-500"
//                         }`}
//                       />
//                       {variant.company.name}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             </motion.div>
//           ))}
//         </motion.div>
//       )}

//       <AnimatePresence>
//         {selectedProduct && (
//           <>
//             {/* Background */}

//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               onClick={handleCross}
//               className="fixed inset-0  bg-black/40 backdrop-blur-sm z-40"
//             />

//             {/* Bottom Sheet */}

//             <motion.div
//               initial={{ y: "100%" }}
//               animate={{ y: 0 }}
//               exit={{ y: "100%" }}
//               transition={{
//                 type: "spring",
//                 stiffness: 260,
//                 damping: 28,
//               }}
//               className="fixed bottom-0 left-0 right-0 mb-15 z-50 bg-white rounded-t-[30px] p-5 max-h-[85vh] overflow-y-auto"
//             >
//               <div className="w-14 h-1.5 bg-gray-300 rounded-full mx-auto mb-5" />

//               <div className="flex gap-5">
//                 <div className="bg-gray-100 rounded-2xl p-3">
//                   <img
//                     src={selectedProduct.image || "./sample_img.png"}
//                     className="h-24 w-24 object-contain"
//                   />
//                 </div>

//                 <div className="flex-1">
//                   <h1 className="text-xl font-bold">{selectedProduct.name}</h1>

//                   <p className="text-gray-500">
//                     {selectedProduct.hinglishName}
//                   </p>
//                   <div className="flex gap-[10px]">
//                     {[
//                       ...new Map(
//                         selectedProduct.variants.map((variant) => [
//                           variant.company._id,
//                           variant,
//                         ]),
//                       ).values(),
//                     ].map((variant) => (
//                       <span
//                         key={variant.company._id}
//                         className={`inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-all duration-200
//         ${
//           variant.available
//             ? "bg-green-100 text-green-700 border-green-200"
//             : "bg-red-100 text-red-700 border-red-200"
//         }`}
//                       >
//                         <span
//                           className={`w-2 h-2 rounded-full ${
//                             variant.available ? "bg-green-500" : "bg-red-500"
//                           }`}
//                         />
//                         {variant.company.name}
//                       </span>
//                     ))}
//                   </div>
//                 </div>

//                 <button
//                   onClick={handleCross}
//                   className="h-10 w-10 absolute right-4 top-11 rounded-full bg-gray-100 flex justify-center items-center"
//                 >
//                   <X />
//                 </button>
//               </div>

//               <form onSubmit={handleSubmit} className="mt-8 space-y-6">
//                 {[
//                   ...new Map(
//                     selectedProduct.variants.map((variant) => [
//                       variant.company._id,
//                       variant,
//                     ]),
//                   ).values(),
//                 ].length > 0 && (
//                   <div>
//                     <h3 className="font-semibold mb-2">कंपनी चुनें</h3>

//                     <div className="flex flex-wrap gap-2">
//                       {[
//                         ...new Map(
//                           selectedProduct.variants.map((variant) => [
//                             variant.company._id,
//                             variant,
//                           ]),
//                         ).values(),
//                       ].map((variant) => (
//                         <button
//                           key={variant.company._id}
//                           type="button"
//                           onClick={() => setSelectedCompany(variant.company)}
//                           className={`px-4 py-2 rounded-full border ${
//                             selectedCompany?._id === variant.company._id
//                               ? "bg-red-600 text-white border-red-600"
//                               : "bg-gray-100"
//                           }`}
//                         >
//                           {variant.company.name}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 )}
//                 {selectedCompany && (
//                   <div>
//                     <h3 className="font-semibold mb-2">माप चुनें</h3>

//                     <div className="flex flex-wrap gap-2">
//                       {selectedProduct.variants
//                         .filter(
//                           (variant) =>
//                             variant.company._id === selectedCompany._id,
//                         )
//                         .map((variant) => (
//                           <button
//                             key={variant.measurement}
//                             type="button"
//                             onClick={() =>
//                               setSelectedMeasurement(variant.measurement)
//                             }
//                             className={`px-4 py-2 rounded-full border ${
//                               selectedMeasurement === variant.measurement
//                                 ? "bg-red-600 text-white"
//                                 : "bg-gray-100"
//                             }`}
//                           >
//                             {variant.measurement}
//                           </button>
//                         ))}
//                     </div>
//                   </div>
//                 )}
//                 {/* Quantity */}

//                 <div>
//                   <h3 className="font-semibold mb-3">मात्रा</h3>

//                   <div className="flex items-center justify-between bg-gray-100 rounded-2xl p-3">
//                     <button
//                       type="button"
//                       onClick={() =>
//                         setQty((prev) => (prev > 10 ? prev - 10 : 1))
//                       }
//                       className="w-13 h-11 rounded-xl bg-white shadow text-xl font-bold"
//                     >
//                       −10
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() =>
//                         setQty((prev) => (prev > 1 ? prev - 1 : 1))
//                       }
//                       className="w-11 h-11 rounded-xl bg-white shadow text-xl font-bold"
//                     >
//                       −
//                     </button>

//                     <span className="text-2xl flex items-center justify-center min-w-[100px] font-bold">
//                       {qty}
//                     </span>

//                     <button
//                       type="button"
//                       onClick={() => setQty((prev) => prev + 1)}
//                       className="w-11 h-11 rounded-xl bg-red-600 text-white shadow text-xl font-bold"
//                     >
//                       +
//                     </button>
//                     <button
//                       type="button"
//                       onClick={() => setQty((prev) => prev + 10)}
//                       className="w-13 h-11 rounded-xl bg-red-600 text-white shadow text-xl font-bold"
//                     >
//                       +10
//                     </button>
//                   </div>
//                 </div>

//                 {/* Price */}

//                 <div className="flex justify-between items-center rounded-2xl bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-2xl">
//                   <div>
//                     <p className="text-gray-500 text-sm">Total Price</p>

//                     <div className="flex items-center gap-2 mt-1">
//                       <h2 className="text-3xl font-bold text-red-600">
//                         ₹{currentPrice}
//                       </h2>

//                       <span className="text-gray-400 line-through text-lg">
//                         ₹{fakeMrp}
//                       </span>

//                       {discount && (
//                         <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
//                           {discount}% OFF
//                         </span>
//                       )}
//                     </div>

//                     <p className="text-xs text-green-700 font-medium mt-1">
//                       You save ₹{fakeMrp - currentPrice}
//                     </p>
//                   </div>

//                   <ShoppingCart size={36} className="text-red-600" />
//                 </div>

//                 {/* Order Button */}

//                 <div className="sticky bottom-0 bg-white pt-3 pb-2">
//                   <motion.button
//                     whileTap={{ scale: 0.97 }}
//                     whileHover={{ scale: 1.01 }}
//                     type="submit"
//                     className="w-full h-14 rounded-2xl bg-red-600 flex justify-center items-center text-white text-lg font-semibold shadow-lg hover:bg-red-700 transition"
//                   >
//                     {addLoading ? (
//                       <Loader2 className="animate-spin h-10 w-10" />
//                     ) : (
//                       <>ऑर्डर करें • ₹{(selectedVariant?.price || 0) * qty}</>
//                     )}
//                   </motion.button>
//                 </div>
//               </form>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// };

// export default ProductsList;

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import {
  Loader2,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

import { API_BASE_URL } from "@/lib/constants";
import { setCartData } from "@/redux/ProductSlice";
import WelcomeCard from "../components/home/WelcomeCard";
import SearchBar from "../components/home/Searchbar";
import CompanyScroller from "../components/home/CompanyScroller";
import Fuse from "fuse.js";
const ProductsList = () => {
  const dispatch = useDispatch();
  const [search, setSearch] = useState("");

  const { productData, prodLoading } = useSelector((state) => state.product);

  const location = useLocation();

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [selectedCompany, setSelectedCompany] = useState("all");

  const [selectedVariantCompany, setSelectedVariantCompany] = useState("");

  const [selectedMeasurement, setSelectedMeasurement] = useState("");

  const [qty, setQty] = useState(1);

  const productsRef = useRef(null);
  const [addLoading, setAddLoading] = useState(false);
  const fuse = useMemo(() => {
    return new Fuse(productData, {
      threshold: 0.35,
      ignoreLocation: true,
      keys: [
        "name",
        "hinglishName",
        "category.name",
        "keywords",
        "variants.company.name",
        "variants.measurement",
      ],
    });
  }, [productData]);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (search.trim() && !hasScrolled.current) {
      window.scrollTo({
        top: 223,
        behavior: "smooth",
      });

      hasScrolled.current = true;
    }

    if (!search.trim()) {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

      hasScrolled.current = false;
    }
  }, [search]);
  useEffect(() => {
    if (location.pathname.includes("/products")) {
      window.scrollTo({
        top: 208,
        behavior: "smooth",
      });
    }
  }, [location.pathname]);
  const products = useMemo(() => {
    let list = [...productData];

    // Company filter
    if (selectedCompany !== "all") {
      list = list.filter((product) =>
        product.variants.some(
          (variant) => variant.company?._id === selectedCompany,
        ),
      );
    }

    // Search
    if (search.trim()) {
      list = fuse.search(search).map((result) => result.item);
    }

    return list;
  }, [productData, selectedCompany, search, fuse]);

  <SearchBar value={search} onChange={setSearch} />;

  const handleProductClick = (product) => {
    setSelectedProduct(product);

    setQty(1);

    setSelectedMeasurement("");

    setSelectedVariantCompany("");
  };
  const handleCross = () => {
    setSelectedProduct(null);
    setSelectedVariantCompany("");
    setSelectedMeasurement("");
    setQty(1);
  };
  const selectedVariant = selectedProduct?.variants.find(
    (variant) =>
      variant.company._id === selectedVariantCompany?._id &&
      variant.measurement === selectedMeasurement,
  );
  const currentPrice = (selectedVariant?.price || 0) * qty;
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedVariantCompany) {
      toast.error("कृपया ब्रांड चुनें");
      return;
    }

    if (!selectedMeasurement) {
      toast.error("कृपया माप चुनें");
      return;
    }

    if (!selectedVariant) {
      toast.error("कृपया सही विकल्प चुनें");
      return;
    }

    setAddLoading(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        toast.error("कृपया पहले लॉगिन करें");
        return;
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/cart/add-cart`,
        {
          productId: selectedProduct._id,
          company: selectedVariantCompany._id,
          measurement: selectedMeasurement,
          qty,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        dispatch(setCartData(res.data.cart));

        toast.success("🟢 कार्ट में जोड़ दिया गया", { duration: 1000 });

        handleCross();
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message || "कार्ट में जोड़ने में समस्या हुई",
      );
    } finally {
      setAddLoading(false);
    }
  };
  if (prodLoading) {
    return (
      <div className="space-y-5 pb-24">
        <WelcomeCard />
        <SearchBar />
        <CompanyScroller />

        {/* Products Skeleton */}
        <div className="grid grid-cols-2 gap-4 px-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                delay: index * 0.08,
              }}
              className="overflow-hidden rounded-3xl bg-white shadow-sm"
            >
              <div className="h-36 animate-pulse bg-gray-200" />

              <div className="space-y-3 p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />

                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />

                <div className="mt-6 h-10 animate-pulse rounded-2xl bg-gray-200" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 mt-6">
      <WelcomeCard />

      <SearchBar value={search} onChange={setSearch} />

      {/* <CompanyScroller onSelect={setSelectedCompany} /> */}

      {products.length === 0 ? (
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mt-24 flex flex-col items-center justify-center px-6"
        >
          <div className="rounded-full bg-red-50 p-6">
            <Package size={60} className="text-red-500" />
          </div>

          <h2 className="mt-6 text-xl font-bold text-gray-800">
            कोई उत्पाद नहीं मिला
          </h2>

          <p className="mt-2 text-center text-sm text-gray-500">
            किसी दूसरे नाम से खोजें या सभी ब्रांड देखें।
          </p>
        </motion.div>
      ) : (
        <motion.div
          ref={productsRef}
          layout
          className="grid grid-cols-2 gap-4 px-4 pb-10"
        >
          {products.map((item) => {
            const lowestPrice = Math.min(...item.variants.map((v) => v.price));

            const companies = [
              ...new Map(
                item.variants.map((v) => [v.company._id, v.company]),
              ).values(),
            ];

            return (
              <motion.div
                key={item._id}
                layout
                transition={{
                  layout: {
                    duration: 0.25,
                  },
                }}
                whileHover={{
                  y: -3,
                  transition: {
                    duration: 0.15,
                  },
                }}
                whileTap={{
                  scale: 0.98,
                }}
                onClick={() => handleProductClick(item)}
                className="cursor-pointer overflow-hidden rounded-3xl bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg"
              >
                {/* Product Image */}
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-red-50">
                  {/* Discount Badge */}
                  <div className="absolute left-3 top-3 z-10 rounded-full bg-red-600 px-3 py-1 text-[10px] font-bold text-white shadow-lg">
                    ₹{lowestPrice} से
                  </div>

                  {/* Category Badge */}
                  <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-gray-600 shadow">
                    {item.category?.name}
                  </div>

                  <motion.img
                    whileHover={{
                      scale: 1.08,
                      rotate: -2,
                    }}
                    src={item.image || "./sample_img.png"}
                    alt={item.name}
                    className="h-36 object-contain"
                  />
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h2 className="line-clamp-1 text-[17px] font-bold text-gray-800">
                    {item.name}
                  </h2>

                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                    {item.hinglishName}
                  </p>

                  {/* Companies */}
                  <div className="flex gap-[8px]">
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
                        className={`inline-flex mt-2 h-full items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium border transition-all duration-200
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
                  {/* Add Button */}
                  <motion.button
                    whileHover={{
                      scale: 1.02,
                    }}
                    whileTap={{
                      scale: 0.96,
                    }}
                    className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-500 font-semibold text-white shadow-lg"
                  >
                    <ShoppingCart size={18} />
                    देखें
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <>
            {" "}
            {/* Background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCross}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
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
              className="fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[34px] bg-white"
            >
              {/* Handle */}
              <div className="sticky top-0 z-20 bg-white pt-3">
                <div className="mx-auto h-1.5 w-16 rounded-full bg-gray-300" />
              </div>

              <div className="p-5">
                {/* Header */}
                <div className="flex gap-5">
                  <motion.div
                    layoutId={selectedProduct._id}
                    className="flex h-32 w-32 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-50 to-red-50"
                  >
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="h-28 object-contain"
                    />
                  </motion.div>

                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-800">
                      {selectedProduct.name}
                    </h1>

                    <p className="mt-1 text-sm text-gray-500">
                      {selectedProduct.hinglishName}
                    </p>

                    <div className="mt-4 flex items-center gap-2">
                      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                        ताज़ा सामान
                      </span>

                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600">
                        {selectedProduct.variants.length} विकल्प
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleCross}
                    className="absolute right-5 top-6 flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 transition hover:bg-gray-200"
                  >
                    <X size={20} />
                  </button>
                </div>
                {/* Company Selection */}
                <div className="mt-8">
                  <h3 className="mb-3 text-lg font-bold">ब्रांड चुनें</h3>

                  <div className="flex flex-wrap gap-3">
                    {[
                      ...new Map(
                        selectedProduct.variants.map((variant) => [
                          variant.company._id,
                          variant,
                        ]),
                      ).values(),
                    ].map((variant) => (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        key={variant.company._id}
                        type="button"
                        onClick={() =>
                          setSelectedVariantCompany(variant.company)
                        }
                        className={`flex items-center gap-2 rounded-2xl border px-4 py-3 transition-all ${
                          selectedVariantCompany?._id === variant.company._id
                            ? "border-red-600 bg-red-600 text-white"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        {variant.company.logo && (
                          <img
                            src={variant.company.logo}
                            className="h-6 w-6 object-contain"
                          />
                        )}

                        <span className="font-medium">
                          {variant.company.name}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>{" "}
                {/* Measurement Selection */}
                {selectedVariantCompany && (
                  <div className="mt-8">
                    <h3 className="mb-3 text-lg font-bold">माप चुनें</h3>

                    <div className="grid grid-cols-3 gap-3">
                      {selectedProduct.variants
                        .filter(
                          (variant) =>
                            variant.company._id === selectedVariantCompany._id,
                        )
                        .map((variant) => {
                          const active =
                            selectedMeasurement === variant.measurement;

                          return (
                            <motion.button
                              key={variant.measurement}
                              whileHover={{
                                y: -2,
                              }}
                              whileTap={{
                                scale: 0.95,
                              }}
                              type="button"
                              onClick={() =>
                                setSelectedMeasurement(variant.measurement)
                              }
                              className={`rounded-2xl border p-4 transition-all ${
                                active
                                  ? "border-red-600 bg-gradient-to-br from-red-600 to-red-500 text-white shadow-lg"
                                  : "border-gray-200 bg-white"
                              }`}
                            >
                              <p className="font-semibold">
                                {variant.measurement}
                              </p>

                              <p
                                className={`mt-2 text-lg font-bold ${
                                  active ? "text-white" : "text-red-600"
                                }`}
                              >
                                ₹{variant.price}
                              </p>
                            </motion.button>
                          );
                        })}
                    </div>
                  </div>
                )}
                {/* Quantity */}
                <div className="mt-8">
                  <h3 className="mb-3 text-lg font-bold">मात्रा</h3>

                  <div className="flex items-center justify-between rounded-3xl bg-gray-100 p-4">
                    <button
                      type="button"
                      onClick={() =>
                        setQty((prev) => (prev > 10 ? prev - 10 : 1))
                      }
                      className="flex h-12 w-14 items-center justify-center rounded-2xl bg-white text-xl font-bold shadow"
                    >
                      −10
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setQty((prev) => (prev > 1 ? prev - 1 : 1))
                      }
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl font-bold shadow"
                    >
                      −
                    </button>

                    <motion.div
                      key={qty}
                      initial={{
                        scale: 0.8,
                      }}
                      animate={{
                        scale: 1,
                      }}
                      className="min-w-[90px] text-center"
                    >
                      <h2 className="text-3xl font-bold">{qty}</h2>

                      <p className="text-xs text-gray-500">Quantity</p>
                    </motion.div>

                    <button
                      type="button"
                      onClick={() => setQty((prev) => prev + 1)}
                      className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-2xl font-bold text-white shadow"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => setQty((prev) => prev + 10)}
                      className="flex h-12 w-14 items-center justify-center rounded-2xl bg-red-600 text-xl font-bold text-white shadow"
                    >
                      +10
                    </button>
                  </div>
                </div>
                {/* Price Summary */}
                <motion.div
                  layout
                  className="mt-8 rounded-3xl bg-gradient-to-r from-red-50 via-orange-50 to-red-50 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">कुल कीमत</p>

                      <h2 className="mt-1 text-4xl font-bold text-red-600">
                        ₹{currentPrice}
                      </h2>

                      {selectedVariant && (
                        <p className="mt-1 text-sm text-gray-500">
                          ₹{selectedVariant.price} × {qty}
                        </p>
                      )}
                    </div>

                    <div className="rounded-full bg-white p-4 shadow-lg">
                      <ShoppingCart size={34} className="text-red-600" />
                    </div>
                  </div>
                </motion.div>{" "}
                {/* Bottom Action */}
                <div className="sticky bottom-0 left-0 right-0 mt-8 border-t bg-white px-1 pt-5 pb-2">
                  <motion.button
                    whileHover={{
                      scale: 1.01,
                    }}
                    whileTap={{
                      scale: 0.98,
                    }}
                    type="submit"
                    onClick={handleSubmit}
                    disabled={addLoading}
                    className="flex h-15 w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-lg font-bold text-white shadow-xl transition-all disabled:opacity-70"
                  >
                    {addLoading ? (
                      <>
                        <Loader2 size={24} className="animate-spin" />
                        जोड़ रहे हैं...
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={22} />
                        कार्ट में जोड़ें • ₹{currentPrice}
                      </>
                    )}
                  </motion.button>

                  <p className="mt-3 text-center text-xs text-gray-500">
                    कीमत में टैक्स शामिल है।
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProductsList;
