import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  CheckCircle2,
  CircleAlert,
  X,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";
import { useNavigate, useSearchParams } from "react-router-dom";

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
};

/* ======================================================
   DATE FILTERS
====================================================== */

const DATE_FILTERS = [
  {
    id: "all",
    label: "सभी",
  },
  {
    id: "yesterday",
    label: "कल",
  },
  {
    id: "7days",
    label: "7 दिन",
  },
  {
    id: "1month",
    label: "1 माह",
  },
  {
    id: "3months",
    label: "3 माह",
  },
];

/* ======================================================
   LOADING CARD
====================================================== */

const LoadingCard = () => {
  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-100 bg-white">
      <div className="h-1 animate-pulse bg-slate-200" />

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3 w-20 animate-pulse rounded-lg bg-slate-200" />
          </div>

          <div className="h-8 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>

        <div className="h-12 animate-pulse rounded-xl bg-slate-100" />
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

  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const [dateFilter, setDateFilter] = useState("all");

  /* ====================================================
     FETCH
     
     IMPORTANT:
     Cancelled + Declined orders are removed BEFORE
     entering React state.
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

      /* -----------------------------------------------
         ONLY KEEP VALID ORDERS

         Cancelled ❌
         Declined  ❌

         Everything else ✅
      ------------------------------------------------ */

      if (ordersResponse.data?.success) {
        const apiOrders = ordersResponse.data.orders || [];

        const validOrders = apiOrders.filter(
          (order) =>
            order.status !== "Cancelled" && order.status !== "Declined",
        );

        setOrders(validOrders);
      } else {
        setOrders([]);
      }

      /* -----------------------------------------------
         INVOICES
      ------------------------------------------------ */

      if (invoicesResponse.data?.success) {
        setInvoices(invoicesResponse.data.invoices || []);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error("Orders fetch error:", error);

      setOrders([]);
      setInvoices([]);
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

    /* -------------------------------
       YESTERDAY
    -------------------------------- */

    if (dateFilter === "yesterday") {
      const startYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
      );

      const endYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      return orders.filter((order) => {
        if (!order.createdAt) return false;

        const date = new Date(order.createdAt);

        return date >= startYesterday && date < endYesterday;
      });
    }

    /* -------------------------------
       OTHER RANGES
    -------------------------------- */

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
     RECEIPTS
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
     DOWNLOAD INVOICE
  ==================================================== */

  const downloadInvoice = async (orderId) => {
    const invoice = getInvoiceForOrder(orderId);

    if (!invoice) return;

    try {
      setDownloadingInvoice(invoice._id);

      const token = localStorage.getItem("token");

      if (!token) return;

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
     ORDER RECEIPT MODAL
     
     Per-order receipt generated manually by the admin.
     Shown on-screen with a download option.
  ==================================================== */

  const openReceipt = useCallback(async (order) => {
    if (!order) return;

    setReceiptOrder(order);
    setReceiptData(null);
    setReceiptError("");
    setReceiptLoading(true);

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setReceiptLoading(false);
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/order/receipt/${order._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.success) {
        setReceiptData(response.data);
      } else {
        setReceiptError(
          response.data?.message || "रसीद नहीं मिली।",
        );
      }
    } catch (error) {
      console.error("Open receipt error:", error);

      setReceiptError(
        error.response?.data?.message || "रसीद नहीं मिली।",
      );
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  const closeReceipt = () => {
    setReceiptOrder(null);
    setReceiptData(null);
    setReceiptError("");

    if (searchParams.get("receipt")) {
      setSearchParams({}, { replace: true });
    }
  };

  const downloadReceipt = async () => {
    if (!receiptOrder || downloadingReceipt) return;

    try {
      setDownloadingReceipt(true);

      const token = localStorage.getItem("token");

      if (!token) return;

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/order/receipt/${receiptOrder._id}/pdf`,
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
      link.download = `e-setu-receipt-${receiptOrder._id.slice(-8)}.pdf`;

      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Receipt PDF download error:", error);
    } finally {
      setDownloadingReceipt(false);
    }
  };

  /* ====================================================
     AUTO-OPEN RECEIPT FROM ONESIGNAL DEEP LINK
     
     The admin's OneSignal push links to:
     ?receipt=<orderId>
  ==================================================== */

  useEffect(() => {
    const receiptParam = searchParams.get("receipt");

    if (!receiptParam) return;

    if (receiptOrder) return;

    const target = orders.find(
      (order) => String(order._id) === String(receiptParam),
    );

    if (target) {
      openReceipt(target);
    }
  }, [searchParams, orders, receiptOrder, openReceipt]);

  /* ====================================================
     FORMATTERS
  ==================================================== */

  const formatDate = (date) => {
    if (!date) return "—";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  /* ====================================================
     STATS

     Only valid orders exist inside `orders`.
  ==================================================== */

  const totalOrders = filteredOrders.length;

  const pendingPayment = useMemo(() => {
    return filteredOrders
      .filter((order) => order.paymentStatus !== "Paid")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  }, [filteredOrders]);

  /* ====================================================
     TOGGLE
  ==================================================== */

  const toggleOrder = (orderId) => {
    setExpandedOrder((current) => (current === orderId ? null : orderId));
  };

  const handleFilterChange = (filterId) => {
    setDateFilter(filterId);
    setExpandedOrder(null);
  };

  /* ====================================================
     PAGE
  ==================================================== */

  return (
    <div className="min-h-screen bg-slate-50 pb-28 pt-20">
      {/* ==================================================
          1. RECEIPTS
      ================================================== */}

      <div className="mx-auto max-w-5xl px-4">
        <motion.button
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => navigate("/invoice-history")}
          className="
            flex
            w-full
            items-center
            justify-between
            rounded-2xl
            border
            border-red-100
            bg-white
            px-3.5
            py-2.5
            shadow-sm
            transition
            hover:border-red-200
          "
        >
          <div className="flex items-center gap-2.5">
            <div
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-xl
                bg-red-600
                text-white
              "
            >
              <ReceiptText className="h-4 w-4" />
            </div>

            <div className="text-left">
              <p className="text-sm font-black text-slate-900">सभी रसीदें</p>
            </div>
          </div>

          <ArrowRight className="h-4 w-4 text-red-500" />
        </motion.button>
      </div>

      {/* ==================================================
          2. MERA HISAB
      ================================================== */}

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-5xl px-4 pt-5"
      >
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
                bg-red-600
                text-white
                shadow-sm
              "
            >
              <History className="h-5 w-5" />
            </div>

            <div>
              <h1 className="text-[25px] font-black tracking-tight text-slate-900">
                मेरा हिसाब
              </h1>

              <p className="mt-0.5 text-xs font-medium text-slate-400">
                आपके ऑर्डर और बाकी भुगतान
              </p>
            </div>
          </div>

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
              bg-white
              shadow-sm
              ring-1
              ring-slate-100
              transition
              active:scale-95
              disabled:opacity-60
            "
          >
            <RefreshCw
              className={`h-4 w-4 text-slate-600 ${
                refreshing ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>
      </motion.div>

      {/* ==================================================
          3. TIMEFRAME
      ================================================== */}

      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-2 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-red-600" />

          <p className="text-sm font-black text-slate-800">समय</p>

          <span className="ml-auto text-[10px] font-bold text-slate-400">
            {activeFilterLabel}
          </span>
        </div>

        <div
          className="
            flex
            w-full
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-1
            shadow-sm
          "
        >
          {DATE_FILTERS.map((filter) => {
            const isActive = dateFilter === filter.id;

            return (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id)}
                className={`
                  relative
                  min-w-0
                  flex-1
                  rounded-xl
                  px-1
                  py-2.5
                  text-[11px]
                  font-black
                  transition-all
                  sm:text-xs
                  ${
                    isActive
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50 hover:text-red-600"
                  }
                `}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================
          4. ORDER / PAISE BAAKI
      ================================================== */}

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {/* ORDERS */}

          <div
            className="
              rounded-[22px]
              border
              border-slate-100
              bg-white
              px-4
              py-4
              shadow-sm
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
                  bg-red-50
                  text-red-600
                "
              >
                <ShoppingBag className="h-4 w-4" />
              </div>

              <p className="text-xs font-bold text-slate-400">ऑर्डर</p>
            </div>

            <p className="mt-3 text-[30px] font-black leading-none text-slate-900">
              {totalOrders}
            </p>
          </div>

          {/* PENDING */}

          <div
            className="
              rounded-[22px]
              border
              border-orange-100
              bg-orange-50/70
              px-4
              py-4
              shadow-sm
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
                  bg-orange-100
                  text-orange-600
                "
              >
                <CircleAlert className="h-4 w-4" />
              </div>

              <p className="text-xs font-bold text-orange-600">पैसे बाकी</p>
            </div>

            <p className="mt-3 text-[27px] font-black leading-none text-orange-700">
              {formatMoney(pendingPayment)}
            </p>
          </div>
        </div>
      </div>

      {/* ==================================================
          5. ORDERS
      ================================================== */}

      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">ऑर्डर</h2>

            <p className="mt-0.5 text-xs font-medium text-slate-400">
              {dateFilter === "all"
                ? "सभी ऑर्डर"
                : `${activeFilterLabel} के ऑर्डर`}
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-500">
            {filteredOrders.length}
          </span>
        </div>

        {/* LOADING */}

        {loading ? (
          <div className="space-y-3">
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : filteredOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="
              rounded-[24px]
              border
              border-slate-100
              bg-white
              px-5
              py-12
              text-center
              shadow-sm
            "
          >
            <div
              className="
                mx-auto
                flex
                h-16
                w-16
                items-center
                justify-center
                rounded-2xl
                bg-red-50
                text-red-500
              "
            >
              <ShoppingBag className="h-7 w-7" />
            </div>

            <h2 className="mt-4 text-lg font-black text-slate-900">
              कोई ऑर्डर नहीं
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              इस समयावधि में कोई ऑर्डर नहीं मिला
            </p>

            {dateFilter !== "all" && (
              <button
                onClick={() => setDateFilter("all")}
                className="
                  mt-5
                  rounded-xl
                  bg-red-600
                  px-5
                  py-2.5
                  text-xs
                  font-black
                  text-white
                  transition
                  active:scale-95
                "
              >
                सभी देखें
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order, index) => {
              const isExpanded = expandedOrder === order._id;

              const hasReceipt = receiptOrderIds.has(String(order._id));

              const invoice = hasReceipt ? getInvoiceForOrder(order._id) : null;

              const isDownloading = downloadingInvoice === invoice?._id;

              const isPaid = order.paymentStatus === "Paid";

              const status = statusStyle[order.status] || {
                wrapper: "bg-slate-100 text-slate-700 border-slate-200",
                dot: "bg-slate-500",
                hindi: order.status || "ऑर्डर",
              };

              return (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(index * 0.025, 0.12),
                  }}
                  className="
                    overflow-hidden
                    rounded-[22px]
                    border
                    border-slate-100
                    bg-white
                    shadow-sm
                  "
                >
                  {/* TOP STATUS LINE */}

                  <div
                    className={`h-1 ${
                      isPaid ? "bg-green-500" : "bg-orange-500"
                    }`}
                  />

                  <div className="p-4">
                    {/* HEADER */}

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

                        <div className="min-w-0">
                          <p className="text-base font-black text-slate-900">
                            {formatDate(order.createdAt)}
                          </p>

                          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-slate-400">
                            <Clock3 className="h-3 w-3" />
                            {formatTime(order.createdAt)}
                          </p>
                        </div>
                      </div>

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

                    {/* PAYMENT STATUS */}

                    <div
                      className={`
                        mt-3
                        flex
                        items-center
                        justify-between
                        rounded-2xl
                        px-3.5
                        py-3
                        ${isPaid ? "bg-green-50" : "bg-orange-50"}
                      `}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`
                            flex
                            h-9
                            w-9
                            items-center
                            justify-center
                            rounded-xl
                            ${
                              isPaid
                                ? "bg-green-100 text-green-600"
                                : "bg-orange-100 text-orange-600"
                            }
                          `}
                        >
                          {isPaid ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <WalletCards className="h-4 w-4" />
                          )}
                        </div>

                        <div>
                          <p className="text-[10px] font-medium text-slate-400">
                            भुगतान
                          </p>

                          <p
                            className={`
                              text-sm
                              font-black
                              ${isPaid ? "text-green-700" : "text-orange-700"}
                            `}
                          >
                            {isPaid ? "पैसा जमा" : "पैसा बाकी"}
                          </p>
                        </div>
                      </div>

                      <p
                        className={`
                          text-lg
                          font-black
                          ${isPaid ? "text-green-700" : "text-orange-700"}
                        `}
                      >
                        {formatMoney(order.totalAmount)}
                      </p>
                    </div>

                    {/* PRODUCTS */}

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

                            <p className="shrink-0 text-sm font-black text-slate-800">
                              {formatMoney(item.total)}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* MORE ITEMS */}

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

                    {/* ACTIONS */}

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
                      <p className="text-[10px] font-semibold text-slate-400">
                        {order.paymentMethod === "Online" ? "ऑनलाइन" : "कैश"}
                      </p>

                      <div className="flex items-center gap-2">
                        {hasReceipt && invoice && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
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
                              transition
                              hover:bg-red-700
                              disabled:opacity-60
                            "
                          >
                            {isDownloading ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}

                            {isDownloading ? "डाउनलोड..." : "रसीद"}
                          </motion.button>
                        )}

                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => openReceipt(order)}
                          title="रसीद देखें"
                          className="
                            flex
                            items-center
                            gap-1.5
                            rounded-xl
                            bg-slate-100
                            px-3
                            py-2
                            text-xs
                            font-bold
                            text-slate-600
                            transition
                            hover:bg-slate-200
                          "
                        >
                          <ReceiptText className="h-3.5 w-3.5" />
                          रसीद
                        </motion.button>

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

                    {/* DETAILS */}

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
                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-[9px] font-semibold text-slate-400">
                                ऑर्डर आईडी
                              </p>

                              <p className="mt-1 break-all text-[10px] font-bold text-slate-700">
                                {order._id}
                              </p>
                            </div>

                            <div className="rounded-xl bg-slate-50 p-3">
                              <p className="text-[9px] font-semibold text-slate-400">
                                भुगतान
                              </p>

                              <p className="mt-1 text-xs font-bold text-slate-700">
                                {order.paymentMethod || "—"}
                              </p>
                            </div>

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

      {/* ------------------------------------------------
          ORDER RECEIPT MODAL
      ------------------------------------------------ */}

      <AnimatePresence>
        {receiptOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
            onClick={closeReceipt}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="
                max-h-[90vh]
                w-full
                max-w-md
                overflow-y-auto
                rounded-t-[28px]
                bg-white
                p-5
                shadow-2xl
                sm:rounded-[28px]
              "
            >
              {/* HEADER */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    ऑर्डर रसीद
                  </h2>

                  <p className="text-xs font-semibold text-slate-400">
                    #{String(receiptOrder._id).slice(-8).toUpperCase()}
                  </p>
                </div>

                <button
                  onClick={closeReceipt}
                  className="
                    flex
                    h-9
                    w-9
                    items-center
                    justify-center
                    rounded-full
                    bg-slate-100
                    text-slate-600
                    transition
                    hover:bg-slate-200
                  "
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* LOADING */}
              {receiptLoading && (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <RefreshCw className="h-8 w-8 animate-spin text-sky-600" />
                  <p className="text-sm font-semibold text-slate-500">
                    रसीद लोड हो रही है...
                  </p>
                </div>
              )}

              {/* ERROR */}
              {!receiptLoading && receiptError && (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-50 py-10 text-center">
                  <CircleAlert className="h-8 w-8 text-slate-400" />
                  <p className="px-6 text-sm font-semibold text-slate-500">
                    {receiptError}
                  </p>
                </div>
              )}

              {/* RECEIPT CONTENT */}
              {!receiptLoading && !receiptError && receiptData && (
                <>
                  {/* ORDER INFO */}
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold text-slate-400">
                        रसीद संख्या
                      </p>

                      <p className="mt-1 break-all text-xs font-black text-slate-800">
                        {receiptData.receipt?.receiptNumber}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[10px] font-bold text-slate-400">
                        तारीख
                      </p>

                      <p className="mt-1 text-xs font-black text-slate-800">
                        {formatDate(receiptData.receipt?.generatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* ITEMS */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
                    <div className="bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        आइटम
                      </p>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {(receiptData.order?.items || []).map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between px-3 py-3"
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              {item.name}
                            </p>

                            <p className="text-[11px] font-semibold text-slate-400">
                              {item.measurement || ""} · {item.qty} ×{" "}
                              {formatMoney(item.price)}
                            </p>
                          </div>

                          <p className="text-sm font-black text-slate-900">
                            {formatMoney(item.total)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TOTAL */}
                  <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-emerald-700">
                        कुल राशि
                      </p>

                      <p className="text-xl font-black text-emerald-700">
                        {formatMoney(receiptData.receipt?.totalAmount)}
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* DOWNLOAD */}
              {!receiptLoading && !receiptError && receiptData && (
                <button
                  onClick={downloadReceipt}
                  disabled={downloadingReceipt}
                  className="
                    mt-5
                    flex
                    h-12
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    bg-slate-900
                    text-sm
                    font-black
                    text-white
                    transition
                    hover:bg-slate-800
                    disabled:opacity-50
                  "
                >
                  {downloadingReceipt ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}

                  {downloadingReceipt ? "डाउनलोड हो रहा..." : "PDF डाउनलोड करें"}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Orders;
