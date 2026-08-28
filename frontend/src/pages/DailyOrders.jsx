import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  CalendarDays,
  Download,
  Loader2,
  ChevronDown,
  User,
  X,
  ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

import { API_BASE_URL } from "@/lib/constants";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Navigate, useNavigate } from "react-router-dom";

/* ============================================================
   HELPERS
============================================================ */

const getToday = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (date) => {
  if (!date) return "";

  const [year, month, day] = date.split("-");

  return `${day}/${month}/${year}`;
};

/* ============================================================
   LOAD FONT
============================================================ */

const loadFontAsBase64 = async (url) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load font: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }

  return btoa(binary);
};

/* ============================================================
   GET ITEM AMOUNT
============================================================ */

const getItemAmount = (item) => {
  return Number(
    item.totalAmount ?? item.amount ?? item.totalPrice ?? item.priceTotal ?? 0,
  );
};

/* ============================================================
   GET TOTAL ORDERS
============================================================ */

const getTotalOrders = (items) => {
  return items.reduce((total, item) => {
    if (Array.isArray(item.orderedBy)) {
      return total + item.orderedBy.length;
    }

    return total;
  }, 0);
};

/* ============================================================
   GET TOTAL AMOUNT
============================================================ */

const getTotalAmount = (items) => {
  return items.reduce((total, item) => {
    return total + getItemAmount(item);
  }, 0);
};

/* ============================================================
   PDF DOWNLOAD
============================================================ */

const downloadPDF = async (items, selectedDate) => {
  if (!items || items.length === 0) {
    toast.error("Download करने के लिए कोई data नहीं है");
    return;
  }

  try {
    toast.loading("PDF बनाई जा रही है...", {
      id: "pdf-download",
    });

    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    /* --------------------------------------------------------
       DEVANAGARI FONT
    -------------------------------------------------------- */

    const fontBase64 = await loadFontAsBase64(
      "/fonts/NotoSansDevanagari-Regular.ttf",
    );

    doc.addFileToVFS("NotoSansDevanagari-Regular.ttf", fontBase64);

    doc.addFont(
      "NotoSansDevanagari-Regular.ttf",
      "NotoSansDevanagari",
      "normal",
    );

    doc.setFont("NotoSansDevanagari", "normal");

    /* --------------------------------------------------------
       CALCULATIONS
    -------------------------------------------------------- */

    const totalProducts = items.length;

    const totalQuantity = items.reduce(
      (sum, item) => sum + Number(item.totalQuantity || 0),
      0,
    );

    const totalOrders = getTotalOrders(items);

    const totalAmount = getTotalAmount(items);

    /* --------------------------------------------------------
       PAGE SIZE
    -------------------------------------------------------- */

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    /* --------------------------------------------------------
       MAIN DATE HEADING
    -------------------------------------------------------- */

    doc.setFont("NotoSansDevanagari", "normal");
    doc.setFontSize(20);

    doc.text(formatDate(selectedDate), pageWidth / 2, 16, {
      align: "center",
    });

    /* --------------------------------------------------------
       SMALL SUMMARY CARDS
    -------------------------------------------------------- */

    const cardY = 23;
    const cardHeight = 12;

    const cardGap = 5;
    const cardWidth = 55;

    const totalCardsWidth = cardWidth * 2 + cardGap;

    const cardsStartX = (pageWidth - totalCardsWidth) / 2;

    /* --------------------------------------------------------
       TOTAL ORDERS CARD
    -------------------------------------------------------- */

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.setLineWidth(0.3);

    doc.roundedRect(cardsStartX, cardY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    doc.text("Total Orders", cardsStartX + 5, cardY + 5);

    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);

    doc.text(String(totalOrders), cardsStartX + cardWidth - 5, cardY + 7, {
      align: "right",
    });

    /* --------------------------------------------------------
       TOTAL AMOUNT CARD
    -------------------------------------------------------- */

    const amountCardX = cardsStartX + cardWidth + cardGap;

    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);

    doc.roundedRect(amountCardX, cardY, cardWidth, cardHeight, 2, 2, "FD");

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);

    doc.text("Total Amount", amountCardX + 5, cardY + 5);

    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);

    doc.text(
      `₹${totalAmount.toFixed(2)}`,
      amountCardX + cardWidth - 5,
      cardY + 7,
      {
        align: "right",
      },
    );

    /* --------------------------------------------------------
       TABLE DATA
    -------------------------------------------------------- */

    const tableData = items.map((item, index) => [
      index + 1,
      item.productName || "-",
      item.hinglishName || "-",
      item.companyName || "-",
      item.measurement || "-",
      Number(item.totalQuantity || 0),
    ]);

    /* --------------------------------------------------------
       TABLE
    -------------------------------------------------------- */

    autoTable(doc, {
      startY: 40,

      head: [["#", "Product", "Hinglish Name", "Company", "माप", "कुल मात्रा"]],

      body: tableData,

      theme: "grid",

      styles: {
        font: "NotoSansDevanagari",
        fontStyle: "normal",
        fontSize: 9,
        cellPadding: {
          top: 4,
          bottom: 4,
          left: 3,
          right: 3,
        },
        valign: "middle",
        overflow: "linebreak",
        lineColor: [210, 210, 210],
        lineWidth: 0.2,
        textColor: [40, 40, 40],
      },

      headStyles: {
        font: "NotoSansDevanagari",
        fontStyle: "normal",
        fontSize: 10,
        halign: "center",
        valign: "middle",
        cellPadding: 4,
        fillColor: [245, 245, 245],
        textColor: [45, 45, 45],
        lineColor: [210, 210, 210],
      },

      bodyStyles: {
        font: "NotoSansDevanagari",
        fontStyle: "normal",
        fontSize: 9,
        valign: "middle",
      },

      alternateRowStyles: {
        fillColor: [252, 252, 252],
      },

      columnStyles: {
        /* # */
        0: {
          cellWidth: 12,
          halign: "center",
        },

        /* PRODUCT */
        1: {
          cellWidth: 48,
        },

        /* HINGLISH */
        2: {
          cellWidth: 45,
        },

        /* COMPANY */
        3: {
          cellWidth: 48,
        },

        /* MEASUREMENT */
        4: {
          cellWidth: 32,
          halign: "center",
        },

        /* QUANTITY */
        5: {
          cellWidth: 32,
          halign: "center",
        },
      },

      margin: {
        left: 14,
        right: 14,
        bottom: 20,
      },

      didParseCell: (data) => {
        /* Product name slightly larger */
        if (data.section === "body" && data.column.index === 1) {
          data.cell.styles.fontSize = 10;
        }

        /* Quantity slightly stronger */
        if (data.section === "body" && data.column.index === 5) {
          data.cell.styles.fontSize = 10;
        }
      },

      didDrawPage: () => {
        /* Keep Hindi font active */
        doc.setFont("NotoSansDevanagari", "normal");

        /* Page number */
        const pageNumber = doc.internal.getNumberOfPages();

        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);

        doc.text(`Page ${pageNumber}`, pageWidth - 14, pageHeight - 8, {
          align: "right",
        });
      },
    });

    /* ========================================================
       FINAL SUMMARY
    ======================================================== */

    const finalY = doc.lastAutoTable.finalY + 8;

    let summaryY = finalY;

    if (summaryY > pageHeight - 30) {
      doc.addPage();
      summaryY = 20;
    }

    /* --------------------------------------------------------
       SUMMARY
    -------------------------------------------------------- */

    doc.setFont("NotoSansDevanagari", "normal");

    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);

    doc.text(`कुल Products: ${totalProducts}`, 14, summaryY);

    doc.text(`कुल मात्रा: ${totalQuantity}`, 14, summaryY + 6);

    /* --------------------------------------------------------
       FILE NAME
    -------------------------------------------------------- */

    doc.save(`approved-orders-${selectedDate}.pdf`);

    toast.success("PDF download हो गई", {
      id: "pdf-download",
      duration: 500,
    });
  } catch (error) {
    console.error("PDF generation error:", error);

    toast.error("PDF बनाने में समस्या हुई", {
      id: "pdf-download",
    });
  }
};

/* ============================================================
   COMPONENT
============================================================ */

const DailyOrders = () => {
  const [selectedDate, setSelectedDate] = useState(getToday());

  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(false);

  const [expandedProduct, setExpandedProduct] = useState(null);

  /* ==========================================================
     PROFILE
  ========================================================== */

  const [selectedUser, setSelectedUser] = useState(null);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const navigate = useNavigate();
  /* ==========================================================
     FETCH DAILY ORDERS
  ========================================================== */

  const fetchDailyOrders = async (date) => {
    if (!date) return;

    try {
      setLoading(true);
      setExpandedProduct(null);

      const res = await axios.get(
        `${API_BASE_URL}/api/v1/order/daily-approved-items`,
        {
          params: {
            date,
          },

          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data?.success) {
        setItems(res.data.items || []);
      } else {
        setItems([]);

        toast.error(res.data?.message || "Failed to load orders");
      }
    } catch (error) {
      console.error("Daily approved orders error:", error);

      setItems([]);

      toast.error(
        error?.response?.data?.message || "Failed to load daily orders",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==========================================================
     DATE CHANGE
  ========================================================== */

  useEffect(() => {
    fetchDailyOrders(selectedDate);
  }, [selectedDate]);

  /* ==========================================================
     PRODUCT TOGGLE
  ========================================================== */

  const toggleProduct = (index) => {
    setExpandedProduct((prev) => (prev === index ? null : index));
  };

  /* ==========================================================
     USER PROFILE
  ========================================================== */

  const openUserProfile = async (userId) => {
    if (!userId) {
      toast.error("User ID नहीं मिला");
      return;
    }

    try {
      setLoadingProfile(true);
      setSelectedUser(null);

      const res = await axios.get(
        `${API_BASE_URL}/api/v1/user/get-user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      if (res.data?.success) {
        setSelectedUser(res.data.user || res.data.data || null);
      } else {
        toast.error(res.data?.message || "User profile नहीं मिली");
      }
    } catch (error) {
      console.error("Get user profile error:", error);

      toast.error(error?.response?.data?.message || "User profile नहीं मिली");
    } finally {
      setLoadingProfile(false);
    }
  };

  /* ==========================================================
     CLOSE PROFILE
  ========================================================== */

  const closeProfile = () => {
    if (!loadingProfile) {
      setSelectedUser(null);
    }
  };

  /* ==========================================================
     USER DISPLAY NAME
  ========================================================== */

  const getUserDisplayName = (user) => {
    if (!user) return "Unknown User";

    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return (
      fullName ||
      user.userName ||
      user.name ||
      user.fullName ||
      user.shopName ||
      "Unknown User"
    );
  };

  /* ==========================================================
     UI
  ========================================================== */

  return (
    <div className="min-h-screen bg-emerald-50 pt-20 px-3 sm:px-4 pb-8 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="bg-emerald-600 text-white rounded-2xl shadow-lg px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <ChevronLeft
                onClick={() => navigate("/admin-dashboard")}
                size={22}
                className="shrink-0"
              />

              <h1 className="text-base sm:text-lg font-bold truncate">
                सभी ऑर्डर की table
              </h1>
            </div>

            <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
              {formatDate(selectedDate)}
            </span>
          </div>
        </div>

        {/* ====================================================
            DATE + PDF
        ==================================================== */}

        <div className="bg-white mt-3 rounded-2xl shadow-md p-3">
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border-2 border-gray-200 outline-none focus:border-emerald-500 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => downloadPDF(items, selectedDate)}
              disabled={!items.length || loading}
              className="h-10 px-4 flex items-center justify-center gap-2 bg-gray-800 text-white rounded-xl hover:bg-gray-900 disabled:opacity-40 text-sm font-semibold shrink-0"
            >
              <Download size={17} />

              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>

        {/* ====================================================
            SMALL SUMMARY CARDS
        ==================================================== */}

        {!loading && items.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {/* TOTAL ORDERS */}

            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium">
                  Total Orders
                </span>

                <span className="text-sm sm:text-base font-bold text-gray-800">
                  {getTotalOrders(items)}
                </span>
              </div>
            </div>

            {/* TOTAL AMOUNT */}

            <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium">
                  Total Amount
                </span>

                <span className="text-sm sm:text-base font-bold text-gray-800">
                  ₹{getTotalAmount(items).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            ORDER TABLE
        ==================================================== */}

        <div className="bg-white mt-3 rounded-2xl shadow-md overflow-hidden">
          <table className="w-full table-fixed border-collapse">
            {/* TABLE HEADER */}

            <thead>
              <tr className="bg-gray-50 border-b-2 border-gray-200">
                <th className="w-[7%] px-2 sm:px-3 py-3 text-left text-[11px] sm:text-xs font-bold text-gray-700">
                  #
                </th>

                <th className="w-[35%] px-2 sm:px-3 py-3 text-left text-[11px] sm:text-xs font-bold text-gray-700">
                  Product
                </th>

                <th className="w-[25%] px-2 sm:px-3 py-3 text-left text-[11px] sm:text-xs font-bold text-gray-700">
                  कंपनी
                </th>

                <th className="w-[18%] px-2 sm:px-3 py-3 text-left text-[11px] sm:text-xs font-bold text-gray-700">
                  माप
                </th>

                <th className="w-[15%] px-2 sm:px-3 py-3 text-center text-[11px] sm:text-xs font-bold text-gray-700">
                  मात्रा
                </th>
              </tr>
            </thead>

            {/* TABLE BODY */}

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2
                        size={30}
                        className="animate-spin text-emerald-600"
                      />

                      <p className="text-sm text-gray-500">
                        Orders लोड हो रहे हैं...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center">
                    <p className="text-sm font-semibold text-gray-600">
                      {formatDate(selectedDate)} के लिए कोई Approved Order नहीं
                      है।
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const isExpanded = expandedProduct === index;

                  return (
                    <React.Fragment
                      key={`${item.productId}-${item.companyId}-${item.measurement}`}
                    >
                      {/* PRODUCT ROW */}

                      <tr
                        onClick={() => toggleProduct(index)}
                        className={`border-b cursor-pointer transition ${
                          isExpanded ? "bg-emerald-50" : "hover:bg-emerald-50"
                        }`}
                      >
                        <td className="px-2 sm:px-3 py-3 text-xs text-gray-500">
                          {index + 1}
                        </td>

                        <td className="px-2 sm:px-3 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate">
                                {item.productName || "-"}
                              </p>

                              {item.hinglishName && (
                                <p className="text-[10px] sm:text-xs text-gray-400 truncate">
                                  {item.hinglishName}
                                </p>
                              )}
                            </div>

                            <ChevronDown
                              size={16}
                              className={`shrink-0 text-gray-500 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </div>
                        </td>

                        <td className="px-2 sm:px-3 py-3">
                          <p className="text-xs sm:text-sm text-gray-700 truncate">
                            {item.companyName || "-"}
                          </p>
                        </td>

                        <td className="px-2 sm:px-3 py-3">
                          <p className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                            {item.measurement || "-"}
                          </p>
                        </td>

                        <td className="px-2 sm:px-3 py-3 text-center">
                          <span className="inline-flex items-center justify-center min-w-8 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                            {item.totalQuantity || 0}
                          </span>
                        </td>
                      </tr>

                      {/* EXPANDED USER DETAILS */}

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan="5"
                            className="bg-emerald-50 px-3 sm:px-5 py-4"
                          >
                            <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden shadow-sm">
                              {item.orderedBy?.length > 0 ? (
                                item.orderedBy.map((user, userIndex) => (
                                  <div
                                    key={user.userId || userIndex}
                                    className="flex items-center justify-between gap-3 px-3 py-3 border-b last:border-b-0"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        {user.profilePic ? (
                                          <img
                                            src={user.profilePic}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover"
                                          />
                                        ) : (
                                          <User
                                            size={16}
                                            className="text-emerald-600"
                                          />
                                        )}
                                      </div>

                                      <div className="min-w-0">
                                        <p className="font-semibold text-gray-800 text-sm truncate">
                                          {getUserDisplayName(user)}
                                        </p>

                                        <p className="text-[11px] text-gray-400">
                                          Ordered
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                      <span className="font-bold text-emerald-700 text-sm">
                                        × {user.quantity || 0}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();

                                          openUserProfile(user.userId);
                                        }}
                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                                      >
                                        Profile
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-4 text-center text-sm text-gray-500">
                                  User details उपलब्ध नहीं हैं।
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          PROFILE MODAL
      ======================================================== */}

      {(selectedUser || loadingProfile) && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={closeProfile}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}

            <div className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between">
              <h2 className="font-bold">User Profile</h2>

              <button
                type="button"
                onClick={closeProfile}
                disabled={loadingProfile}
                className="p-1 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* LOADING */}

            {loadingProfile ? (
              <div className="py-12 flex justify-center">
                <Loader2 size={32} className="animate-spin text-emerald-600" />
              </div>
            ) : selectedUser ? (
              <div className="p-5 space-y-4">
                {/* PROFILE IMAGE */}

                <div className="flex justify-center">
                  {selectedUser.profilePic ? (
                    <img
                      src={selectedUser.profilePic}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-emerald-200"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
                      <User size={35} className="text-emerald-600" />
                    </div>
                  )}
                </div>

                {/* NAME */}

                <div className="text-center">
                  <h3 className="text-lg font-bold text-gray-800">
                    {getUserDisplayName(selectedUser)}
                  </h3>
                </div>

                {/* DETAILS */}

                <div className="space-y-2">
                  {selectedUser.phoneNumber && (
                    <div className="flex justify-between gap-3 border-b pb-2">
                      <span className="text-sm text-gray-500">Phone</span>

                      <span className="text-sm font-semibold text-gray-800">
                        {selectedUser.phoneNumber}
                      </span>
                    </div>
                  )}

                  {selectedUser.email && (
                    <div className="flex justify-between gap-3 border-b pb-2">
                      <span className="text-sm text-gray-500">Email</span>

                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {selectedUser.email}
                      </span>
                    </div>
                  )}

                  {selectedUser.address && (
                    <div className="border-b pb-2">
                      <p className="text-sm text-gray-500 mb-1">Address</p>

                      <p className="text-sm font-semibold text-gray-800">
                        {selectedUser.address}
                      </p>
                    </div>
                  )}

                  {selectedUser.shopName && (
                    <div className="flex justify-between gap-3 border-b pb-2">
                      <span className="text-sm text-gray-500">Shop</span>

                      <span className="text-sm font-semibold text-gray-800">
                        {selectedUser.shopName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyOrders;
