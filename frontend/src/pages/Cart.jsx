import React, { useEffect, useMemo, useState } from "react";
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
  MoveLeft,
} from "lucide-react";

import Timer from "@/components/Timer";
import { Button } from "@/components/ui/button";
import { setCartData, clearCart } from "@/redux/ProductSlice";
import { API_BASE_URL } from "@/lib/constants";

// ============================================================
// ANIMATION CONFIG
// ============================================================

const easeOut = [0.22, 1, 0.36, 1];

const containerVariants = {
  hidden: {
    opacity: 0,
  },

  visible: {
    opacity: 1,

    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.03,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.985,
  },

  visible: {
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      duration: 0.24,
      ease: easeOut,
    },
  },

  exit: {
    opacity: 0,
    x: -35,
    scale: 0.97,

    transition: {
      duration: 0.18,
      ease: "easeOut",
    },
  },
};

const pageVariants = {
  hidden: {
    opacity: 0,
    y: 12,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.28,
      ease: easeOut,
    },
  },
};

// ============================================================
// SUCCESS ANIMATION
// ============================================================

const OrderSuccessAnimation = ({ orderId }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="
        fixed
        inset-0
        z-[9999]
        flex
        items-center
        justify-center
        bg-white
        px-5
      "
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        {/* ====================================================
            GOOGLE PAY STYLE SUCCESS CIRCLE
        ==================================================== */}

        <div className="relative flex h-32 w-32 items-center justify-center">
          {/* Outer expanding ring */}
          <motion.div
            initial={{
              scale: 0.65,
              opacity: 0,
            }}
            animate={{
              scale: 1.18,
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 0.85,
              ease: "easeOut",
            }}
            className="
              absolute
              inset-0
              rounded-full
              border-[5px]
              border-green-200
            "
          />

          {/* Main green circle */}
          <motion.div
            initial={{
              scale: 0,
            }}
            animate={{
              scale: 1,
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 18,
              mass: 0.7,
            }}
            className="
              relative
              flex
              h-28
              w-28
              items-center
              justify-center
              rounded-full
              bg-green-500
              shadow-lg
              shadow-green-200
            "
          >
            {/* Inner subtle highlight */}
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.7,
              }}
              animate={{
                opacity: 0.18,
                scale: 1,
              }}
              transition={{
                duration: 0.3,
                delay: 0.15,
              }}
              className="
                absolute
                inset-2
                rounded-full
                border
                border-white
              "
            />

            {/* =================================================
                TICK
            ================================================= */}

            <svg
              viewBox="0 0 64 64"
              className="relative h-16 w-16 text-white"
              fill="none"
            >
              <motion.path
                d="M17 33L27 43L48 21"
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                transition={{
                  pathLength: {
                    duration: 0.42,
                    delay: 0.28,
                    ease: "easeOut",
                  },
                  opacity: {
                    duration: 0.05,
                    delay: 0.28,
                  },
                }}
              />
            </svg>
          </motion.div>
        </div>

        {/* ====================================================
            SUCCESS TEXT
        ==================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 12,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 0.62,
            ease: easeOut,
          }}
        >
          <h1
            className="
            mt-7
            text-3xl
            font-extrabold
            tracking-tight
            text-gray-900
          "
          >
            ऑर्डर सफल रहा!
          </h1>

          <p
            className="
            mt-2
            text-gray-500
          "
          >
            आपका ऑर्डर आज के ऑर्डर में जोड़ दिया गया है।
          </p>
        </motion.div>

        {/* ====================================================
            ORDER ID
        ==================================================== */}

        {orderId && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.94,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.25,
              delay: 0.82,
              ease: easeOut,
            }}
            className="
              mt-5
              rounded-2xl
              bg-gray-50
              px-5
              py-3
            "
          >
            <p
              className="
              text-[10px]
              font-semibold
              tracking-widest
              text-gray-400
            "
            >
              ORDER ID
            </p>

            <p
              className="
              mt-1
              font-mono
              text-sm
              font-bold
              text-gray-700
            "
            >
              #{orderId.slice(-8).toUpperCase()}
            </p>
          </motion.div>
        )}

        {/* ====================================================
            REDIRECT INDICATOR
        ==================================================== */}

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 1,
          }}
          className="
            mt-7
            flex
            items-center
            gap-2
            text-sm
            text-gray-400
          "
        >
          <motion.span
            animate={{
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              repeat: Infinity,
              duration: 1,
              ease: "easeInOut",
            }}
            className="
              h-2
              w-2
              rounded-full
              bg-green-500
            "
          />
          आज के ऑर्डर पर ले जा रहे हैं...
        </motion.div>
      </div>
    </motion.div>
  );
};

// ============================================================
// CART
// ============================================================

const Cart = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ============================================================
  // REDUX
  // ============================================================

  const { cartData, productData } = useSelector(
    (store) =>
      store.product || {
        cartData: {
          items: [],
          totalPrice: 0,
        },
        productData: [],
      },
  );

  // ============================================================
  // STATE
  // ============================================================

  const [loading, setLoading] = useState(false);

  const [updatingId, setUpdatingId] = useState(null);

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [orderSuccess, setOrderSuccess] = useState(false);

  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const token = localStorage.getItem("token");

  // ============================================================
  // DERIVED DATA
  // ============================================================

  const items = cartData?.items || [];

  const totalPrice = Number(cartData?.totalPrice || 0);

  // ============================================================
  // DISCOUNT
  // ============================================================

  const discount = useMemo(() => {
    return ((totalPrice * 13) / 100).toFixed(1);
  }, [totalPrice]);

  // ============================================================
  // PRODUCT IMAGE
  // ============================================================

  const getProductImageUrl = (item) => {
    if (item?.productId?.image) {
      return item.productId.image;
    }

    return null;
  };

  // ============================================================
  // ITEM KEY
  // ============================================================

  const getItemKey = (item) => {
    const productId = item?.productId?._id || item?.productId || "";

    const companyId = item?.company?._id || item?.company || "";

    return `${productId}-${companyId}-${item?.measurement}`;
  };

  // ============================================================
  // SYNC CART
  // ============================================================

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

  // ============================================================
  // FETCH CART
  // ============================================================

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
      console.error("Fetch cart error:", error);

      toast.error(
        error.response?.data?.message || "कार्ट लोड करने में समस्या हुई",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD CART
  // ============================================================

  useEffect(() => {
    fetchCart();
  }, []);

  // ============================================================
  // AUTO NAVIGATION AFTER SUCCESS
  // ============================================================

  useEffect(() => {
    if (!orderSuccess) return;

    // Short Google-Pay-like confirmation.
    // Long enough to see the tick, but doesn't feel slow.
    const timer = setTimeout(() => {
      navigate("/my-orders", {
        replace: true,
      });
    }, 1150);

    return () => clearTimeout(timer);
  }, [orderSuccess, navigate]);

  // ============================================================
  // COMPANY NAME
  // ============================================================

  const fetchCompanyName = (company) => {
    const companyId = typeof company === "object" ? company?._id : company;

    if (!companyId) return "";

    for (const product of productData || []) {
      const variant = product?.variants?.find(
        (v) => (v.company?._id || v.company) === companyId,
      );

      if (variant) {
        return variant.company?.name || "";
      }
    }

    return "";
  };

  // ============================================================
  // UPDATE QUANTITY
  // ============================================================

  const updateQuantity = async (item, type) => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें", {
        duration: 1000,
      });

      return;
    }

    const productId = item.productId?._id || item.productId;

    const companyId = item.company?._id || item.company;

    const itemKey = getItemKey(item);

    // Prevent double request
    if (updatingId === itemKey) {
      return;
    }

    const currentItem = cartData?.items?.find(
      (cartItem) => getItemKey(cartItem) === itemKey,
    );

    if (!currentItem) return;

    if (type === "decrease" && currentItem.qty <= 1) {
      return;
    }

    const previousCart = cartData;

    const newQty =
      type === "increase"
        ? currentItem.qty + 1
        : Math.max(1, currentItem.qty - 1);

    const variant = currentItem.productId?.variants?.find(
      (variant) => variant.measurement === currentItem.measurement,
    );

    const price = Number(variant?.price || currentItem.price || 0);

    const newItemTotal = price * newQty;

    const updatedItems = cartData.items.map((cartItem) => {
      if (getItemKey(cartItem) !== itemKey) {
        return cartItem;
      }

      return {
        ...cartItem,
        qty: newQty,
        total: newItemTotal,
      };
    });

    const newTotalPrice = updatedItems.reduce(
      (sum, cartItem) => sum + Number(cartItem.total || 0),
      0,
    );

    const optimisticCart = {
      ...cartData,
      items: updatedItems,
      totalPrice: newTotalPrice,
    };

    // Instant UI update
    dispatch(setCartData(optimisticCart));

    setUpdatingId(itemKey);

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/cart/update-cart`,
        {
          productId,
          company: companyId,
          measurement: currentItem.measurement,
          type,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.data.success) {
        dispatch(setCartData(previousCart));

        toast.error(res.data.message || "मात्रा अपडेट नहीं हो सकी", {
          duration: 1000,
        });

        return;
      }

      if (res.data.cart) {
        dispatch(setCartData(res.data.cart));
      }
    } catch (error) {
      console.error("Update quantity error:", error);

      dispatch(setCartData(previousCart));

      toast.error(error.response?.data?.message || "मात्रा अपडेट नहीं हो सकी", {
        duration: 1000,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // ============================================================
  // REMOVE ITEM
  // ============================================================

  const removeItem = async (item) => {
    if (!token) {
      toast.error("कृपया पहले लॉग इन करें");
      return;
    }

    const productId = item.productId?._id || item.productId;

    const companyId = item.company?._id || item.company;

    const itemKey = getItemKey(item);

    if (updatingId === itemKey) {
      return;
    }

    const previousCart = cartData;

    const updatedItems = cartData.items.filter(
      (cartItem) => getItemKey(cartItem) !== itemKey,
    );

    const newTotalPrice = updatedItems.reduce(
      (sum, cartItem) => sum + Number(cartItem.total || 0),
      0,
    );

    const optimisticCart = {
      ...cartData,
      items: updatedItems,
      totalPrice: newTotalPrice,
    };

    dispatch(setCartData(optimisticCart));

    setUpdatingId(itemKey);

    try {
      const res = await axios.delete(
        `${API_BASE_URL}/api/v1/cart/remove-cart`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },

          data: {
            productId,
            company: companyId,
            measurement: item.measurement,
          },
        },
      );

      if (!res.data.success) {
        dispatch(setCartData(previousCart));

        toast.error(res.data.message || "कुछ गलत हो गया", {
          duration: 1000,
        });

        return;
      }

      if (res.data.cart) {
        dispatch(setCartData(res.data.cart));
      }

      toast.success("कार्ट से हटाया गया", {
        duration: 1000,
      });
    } catch (error) {
      console.error("Remove cart item error:", error);

      dispatch(setCartData(previousCart));

      toast.error(error.response?.data?.message || "कुछ गलत हो गया");
    } finally {
      setUpdatingId(null);
    }
  };

  // ============================================================
  // CHECKOUT
  // ============================================================
  const handleCheckout = async () => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें");
      return;
    }

    if (checkoutLoading || !items.length) return;

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
        // Clear cart
        dispatch(clearCart());

        // Immediately show confirmation page
        navigate("/order-success", {
          replace: true,
        });
      } else {
        toast.error(res.data.message || "ऑर्डर पूरा नहीं हो सका");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "ऑर्डर पूरा नहीं हो सका", {
        duration: 2500,
      });
    } finally {
      setCheckoutLoading(false);
    }
  };
  // ============================================================
  // LOGIN SCREEN
  // ============================================================

  if (!token) {
    return (
      <div
        className="
        mt-24
        flex
        min-h-[60vh]
        items-center
        justify-center
        px-4
      "
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 18,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.28,
          }}
          className="
            w-full
            max-w-lg
            rounded-3xl
            border
            bg-white
            p-10
            text-center
            shadow-xl
          "
        >
          <ShoppingBag
            className="
              mx-auto
              mb-5
              h-20
              w-20
              text-green-600
            "
          />

          <h1
            className="
            text-3xl
            font-bold
          "
          >
            कृपया पहले लॉगिन करें
          </h1>

          <p
            className="
            mt-3
            text-gray-500
          "
          >
            कार्ट देखने और ऑर्डर करने के लिए आपको अपने खाते में लॉगिन करना
            आवश्यक है।
          </p>

          <Button
            onClick={() => navigate("/login")}
            className="
              mt-8
              h-12
              w-full
              rounded-2xl
              text-lg
            "
          >
            लॉगिन करें
          </Button>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // SUCCESS SCREEN
  //
  // IMPORTANT:
  // This MUST come before empty-cart.
  // clearCart() makes items empty.
  // ============================================================

  if (orderSuccess) {
    return <OrderSuccessAnimation orderId={confirmedOrder?._id} />;
  }

  // ============================================================
  // INITIAL LOADING
  // ============================================================

  if (loading) {
    return (
      <div
        className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/10
        backdrop-blur-sm
      "
      >
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            repeat: Infinity,
            duration: 0.8,
            ease: "linear",
          }}
          className="
            h-12
            w-12
            rounded-full
            border-4
            border-red-600
            border-t-transparent
          "
        />
      </div>
    );
  }

  // ============================================================
  // EMPTY CART
  // ============================================================

  if (!items.length) {
    return (
      <div
        className="
        mt-20
        flex
        min-h-[80vh]
        items-center
        justify-center
        bg-gray-50
        px-5
      "
      >
        <motion.div
          initial={{
            opacity: 0,
            scale: 0.96,
          }}
          animate={{
            opacity: 1,
            scale: 1,
          }}
          transition={{
            duration: 0.28,
            ease: easeOut,
          }}
          className="
            max-w-md
            rounded-[32px]
            bg-white
            p-10
            text-center
            shadow-xl
          "
        >
          <img
            src="./cart.png"
            alt="Empty cart"
            className="
              mx-auto
              mb-5
              h-20
            "
          />

          <h2
            className="
            text-3xl
            font-bold
          "
          >
            आपका कार्ट खाली है
          </h2>

          <p
            className="
            mt-3
            text-gray-500
          "
          >
            अभी तक आपने कोई सामान नहीं चुना है। अपनी ज़रूरत का सामान जोड़कर
            खरीदारी शुरू करें।
          </p>

          <Button
            onClick={() => navigate("/")}
            className="
              mt-8
              h-12
              w-full
              rounded-2xl
              border-2
              border-yellow-400
              bg-red-600
              text-lg
              font-bold
              text-white
            "
          >
            <MoveLeft />
            खरीदारी शुरू करें
          </Button>
        </motion.div>
      </div>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="
        mx-auto
        mt-20
        max-w-7xl
        px-4
        pb-10
        lg:px-6
      "
    >
      {/* ======================================================
          TIMER
      ====================================================== */}

      <Timer />

      {/* ======================================================
          CART HEADER
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: -12,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          duration: 0.28,
          ease: easeOut,
        }}
        className="
          mb-6
          overflow-hidden
          rounded-3xl
          border
          border-red-100
          bg-gradient-to-tr
          from-red-400
          to-red-700
          shadow-sm
        "
      >
        <div
          className="
          flex
          flex-col
          gap-5
          p-4
          lg:flex-row
          lg:items-center
          lg:justify-between
        "
        >
          <div>
            <div
              className="
              flex
              items-center
              gap-3
            "
            >
              <div
                className="
                rounded-2xl
                p-3
                text-white
              "
              >
                <ShoppingBag size={24} />
              </div>

              <div>
                <h1
                  className="
                  mb-3
                  text-3xl
                  font-bold
                  text-white
                "
                >
                  आपका कार्ट ({items.length})
                </h1>

                <p
                  className="
                  mt-1
                  text-sm
                  text-white/70
                "
                >
                  आपका कार्ट आज के ऑर्डर में जोड़ दिया जाएगा, कृपया इसे सावधानी
                  से जोड़ें।
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ======================================================
          CONTENT GRID
      ====================================================== */}

      <div
        className="
        mb-15
        grid
        gap-6
        lg:grid-cols-[2fr_360px]
      "
      >
        {/* ====================================================
            PRODUCT GRID
        ==================================================== */}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="
            grid
            grid-cols-2
            gap-4
            md:grid-cols-2
          "
        >
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item) => {
              const imageUrl = getProductImageUrl(item);

              const productId = item.productId?._id || item.productId;

              const itemKey = getItemKey(item);

              const isUpdating = updatingId === itemKey;

              return (
                <motion.div
                  key={itemKey}
                  layout="position"
                  variants={cardVariants}
                  exit={cardVariants.exit}
                  className="
                    relative
                    rounded-3xl
                    border
                    bg-white
                    p-4
                    shadow-sm
                    will-change-transform
                  "
                >
                  {/* ==================================================
                      PRODUCT
                  ================================================== */}

                  <div
                    className="
                    mb-3
                    flex
                    gap-3
                  "
                  >
                    {/* IMAGE */}

                    <div
                      className="
                      flex
                      h-15
                      w-15
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      bg-gray-100
                    "
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.productId?.name}
                          loading="lazy"
                          decoding="async"
                          className="
                            h-20
                            w-20
                            object-contain
                          "
                        />
                      ) : (
                        <Package
                          className="
                            h-10
                            w-10
                            text-gray-400
                          "
                        />
                      )}
                    </div>

                    {/* NAME */}

                    <div
                      className="
                      flex
                      flex-1
                      flex-col
                      justify-between
                      px-1
                    "
                    >
                      <div>
                        <span
                          className="
                          inline-flex
                          rounded-full
                          bg-blue-100
                          px-2
                          text-[14px]
                          font-semibold
                          text-blue-700
                        "
                        >
                          {fetchCompanyName(item.company)}
                        </span>

                        <h2
                          className="
                          mt-1
                          line-clamp-2
                          text-lg
                          font-bold
                          text-gray-900
                        "
                        >
                          {item.productId?.name}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* ==================================================
                      MEASUREMENT
                  ================================================== */}

                  <span
                    className="
                    rounded-full
                    px-1
                    py-1
                    text-[15px]
                    font-semibold
                    text-gray-500
                  "
                  >
                    कुल - {item.measurement}* x {item.qty}
                  </span>

                  {/* ==================================================
                      PRICE
                  ================================================== */}

                  <div
                    className="
                    mt-8
                    flex
                    flex-col
                    justify-between
                  "
                  >
                    <div
                      className="
                      flex
                      items-end
                      gap-1
                    "
                    >
                      <p
                        className="
                        flex
                        items-center
                        text-2xl
                        font-bold
                        text-green-700
                      "
                      >
                        <IndianRupee
                          className="
                            mr-1
                            h-5
                            w-5
                          "
                        />

                        {item.total}
                      </p>

                      <p
                        className="
                        text-[10px]
                        text-gray-400
                      "
                      >
                        ₹{item.qty ? (item.total / item.qty).toFixed(0) : 0}{" "}
                        प्रति
                      </p>
                    </div>
                  </div>

                  {/* ==================================================
                      CONTROLS
                  ================================================== */}

                  <div
                    className="
                    mt-4
                    flex
                    w-full
                    items-center
                    gap-2
                  "
                  >
                    {/* QUANTITY */}

                    <div
                      className="
                      flex
                      items-center
                      justify-around
                      gap-2
                      rounded-full
                      border
                      bg-gray-50
                    "
                    >
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={item.qty <= 1 || isUpdating}
                        onClick={() => updateQuantity(item, "decrease")}
                        className="
                          h-9
                          w-9
                          rounded-full
                        "
                      >
                        <Minus
                          className="
                          h-4
                          w-4
                        "
                        />
                      </Button>

                      <motion.span
                        key={item.qty}
                        initial={{
                          scale: 1.15,
                          opacity: 0.7,
                        }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                        }}
                        transition={{
                          duration: 0.14,
                        }}
                        className="
                          min-w-[20px]
                          text-center
                          text-lg
                          font-bold
                        "
                      >
                        {item.qty}
                      </motion.span>

                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isUpdating}
                        onClick={() => updateQuantity(item, "increase")}
                        className="
                          h-9
                          w-9
                          rounded-full
                        "
                      >
                        <Plus
                          className="
                          h-4
                          w-4
                        "
                        />
                      </Button>
                    </div>

                    {/* DELETE */}

                    <Button
                      size="icon"
                      variant="destructive"
                      disabled={isUpdating}
                      onClick={() => removeItem(item)}
                      className="
                        h-8
                        w-8
                        rounded-full
                      "
                    >
                      <Trash2
                        className="
                        h-4
                        w-4
                      "
                      />
                    </Button>
                  </div>

                  {/* SMALL LOADING */}

                  <AnimatePresence>
                    {isUpdating && (
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
                        className="
                          pointer-events-none
                          absolute
                          right-4
                          top-4
                        "
                      >
                        <Loader2
                          className="
                            h-4
                            w-4
                            animate-spin
                            text-red-500
                          "
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>

        {/* ====================================================
            SUMMARY
        ==================================================== */}

        <motion.aside
          initial={{
            opacity: 0,
            x: 18,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 0.08,
            ease: easeOut,
          }}
          className="
            sticky
            top-24
            h-fit
            space-y-4
          "
        >
          <div
            className="
            rounded-3xl
            border
            bg-white
            p-6
            shadow-sm
          "
          >
            <h2
              className="
              mb-5
              text-2xl
              font-bold
            "
            >
              कार्ट का कुल योग
            </h2>

            <div
              className="
              space-y-4
            "
            >
              {/* SUBTOTAL */}

              <div
                className="
                flex
                items-center
                justify-between
                text-gray-600
              "
              >
                <span>उप-योग</span>

                <span
                  className="
                  font-semibold
                "
                >
                  ₹{totalPrice}
                </span>
              </div>

              {/* DELIVERY */}

              <div
                className="
                flex
                items-center
                justify-between
                text-gray-600
              "
              >
                <span>डिलीवरी शुल्क</span>

                <span
                  className="
                  font-semibold
                  text-green-600
                "
                >
                  निःशुल्क
                </span>
              </div>

              {/* TOTAL */}

              <div
                className="
                flex
                items-center
                justify-between
                border-t
                pt-4
              "
              >
                <span
                  className="
                  text-lg
                  font-bold
                "
                >
                  कुल भुगतान
                </span>

                <span
                  className="
                  flex
                  items-end
                  gap-2
                  text-3xl
                  font-bold
                  text-green-700
                "
                >
                  <span
                    className="
                    flex
                    items-center
                    rounded-full
                    bg-green-600
                    px-2
                    py-1
                    text-xs
                    font-semibold
                    text-white
                  "
                  >
                    ₹{discount} off
                  </span>
                  ₹{totalPrice}
                  <p
                    className="
                    py-1
                    text-[20px]
                  "
                  >
                    /-
                  </p>
                </span>
              </div>
            </div>

            {/* ==================================================
                CHECKOUT BUTTON
            ================================================== */}

            <Button
              onClick={handleCheckout}
              disabled={checkoutLoading || orderSuccess}
              className="
                mt-6
                h-14
                w-full
                rounded-2xl
                border-2
                border-yellow-600
                bg-gradient-to-tr
                from-red-900
                via-red-600
                to-red-400
                text-[20px]
                font-semibold
                text-white
                transition-transform
                active:scale-[0.98]
              "
            >
              {checkoutLoading ? (
                <>
                  <Loader2
                    className="
                      animate-spin
                    "
                  />
                  कृपया प्रतीक्षा करें!
                </>
              ) : (
                <>
                  <Check size={20} />
                  ऑर्डर पक्का करें
                </>
              )}
            </Button>

            {/* CONTINUE SHOPPING */}

            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="
                mt-3
                h-14
                w-full
                rounded-2xl
              "
            >
              <ChevronLeft />
              और खरीदारी करें
            </Button>

            {/* INFO */}

            <div
              className="
              mt-6
              rounded-2xl
              bg-green-50
              p-4
            "
            >
              <h3
                className="
                flex
                gap-2
                font-semibold
                text-green-700
              "
              >
                <CircleAlert />
                आज की डिलीवरी (ऑर्डर)
              </h3>

              <p
                className="
                mt-2
                text-sm
                leading-6
                text-gray-600
              "
              >
                आपका ऑर्डर आज की डिलीवरी सूची में शामिल किया जाएगा। समय सीमा
                समाप्त होने से पहले आप मात्रा बदल सकते हैं या किसी भी उत्पाद को
                हटा सकते हैं।
              </p>
            </div>
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
};

export default Cart;
