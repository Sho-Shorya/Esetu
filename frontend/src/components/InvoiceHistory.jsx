import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  ArrowDownToLine,
  CalendarDays,
  FileText,
  Loader2,
  ReceiptText,
  RefreshCw,
} from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";
import { BiLeftArrow } from "react-icons/bi";
import { useNavigate } from "react-router-dom";

const InvoiceHistory = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  /* =========================================================
     FETCH INVOICES
  ========================================================= */

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

  /* =========================================================
     DOWNLOAD PDF
  ========================================================= */

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
      link.download = `e-setu-receipt-${invoice.dateKey}.pdf`;

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

  /* =========================================================
     DATE FORMAT
     Example: 15/08/2026
  ========================================================= */

  const formatDate = (dateKey) => {
    if (!dateKey) return "--/--/----";

    const [year, month, day] = dateKey.split("-");

    if (!year || !month || !day) {
      return dateKey;
    }

    return `${day}/${month}/${year}`;
  };

  /* =========================================================
     MONEY
  ========================================================= */

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  /* =========================================================
     LOADING CARD
  ========================================================= */

  const LoadingCard = () => (
    <div className="h-[82px] animate-pulse rounded-2xl border border-neutral-100 bg-white" />
  );

  /* =========================================================
     PAGE
  ========================================================= */

  const navigate = useNavigate();
  return (
    <main className="min-h-screen bg-[#f6f6f6] px-4 pb-28 pt-20 sm:px-6">
      <div
        onClick={() => navigate("/order-history")}
        className="text-red-600 bg-white px-4 py-2 w-23 items-center justify-start mb-4 flex gap-2 rounded-2xl"
      >
        <BiLeftArrow />
        पीछे
      </div>
      <div className="mx-auto max-w-3xl">
        {/* =====================================================
            HEADER
        ====================================================== */}

        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* ICON */}

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

            {/* TITLE */}

            <div>
              <h1 className="text-xl font-black tracking-tight text-neutral-950 sm:text-2xl">
                दैनिक रसीदें
              </h1>

              <p className="mt-0.5 text-xs font-medium text-neutral-400">
                {invoices.length} रसीद
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
        </div>

        {/* =====================================================
            LOADING
        ====================================================== */}

        {loading ? (
          <div className="space-y-3">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        ) : invoices.length === 0 ? (
          /* ===================================================
             EMPTY
          ==================================================== */

          <div
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
              अभी कोई रसीद नहीं
            </h2>

            <p className="mt-1 text-xs text-neutral-400">
              आपकी दैनिक रसीदें यहाँ दिखाई देंगी
            </p>
          </div>
        ) : (
          /* ===================================================
             INVOICE LIST
          ==================================================== */

          <div className="space-y-3">
            {invoices.map((invoice) => {
              const isDownloading = downloadingId === invoice._id;

              return (
                <div
                  key={invoice._id}
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
                  {/* RED ACCENT */}

                  <div className="absolute left-0 top-0 h-full w-1 bg-red-600" />

                  <div className="flex items-center gap-3 p-4 pl-5 sm:gap-4 sm:p-4 sm:pl-6">
                    {/* RECEIPT ICON */}

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

                    {/* DETAILS */}

                    <div className="min-w-0 flex-1">
                      {/* DATE */}

                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-red-600" />

                        <p className="text-base font-black tracking-tight text-neutral-950">
                          {formatDate(invoice.dateKey)}
                        </p>
                      </div>

                      {/* SMALL META */}

                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-xs font-medium text-neutral-400">
                          {invoice.totalOrders || 0} ऑर्डर
                        </span>

                        <span className="text-neutral-300">•</span>

                        <span className="text-xs font-medium text-neutral-400">
                          {invoice.items?.length || 0} आइटम
                        </span>
                      </div>
                    </div>

                    {/* RIGHT */}

                    <div className="flex shrink-0 items-center gap-2">
                      {/* AMOUNT */}

                      <p className="hidden text-base font-black text-neutral-950 sm:block">
                        {formatMoney(invoice.totalAmount)}
                      </p>

                      {/* DOWNLOAD */}

                      <button
                        type="button"
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
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="h-4 w-4" />
                        )}

                        <span className="hidden text-xs font-black sm:block">
                          डाउनलोड
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* MOBILE AMOUNT */}

                  <div
                    className="
                      border-t
                      border-neutral-100
                      px-5
                      py-2.5
                      sm:hidden
                    "
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-400">
                        कुल राशि
                      </span>

                      <span className="text-sm font-black text-neutral-950">
                        {formatMoney(invoice.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* =====================================================
            BOTTOM NOTE
        ====================================================== */}

        {!loading && invoices.length > 0 && (
          <p className="mt-5 text-center text-[11px] font-medium text-neutral-400">
            अपनी रसीद डाउनलोड करने के लिए डाउनलोड दबाएँ
          </p>
        )}
      </div>
    </main>
  );
};

export default InvoiceHistory;
