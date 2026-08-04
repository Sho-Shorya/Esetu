import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  Package,
  IndianRupee,
  Loader2,
  CircleAlert,
  ChevronLeft,
  Check,
} from "lucide-react";

import Timer from "@/components/Timer";
import { Button } from "@/components/ui/button";
import { setCartData, clearCart } from "@/redux/ProductSlice";
import { API_BASE_URL } from "@/lib/constants";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
    },
  },
};

const Cart = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { cartData } = useSelector(
    (store) => store.product || { cartData: { items: [] } },
  );

  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [discount, setDiscount] = useState("");
  const token = localStorage.getItem("token");

  const items = cartData?.items || [];
  const totalPrice = cartData?.totalPrice || 0;

  useEffect(() => {
    const dis = ((cartData?.totalPrice || 0) * 13) / 100;
    setDiscount(dis.toFixed(1));
  }, [cartData]);

  const getProductImageUrl = (item) => {
    if (item?.productId?.image) {
      return item.productId.image;
    }
    return null;
  };

  const syncCart = (newCart) => {
    dispatch(
      setCartData(
        newCart || {
          items: [],
          totalPrice: 0,
        },
      ),
    );
  };

  const fetchCart = async () => {
    if (!token) return;

    setLoading(true);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data.success) {
        syncCart(res.data.cart);
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error.response?.data?.message || "कार्ट लोड करने में समस्या हुई",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const updateQuantity = async (item, type) => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें", { duration: 1000 });
      return;
    }

    setUpdatingId(item.productId._id);

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/cart/update-cart`,
        {
          productId: item.productId._id,
          company: item.company?._id || item.company,
          measurement: item.measurement,
          type,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        syncCart(res.data.cart);
      } else {
        toast.error(res.data.message, { duration: 1000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "मात्रा अपडेट नहीं हो सकी");
    } finally {
      setUpdatingId(null);
    }
  };
  const removeItem = async (item) => {
    if (!token) {
      toast.error("कृपया पहले लॉग इन करें");
      return;
    }

    setUpdatingId(item.productId._id);

    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/v1/cart/remove-cart`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            productId: item.productId._id,
            company: item.company._id || item.company,
            measurement: item.measurement,
          },
        },
      );

      if (res.data.success) {
        dispatch(setCartData(res.data.cart));
        toast.success("कार्ट से हटाया गया", {
          duration: 1000,
        });
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "कुछ गलत हो गया");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCheckout = async () => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें");
      return;
    }

    try {
      setCheckoutLoading(true);

      const res = await axios.post(
        `${API_BASE_URL}/api/v1/order/add-order`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        toast.success("🎉 ऑर्डर दर्ज हो गया", { duration: 1000 });
        dispatch(clearCart());
        navigate("/my-orders");
      } else {
        toast.error(res.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "ऑर्डर पूरा नहीं हो सका", {
        duration: 3000,
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    navigate("/");
  };
  const { productData } = useSelector((state) => state.product);
  const fetchCompanyName = (companyId) => {
    for (const product of productData) {
      const variant = product.variants?.find(
        (v) => v.company?._id === companyId,
      );

      if (variant) {
        return variant.company.name;
      }
    }

    return "";
  };

  if (!token) {
    return (
      <div className="mt-24 flex min-h-[60vh] items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg rounded-3xl border bg-white p-10 text-center shadow-xl"
        >
          <ShoppingBag className="mx-auto mb-5 h-20 w-20 text-green-600" />

          <h1 className="text-3xl font-bold">कृपया पहले लॉगिन करें</h1>

          <p className="mt-3 text-gray-500">
            कार्ट देखने और ऑर्डर करने के लिए आपको अपने खाते में लॉगिन करना
            आवश्यक है।
          </p>

          <Button
            onClick={() => navigate("/login")}
            className="mt-8 h-12 w-full rounded-2xl text-lg"
          >
            लॉगिन करें
          </Button>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mt-24 flex min-h-[70vh] items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 1,
            ease: "linear",
          }}
          className="h-14 w-14 rounded-full border-4 border-green-600 border-t-transparent"
        />
      </div>
    );
  }

  if (!items.length && !modalOpen) {
    return (
      <div className="mt-20 flex min-h-[80vh] items-center justify-center bg-gray-50 px-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md rounded-[32px] bg-white p-10 text-center shadow-xl"
        >
          <ShoppingBag size={80} className="mx-auto mb-5 text-green-600" />

          <h2 className="text-3xl font-bold">आपका कार्ट खाली है</h2>

          <p className="mt-3 text-gray-500">
            अभी तक आपने कोई सामान नहीं चुना है। अपनी ज़रूरत का सामान जोड़कर
            खरीदारी शुरू करें।
          </p>

          <Button
            onClick={() => navigate("/")}
            className="mt-8 h-12 w-full rounded-2xl text-lg"
          >
            खरीदारी शुरू करें
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-20 max-w-7xl px-4 pb-10 lg:px-6">
      <Timer />
      <motion.div
        initial={{ opacity: 0, y: -25 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 overflow-hidden rounded-3xl border border-red-100 bg-gradient-to-tr from-green-400 via-black to-green-700 shadow-sm"
      >
        <div className="flex flex-col gap-5 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl p-3 text-green-400">
                <ShoppingBag size={24} />
              </div>
              <div>
                <h1 className="text-3xl mb-3 text-white font-bold">
                  आपका कार्ट ({items.length})
                </h1>

                <p className="mt-1 text-sm text-gray-400">
                  आपका कार्ट आज के ऑर्डर में जोड़ दिया जाएगा,कृपया इसे सावधानी
                  से जोड़ें।
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid mb-15 gap-6 lg:grid-cols-[2fr_360px]">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 gap-4 md:grid-cols-2"
        >
          <AnimatePresence>
            {items.map((item) => {
              const imageUrl = getProductImageUrl(item);

              const productId = item.productId?._id || item.productId;

              return (
                <motion.div
                  key={`${productId}-${item.company}-${item.measurement}`}
                  layout
                  variants={cardVariants}
                  exit={{
                    opacity: 0,
                    x: -80,
                    scale: 0.95,
                  }}
                  whileHover={{
                    y: -4,
                  }}
                  className="rounded-3xl border bg-white p-4 shadow-sm transition-all"
                >
                  <div className="flex gap-3 mb-3">
                    <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-2xl bg-gray-100">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.productId?.name}
                          className="h-20 w-20 object-contain"
                        />
                      ) : (
                        <Package className="h-10 w-10 text-gray-400" />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col px-1  justify-between">
                      <div>
                        <div>
                          <span className="inline-flex rounded-full bg-blue-100 px-2 text-[15px] font-semibold text-blue-700">
                            {fetchCompanyName(item.company)}
                          </span>

                          <h2 className="line-clamp-2 mt-1 text-lg font-bold text-gray-900">
                            {item.productId?.name}
                          </h2>
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="rounded-full px-1 py-1 text-[15px] font-semibold text-gray-500">
                    कुल - {item.measurement}* x {item.qty}
                  </span>
                  <div className="mt-8 flex flex-col justify-between">
                    <div className="flex items-end gap-1">
                      <p className="flex items-center text-2xl font-bold text-green-700">
                        <IndianRupee className="mr-1  h-5 w-5" />
                        {item.total}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        ₹{item.total / item.qty} प्रति
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center w-full mt-4  gap-2">
                    <div className="flex  gap-2 rounded-full border bg-gray-50 justify-around items-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={item.qty <= 1 || updatingId === productId}
                        onClick={() => updateQuantity(item, "decrease")}
                        className="h-9 w-9 rounded-full"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>

                      <motion.span
                        key={item.qty}
                        initial={{
                          scale: 1.3,
                        }}
                        animate={{
                          scale: 1,
                        }}
                        transition={{
                          duration: 0.2,
                        }}
                        className="min-w-[20px] text-center text-lg font-bold"
                      >
                        {item.qty}
                      </motion.span>

                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={updatingId === productId}
                        onClick={() => updateQuantity(item, "increase")}
                        className="h-9 w-9 rounded-full"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      size="icon"
                      variant="destructive"
                      disabled={updatingId === productId}
                      onClick={() => removeItem(item)}
                      className="h-7 w-7 rounded-full"
                    >
                      <Trash2 className="h-7 w-7" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        <motion.aside
          initial={{
            opacity: 0,
            x: 40,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          className="sticky top-24 h-fit space-y-4"
        >
          <div className="rounded-3xl border bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-2xl font-bold">कार्ट का कुल योग</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-gray-600">
                <span>उप-योग</span>

                <span className="font-semibold">₹{totalPrice}</span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>डिलीवरी शुल्क</span>

                <span className="font-semibold text-green-600">निःशुल्क</span>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-lg font-bold">कुल भुगतान</span>

                <span className=" flex items-end gap-2 text-3xl font-bold text-green-700">
                  <span className="bg-green-600 flex items-center text-white text-xs px-2 py-1 rounded-full font-semibold">
                    ₹{discount} off
                  </span>
                  ₹{totalPrice}
                  <p className="text-[20px] py-1">/-</p>
                </span>
              </div>
            </div>

            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading}
              className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-tr from-green-900 via-black to-green-700 text-[20px] text-white font-semibold"
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="animate-spin" />
                  कृपया प्रतीक्षा करें!
                </>
              ) : (
                <>
                  <Check size={20} className="" />
                  ऑर्डर पक्का करें
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="mt-3 h-14 w-full rounded-2xl"
            >
              <ChevronLeft />
              और खरीदारी करें
            </Button>

            <div className="mt-6  rounded-2xl bg-green-50 p-4">
              <h3 className="font-semibold flex gap-2 text-green-700">
                <CircleAlert /> आज की डिलीवरी (ऑर्डर)
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                आपका ऑर्डर आज की डिलीवरी सूची में शामिल किया जाएगा। समय सीमा
                समाप्त होने से पहले आप मात्रा बदल सकते हैं या किसी भी उत्पाद को
                हटा सकते हैं।
              </p>
            </div>
          </div>
        </motion.aside>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            className="fixed inset-0 z-50  flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{
                scale: 0.85,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.9,
                opacity: 0,
              }}
              transition={{
                duration: 0.25,
              }}
              className="w-full max-w-lg rounded-[32px] bg-white p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.6,
                  }}
                  className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-green-100"
                >
                  <span className="text-5xl">🎉</span>
                </motion.div>

                <h2 className="text-3xl font-bold">ऑर्डर सफल रहा!</h2>

                <p className="mt-3 text-gray-600 leading-7">
                  {checkoutMessage}
                </p>

                <div className="mt-8 grid w-full grid-cols-2 gap-3">
                  <Button onClick={closeModal} className="h-12 rounded-2xl">
                    खरीदारी जारी रखें
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setModalOpen(false);
                    }}
                    className="h-12 rounded-2xl"
                  >
                    बंद करें
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Cart;
