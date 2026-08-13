import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  ShoppingBag,
  Package2,
  IndianRupee,
  CalendarDays,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";

// ======================================================
// STATUS STYLES
// ======================================================

const statusStyle = {
  Delivered: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
  Approved: "bg-blue-100 text-blue-700",
  Preparing: "bg-violet-100 text-violet-700",
  "Out For Delivery": "bg-cyan-100 text-cyan-700",
};

// ======================================================
// LOADING CARD
// ======================================================

const LoadingCard = () => (
  <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
    <div className="h-1.5 bg-gray-200 animate-pulse" />

    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        </div>

        <div className="h-8 w-20 animate-pulse rounded-full bg-gray-200" />
      </div>

      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3"
          >
            <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />

            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
            </div>

            <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      <div className="h-10 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  </div>
);

// ======================================================
// COMPONENT
// ======================================================

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // ====================================================
  // FETCH ORDERS
  // ====================================================

  useEffect(() => {
    const controller = new AbortController();

    const fetchOrders = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/order/order-history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      } catch (error) {
        if (error.name !== "CanceledError") {
          console.error("Order history error:", error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      controller.abort();
    };
  }, []);

  // ====================================================
  // FORMATTERS
  // ====================================================

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("hi-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString("hi-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // ====================================================
  // STATS
  // ====================================================

  const totalOrders = orders.length;

  const totalSpent = useMemo(() => {
    return orders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );
  }, [orders]);

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="mt-15 min-h-screen bg-gray-50 pb-28">
      {/* ==================================================
          HEADER
      ================================================== */}

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="
          rounded-b-[32px]
          bg-gradient-to-br
          from-red-600
          via-red-500
          to-red-700
          px-5
          pb-8
          pt-10
          text-white
          shadow-xl
        "
      >
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm">
            <History size={30} />
          </div>

          <div>
            <h1 className="text-3xl font-bold">पुराना हिसाब</h1>

            <p className="mt-1 text-sm text-red-100">
              आपके सभी पुराने ऑर्डर यहाँ दिखाई देंगे।
            </p>
          </div>
        </div>

        {/* ==================================================
            STATS
        ================================================== */}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} />

              <span className="text-sm text-red-100">कुल ऑर्डर</span>
            </div>

            <p className="mt-2 text-3xl font-bold">{totalOrders}</p>
          </div>

          <div className="rounded-2xl bg-white/15 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <IndianRupee size={18} />

              <span className="text-sm text-red-100">कुल खर्च</span>
            </div>

            <p className="mt-2 text-3xl font-bold">
              ₹{totalSpent.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ====================================================
          CONTENT
      ==================================================== */}

      <div className="space-y-5 px-4 py-5">
        {/* ==================================================
            LOADING
        ================================================== */}

        {loading ? (
          <>
            <LoadingCard />
            <LoadingCard />
          </>
        ) : (
          <AnimatePresence mode="wait">
            {/* ==================================================
                EMPTY
            ================================================== */}

            {orders.length === 0 ? (
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.98,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                transition={{
                  duration: 0.2,
                }}
                className="
                  rounded-3xl
                  bg-white
                  p-10
                  text-center
                  shadow-sm
                "
              >
                <div
                  className="
                    mx-auto
                    flex
                    h-24
                    w-24
                    items-center
                    justify-center
                    rounded-full
                    bg-red-50
                  "
                >
                  <Package2 size={42} className="text-red-500" />
                </div>

                <h2 className="mt-5 text-xl font-bold text-gray-800">
                  अभी कोई ऑर्डर नहीं
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  आपके पुराने ऑर्डर यहाँ दिखाई देंगे।
                </p>
              </motion.div>
            ) : (
              /* ==================================================
                 ORDERS
              ================================================== */

              <div className="space-y-5">
                {orders.map((order) => (
                  <motion.div
                    key={order._id}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      duration: 0.18,
                    }}
                    className="
                      overflow-hidden
                      rounded-3xl
                      bg-white
                      shadow-sm
                    "
                  >
                    {/* ==========================================
                        TOP STRIPE
                    ========================================== */}

                    <div className="h-1.5 bg-gradient-to-r from-red-500 via-red-400 to-red-600" />

                    <div className="p-5">
                      {/* ========================================
                          ORDER HEADER
                      ======================================== */}

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className="
                              flex
                              items-center
                              gap-1.5
                              text-lg
                              font-bold
                              text-gray-800
                            "
                          >
                            <CalendarDays
                              size={15}
                              className="shrink-0 text-red-500"
                            />

                            <span className="truncate">
                              {formatDate(order.createdAt)}
                            </span>
                          </div>

                          <p className="mt-1 text-sm text-gray-500">
                            {formatTime(order.createdAt)}
                          </p>

                          <h2 className="mt-1 text-xs text-gray-400">
                            ऑर्डर #{order._id.slice(-6)}
                          </h2>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <span
                            className={`
                              rounded-full
                              px-3
                              py-1
                              text-xs
                              font-semibold
                              ${
                                statusStyle[order.status] ||
                                "bg-gray-100 text-gray-700"
                              }
                            `}
                          >
                            {order.status || "Pending"}
                          </span>

                          <div
                            className="
                              flex
                              items-center
                              rounded-xl
                              bg-red-50
                              px-3
                              py-2
                              font-bold
                              text-red-600
                            "
                          >
                            <IndianRupee size={16} className="mr-1" />

                            {order.totalAmount || 0}
                          </div>
                        </div>
                      </div>

                      {/* ========================================
                          PRODUCTS
                      ======================================== */}

                      <div className="mt-5 space-y-3">
                        {order.items?.map((item, itemIndex) => {
                          /*
                           * Company can come in different forms
                           * depending on backend population.
                           */

                          const companyName =
                            typeof item.company === "object"
                              ? item.company?.name
                              : item.company || item.companyName || "";

                          return (
                            <motion.div
                              key={`${order._id}-${itemIndex}`}
                              whileHover={{
                                scale: 1.01,
                              }}
                              transition={{
                                duration: 0.15,
                              }}
                              className="
                                flex
                                items-center
                                gap-3
                                rounded-2xl
                                border
                                border-gray-100
                                bg-gray-50
                                p-3
                              "
                            >
                              {/* ==================================
                                  PRODUCT IMAGE
                              ================================== */}

                              <div
                                className="
                                  flex
                                  h-14
                                  w-14
                                  shrink-0
                                  items-center
                                  justify-center
                                  overflow-hidden
                                  rounded-2xl
                                  bg-white
                                  shadow-sm
                                "
                              >
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="
                                      h-12
                                      w-12
                                      object-contain
                                    "
                                  />
                                ) : (
                                  <Package2
                                    size={26}
                                    className="text-red-500"
                                  />
                                )}
                              </div>

                              {/* ==================================
                                  PRODUCT DETAILS
                              ================================== */}

                              <div className="min-w-0 flex-1">
                                {/* COMPANY + PRODUCT NAME SAME LINE */}

                                <h3
                                  className="
                                    truncate
                                    font-semibold
                                    text-gray-800
                                  "
                                >
                                  {companyName && (
                                    <>
                                      <span className="text-green-700">
                                        {companyName}
                                      </span>

                                      <span className="mx-1 text-gray-300">
                                        •
                                      </span>
                                    </>
                                  )}

                                  <span>{item.name}</span>
                                </h3>

                                {/* PRODUCT META */}

                                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                  {item.measurement && (
                                    <span
                                      className="
                                        rounded-full
                                        bg-white
                                        px-2
                                        py-1
                                        text-gray-600
                                      "
                                    >
                                      {item.measurement}
                                    </span>
                                  )}

                                  <span
                                    className="
                                      rounded-full
                                      bg-red-50
                                      px-2
                                      py-1
                                      text-red-600
                                    "
                                  >
                                    Qty × {item.qty || item.quantity || 1}
                                  </span>
                                </div>
                              </div>

                              {/* ==================================
                                  PRICE
                              ================================== */}

                              <div className="shrink-0 text-right">
                                <p className="font-bold text-gray-800">
                                  ₹{item.total || 0}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* ========================================
                          BOTTOM
                      ======================================== */}

                      <div
                        className="
                          mt-5
                          flex
                          items-center
                          justify-between
                          border-t
                          pt-4
                        "
                      >
                        <div>
                          <p className="text-xs text-gray-500">
                            {order.items?.length || 0} सामान
                          </p>

                          <p className="text-lg font-bold text-red-600">
                            ₹{order.totalAmount || 0}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xs text-gray-400">Payment</p>

                          <p className="text-sm font-semibold text-gray-700">
                            {order.paymentMethod || "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
