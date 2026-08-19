import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";

import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Home,
  MapPinned,
  ShieldCheck,
  ShieldX,
  CalendarDays,
  ShoppingBag,
  Package,
  BadgeIndianRupee,
  Clock3,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  Ban,
  RefreshCw,
  IndianRupee,
  ChevronRight,
} from "lucide-react";

const AdminUserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);

  // IMPORTANT:
  // allOrders = lifetime orders, used ONLY for lifetime stats
  const [allOrders, setAllOrders] = useState([]);

  // selectedDayOrders = ONLY selected calendar day's orders
  const [selectedDayOrders, setSelectedDayOrders] = useState([]);

  const [loading, setLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  });

  const token = localStorage.getItem("token");

  // =========================================================
  // STATUS CONFIG
  // =========================================================

  const statusConfig = {
    Pending: {
      label: "पेंडिंग",
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: Clock3,
    },

    Approved: {
      label: "स्वीकृत",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    },

    Preparing: {
      label: "तैयार हो रहा है",
      className: "bg-sky-50 text-sky-700 border-sky-200",
      icon: Package,
    },

    "Out For Delivery": {
      label: "रास्ते में",
      className: "bg-blue-50 text-blue-700 border-blue-200",
      icon: Truck,
    },

    Delivered: {
      label: "डिलीवर हो गया",
      className: "bg-green-50 text-green-700 border-green-200",
      icon: PackageCheck,
    },

    Cancelled: {
      label: "रद्द",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: Ban,
    },

    Declined: {
      label: "नामंजूर",
      className: "bg-red-50 text-red-700 border-red-200",
      icon: XCircle,
    },
  };

  // =========================================================
  // DATE HELPERS
  // =========================================================

  const getDateKey = (date) => {
    if (!date) return "";

    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(date));
    } catch {
      return "";
    }
  };

  const formatDate = (date) => {
    if (!date) return "--";

    try {
      return new Date(date).toLocaleDateString("hi-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "--";
    }
  };

  const formatDateTime = (date) => {
    if (!date) return "--";

    try {
      return new Date(date).toLocaleString("hi-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "--";
    }
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  const getSelectedDateLabel = () => {
    if (!selectedDate) return "तारीख चुनें";

    try {
      return new Date(`${selectedDate}T00:00:00`).toLocaleDateString("hi-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  };

  const getFullName = (person) => {
    return [person?.firstName, person?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  };

  // =========================================================
  // FETCH USER
  // =========================================================

  const fetchUser = useCallback(async () => {
    if (!token || !userId) return;

    try {
      setLoading(true);

      const res = await axios.get(
        `${API_BASE_URL}/api/v1/user/get-user/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data?.success) {
        setUser(res.data.user || null);
      }
    } catch (error) {
      console.error("Fetch user error:", error);

      toast.error(
        error?.response?.data?.message || "खरीदार की जानकारी लोड नहीं हो पाई।",
      );
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  // =========================================================
  // FETCH ALL ORDERS
  //
  // This is ONLY for lifetime stats.
  // These orders are NEVER directly rendered.
  // =========================================================

  const fetchAllOrders = useCallback(async () => {
    if (!token || !userId) return;

    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/v1/order/user-orders/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data?.success) {
        setAllOrders(Array.isArray(res.data.orders) ? res.data.orders : []);
      } else {
        setAllOrders([]);
      }
    } catch (error) {
      console.error("Fetch all orders error:", error);

      setAllOrders([]);

      toast.error(
        error?.response?.data?.message ||
          "खरीदार के पुराने ऑर्डर लोड नहीं हो पाए।",
      );
    }
  }, [token, userId]);

  // =========================================================
  // FETCH SELECTED DAY
  // =========================================================

  const fetchSelectedDayOrders = useCallback(async () => {
    if (!token || !userId || !selectedDate) return;

    try {
      setOrdersLoading(true);

      const res = await axios.get(
        `${API_BASE_URL}/api/v1/order/user-orders/${userId}`,
        {
          params: {
            date: selectedDate,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const fetchedOrders = Array.isArray(res.data?.orders)
        ? res.data.orders
        : [];

      /*
       * IMPORTANT SAFETY FILTER
       *
       * Even if backend accidentally returns multiple dates,
       * ONLY selectedDate is allowed into the history UI.
       */

      const exactDayOrders = fetchedOrders.filter(
        (order) => getDateKey(order?.createdAt) === selectedDate,
      );

      setSelectedDayOrders(exactDayOrders);
    } catch (error) {
      console.error("Fetch selected day orders error:", error);

      setSelectedDayOrders([]);

      toast.error(
        error?.response?.data?.message || "इस तारीख के ऑर्डर लोड नहीं हो पाए।",
      );
    } finally {
      setOrdersLoading(false);
    }
  }, [token, userId, selectedDate]);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    fetchUser();
    fetchAllOrders();
  }, [fetchUser, fetchAllOrders]);

  // =========================================================
  // SELECTED DATE LOAD
  // =========================================================

  useEffect(() => {
    fetchSelectedDayOrders();
  }, [fetchSelectedDayOrders]);

  // =========================================================
  // UPDATE STATUS
  // =========================================================

  const handleStatusChange = async (orderId, status) => {
    if (!token || !orderId) return;

    try {
      setUpdatingOrderId(orderId);

      const res = await axios.put(
        `${API_BASE_URL}/api/v1/order/update-status/${orderId}`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data?.success) {
        const updatedOrder = res.data.order;

        // Update selected-day UI only if this order belongs to selected day
        setSelectedDayOrders((prev) =>
          prev.map((order) => (order._id === orderId ? updatedOrder : order)),
        );

        // Also update lifetime copy for correct lifetime stats
        setAllOrders((prev) =>
          prev.map((order) => (order._id === orderId ? updatedOrder : order)),
        );

        toast.success(
          status === "Approved"
            ? "ऑर्डर approve हो गया"
            : "ऑर्डर reject हो गया",
        );
      }
    } catch (error) {
      console.error("Update status error:", error);

      toast.error(
        error?.response?.data?.message ||
          "ऑर्डर का status update नहीं हो पाया।",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // =========================================================
  // LIFETIME STATS
  //
  // NEVER use selectedDayOrders here.
  // =========================================================

  const lifetimeStats = useMemo(() => {
    const totalOrders = allOrders.length;

    const totalSpent = allOrders.reduce(
      (sum, order) => sum + Number(order?.totalAmount || 0),
      0,
    );

    /*
     * THIS IS THE CORRECT PAISA BAKI
     *
     * It comes from ALL orders of this customer,
     * not from the selected date.
     */

    const paisaBaki = allOrders.reduce((sum, order) => {
      const paymentStatus = String(order?.paymentStatus || "").toLowerCase();

      const isUnpaid =
        paymentStatus === "pending" ||
        paymentStatus === "unpaid" ||
        paymentStatus === "due";

      if (isUnpaid) {
        return sum + Number(order?.totalAmount || 0);
      }

      return sum;
    }, 0);

    const averageOrder =
      totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;

    return {
      totalOrders,
      totalSpent,
      paisaBaki,
      averageOrder,
    };
  }, [allOrders]);

  // =========================================================
  // SELECTED DAY STATS
  // =========================================================

  const selectedDayStats = useMemo(() => {
    const total = selectedDayOrders.reduce(
      (sum, order) => sum + Number(order?.totalAmount || 0),
      0,
    );

    return {
      count: selectedDayOrders.length,
      total,
    };
  }, [selectedDayOrders]);

  // =========================================================
  // PAYMENT
  // =========================================================

  const getPaymentStatus = (order) => {
    const status = String(order?.paymentStatus || "").toLowerCase();

    if (status === "pending" || status === "unpaid" || status === "due") {
      return {
        label: "पैसा बाकी",
        className: "bg-red-50 text-red-700 border-red-200",
      };
    }

    if (status === "paid" || status === "completed" || status === "success") {
      return {
        label: "पैसा मिल गया",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }

    return {
      label: order?.paymentStatus || "COD",
      className: "bg-gray-50 text-gray-600 border-gray-200",
    };
  };

  // =========================================================
  // ITEM COUNT
  // =========================================================

  const getItemCount = (order) => {
    if (!Array.isArray(order?.items)) return 0;

    return order.items.reduce(
      (total, item) => total + Number(item?.qty || 0),
      0,
    );
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 pb-10 pt-20">
        <div className="mx-auto max-w-6xl">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-700 shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            पीछे
          </button>

          <div className="flex min-h-[400px] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />

              <p className="mt-4 font-bold text-gray-700">
                खरीदार की जानकारी लोड हो रही है...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // PAGE
  // =========================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-gray-50 to-white px-3 pb-30 pt-20 sm:px-5">
      <div className="mx-auto max-w-6xl">
        {/* =====================================================
            BACK
        ====================================================== */}

        <button
          onClick={() => navigate(-1)}
          className="mb-3 flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-emerald-50"
        >
          <ArrowLeft className="h-4 w-4" />
          पीछे
        </button>

        {/* =====================================================
            PROFILE HERO
        ====================================================== */}

        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500 px-5 py-6 text-white sm:px-7">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />

            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {user?.profilePic ? (
                  <img
                    src={user.profilePic}
                    alt={getFullName(user)}
                    className="h-20 w-20 shrink-0 rounded-2xl border-2 border-white/40 object-cover shadow-lg sm:h-24 sm:w-24"
                  />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 shadow-lg sm:h-24 sm:w-24">
                    <User className="h-10 w-10 sm:h-12 sm:w-12" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-xs font-bold text-emerald-100">
                    खरीदार प्रोफाइल
                  </p>

                  <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">
                    {getFullName(user) || "Unknown User"}
                  </h1>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {user?.phoneNumber && (
                      <a
                        href={`tel:${user.phoneNumber}`}
                        className="flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-black shadow-sm transition hover:bg-red-700 active:scale-95"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-red-600">
                          <Phone className="h-3.5 w-3.5" />
                        </span>

                        {user.phoneNumber}
                      </a>
                    )}

                    <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold">
                      <MapPin className="h-3.5 w-3.5" />
                      {user?.place || "स्थान नहीं"}
                    </span>

                    <span className="flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold">
                      {user?.isVerified ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldX className="h-3.5 w-3.5" />
                      )}

                      {user?.isVerified ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur">
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-100">
                  <CalendarDays className="h-4 w-4" />
                  ग्राहक बने
                </p>

                <p className="mt-1 font-black">{formatDate(user?.createdAt)}</p>
              </div>
            </div>
          </div>

          {/* ===================================================
              LIFETIME STATS
          ==================================================== */}

          <div className="grid grid-cols-2 divide-x divide-y sm:grid-cols-4 sm:divide-y-0">
            <div className="p-4">
              <p className="text-xs font-bold text-gray-500">कुल ऑर्डर</p>

              <p className="mt-1 text-2xl font-black text-gray-900">
                {lifetimeStats.totalOrders}
              </p>

              <p className="text-[10px] font-semibold text-gray-400">अब तक</p>
            </div>

            <div className="p-4">
              <p className="text-xs font-bold text-gray-500">कुल खर्च</p>

              <p className="mt-1 text-2xl font-black text-gray-900">
                {formatCurrency(lifetimeStats.totalSpent)}
              </p>

              <p className="text-[10px] font-semibold text-gray-400">अब तक</p>
            </div>

            <div className="p-4">
              <p className="flex items-center gap-1 text-xs font-bold text-red-600">
                <IndianRupee className="h-3.5 w-3.5" />
                पैसा बाकी
              </p>

              <p
                className={`mt-1 text-2xl font-black ${
                  lifetimeStats.paisaBaki > 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {formatCurrency(lifetimeStats.paisaBaki)}
              </p>

              <p className="text-[10px] font-semibold text-gray-400">
                पूरे हिसाब का
              </p>
            </div>

            <div className="p-4">
              <p className="text-xs font-bold text-gray-500">औसत ऑर्डर</p>

              <p className="mt-1 text-2xl font-black text-gray-900">
                {formatCurrency(lifetimeStats.averageOrder)}
              </p>

              <p className="text-[10px] font-semibold text-gray-400">
                प्रति ऑर्डर
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            BASIC DETAILS
        ====================================================== */}

        <section className="mt-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-black text-gray-900">
              खरीदार की जानकारी
            </h2>

            <p className="text-xs font-medium text-gray-400">Basic details</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Home className="h-4 w-4" />
                <span className="text-xs font-bold">पता</span>
              </div>

              <p className="mt-1.5 text-sm font-bold text-gray-800">
                {user?.address || "पता नहीं दिया गया"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-500">
                <MapPinned className="h-4 w-4" />
                <span className="text-xs font-bold">पिन कोड</span>
              </div>

              <p className="mt-1.5 text-sm font-bold text-gray-800">
                {user?.zipCode || "N/A"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-500">
                <MapPin className="h-4 w-4" />
                <span className="text-xs font-bold">स्थान</span>
              </div>

              <p className="mt-1.5 text-sm font-bold text-gray-800">
                {user?.place || "स्थान नहीं"}
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Clock3 className="h-4 w-4" />
                <span className="text-xs font-bold">आखिरी अपडेट</span>
              </div>

              <p className="mt-1.5 text-sm font-bold text-gray-800">
                {formatDateTime(user?.updatedAt)}
              </p>
            </div>
          </div>
        </section>

        {/* =====================================================
            ONE DAY ORDER HISTORY
        ====================================================== */}

        <section className="mt-3 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {/* HEADER */}

          <div className="border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <ShoppingBag className="h-5 w-5" />
                  </div>

                  <h2 className="text-xl font-black text-gray-900">
                    ऑर्डर हिस्ट्री
                  </h2>
                </div>

                <p className="mt-1 text-xs font-medium text-gray-400">
                  एक समय में सिर्फ चुने हुए दिन के ऑर्डर
                </p>
              </div>

              {/* CALENDAR */}

              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="
                    h-11
                    w-full
                    rounded-xl
                    border
                    border-gray-200
                    bg-gray-50
                    pl-10
                    pr-3
                    text-sm
                    font-black
                    text-gray-800
                    outline-none
                    transition
                    focus:border-emerald-400
                    focus:bg-white
                    focus:ring-4
                    focus:ring-emerald-50
                    sm:w-[210px]
                  "
                />
              </div>
            </div>

            {/* SELECTED DAY SUMMARY */}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                <CalendarDays className="h-3.5 w-3.5" />
                {getSelectedDateLabel()}
              </div>

              <div className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-600">
                {selectedDayStats.count} ऑर्डर
              </div>

              <div className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">
                दिन का कुल {formatCurrency(selectedDayStats.total)}
              </div>

              <button
                type="button"
                onClick={fetchSelectedDayOrders}
                disabled={ordersLoading}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    ordersLoading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* ===================================================
              ORDERS
          ==================================================== */}

          <div className="p-4 sm:p-5">
            {ordersLoading ? (
              <div className="flex min-h-[260px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-gray-200 border-t-emerald-600" />

                  <p className="mt-3 text-sm font-bold text-gray-600">
                    {getSelectedDateLabel()} के ऑर्डर लोड हो रहे हैं...
                  </p>
                </div>
              </div>
            ) : selectedDayOrders.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-5 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                  <Package className="h-8 w-8 text-gray-300" />
                </div>

                <h3 className="mt-4 text-lg font-black text-gray-800">
                  इस दिन कोई ऑर्डर नहीं
                </h3>

                <p className="mt-1 max-w-sm text-sm text-gray-400">
                  {getSelectedDateLabel()} को इस खरीदार का कोई ऑर्डर नहीं मिला।
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayOrders.map((order, index) => {
                  const config =
                    statusConfig[order?.status] || statusConfig.Pending;

                  const StatusIcon = config.icon;

                  const payment = getPaymentStatus(order);

                  const items = Array.isArray(order?.items) ? order.items : [];

                  return (
                    <div
                      key={order?._id || index}
                      className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-emerald-200 hover:shadow-md"
                    >
                      {/* ORDER HEADER */}

                      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">
                            #{index + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-black text-gray-900">
                                #{order?._id?.slice(-6)?.toUpperCase()}
                              </h3>

                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${config.className}`}
                              >
                                <StatusIcon className="h-3 w-3" />
                                {config.label}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-gray-400">
                              {formatDateTime(order?.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${payment.className}`}
                          >
                            {payment.label}
                          </span>

                          <div className="rounded-xl bg-emerald-50 px-3 py-2">
                            <p className="text-base font-black text-emerald-700">
                              {formatCurrency(order?.totalAmount)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* ORDER META */}

                      <div className="flex flex-wrap gap-2 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
                        <span className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 shadow-sm">
                          <Package className="h-3.5 w-3.5 text-blue-500" />
                          {items.length} Products
                        </span>

                        <span className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 shadow-sm">
                          <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                          {getItemCount(order)} Items
                        </span>

                        <span className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-gray-600 shadow-sm">
                          <BadgeIndianRupee className="h-3.5 w-3.5 text-amber-500" />
                          {order?.paymentMethod || "COD"}
                        </span>
                      </div>

                      {/* PRODUCTS */}

                      <div className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-black text-gray-800">
                            सामान
                          </h4>

                          <span className="text-xs font-bold text-gray-400">
                            {items.length} products
                          </span>
                        </div>

                        {items.length === 0 ? (
                          <div className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-400">
                            इस ऑर्डर में कोई सामान नहीं मिला।
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item, itemIndex) => (
                              <div
                                key={item?._id || `${order?._id}-${itemIndex}`}
                                className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-black text-gray-500">
                                    {itemIndex + 1}
                                  </div>

                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-gray-800">
                                      {item?.companyName || "Company"}
                                    </p>

                                    <p className="truncate text-xs text-gray-500">
                                      {item?.name ||
                                        item?.hinglishName ||
                                        "Product"}
                                    </p>

                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                      {item?.measurement && (
                                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                                          {item.measurement}
                                        </span>
                                      )}

                                      <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500">
                                        Qty × {item?.qty || 0}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-black text-gray-900">
                                    {formatCurrency(item?.total)}
                                  </p>

                                  {item?.price != null && (
                                    <p className="mt-0.5 text-[10px] text-gray-400">
                                      {formatCurrency(item.price)} / unit
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ADDRESS */}

                      {order?.shippingAddress && (
                        <div className="border-t border-gray-100 px-4 py-3">
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />

                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                                Delivery Address
                              </p>

                              <p className="mt-0.5 text-xs font-semibold text-gray-600">
                                {order.shippingAddress}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ACTIONS */}

                      {order?.status === "Pending" && (
                        <div className="flex gap-2 border-t border-gray-100 bg-gray-50 p-3">
                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(order._id, "Approved")
                            }
                            disabled={updatingOrderId === order._id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-4 w-4" />

                            {updatingOrderId === order._id
                              ? "अपडेट हो रहा है..."
                              : "Approve करें"}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleStatusChange(order._id, "Declined")
                            }
                            disabled={updatingOrderId === order._id}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminUserProfile;
