import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Download,
  History,
  Package2,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  WalletCards,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

/* ======================================================
   STATUS
====================================================== */

const statusStyle = {
  Delivered: {
    wrapper: "bg-red-50 text-red-700 border-red-100",
    dot: "bg-red-500",
    hindi: "डिलीवर",
  },

  Approved: {
    wrapper: "bg-green-50 text-green-700 border-green-100",
    dot: "bg-green-500",
    hindi: "स्वीकृत",
  },

  Pending: {
    wrapper: "bg-orange-50 text-orange-700 border-orange-100",
    dot: "bg-orange-500",
    hindi: "जाँच में",
  },

  Preparing: {
    wrapper: "bg-orange-50 text-orange-700 border-orange-100",
    dot: "bg-orange-500",
    hindi: "तैयार हो रहा",
  },

  "Out For Delivery": {
    wrapper: "bg-red-50 text-red-700 border-red-100",
    dot: "bg-red-500",
    hindi: "रास्ते में",
  },

  Cancelled: {
    wrapper: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-500",
    hindi: "रद्द",
  },

  Declined: {
    wrapper: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-500",
    hindi: "अस्वीकृत",
  },
};

/* ======================================================
   DATE FILTERS
====================================================== */

const DATE_FILTERS = [
  {
    id: "all",
    label: "सभी",
    shortLabel: "सभी",
  },
  {
    id: "today",
    label: "आज",
    shortLabel: "आज",
  },
  {
    id: "7days",
    label: "7 दिन",
    shortLabel: "7 दिन",
  },
  {
    id: "1month",
    label: "1 महीना",
    shortLabel: "1 माह",
  },
  {
    id: "3months",
    label: "3 महीने",
    shortLabel: "3 माह",
  },
  {
    id: "6months",
    label: "6 महीने",
    shortLabel: "6 माह",
  },
];

/* ======================================================
   LOADING CARD
====================================================== */

const LoadingCard = () => {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm">
      <div className="h-1 animate-pulse bg-slate-200" />

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3 w-20 animate-pulse rounded-lg bg-slate-200" />
          </div>

          <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>

        <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />

        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
};

/* ======================================================
   ORDERS
====================================================== */

const Orders = () => {
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedOrder, setExpandedOrder] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);

  // DATE FILTER
  const [dateFilter, setDateFilter] = useState("all");

  /* ====================================================
     FETCH ORDERS + RECEIPTS
  ==================================================== */

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = localStorage.getItem("token");

      if (!token) {
        setOrders([]);
        setInvoices([]);
        return;
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const [ordersResponse, invoicesResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/order/order-history`, config),

        axios.get(`${API_BASE_URL}/api/v1/user/invoice/my-invoices`, config),
      ]);

      if (ordersResponse.data?.success) {
        setOrders(ordersResponse.data.orders || []);
      }

      if (invoicesResponse.data?.success) {
        setInvoices(invoicesResponse.data.invoices || []);
      }
    } catch (error) {
      console.error("Orders fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ====================================================
     FILTER ORDERS
  ==================================================== */

  const filteredOrders = useMemo(() => {
    if (dateFilter === "all") {
      return orders;
    }

    const now = new Date();

    /* --------------------------------------------------
       TODAY
       Start/end of local day
    -------------------------------------------------- */

    if (dateFilter === "today") {
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const endOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );

      return orders.filter((order) => {
        if (!order.createdAt) return false;

        const orderDate = new Date(order.createdAt);

        return orderDate >= startOfToday && orderDate < endOfToday;
      });
    }

    /* --------------------------------------------------
       OTHER DATE RANGES
    -------------------------------------------------- */

    const startDate = new Date(now);

    if (dateFilter === "7days") {
      startDate.setDate(startDate.getDate() - 7);
    }

    if (dateFilter === "1month") {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    if (dateFilter === "3months") {
      startDate.setMonth(startDate.getMonth() - 3);
    }

    if (dateFilter === "6months") {
      startDate.setMonth(startDate.getMonth() - 6);
    }

    return orders.filter((order) => {
      if (!order.createdAt) return false;

      const orderDate = new Date(order.createdAt);

      return orderDate >= startDate && orderDate <= now;
    });
  }, [orders, dateFilter]);

  /* ====================================================
     FILTER LABEL
  ==================================================== */

  const activeFilterLabel = useMemo(() => {
    return (
      DATE_FILTERS.find((filter) => filter.id === dateFilter)?.label || "सभी"
    );
  }, [dateFilter]);

  /* ====================================================
     ORDERS WHICH HAVE GENERATED RECEIPTS
  ==================================================== */

  const receiptOrderIds = useMemo(() => {
    const ids = new Set();

    invoices.forEach((invoice) => {
      if (invoice.status !== "Generated") return;

      (invoice.orderIds || []).forEach((orderId) => {
        ids.add(String(orderId));
      });
    });

    return ids;
  }, [invoices]);

  /* ====================================================
     FIND RECEIPT FOR ORDER
  ==================================================== */

  const getInvoiceForOrder = (orderId) => {
    return invoices.find(
      (invoice) =>
        invoice.status === "Generated" &&
        (invoice.orderIds || []).some(
          (invoiceOrderId) => String(invoiceOrderId) === String(orderId),
        ),
    );
  };

  /* ====================================================
     DIRECT PDF DOWNLOAD
  ==================================================== */

  const downloadInvoice = async (orderId) => {
    const invoice = getInvoiceForOrder(orderId);

    if (!invoice) return;

    try {
      setDownloadingInvoice(invoice._id);

      const token = localStorage.getItem("token");

      if (!token) {
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/user/invoice/${invoice._id}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `e-setu-invoice-${invoice.dateKey || invoice._id}.pdf`;

      link.style.display = "none";

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Receipt download error:", error);
    } finally {
      setDownloadingInvoice(null);
    }
  };

  /* ====================================================
     FORMAT DATE
  ==================================================== */

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  /* ====================================================
     FORMAT TIME
  ==================================================== */

  const formatTime = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ====================================================
     FORMAT MONEY
  ==================================================== */

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  /* ====================================================
     STATS
  ==================================================== */

  const totalOrders = filteredOrders.length;

  const totalSpent = useMemo(() => {
    return filteredOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );
  }, [filteredOrders]);

  /* ====================================================
     TOGGLE ORDER
  ==================================================== */

  const toggleOrder = (orderId) => {
    setExpandedOrder((current) => (current === orderId ? null : orderId));
  };

  /* ====================================================
     CHANGE FILTER
  ==================================================== */

  const handleFilterChange = (filterId) => {
    setDateFilter(filterId);

    // Close expanded order when changing period
    setExpandedOrder(null);
  };

  /* ====================================================
     PAGE
  ==================================================== */

  return (
    <div className="min-h-screen bg-slate-50 pb-28 pt-16">
      {/* ==================================================
          HEADER
      ================================================== */}

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="
          rounded-b-[30px]
          bg-gradient-to-br
          from-red-600
          via-red-600
          to-red-700
          px-5
          pb-5
          pt-7
          text-white
          shadow-lg
        "
      >
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-2xl
                  bg-white/15
                  ring-1
                  ring-white/20
                "
              >
                <History className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-2xl font-black">मेरा हिसाब</h1>

                <p className="text-xs text-red-100">आपके ऑर्डर</p>
              </div>
            </div>

            {/* REFRESH */}

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                bg-white/15
                ring-1
                ring-white/20
                transition
                active:scale-95
                disabled:opacity-60
              "
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {/* STATS */}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/15 px-3 py-2.5">
              <p className="text-[10px] text-red-100">ऑर्डर</p>

              <p className="mt-0.5 text-xl font-black">{totalOrders}</p>
            </div>

            <div className="rounded-2xl bg-white/15 px-3 py-2.5">
              <p className="text-[10px] text-red-100">कुल खर्च</p>

              <p className="mt-0.5 text-xl font-black">
                {formatMoney(totalSpent)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.button
        initial={{
          opacity: 0,
          y: 8,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        whileTap={{
          scale: 0.98,
        }}
        onClick={() => navigate("/invoice-history")}
        className="
          mt-3
          mb-3
          flex
          w-full
          items-center
          justify-between
          rounded-[22px]
          border
          border-red-100
          bg-white
          p-3.5
          text-left
          shadow-sm
          transition
          hover:border-red-200
          hover:shadow-md
        "
      >
        <div className="flex items-center gap-3">
          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-2xl
              bg-red-600
              text-white
              shadow-sm
            "
          >
            <ReceiptText className="h-5 w-5" />
          </div>

          <div>
            <p className="text-base font-black text-slate-900">सभी रसीदें</p>

            <p className="text-[11px] text-slate-400">
              {invoices.length} रसीद उपलब्ध
            </p>
          </div>
        </div>

        <div
          className="
            flex
            h-9
            w-9
            items-center
            justify-center
            rounded-xl
            bg-red-50
            text-red-600
          "
        >
          <ArrowRight className="h-4 w-4" />
        </div>
      </motion.button>
      {/* ==================================================
          CONTENT
      ================================================== */}

      <div className="mx-auto max-w-5xl px-4 py-5">
        {/* ==================================================
            DATE FILTER
        ================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.3,
            delay: 0.05,
          }}
          className="mb-5"
        >
          {/* FILTER HEADER */}

          <div className="mb-2.5 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-red-600" />

              <p className="text-sm font-black text-slate-800">ऑर्डर की अवधि</p>
            </div>

            <span className="text-[10px] font-semibold text-slate-400">
              {activeFilterLabel}
            </span>
          </div>

          {/* FILTER SCROLLER */}

          <div
            className="
              -mx-1
              flex
              gap-2
              overflow-x-auto
              px-1
              pb-1
              scrollbar-none
            "
          >
            {DATE_FILTERS.map((filter) => {
              const isActive = dateFilter === filter.id;

              return (
                <motion.button
                  key={filter.id}
                  whileTap={{
                    scale: 0.94,
                  }}
                  onClick={() => handleFilterChange(filter.id)}
                  className={`
                    relative
                    shrink-0
                    overflow-hidden
                    rounded-2xl
                    border
                    px-4
                    py-2.5
                    text-xs
                    font-bold
                    transition-all
                    duration-200
                    ${
                      isActive
                        ? "border-red-600 bg-red-600 text-white shadow-md shadow-red-200"
                        : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-red-200 hover:text-red-600"
                    }
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeDateFilter"
                      className="absolute inset-0 bg-red-600"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}

                  <span className="relative z-10">{filter.label}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ==================================================
            FILTER SUMMARY
        ================================================== */}

        {!loading && orders.length > 0 && (
          <motion.div
            key={dateFilter}
            initial={{
              opacity: 0,
              y: -4,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="
              mb-4
              flex
              items-center
              justify-between
              rounded-2xl
              border
              border-red-100
              bg-red-50/70
              px-3.5
              py-2.5
            "
          >
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-500" />

              <p className="text-[11px] font-semibold text-red-700">
                {dateFilter === "all"
                  ? "सभी ऑर्डर"
                  : `${activeFilterLabel} के ऑर्डर`}
              </p>
            </div>

            <p className="text-[10px] font-bold text-red-500">
              {filteredOrders.length} ऑर्डर
            </p>
          </motion.div>
        )}

        {/* ==================================================
            LOADING
        ================================================== */}

        {loading ? (
          <div className="space-y-4">
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : filteredOrders.length === 0 ? (
          /* ==================================================
             EMPTY
          ================================================== */

          <motion.div
            key={`empty-${dateFilter}`}
            initial={{
              opacity: 0,
              y: 10,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="
              rounded-[28px]
              border
              border-slate-100
              bg-white
              p-8
              text-center
              shadow-sm
            "
          >
            <div
              className="
                mx-auto
                flex
                h-20
                w-20
                items-center
                justify-center
                rounded-[24px]
                bg-red-50
                text-red-500
              "
            >
              <ShoppingBag className="h-9 w-9" />
            </div>

            <h2 className="mt-4 text-xl font-black text-slate-900">
              {dateFilter === "all"
                ? "अभी कोई ऑर्डर नहीं"
                : `${activeFilterLabel} में कोई ऑर्डर नहीं`}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {dateFilter === "all"
                ? "आपके ऑर्डर यहाँ दिखाई देंगे"
                : "इस अवधि में आपका कोई ऑर्डर नहीं मिला"}
            </p>

            {dateFilter !== "all" ? (
              <button
                onClick={() => setDateFilter("all")}
                className="
                  mt-5
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-red-600
                  transition
                  hover:bg-red-100
                  active:scale-95
                "
              >
                सभी ऑर्डर देखें
              </button>
            ) : (
              <button
                onClick={() => navigate("/")}
                className="
                  mt-5
                  rounded-xl
                  bg-red-600
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-white
                  transition
                  hover:bg-red-700
                  active:scale-95
                "
              >
                खरीदारी करें
              </button>
            )}
          </motion.div>
        ) : (
          /* ==================================================
             ORDERS
          ================================================== */

          <div className="space-y-4">
            {filteredOrders.map((order, index) => {
              const isExpanded = expandedOrder === order._id;

              const hasReceipt = receiptOrderIds.has(String(order._id));

              const invoice = hasReceipt ? getInvoiceForOrder(order._id) : null;

              const isDownloading = downloadingInvoice === invoice?._id;

              const status = statusStyle[order.status] || {
                wrapper: "bg-slate-100 text-slate-700 border-slate-200",
                dot: "bg-slate-500",
                hindi: order.status || "ऑर्डर",
              };

              return (
                <motion.div
                  key={order._id}
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.25,
                    delay: Math.min(index * 0.03, 0.15),
                  }}
                  className="
                    overflow-hidden
                    rounded-[24px]
                    border
                    border-slate-100
                    bg-white
                    shadow-sm
                  "
                >
                  {/* RED STRIPE */}

                  <div className="h-1 bg-red-600" />

                  <div className="p-4">
                    {/* ==================================================
                        HEADER
                    ================================================== */}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="
                            flex
                            h-10
                            w-10
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            bg-red-50
                            text-red-600
                          "
                        >
                          <CalendarDays className="h-5 w-5" />
                        </div>

                        <div>
                          <p className="text-base font-black text-slate-900">
                            {formatDate(order.createdAt)}
                          </p>

                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
                            <Clock3 className="h-3 w-3" />

                            {formatTime(order.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* STATUS */}

                      <span
                        className={`
                          inline-flex
                          shrink-0
                          items-center
                          gap-1.5
                          rounded-full
                          border
                          px-2.5
                          py-1.5
                          text-[10px]
                          font-black
                          ${status.wrapper}
                        `}
                      >
                        <span
                          className={`
                            h-1.5
                            w-1.5
                            rounded-full
                            ${status.dot}
                          `}
                        />

                        {status.hindi}
                      </span>
                    </div>

                    {/* ==================================================
                        TOTAL
                    ================================================== */}

                    <div
                      className="
                        mt-4
                        flex
                        items-center
                        justify-between
                        rounded-2xl
                        bg-slate-50
                        px-3
                        py-3
                      "
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-xl
                            bg-white
                            text-red-500
                            shadow-sm
                          "
                        >
                          <WalletCards className="h-4 w-4" />
                        </div>

                        <div>
                          <p className="text-[10px] text-slate-400">बिल</p>

                          <p className="text-xs font-bold text-slate-700">
                            {order.items?.length || 0} सामान
                          </p>
                        </div>
                      </div>

                      <p className="text-xl font-black text-slate-900">
                        {formatMoney(order.totalAmount)}
                      </p>
                    </div>

                    {/* ==================================================
                        PRODUCTS
                    ================================================== */}

                    <div className="mt-3 space-y-2">
                      {(isExpanded
                        ? order.items || []
                        : (order.items || []).slice(0, 2)
                      ).map((item, itemIndex) => {
                        const companyName =
                          typeof item.company === "object"
                            ? item.company?.name
                            : item.company || item.companyName || "";

                        return (
                          <motion.div
                            key={`${order._id}-${itemIndex}`}
                            layout
                            className="
                                flex
                                items-center
                                gap-3
                                rounded-2xl
                                border
                                border-slate-100
                                bg-white
                                p-2.5
                              "
                          >
                            {/* PRODUCT ICON */}

                            <div
                              className="
                                  flex
                                  h-11
                                  w-11
                                  shrink-0
                                  items-center
                                  justify-center
                                  rounded-xl
                                  bg-slate-50
                                "
                            >
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  loading="lazy"
                                  className="h-9 w-9 object-contain"
                                />
                              ) : (
                                <Package2 className="h-5 w-5 text-red-400" />
                              )}
                            </div>

                            {/* PRODUCT */}

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                {companyName && (
                                  <>
                                    <span className="max-w-[65px] truncate text-[9px] font-bold text-red-500">
                                      {companyName}
                                    </span>

                                    <span className="text-slate-300">•</span>
                                  </>
                                )}

                                <h3 className="truncate text-sm font-bold text-slate-800">
                                  {item.name}
                                </h3>
                              </div>

                              <div className="mt-1 flex gap-1.5">
                                {item.measurement && (
                                  <span
                                    className="
                                        rounded-full
                                        bg-slate-100
                                        px-2
                                        py-0.5
                                        text-[9px]
                                        font-semibold
                                        text-slate-500
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
                                      py-0.5
                                      text-[9px]
                                      font-bold
                                      text-red-600
                                    "
                                >
                                  × {item.qty || item.quantity || 1}
                                </span>
                              </div>
                            </div>

                            {/* PRICE */}

                            <p className="shrink-0 text-sm font-black text-slate-800">
                              {formatMoney(item.total)}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* ==================================================
                        MORE ITEMS
                    ================================================== */}

                    {!isExpanded && (order.items?.length || 0) > 2 && (
                      <button
                        onClick={() => toggleOrder(order._id)}
                        className="
                            mt-2
                            flex
                            w-full
                            items-center
                            justify-center
                            gap-1
                            rounded-xl
                            py-1.5
                            text-[11px]
                            font-bold
                            text-red-600
                            transition
                            hover:bg-red-50
                          "
                      >
                        +{order.items.length - 2} और
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isExpanded && (order.items?.length || 0) > 2 && (
                      <button
                        onClick={() => toggleOrder(order._id)}
                        className="
                            mt-2
                            flex
                            w-full
                            items-center
                            justify-center
                            gap-1
                            rounded-xl
                            py-1.5
                            text-[11px]
                            font-bold
                            text-slate-500
                            transition
                            hover:bg-slate-50
                          "
                      >
                        कम दिखाएँ
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* ==================================================
                        ACTIONS
                    ================================================== */}

                    <div
                      className="
                        mt-3
                        flex
                        items-center
                        justify-between
                        border-t
                        border-slate-100
                        pt-3
                      "
                    >
                      <div>
                        <p className="text-[9px] text-slate-400">भुगतान</p>

                        <p className="text-xs font-bold text-slate-700">
                          {order.paymentMethod === "Online" ? "ऑनलाइन" : "कैश"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* RECEIPT DOWNLOAD */}

                        {hasReceipt && invoice && (
                          <motion.button
                            whileTap={{
                              scale: 0.95,
                            }}
                            onClick={() => downloadInvoice(order._id)}
                            disabled={isDownloading}
                            className="
                              flex
                              items-center
                              gap-1.5
                              rounded-xl
                              bg-red-600
                              px-3
                              py-2
                              text-xs
                              font-bold
                              text-white
                              shadow-sm
                              transition
                              hover:bg-red-700
                              disabled:cursor-not-allowed
                              disabled:opacity-60
                            "
                          >
                            {isDownloading ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}

                            {isDownloading ? "डाउनलोड..." : "रसीद डाउनलोड"}
                          </motion.button>
                        )}

                        {/* DETAILS */}

                        <button
                          onClick={() => toggleOrder(order._id)}
                          className="
                            flex
                            items-center
                            gap-1
                            rounded-xl
                            bg-slate-100
                            px-3
                            py-2
                            text-xs
                            font-bold
                            text-slate-600
                            transition
                            hover:bg-slate-200
                            active:scale-95
                          "
                        >
                          {isExpanded ? "कम" : "विवरण"}

                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ==================================================
                        DETAILS
                    ================================================== */}

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            height: 0,
                          }}
                          animate={{
                            opacity: 1,
                            height: "auto",
                          }}
                          exit={{
                            opacity: 0,
                            height: 0,
                          }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                            {/* ORDER ID */}

                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-[9px] font-semibold text-slate-400">
                                ऑर्डर आईडी
                              </p>

                              <p className="mt-1 break-all text-[10px] font-bold text-slate-700">
                                {order._id}
                              </p>
                            </div>

                            {/* PAYMENT */}

                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-[9px] font-semibold text-slate-400">
                                भुगतान
                              </p>

                              <p className="mt-1 text-xs font-bold text-slate-700">
                                {order.paymentMethod || "—"}
                              </p>
                            </div>

                            {/* ADDRESS */}

                            {order.shippingAddress && (
                              <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                                <p className="text-[9px] font-semibold text-slate-400">
                                  पता
                                </p>

                                <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">
                                  {order.shippingAddress}
                                </p>
                              </div>
                            )}

                            {/* APPROVED */}

                            {order.approvedAt && (
                              <div className="rounded-xl bg-red-50 p-3">
                                <p className="text-[9px] font-semibold text-red-500">
                                  स्वीकृत
                                </p>

                                <p className="mt-1 text-xs font-bold text-red-700">
                                  {formatDate(order.approvedAt)}
                                </p>
                              </div>
                            )}

                            {/* DELIVERED */}

                            {order.deliveredAt && (
                              <div className="rounded-xl bg-red-50 p-3">
                                <p className="text-[9px] font-semibold text-red-500">
                                  डिलीवर
                                </p>

                                <p className="mt-1 text-xs font-bold text-red-700">
                                  {formatDate(order.deliveredAt)}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
