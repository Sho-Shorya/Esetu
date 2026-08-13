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
  const [updatingId, setUpdatingId] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  /* ==========================================================
     TOKEN
  ========================================================== */

  const token = localStorage.getItem("token");

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

  /* ==========================================================
     FETCH CART
  ========================================================== */

  const fetchCart = async () => {
    if (!token) return;

    setLoading(true);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/cart`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data?.success) {
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
     UPDATE QUANTITY
  ========================================================== */

  const updateQuantity = async (item, type) => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें", {
        duration: 1000,
      });

      return;
    }

    const productId =
      typeof item?.productId === "object"
        ? item?.productId?._id
        : item?.productId;

    const companyId =
      typeof item?.company === "object" ? item?.company?._id : item?.company;

    const itemKey = getItemKey(item);

    if (!productId || updatingId === itemKey) {
      return;
    }

    const currentItem = cartData?.items?.find(
      (cartItem) => getItemKey(cartItem) === itemKey,
    );

    if (!currentItem) return;

    if (type === "decrease" && Number(currentItem.qty || 1) <= 1) {
      return;
    }

    const previousCart = cartData;

    const currentQty = Number(currentItem.qty || 1);

    const newQty =
      type === "increase" ? currentQty + 1 : Math.max(1, currentQty - 1);

    const variant = currentItem?.productId?.variants?.find(
      (v) => v?.measurement === currentItem?.measurement,
    );

    const price = Number(
      variant?.price ||
        currentItem?.price ||
        (currentQty ? Number(currentItem?.total || 0) / currentQty : 0),
    );

    const newItemTotal = price * newQty;

    const updatedItems = (cartData?.items || []).map((cartItem) => {
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
      (sum, cartItem) => sum + Number(cartItem?.total || 0),
      0,
    );

    const optimisticCart = {
      ...cartData,
      items: updatedItems,
      totalPrice: newTotalPrice,
    };

    /* Instant UI update */
    dispatch(setCartData(optimisticCart));

    setUpdatingId(itemKey);

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/cart/update-cart`,
        {
          productId,
          company: companyId,
          measurement: currentItem?.measurement,
          type,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.data?.success) {
        dispatch(setCartData(previousCart));

        toast.error(res.data?.message || "मात्रा अपडेट नहीं हो सकी", {
          duration: 1000,
        });

        return;
      }

      if (res.data?.cart) {
        dispatch(setCartData(res.data.cart));
      }
    } catch (error) {
      console.error("Update quantity error:", error);

      dispatch(setCartData(previousCart));

      toast.error(error.response?.data?.message || "मात्रा अपडेट नहीं हो सकी", {
        duration: 1200,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  /* ==========================================================
     REMOVE ITEM
  ========================================================== */

  const removeItem = async (item) => {
    if (!token) {
      toast.error("कृपया पहले लॉग इन करें");
      return;
    }

    const productId =
      typeof item?.productId === "object"
        ? item?.productId?._id
        : item?.productId;

    const companyId =
      typeof item?.company === "object" ? item?.company?._id : item?.company;

    const itemKey = getItemKey(item);

    if (!productId || updatingId === itemKey) {
      return;
    }

    const previousCart = cartData;

    const updatedItems = (cartData?.items || []).filter(
      (cartItem) => getItemKey(cartItem) !== itemKey,
    );

    const newTotalPrice = updatedItems.reduce(
      (sum, cartItem) => sum + Number(cartItem?.total || 0),
      0,
    );

    const optimisticCart = {
      ...cartData,
      items: updatedItems,
      totalPrice: newTotalPrice,
    };

    /* Instant removal */
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
            measurement: item?.measurement,
          },
        },
      );

      if (!res.data?.success) {
        dispatch(setCartData(previousCart));

        toast.error(res.data?.message || "कुछ गलत हो गया", {
          duration: 1200,
        });

        return;
      }

      if (res.data?.cart) {
        dispatch(setCartData(res.data.cart));
      }

      toast.success("कार्ट से हटाया गया", {
        duration: 900,
      });
    } catch (error) {
      console.error("Remove cart item error:", error);

      dispatch(setCartData(previousCart));

      toast.error(error.response?.data?.message || "कुछ गलत हो गया", {
        duration: 1200,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  /* ==========================================================
     CHECKOUT
  ========================================================== */

  const handleCheckout = async () => {
    if (!token) {
      toast.error("कृपया पहले लॉगिन करें");
      return;
    }

    if (checkoutLoading || !items.length) {
      return;
    }

    // Lock immediately so the user cannot double-submit
    setCheckoutLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/order/add-order`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        },
      );

      if (res.data?.success) {
        // Clear local cart immediately
        dispatch(clearCart());

        // Go straight to success screen
        navigate("/order-success", {
          replace: true,
          state: {
            order: res.data?.order || null,
          },
        });

        return;
      }

      toast.error(res.data?.message || "ऑर्डर पूरा नहीं हो सका", {
        duration: 2000,
      });
    } catch (error) {
      console.error("Checkout error:", error);

      if (error.code === "ECONNABORTED") {
        toast.error("सर्वर से जवाब आने में बहुत समय लग रहा है");
      } else {
        toast.error(error.response?.data?.message || "ऑर्डर पूरा नहीं हो सका", {
          duration: 2500,
        });
      }
    } finally {
      setCheckoutLoading(false);
    }
  };

  /* ==========================================================
     LOGIN SCREEN
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
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div
        className="
          fixed
          inset-0
          z-[999]
          flex
          items-center
          justify-center
          bg-white/70
          backdrop-blur-md
        "
      >
        <div
          className="
            flex
            h-20
            w-20
            items-center
            justify-center
            rounded-3xl
            border
            border-gray-100
            bg-white
            shadow-xl
          "
        >
          <Loader2
            className="
              h-8
              w-8
              animate-spin
              text-red-600
            "
          />
        </div>
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
            <MoveLeft className="mr-1 h-5 w-5" />
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
          {/* Decorative glow */}

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
            <div className="flex items-center gap-3">
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
                <ShoppingBag size={24} className="sm:h-7 sm:w-7" />
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
          CONTENT GRID
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
              const isUpdating = updatingId === itemKey;

              const companyName = fetchCompanyName(item.company);

              const unitPrice =
                item.qty > 0 ? Number(item.total || 0) / Number(item.qty) : 0;

              return (
                <motion.div
                  key={itemKey}
                  layout="position"
                  variants={cardVariants}
                  exit={cardVariants.exit}
                  whileTap={{ scale: 0.985 }}
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
            transition-all
            duration-200
            hover:shadow-[0_7px_22px_rgba(0,0,0,0.10)]
            sm:rounded-3xl
            sm:p-4
          "
                >
                  {/* ==================================================
              PRODUCT HEADER
          ================================================== */}

                  <div className="flex min-w-0 items-start gap-3">
                    {/* PRODUCT IMAGE */}

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

                    {/* PRODUCT INFORMATION */}

                    <div className="min-w-0 flex-1">
                      {/* COMPANY */}

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
                    text-[12px]
                    font-extrabold
                    leading-none
                    text-blue-600
                    sm:text-[13px]
                  "
                        >
                          {companyName}
                        </span>
                      )}

                      {/* PRODUCT NAME */}

                      <h2
                        className="
                  mt-1.5
                  line-clamp-2
                  text-[18px]
                  font-black
                  leading-[1.12]
                  tracking-[-0.02em]
                  text-gray-950
                  sm:text-[20px]
                "
                      >
                        {item.productId?.name || "Product"}
                      </h2>

                      {/* VARIANT / MEASUREMENT */}

                      <p
                        className="
                  mt-1.5
                  truncate
                  text-[12px]
                  font-bold
                  leading-none
                  text-gray-500
                  sm:text-[13px]
                "
                      >
                        {item.measurement} × {item.qty}
                      </p>
                    </div>
                  </div>

                  {/* ==================================================
              PRICE ROW
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
                    {/* PRICE */}

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

                    {/* MEASUREMENT PILL */}

                    <span
                      className="
                max-w-[85px]
                truncate
                rounded-full
                bg-gray-100
                px-2.5
                py-1.5
                text-[11px]
                font-extrabold
                text-gray-600
                sm:max-w-[100px]
                sm:text-[12px]
              "
                    >
                      {item.measurement}
                    </span>
                  </div>

                  {/* ==================================================
              QUANTITY + REMOVE
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
                        disabled={item.qty <= 1 || isUpdating}
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
                          scale: 1.25,
                          opacity: 0.5,
                        }}
                        animate={{
                          scale: 1,
                          opacity: 1,
                        }}
                        transition={{
                          duration: 0.15,
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
                        disabled={isUpdating}
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
                      disabled={isUpdating}
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

                  {/* ==================================================
              UPDATE LOADING
          ================================================== */}

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
                  inset-0
                  z-20
                  flex
                  items-center
                  justify-center
                  rounded-[22px]
                  bg-white/65
                  backdrop-blur-[2px]
                  sm:rounded-3xl
                "
                      >
                        <div
                          className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-full
                    bg-white
                    shadow-lg
                  "
                        >
                          <Loader2
                            className="
                      h-5
                      w-5
                      animate-spin
                      text-red-500
                    "
                          />
                        </div>
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
            {/* SUMMARY HEADER */}

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

            <div
              className="
                p-5
                sm:p-6
              "
            >
              {/* ==================================================
                  PRICE DETAILS
              ================================================== */}

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
                  CHECKOUT BUTTON
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
                    <Loader2 className="h-5 w-5 animate-spin" />
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
