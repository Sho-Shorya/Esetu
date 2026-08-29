import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDownToLine,
  ArrowLeft,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
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
  const [receipts, setReceipts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [downloadingId, setDownloadingId] = useState(null);

  const [dateFilter, setDateFilter] = useState("all");

  /* =======================================================
     FETCH INVOICES
  ======================================================= */

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const token = localStorage.getItem("token");

      if (!token) {
        setInvoices([]);
        setReceipts([]);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [invoiceResponse, receiptResponse] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/user/invoice/my-invoices`, {
          headers,
        }),

        axios.get(`${API_BASE_URL}/api/v1/order/my-receipts`, {
          headers,
        }),
      ]);

      if (invoiceResponse.data?.success) {
        setInvoices(invoiceResponse.data.invoices || []);
      } else {
        setInvoices([]);
      }

      if (receiptResponse.data?.success) {
        setReceipts(receiptResponse.data.receipts || []);
      } else {
        setReceipts([]);
      }
    } catch (error) {
      console.error("Invoice History Error:", error);
      setInvoices([]);
      setReceipts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
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
     DATE KEY FROM DATE
  ======================================================= */

  const toLocalDateKey = (value) => {
    if (!value) return null;

    const date = new Date(value);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
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

  /* =======================================================
     COMBINED ENTRIES

     DailyInvoices + per-order receipts, sorted newest first.
  ======================================================= */

  const entries = useMemo(() => {
    const invoiceEntries = invoices.map((invoice) => ({
      kind: "invoice",
      _id: invoice._id,
      dateKey: invoice.dateKey || null,
      date: parseDateKey(invoice.dateKey),
      totalAmount: invoice.totalAmount || 0,
      totalOrders: invoice.totalOrders || 0,
      itemCount: invoice.items?.length || 0,
    }));

    const receiptEntries = receipts.map((receipt) => ({
      kind: "receipt",
      _id: receipt._id,
      orderId: receipt.orderId,
      dateKey: toLocalDateKey(receipt.orderCreatedAt || receipt.generatedAt),
      date: receipt.orderCreatedAt
        ? new Date(receipt.orderCreatedAt)
        : receipt.generatedAt
          ? new Date(receipt.generatedAt)
          : null,
      generatedDateKey: toLocalDateKey(receipt.generatedAt),
      receiptNumber: receipt.receiptNumber,
      totalAmount: receipt.totalAmount || 0,
    }));

    return [...invoiceEntries, ...receiptEntries].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;

      return timeB - timeA;
    });
  }, [invoices, receipts]);

  /* =======================================================
     FILTER ENTRIES
  ======================================================= */

  const filteredEntries = useMemo(() => {
    if (dateFilter === "all") {
      return entries;
    }

    const now = new Date();

    const startOfToday = getStartOfToday();

    /* -----------------------------------------------------
       TODAY
    ----------------------------------------------------- */

    if (dateFilter === "today") {
      return entries.filter((entry) => {
        if (!entry.date) return false;

        return new Date(entry.date).getTime() === startOfToday.getTime();
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

    return entries.filter((entry) => {
      if (!entry.date) return false;

      const entryDate = new Date(entry.date);

      return entryDate >= startDate && entryDate <= now;
    });
  }, [entries, dateFilter]);

  /* =======================================================
     GROUP ENTRIES BY DAY
  ======================================================= */

  const groupedEntries = useMemo(() => {
    const groupMap = new Map();

    for (const entry of filteredEntries) {
      const key = entry.dateKey || "---";

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }

      groupMap.get(key).push(entry);
    }

    return Array.from(groupMap.entries());
  }, [filteredEntries]);

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
    return filteredEntries.reduce(
      (sum, entry) => sum + Number(entry.totalAmount || 0),
      0,
    );
  }, [filteredEntries]);

  /* =======================================================
     DOWNLOAD PDF
  ======================================================= */

  const downloadEntry = async (entry) => {
    if (!entry || !entry._id) return;

    try {
      setDownloadingId(entry._id);

      const token = localStorage.getItem("token");

      if (!token) {
        alert("कृपया पहले लॉगिन करें।");
        return;
      }

      const isInvoice = entry.kind === "invoice";

      const url = isInvoice
        ? `${API_BASE_URL}/api/v1/user/invoice/${entry._id}/pdf`
        : `${API_BASE_URL}/api/v1/order/receipt/${entry.orderId}/pdf`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/pdf",
      });

      const objectUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = objectUrl;

      link.download = isInvoice
        ? `e-setu-receipt-${entry.dateKey || entry._id}.pdf`
        : `e-setu-receipt-${String(entry.orderId || "").slice(-8)}.pdf`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      setTimeout(() => {
        window.URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (error) {
      console.error("Download Receipt Error:", error);

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
                सभी रसीदें
              </h1>

              <p className="mt-0.5 text-xs font-medium text-neutral-400">
                दैनिक और ऑर्डर रसीदें
              </p>
            </div>
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={() => fetchData(true)}
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

        {!loading && entries.length > 0 && (
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
                {filteredEntries.length} रसीद
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
        ) : filteredEntries.length === 0 ? (
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
                ? "आपकी सभी रसीदें यहाँ दिखाई देंगी"
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
             INVOICE LIST (grouped by day)
             Card height intentionally kept compact.
          ================================================= */

          <div className="space-y-6">
            {groupedEntries.map(([dateKey, rows], groupIndex) => (
              <div key={dateKey}>
                {/* DAY HEADER */}

                <div className="mb-2 flex items-center gap-2 px-1">
                  <p className="text-xs font-black tracking-wide text-neutral-500">
                    {formatDate(dateKey)}
                  </p>

                  <div className="h-px flex-1 rounded-full bg-neutral-200" />

                  <span className="text-[10px] font-bold text-neutral-400">
                    {rows.length} रसीद
                  </span>
                </div>

                <div className="space-y-3">
                  {rows.map((entry, index) => {
                    const isDownloading = downloadingId === entry._id;

                    const isReceipt = entry.kind === "receipt";

                    return (
                      <motion.div
                        key={`${entry.kind}-${entry._id}`}
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
                          delay: Math.min(
                            groupIndex * 0.02 + index * 0.02,
                            0.15,
                          ),
                        }}
                        className="
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
                        <div
                          className={`
                            h-1
                            ${isReceipt ? "bg-red-600" : "bg-neutral-900"}
                          `}
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
                      className={`
                        flex
                        h-11
                        w-11
                        shrink-0
                        items-center
                        justify-center
                        rounded-xl
                        text-white
                        ${isReceipt ? "bg-red-600" : "bg-neutral-950"}
                      `}
                    >
                      {isReceipt ? (
                        <ReceiptText className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>

                    {/* =======================================
                        DETAILS
                    ======================================= */}

                    <div className="min-w-0 flex-1">
                      {/* TYPE BADGE */}

                      <span
                        className={`
                          inline-block
                          rounded-full
                          px-2
                          py-0.5
                          text-[9px]
                          font-black
                          uppercase
                          tracking-wide
                          ${
                            isReceipt
                              ? "bg-red-50 text-red-600"
                              : "bg-neutral-100 text-neutral-500"
                          }
                        `}
                      >
                        {isReceipt ? "ऑर्डर रसीद" : "दैनिक रसीद"}
                      </span>

                      {/* META */}

                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {isReceipt ? (
                          <>
                            <span className="text-xs font-medium text-neutral-400">
                              ऑर्डर #
                              {String(entry.orderId || "")
                                .slice(-8)
                                .toUpperCase()}
                            </span>

                            <span className="text-neutral-300">•</span>

                            <span className="text-[11px] font-medium text-neutral-400">
                              रसीद बनी: {formatDate(entry.generatedDateKey)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-medium text-neutral-400">
                              {entry.totalOrders} ऑर्डर
                            </span>

                            <span className="text-neutral-300">•</span>

                            <span className="text-xs font-medium text-neutral-400">
                              {entry.itemCount} आइटम
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* =======================================
                        RIGHT SIDE
                    ======================================= */}

                    <div className="flex shrink-0 items-center gap-2">
                      {/* AMOUNT */}

                      <p
                        className="
                          text-sm
                          font-black
                          text-neutral-950
                          sm:text-base
                        "
                      >
                        {formatMoney(entry.totalAmount)}
                      </p>

                      {/* DOWNLOAD */}

                      <motion.button
                        type="button"
                        whileTap={{
                          scale: 0.94,
                        }}
                        onClick={() => downloadEntry(entry)}
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
          </div>
        ))}
        </div>
      )}
      </div>
    </main>
  );
};

export default InvoiceHistory;
