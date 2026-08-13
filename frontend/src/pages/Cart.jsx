import React, { useEffect, useMemo, useRef, useState } from "react";

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

/* ============================================================
   ANIMATION
============================================================ */

const easeOut = [0.22, 1, 0.36, 1];

const containerVariants = {
  hidden: {
    opacity: 0,
  },

  visible: {
    opacity: 1,

    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
};

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.985,
  },

  visible: {
    opacity: 1,
    y: 0,
    scale: 1,

    transition: {
      duration: 0.22,
      ease: easeOut,
    },
  },

  exit: {
    opacity: 0,
    x: -30,
    scale: 0.97,

    transition: {
      duration: 0.16,
      ease: "easeOut",
    },
  },
};

const pageVariants = {
  hidden: {
    opacity: 0,
    y: 10,
  },

  visible: {
    opacity: 1,
    y: 0,

    transition: {
      duration: 0.25,
      ease: easeOut,
    },
  },
};

/* ============================================================
   CART
============================================================ */

const Cart = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  /* ==========================================================
     REDUX
  ========================================================== */

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

  /* ==========================================================
     STATE
  ========================================================== */

  const [loading, setLoading] = useState(false);

  const [checkoutLoading, setCheckoutLoading] = useState(false);

  /* ==========================================================
     REFS

     Refs are used for handlers because changing a ref does
     NOT cause a React render.

     This makes the handlers feel faster.
  ========================================================== */

  const requestQueues = useRef(new Map());

  const checkoutLock = useRef(false);

  const mountedRef = useRef(true);

  /* ==========================================================
     TOKEN
  ========================================================== */

  const token = localStorage.getItem("token");

  /* ==========================================================
     CLEANUP
  ========================================================== */

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ==========================================================
     DERIVED DATA
  ========================================================== */

  const items = cartData?.items || [];

  const totalPrice = Number(cartData?.totalPrice || 0);

  const discount = useMemo(() => {
    return ((totalPrice * 13) / 100).toFixed(1);
  }, [totalPrice]);

  /* ==========================================================
     PRODUCT IMAGE
  ========================================================== */

  const getProductImageUrl = (item) => {
    if (item?.productId?.productImg?.[0]?.url) {
      return item.productId.productImg[0].url;
    }

    if (item?.productImg?.[0]?.url) {
      return item.productImg[0].url;
    }

    if (item?.productId?.image) {
      return item.productId.image;
    }

    if (item?.image) {
      return item.image;
    }

    return null;
  };

  /* ==========================================================
     ITEM KEY
  ========================================================== */

  const getItemKey = (item) => {
    const productId =
      typeof item?.productId === "object"
        ? item?.productId?._id
        : item?.productId;

    const companyId =
      typeof item?.company === "object" ? item?.company?._id : item?.company;

    return `${productId || ""}-${companyId || ""}-${item?.measurement || ""}`;
  };
  /* ==========================================================
   SYNC CART
========================================================== */

  const EMPTY_CART = {
    items: [],
    totalPrice: 0,
  };

  const syncCart = (newCart) => {
    dispatch(setCartData(newCart || EMPTY_CART));
  };

  /* ==========================================================
   FETCH CART
   - Never block the UI
   - Redux cart is shown immediately
   - Backend refresh happens silently
========================================================== */

  const fetchCart = async () => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/cart`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },

        // Don't let a dead/slow backend hang the page forever
        timeout: 7000,
      });

      if (res.data?.success) {
        syncCart(res.data.cart);
      }
    } catch (error) {
      console.error("Fetch cart error:", error);

      // Only show an error if the user actually has no
      // locally available cart to display.
      const currentCart = cartData;

      if (!currentCart?.items?.length) {
        toast.error(
          error.response?.data?.message || "कार्ट लोड करने में समस्या हुई",
          {
            duration: 1500,
          },
        );
      }
    }
  };

  /* ==========================================================
   INITIAL LOAD
========================================================== */

  useEffect(() => {
    fetchCart();
  }, []);
  /* ==========================================================
     COMPANY NAME
  ========================================================== */

  const fetchCompanyName = (company) => {
    const companyId = typeof company === "object" ? company?._id : company;

    if (!companyId) return "";

    for (const product of productData || []) {
      const variant = product?.variants?.find(
        (v) => (v?.company?._id || v?.company) === companyId,
      );

      if (variant) {
        return variant?.company?.name || "";
      }
    }

    if (typeof company === "object") {
      return company?.name || "";
    }

    return "";
  };

  /* ==========================================================
     GET UNIT PRICE
  ========================================================== */

  const getUnitPrice = (item) => {
    const qty = Number(item?.qty || 1);

    const variant = item?.productId?.variants?.find(
      (v) => v?.measurement === item?.measurement,
    );

    return (
      Number(variant?.price) ||
      Number(item?.price) ||
      (qty > 0 ? Number(item?.total || 0) / qty : 0)
    );
  };

  /* ==========================================================
     BUILD OPTIMISTIC CART
  ========================================================== */

  const buildQuantityCart = (currentCart, itemKey, newQty) => {
    const currentItems = currentCart?.items || [];

    const updatedItems = currentItems.map((cartItem) => {
      if (getItemKey(cartItem) !== itemKey) {
        return cartItem;
      }

      const unitPrice = getUnitPrice(cartItem);

      return {
        ...cartItem,

        qty: newQty,

        total: unitPrice * newQty,
      };
    });

    const total = updatedItems.reduce(
      (sum, cartItem) => sum + Number(cartItem?.total || 0),
      0,
    );

    return {
      ...currentCart,

      items: updatedItems,

      totalPrice: total,
    };
  };

  /* ==========================================================
     UPDATE QUANTITY — INSTANT UI
     
     IMPORTANT:
     There is NO loading overlay.
     
     The UI changes immediately.
     
     API requests for the same item are queued so rapid
     + / - clicks don't race each other.
  ========================================================== */

  const updateQuantity = async (item, type) => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें", {
        duration: 1000,
      });

      return;
    }

    const itemKey = getItemKey(item);

    const productId =
      typeof item?.productId === "object"
        ? item?.productId?._id
        : item?.productId;

    const companyId =
      typeof item?.company === "object" ? item?.company?._id : item?.company;

    if (!productId) return;

    /* --------------------------------------------------------
       ALWAYS READ LATEST ITEM FROM REDUX
       
       This is important when user rapidly clicks + + +.
    -------------------------------------------------------- */

    const latestItem = (cartData?.items || []).find(
      (cartItem) => getItemKey(cartItem) === itemKey,
    );

    if (!latestItem) return;

    const currentQty = Number(latestItem?.qty || 1);

    if (type === "decrease" && currentQty <= 1) {
      return;
    }

    const newQty =
      type === "increase" ? currentQty + 1 : Math.max(1, currentQty - 1);

    /* --------------------------------------------------------
       INSTANT UI UPDATE
    -------------------------------------------------------- */

    const optimisticCart = buildQuantityCart(cartData, itemKey, newQty);

    dispatch(setCartData(optimisticCart));

    /* --------------------------------------------------------
       QUEUE REQUEST
       
       If another request for this product is already running,
       this request waits for it.
    -------------------------------------------------------- */

    const previousQueue =
      requestQueues.current.get(itemKey) || Promise.resolve();

    const request = previousQueue
      .catch(() => {})
      .then(async () => {
        try {
          const res = await axios.put(
            `${API_BASE_URL}/api/v1/cart/update-cart`,
            {
              productId,

              company: companyId,

              measurement: latestItem?.measurement,

              type,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          if (!res.data?.success) {
            throw new Error(res.data?.message || "मात्रा अपडेट नहीं हो सकी");
          }

          /*
              Do NOT immediately replace the optimistic
              state with the backend cart here.

              If the user clicked + several times quickly,
              an older response could overwrite the newer
              optimistic quantity.
            */

          return res.data;
        } catch (error) {
          console.error("Quantity update error:", error);

          /*
              Server rejected one of the operations.

              Safest option is to sync the real cart instead
              of guessing the correct quantity.
            */

          try {
            const fresh = await axios.get(`${API_BASE_URL}/api/v1/cart`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (fresh.data?.success && mountedRef.current) {
              dispatch(setCartData(fresh.data.cart));
            }
          } catch (syncError) {
            console.error("Cart resync error:", syncError);
          }

          if (mountedRef.current) {
            toast.error(
              error.response?.data?.message ||
                error.message ||
                "मात्रा अपडेट नहीं हो सकी",
              {
                duration: 1200,
              },
            );
          }

          throw error;
        }
      });

    requestQueues.current.set(itemKey, request);

    try {
      await request;
    } catch {
      // Error already handled above.
    } finally {
      /*
        Only delete if this is still the current queue.
      */

      if (requestQueues.current.get(itemKey) === request) {
        requestQueues.current.delete(itemKey);
      }
    }
  };

  /* ==========================================================
     REMOVE ITEM — INSTANT
     
     NO WHITE LOADING.
     NO SPINNER.
  ========================================================== */

  const removeItem = async (item) => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें");

      return;
    }

    const itemKey = getItemKey(item);

    const productId =
      typeof item?.productId === "object"
        ? item?.productId?._id
        : item?.productId;

    const companyId =
      typeof item?.company === "object" ? item?.company?._id : item?.company;

    if (!productId) return;

    /* --------------------------------------------------------
       SAVE PREVIOUS CART
    -------------------------------------------------------- */

    const previousCart = cartData;

    /* --------------------------------------------------------
       REMOVE IMMEDIATELY
    -------------------------------------------------------- */

    const updatedItems = (cartData?.items || []).filter(
      (cartItem) => getItemKey(cartItem) !== itemKey,
    );

    const newTotal = updatedItems.reduce(
      (sum, cartItem) => sum + Number(cartItem?.total || 0),
      0,
    );

    dispatch(
      setCartData({
        ...cartData,

        items: updatedItems,

        totalPrice: newTotal,
      }),
    );

    /* --------------------------------------------------------
       API
    -------------------------------------------------------- */

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

            measurement: item?.measurement,
          },
        },
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "प्रोडक्ट हटाया नहीं जा सका");
      }

      /*
        Do NOT replace the cart with the response.

        The UI already contains the correct optimistic
        state and another quantity request may be running.
      */
    } catch (error) {
      console.error("Remove item error:", error);

      /*
        Restore previous cart.
      */

      if (mountedRef.current) {
        dispatch(setCartData(previousCart));

        toast.error(
          error.response?.data?.message ||
            error.message ||
            "प्रोडक्ट हटाया नहीं जा सका",
          {
            duration: 1400,
          },
        );
      }
    }
  };

  /* ==========================================================
     CHECKOUT
     
     Fastest safe approach:
     
     1. Lock with ref immediately.
     2. Disable button visually.
     3. Send order request.
     4. Clear Redux.
     5. Navigate immediately after success.
     
     We DO NOT fetch cart again.
  ========================================================== */

  const handleCheckout = async () => {
    const currentToken = localStorage.getItem("token");

    if (!currentToken) {
      toast.error("कृपया पहले लॉगिन करें", {
        duration: 1200,
      });
      return;
    }

    if (checkoutLock.current || !items.length) {
      return;
    }

    // 🔒 synchronous lock — prevents double click
    checkoutLock.current = true;

    // Don't wait for React to update before locking
    setCheckoutLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/order/add-order`,
        {},
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },

          // Don't use 15 seconds for a user action
          timeout: 8000,
        },
      );

      if (!res.data?.success) {
        throw new Error(res.data?.message || "ऑर्डर पूरा नहीं हो सका");
      }

      // ⚡ Do these synchronously
      dispatch(clearCart());

      navigate("/order-success", {
        replace: true,
        state: {
          order: res.data.order || null,
        },
      });
    } catch (error) {
      console.error("Checkout error:", error);

      if (error.code === "ECONNABORTED") {
        toast.error("सर्वर से जवाब आने में बहुत समय लग रहा है", {
          duration: 1500,
        });
      } else {
        toast.error(error.response?.data?.message || "ऑर्डर पूरा नहीं हो सका", {
          duration: 1800,
        });
      }

      checkoutLock.current = false;
      setCheckoutLoading(false);
    }
  };

  /* ==========================================================
     LOGIN
  ========================================================== */

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
          sm:px-6
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
            rounded-[28px]
            border
            border-gray-100
            bg-white
            p-6
            text-center
            shadow-[0_20px_60px_rgba(0,0,0,0.08)]
            sm:p-10
          "
        >
          <div
            className="
              mx-auto
              mb-5
              flex
              h-20
              w-20
              items-center
              justify-center
              rounded-3xl
              bg-green-50
            "
          >
            <ShoppingBag
              className="
                h-10
                w-10
                text-green-600
              "
            />
          </div>

          <h1
            className="
              text-2xl
              font-extrabold
              tracking-tight
              text-gray-900
              sm:text-3xl
            "
          >
            कृपया पहले लॉगिन करें
          </h1>

          <p
            className="
              mx-auto
              mt-3
              max-w-md
              text-sm
              leading-6
              text-gray-500
              sm:text-base
            "
          >
            कार्ट देखने और ऑर्डर करने के लिए आपको अपने खाते में लॉगिन करना
            आवश्यक है।
          </p>

          <Button
            onClick={() => navigate("/login")}
            className="
              mt-7
              h-12
              w-full
              rounded-2xl
              bg-red-600
              text-base
              font-bold
              shadow-lg
              shadow-red-100
              transition-all
              hover:bg-red-700
              active:scale-[0.98]
              sm:text-lg
            "
          >
            लॉगिन करें
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ==========================================================
     EMPTY CART
  ========================================================== */

  if (!items.length) {
    return (
      <div
        className="
          mt-20
          flex
          min-h-[80vh]
          items-center
          justify-center
          bg-gray-50/70
          px-4
          py-10
          sm:px-5
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
            w-full
            max-w-md
            rounded-[30px]
            border
            border-gray-100
            bg-white
            p-7
            text-center
            shadow-[0_20px_60px_rgba(0,0,0,0.07)]
            sm:p-10
          "
        >
          <div
            className="
              mx-auto
              mb-5
              flex
              h-24
              w-24
              items-center
              justify-center
              rounded-[28px]
              bg-gray-50
            "
          >
            <img
              src="./cart.png"
              alt="Empty cart"
              className="
                h-20
                w-20
                object-contain
              "
            />
          </div>

          <h2
            className="
              text-2xl
              font-extrabold
              tracking-tight
              text-gray-900
              sm:text-3xl
            "
          >
            आपका कार्ट खाली है
          </h2>

          <p
            className="
              mt-3
              text-sm
              leading-6
              text-gray-500
              sm:text-base
            "
          >
            अभी तक आपने कोई सामान नहीं चुना है। अपनी ज़रूरत का सामान जोड़कर
            खरीदारी शुरू करें।
          </p>

          <Button
            onClick={() => navigate("/")}
            className="
              mt-7
              h-12
              w-full
              rounded-2xl
              border-2
              border-yellow-400
              bg-red-600
              text-base
              font-bold
              text-white
              shadow-lg
              shadow-red-100
              transition-all
              hover:bg-red-700
              active:scale-[0.98]
              sm:h-14
              sm:text-lg
            "
          >
            <MoveLeft
              className="
                mr-1
                h-5
                w-5
              "
            />
            खरीदारी शुरू करें
          </Button>
        </motion.div>
      </div>
    );
  }

  /* ==========================================================
     MAIN PAGE
  ========================================================== */

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="
        mx-auto
        mt-20
        w-full
        max-w-7xl
        px-3
        pb-10
        sm:px-4
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
          mb-5
          overflow-hidden
          rounded-[26px]
          border
          border-red-200/60
          bg-gradient-to-br
          from-red-500
          via-red-600
          to-red-800
          shadow-[0_15px_40px_rgba(220,38,38,0.16)]
          sm:mb-6
          sm:rounded-3xl
        "
      >
        <div
          className="
            relative
            flex
            flex-col
            gap-4
            p-4
            sm:p-5
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div
            className="
              pointer-events-none
              absolute
              -right-16
              -top-16
              h-40
              w-40
              rounded-full
              bg-white/10
              blur-2xl
            "
          />

          <div className="relative">
            <div
              className="
                flex
                items-center
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-12
                  w-12
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  bg-white/15
                  text-white
                  ring-1
                  ring-white/20
                  backdrop-blur-md
                  sm:h-14
                  sm:w-14
                "
              >
                <ShoppingBag
                  size={24}
                  className="
                    sm:h-7
                    sm:w-7
                  "
                />
              </div>

              <div className="min-w-0">
                <h1
                  className="
                    text-2xl
                    font-extrabold
                    tracking-tight
                    text-white
                    sm:text-3xl
                  "
                >
                  आपका कार्ट ({items.length})
                </h1>

                <p
                  className="
                    mt-1
                    max-w-2xl
                    text-xs
                    leading-5
                    text-white/75
                    sm:text-sm
                  "
                >
                  आपका कार्ट आज के ऑर्डर में जोड़ दिया जाएगा।
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ======================================================
          CONTENT
      ====================================================== */}

      <div
        className="
          mb-16
          grid
          gap-5
          lg:grid-cols-[minmax(0,1fr)_360px]
          lg:items-start
          lg:gap-6
        "
      >
        {/* ====================================================
            PRODUCT GRID

            ALWAYS 2 PRODUCTS PER ROW
        ==================================================== */}

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="
            grid
            grid-cols-2
            gap-3
            sm:gap-4
          "
        >
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((item) => {
              const imageUrl = getProductImageUrl(item);

              const itemKey = getItemKey(item);

              const companyName = fetchCompanyName(item.company);

              const unitPrice =
                item.qty > 0 ? Number(item.total || 0) / Number(item.qty) : 0;

              return (
                <motion.div
                  key={itemKey}
                  layout="position"
                  variants={cardVariants}
                  exit={cardVariants.exit}
                  whileTap={{
                    scale: 0.985,
                  }}
                  className="
                    relative
                    min-w-0
                    overflow-hidden
                    rounded-[22px]
                    border
                    border-gray-200
                    bg-white
                    p-3.5
                    shadow-[0_3px_14px_rgba(0,0,0,0.07)]
                    transition-shadow
                    duration-200
                    hover:shadow-[0_7px_22px_rgba(0,0,0,0.10)]
                    sm:rounded-3xl
                    sm:p-4
                  "
                >
                  {/* ==================================================
                      PRODUCT HEADER
                  ================================================== */}

                  <div
                    className="
                      flex
                      min-w-0
                      items-start
                      gap-3
                    "
                  >
                    {/* IMAGE */}

                    <div
                      className="
                        flex
                        h-[58px]
                        w-[58px]
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-2xl
                        bg-gray-50
                        sm:h-[70px]
                        sm:w-[70px]
                      "
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={item.productId?.name || "Product"}
                          loading="lazy"
                          decoding="async"
                          className="
                            h-[48px]
                            w-[48px]
                        
                            object-contain
                            sm:h-[58px]
                            sm:w-[58px]
                          "
                        />
                      ) : (
                        <Package
                          className="
                            h-8
                            w-8
                            text-gray-300
                            sm:h-10
                            sm:w-10
                          "
                        />
                      )}
                    </div>

                    {/* INFORMATION */}

                    <div
                      className="
                        min-w-0
                        flex-1
                      "
                    >
                      {companyName && (
                        <span
                          className="
                            inline-flex
                            max-w-full
                            truncate
                            rounded-full
                            bg-blue-50
                            px-2.5
                            py-1
                            text-[14px]
                            font-extrabold
                            leading-none
                            text-blue-600
                            sm:text-[13px]
                          "
                        >
                          {companyName}
                        </span>
                      )}

                      <h2
                        className="
                          mt-1.5
                          line-clamp-2
                          text-[18px]
                          font-black
                          leading-[1.25]
                          tracking-[-0.01em]
                          text-gray-950
                          sm:text-[20px]
                        "
                      >
                        {item.productId?.name || "Product"}
                      </h2>
                    </div>
                  </div>

                  <p
                    className="
                          mt-4
                          truncate
                          text-[14px]
                          font-bold
                          leading-none
                          text-gray-500
                          sm:text-[13px]
                        "
                  >
                    {item.measurement} × {item.qty}
                  </p>
                  {/* ==================================================
                      PRICE
                  ================================================== */}

                  <div
                    className="
                      mt-4
                      flex
                      items-end
                      justify-between
                      gap-2
                    "
                  >
                    <div>
                      <div
                        className="
                          flex
                          items-center
                          text-[24px]
                          font-black
                          leading-none
                          tracking-tight
                          text-green-700
                          sm:text-[27px]
                        "
                      >
                        <IndianRupee
                          className="
                            mr-0.5
                            h-[19px]
                            w-[19px]
                            stroke-[2.8]
                            sm:h-[21px]
                            sm:w-[21px]
                          "
                        />

                        {Number(item.total || 0).toFixed(0)}
                      </div>

                      <p
                        className="
                          mt-1
                          text-[11px]
                          font-bold
                          leading-none
                          text-gray-400
                          sm:text-[12px]
                        "
                      >
                        ₹{unitPrice.toFixed(0)} प्रति
                      </p>
                    </div>
                  </div>

                  {/* ==================================================
                      QUANTITY
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
                    <div
                      className="
                        flex
                        h-11
                        min-w-0
                        flex-1
                        items-center
                        justify-between
                        rounded-full
                        border
                        border-gray-200
                        bg-gray-50
                        px-1
                        sm:h-12
                      "
                    >
                      {/* MINUS */}

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={Number(item.qty) <= 1}
                        onClick={() => updateQuantity(item, "decrease")}
                        className="
                          h-9
                          w-9
                          shrink-0
                          rounded-full
                          text-gray-700
                          hover:bg-white
                          hover:text-red-600
                          sm:h-10
                          sm:w-10
                        "
                      >
                        <Minus
                          className="
                            h-[18px]
                            w-[18px]
                            stroke-[2.5]
                          "
                        />
                      </Button>

                      {/* NUMBER */}

                      <motion.span
                        key={item.qty}
                        initial={{
                          scale: 1.2,
                          opacity: 0.5,
                        }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                        }}
                        transition={{
                          duration: 0.12,
                        }}
                        className="
                          min-w-[30px]
                          text-center
                          text-[19px]
                          font-black
                          leading-none
                          text-gray-950
                          sm:text-[21px]
                        "
                      >
                        {item.qty}
                      </motion.span>

                      {/* PLUS */}

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => updateQuantity(item, "increase")}
                        className="
                          h-9
                          w-9
                          shrink-0
                          rounded-full
                          text-gray-700
                          hover:bg-white
                          hover:text-green-600
                          sm:h-10
                          sm:w-10
                        "
                      >
                        <Plus
                          className="
                            h-[18px]
                            w-[18px]
                            stroke-[2.5]
                          "
                        />
                      </Button>
                    </div>

                    {/* DELETE */}

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeItem(item)}
                      className="
                        h-11
                        w-11
                        shrink-0
                        rounded-full
                        border
                        border-red-100
                        bg-red-50
                        text-red-500
                        transition-all
                        hover:bg-red-100
                        hover:text-red-600
                        active:scale-90
                        sm:h-12
                        sm:w-12
                      "
                    >
                      <Trash2
                        className="
                          h-[18px]
                          w-[18px]
                          stroke-[2.5]
                        "
                      />
                    </Button>
                  </div>
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
            delay: 0.06,
            ease: easeOut,
          }}
          className="
            h-fit
            lg:sticky
            lg:top-24
          "
        >
          <div
            className="
              overflow-hidden
              rounded-[26px]
              border
              border-gray-100
              bg-white
              shadow-[0_12px_40px_rgba(0,0,0,0.06)]
              sm:rounded-3xl
            "
          >
            {/* HEADER */}

            <div
              className="
                border-b
                border-gray-100
                px-5
                py-5
                sm:px-6
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >
                <h2
                  className="
                    text-xl
                    font-extrabold
                    tracking-tight
                    text-gray-900
                    sm:text-2xl
                  "
                >
                  कार्ट का कुल योग
                </h2>

                <div
                  className="
                    flex
                    h-9
                    min-w-9
                    items-center
                    justify-center
                    rounded-full
                    bg-gray-100
                    px-2.5
                    text-xs
                    font-bold
                    text-gray-600
                  "
                >
                  {items.length}
                </div>
              </div>
            </div>

            {/* BODY */}

            <div
              className="
                p-5
                sm:p-6
              "
            >
              <div className="space-y-4">
                {/* SUBTOTAL */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                    text-sm
                    text-gray-500
                  "
                >
                  <span>उप-योग</span>

                  <span
                    className="
                      font-bold
                      text-gray-800
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
                    gap-4
                    text-sm
                    text-gray-500
                  "
                >
                  <span>डिलीवरी शुल्क</span>

                  <span
                    className="
                      rounded-full
                      bg-green-50
                      px-2.5
                      py-1
                      text-xs
                      font-bold
                      text-green-600
                    "
                  >
                    निःशुल्क
                  </span>
                </div>

                {/* DISCOUNT */}

                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-4
                    text-sm
                    text-gray-500
                  "
                >
                  <span>आपकी बचत</span>

                  <span
                    className="
                      font-bold
                      text-green-600
                    "
                  >
                    ₹{discount}
                  </span>
                </div>

                {/* TOTAL */}

                <div
                  className="
                    mt-2
                    border-t
                    border-dashed
                    border-gray-200
                    pt-4
                  "
                >
                  <div
                    className="
                      flex
                      items-end
                      justify-between
                      gap-4
                    "
                  >
                    <span
                      className="
                        text-base
                        font-extrabold
                        text-gray-900
                        sm:text-lg
                      "
                    >
                      कुल भुगतान
                    </span>

                    <div
                      className="
                        flex
                        items-baseline
                        gap-0.5
                      "
                    >
                      <span
                        className="
                          text-2xl
                          font-black
                          tracking-tight
                          text-green-700
                          sm:text-3xl
                        "
                      >
                        ₹{totalPrice}
                      </span>

                      <span
                        className="
                          text-sm
                          font-bold
                          text-green-700
                        "
                      >
                        /-
                      </span>
                    </div>
                  </div>

                  <div
                    className="
                      mt-2
                      flex
                      justify-end
                    "
                  >
                    <span
                      className="
                        rounded-full
                        bg-green-600
                        px-2.5
                        py-1
                        text-[10px]
                        font-bold
                        text-white
                        shadow-sm
                      "
                    >
                      ₹{discount} की बचत
                    </span>
                  </div>
                </div>
              </div>

              {/* ==================================================
                  CHECKOUT
              ================================================== */}

              <Button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="
                  mt-6
                  h-13
                  w-full
                  rounded-2xl
                  border-2
                  border-yellow-500
                  bg-gradient-to-r
                  from-red-800
                  via-red-600
                  to-red-500
                  text-base
                  font-extrabold
                  text-white
                  shadow-lg
                  shadow-red-100
                  transition-all
                  hover:brightness-105
                  active:scale-[0.98]
                  sm:h-14
                  sm:text-lg
                "
              >
                {checkoutLoading ? (
                  <>
                    <Loader2
                      className="
                        h-5
                        w-5
                        animate-spin
                      "
                    />
                    कृपया प्रतीक्षा करें!
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    ऑर्डर पक्का करें
                  </>
                )}
              </Button>

              {/* ==================================================
                  CONTINUE SHOPPING
              ================================================== */}

              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="
                  mt-3
                  h-12
                  w-full
                  rounded-2xl
                  border-gray-200
                  bg-white
                  text-sm
                  font-bold
                  text-gray-700
                  hover:bg-gray-50
                  sm:h-14
                  sm:text-base
                "
              >
                <ChevronLeft className="h-5 w-5" />
                और खरीदारी करें
              </Button>

              {/* ==================================================
                  INFO
              ================================================== */}

              <div
                className="
                  mt-5
                  rounded-2xl
                  border
                  border-green-100
                  bg-gradient-to-br
                  from-green-50
                  to-emerald-50
                  p-4
                "
              >
                <h3
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-extrabold
                    text-green-700
                  "
                >
                  <CircleAlert
                    className="
                      h-4
                      w-4
                      shrink-0
                    "
                  />
                  आज की डिलीवरी
                </h3>

                <p
                  className="
                    mt-2
                    text-xs
                    leading-5
                    text-gray-600
                    sm:text-sm
                    sm:leading-6
                  "
                >
                  आपका ऑर्डर आज की डिलीवरी सूची में शामिल किया जाएगा। समय सीमा
                  समाप्त होने से पहले आप मात्रा बदल सकते हैं या किसी भी उत्पाद
                  को हटा सकते हैं।
                </p>
              </div>
            </div>
          </div>
        </motion.aside>
      </div>
    </motion.div>
  );
};

export default Cart;
