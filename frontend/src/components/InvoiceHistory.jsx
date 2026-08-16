import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowLeft,
  CalendarDays,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

/* =========================================================
   DATE FILTERS
========================================================= */

const DATE_FILTERS = [
  {
    id: "all",
    label: "सभी",
  },
  {
    id: "today",
    label: "आज",
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
  {
    id: "6months",
    label: "6 माह",
  },
];

/* =========================================================
   LOADING CARD
   Same compact height as original
========================================================= */

const LoadingCard = () => (
  <div
    className="
      h-[82px]
      animate-pulse
      overflow-hidden
      rounded-[22px]
      border
      border-neutral-100
      bg-white
    "
  >
    <div className="flex h-full items-center gap-3 p-4">
      <div className="h-11 w-11 shrink-0 rounded-xl bg-neutral-200" />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 rounded-md bg-neutral-200" />
        <div className="h-3 w-24 rounded-md bg-neutral-100" />
      </div>

      <div className="h-10 w-10 rounded-xl bg-neutral-200" />
    </div>
  </div>
);

/* =========================================================
   INVOICE HISTORY
========================================================= */

const InvoiceHistory = () => {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [downloadingId, setDownloadingId] = useState(null);

  const [dateFilter, setDateFilter] = useState("all");

  /* =======================================================
     FETCH INVOICES
  ======================================================= */

  const fetchInvoices = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = localStorage.getItem("token");

      if (!token) {
        setInvoices([]);
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/user/invoice/my-invoices`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.success) {
        setInvoices(response.data.invoices || []);
      } else {
        setInvoices([]);
      }
    } catch (error) {
      console.error("Invoice History Error:", error);
      setInvoices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  /* =======================================================
     PARSE DATE KEY
     
     invoice.dateKey:
     YYYY-MM-DD
     
     We create local date instead of:
     new Date("YYYY-MM-DD")
     
     because that can cause timezone issues.
  ======================================================= */

  const parseDateKey = (dateKey) => {
    if (!dateKey) return null;

    const [year, month, day] = String(dateKey).split("-").map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  };

  /* =======================================================
     START OF TODAY
  ======================================================= */

  const getStartOfToday = () => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  /* =======================================================
     FILTER INVOICES
  ======================================================= */

  const filteredInvoices = useMemo(() => {
    if (dateFilter === "all") {
      return invoices;
    }

    const now = new Date();

    const startOfToday = getStartOfToday();

    /* -----------------------------------------------------
       TODAY
    ----------------------------------------------------- */

    if (dateFilter === "today") {
      return invoices.filter((invoice) => {
        const invoiceDate = parseDateKey(invoice.dateKey);

        if (!invoiceDate) return false;

        return invoiceDate.getTime() === startOfToday.getTime();
      });
    }

    /* -----------------------------------------------------
       DATE RANGE
    ----------------------------------------------------- */

    const startDate = new Date(startOfToday);

    if (dateFilter === "7days") {
      startDate.setDate(startDate.getDate() - 6);
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

    return invoices.filter((invoice) => {
      const invoiceDate = parseDateKey(invoice.dateKey);

      if (!invoiceDate) return false;

      return invoiceDate >= startDate && invoiceDate <= now;
    });
  }, [invoices, dateFilter]);

  /* =======================================================
     ACTIVE FILTER LABEL
  ======================================================= */

  const activeFilterLabel = useMemo(() => {
    return (
      DATE_FILTERS.find((filter) => filter.id === dateFilter)?.label || "सभी"
    );
  }, [dateFilter]);

  /* =======================================================
     FILTER TOTAL
  ======================================================= */

  const filteredTotal = useMemo(() => {
    return filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
      0,
    );
  }, [filteredInvoices]);

  /* =======================================================
     DOWNLOAD PDF
  ======================================================= */

  const downloadInvoice = async (invoice) => {
    if (!invoice?._id) return;

    try {
      setDownloadingId(invoice._id);

      const token = localStorage.getItem("token");

      if (!token) {
        alert("कृपया पहले लॉगिन करें।");
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

      link.download = `e-setu-receipt-${invoice.dateKey || invoice._id}.pdf`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Download Invoice Error:", error);

      alert("रसीद डाउनलोड नहीं हो सकी।");
    } finally {
      setDownloadingId(null);
    }
  };

  /* =======================================================
     DATE FORMAT
     
     Example:
     15/08/2026
  ======================================================= */

  const formatDate = (dateKey) => {
    if (!dateKey) return "--/--/----";

    const [year, month, day] = String(dateKey).split("-");

    if (!year || !month || !day) {
      return dateKey;
    }

    return `${day}/${month}/${year}`;
  };

  /* =======================================================
     MONEY
  ======================================================= */

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  /* =======================================================
     CHANGE FILTER
  ======================================================= */

  const handleFilterChange = (filterId) => {
    setDateFilter(filterId);
  };

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <main
      className="
        min-h-screen
        bg-[#f6f6f6]
        px-4
        pb-28
        pt-20
        sm:px-6
      "
    >
      <div className="mx-auto max-w-3xl">
        {/* =================================================
            BACK
        ================================================= */}

        <motion.button
          initial={{
            opacity: 0,
            x: -8,
          }}
          animate={{
            opacity: 1,
            x: 0,
          }}
          whileTap={{
            scale: 0.96,
          }}
          onClick={() => navigate("/order-history")}
          className="
            mb-4
            inline-flex
            items-center
            gap-2
            rounded-2xl
            border
            border-neutral-200
            bg-white
            px-3.5
            py-2.5
            text-xs
            font-black
            text-neutral-700
            shadow-sm
            transition
            hover:border-red-200
            hover:bg-red-50
            hover:text-red-600
          "
        >
          <ArrowLeft className="h-4 w-4" />
          पीछे
        </motion.button>

        {/* =================================================
            HEADER
        ================================================= */}

        <motion.div
          initial={{
            opacity: 0,
            y: -10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          className="mb-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            {/* ICON */}

            <div
              className="
                flex
                h-11
                w-11
                shrink-0
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

            {/* TITLE */}

            <div>
              <h1
                className="
                  text-xl
                  font-black
                  tracking-tight
                  text-neutral-950
                  sm:text-2xl
                "
              >
                दैनिक रसीदें
              </h1>

              <p className="mt-0.5 text-xs font-medium text-neutral-400">
                आपकी सभी रसीदें
              </p>
            </div>
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={() => fetchInvoices(true)}
            disabled={refreshing}
            aria-label="रसीदें रिफ्रेश करें"
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              border
              border-neutral-200
              bg-white
              text-neutral-600
              shadow-sm
              transition
              hover:border-red-200
              hover:bg-red-50
              hover:text-red-600
              active:scale-95
              disabled:opacity-50
            "
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </motion.div>

        {/* =================================================
            QUICK STATS
        ================================================= */}

        {!loading && invoices.length > 0 && (
          <motion.div
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="mb-5 grid grid-cols-2 gap-2"
          ></motion.div>
        )}

        {/* =================================================
            DATE FILTER
        ================================================= */}

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
            delay: 0.05,
          }}
          className="mb-5"
        >
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
                    ${
                      isActive
                        ? "border-red-600 bg-red-600 text-white shadow-md shadow-red-100"
                        : "border-neutral-200 bg-white text-neutral-600 shadow-sm hover:border-red-200 hover:text-red-600"
                    }
                  `}
                >
                  {isActive && (
                    <motion.div
                      layoutId="invoiceActiveFilter"
                      className="
                        absolute
                        inset-0
                        bg-red-600
                      "
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

        {/* =================================================
            FILTER SUMMARY
        ================================================= */}

        {!loading && invoices.length > 0 && (
          <AnimatePresence mode="wait">
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
              exit={{
                opacity: 0,
                y: -4,
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
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />

                <p className="text-[11px] font-bold text-red-700">
                  {dateFilter === "all"
                    ? "सभी रसीदें"
                    : `${activeFilterLabel} की रसीदें`}
                </p>
              </div>

              <p className="text-[10px] font-black text-red-500">
                {filteredInvoices.length} रसीद
              </p>
            </motion.div>
          </AnimatePresence>
        )}

        {/* =================================================
            LOADING
        ================================================= */}

        {loading ? (
          <div className="space-y-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : filteredInvoices.length === 0 ? (
          /* =================================================
             EMPTY
          ================================================= */

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
              rounded-[24px]
              border
              border-neutral-200
              bg-white
              px-6
              py-14
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
                bg-neutral-950
                text-white
              "
            >
              <ReceiptText className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-base font-black text-neutral-900">
              {dateFilter === "all"
                ? "अभी कोई रसीद नहीं"
                : `${activeFilterLabel} में कोई रसीद नहीं`}
            </h2>

            <p className="mt-1 text-xs text-neutral-400">
              {dateFilter === "all"
                ? "आपकी दैनिक रसीदें यहाँ दिखाई देंगी"
                : "इस अवधि में कोई रसीद नहीं मिली"}
            </p>

            {dateFilter !== "all" && (
              <button
                onClick={() => setDateFilter("all")}
                className="
                  mt-5
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  px-5
                  py-2.5
                  text-xs
                  font-black
                  text-red-600
                  transition
                  hover:bg-red-100
                  active:scale-95
                "
              >
                सभी रसीदें देखें
              </button>
            )}
          </motion.div>
        ) : (
          /* =================================================
             INVOICE LIST
             IMPORTANT:
             Card height intentionally kept compact.
          ================================================= */

          <div className="space-y-3">
            {filteredInvoices.map((invoice, index) => {
              const isDownloading = downloadingId === invoice._id;

              return (
                <motion.div
                  key={invoice._id}
                  initial={{
                    opacity: 0,
                    y: 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(index * 0.025, 0.12),
                  }}
                  className="
                    group
                    relative
                    overflow-hidden
                    rounded-[22px]
                    border
                    border-neutral-200
                    bg-white
                    shadow-sm
                    transition
                    hover:border-red-100
                    hover:shadow-md
                  "
                >
                  {/* =========================================
                      RED ACCENT
                  ========================================= */}

                  <div
                    className="
                      absolute
                      left-0
                      top-0
                      h-full
                      w-1
                      bg-red-600
                    "
                  />

                  <div
                    className="
                      flex
                      min-h-[82px]
                      items-center
                      gap-3
                      p-4
                      pl-5
                      sm:gap-4
                      sm:pl-6
                    "
                  >
                    {/* =======================================
                        RECEIPT ICON
                    ======================================= */}

                    <div
                      className="
                        flex
                        h-11
                        w-11
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        bg-neutral-950
                        text-white
                      "
                    >
                      <FileText className="h-5 w-5" />
                    </div>

                    {/* =======================================
                        DETAILS
                    ======================================= */}

                    <div className="min-w-0 flex-1">
                      {/* DATE */}

                      <div className="flex items-center gap-1.5">
                        <CalendarDays
                          className="
                            h-3.5
                            w-3.5
                            shrink-0
                            text-red-600
                          "
                        />

                        <p
                          className="
                            text-base
                            font-black
                            tracking-tight
                            text-neutral-950
                          "
                        >
                          {formatDate(invoice.dateKey)}
                        </p>
                      </div>

                      {/* META */}

                      <div className="mt-1.5 flex items-center gap-2">
                        <span
                          className="
                            text-xs
                            font-medium
                            text-neutral-400
                          "
                        >
                          {invoice.totalOrders || 0} ऑर्डर
                        </span>

                        <span className="text-neutral-300">•</span>

                        <span
                          className="
                            text-xs
                            font-medium
                            text-neutral-400
                          "
                        >
                          {invoice.items?.length || 0} आइटम
                        </span>
                      </div>
                    </div>

                    {/* =======================================
                        RIGHT SIDE
                    ======================================= */}

                    <div className="flex shrink-0 items-center gap-2">
                      {/* DESKTOP AMOUNT */}

                      <p
                        className="
                          hidden
                          text-base
                          font-black
                          text-neutral-950
                          sm:block
                        "
                      >
                        {formatMoney(invoice.totalAmount)}
                      </p>

                      {/* DOWNLOAD */}

                      <motion.button
                        type="button"
                        whileTap={{
                          scale: 0.94,
                        }}
                        onClick={() => downloadInvoice(invoice)}
                        disabled={isDownloading}
                        aria-label="रसीद डाउनलोड करें"
                        title="रसीद डाउनलोड करें"
                        className="
                          flex
                          h-10
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          bg-red-600
                          px-3
                          text-white
                          shadow-sm
                          transition
                          hover:bg-red-700
                          active:scale-95
                          disabled:cursor-not-allowed
                          disabled:opacity-60
                          sm:px-4
                        "
                      >
                        {isDownloading ? (
                          <Loader2
                            className="
                              h-4
                              w-4
                              animate-spin
                            "
                          />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4" />
                        )}

                        <span
                          className="
                            hidden
                            text-xs
                            font-black
                            sm:block
                          "
                        >
                          डाउनलोड
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* =================================================
            BOTTOM NOTE
        ================================================= */}

        {!loading && filteredInvoices.length > 0 && (
          <motion.p
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            className="
              mt-5
              text-center
              text-[11px]
              font-medium
              text-neutral-400
            "
          >
            अपनी रसीद डाउनलोड करने के लिए डाउनलोड दबाएँ
          </motion.p>
        )}
      </div>
    </main>
  );
};

export default InvoiceHistory;
