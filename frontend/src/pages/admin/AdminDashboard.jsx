import Features from "@/components/Features";
import Hero from "@/components/Hero";
import AdminNotificationPanel from "@/components/AdminNotificationPanel";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
  Loader2,
  Package,
  Plus,
  Save,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { productData = [] } = useSelector((state) => state.product);
  const { supplierData } = useSelector((state) => state.user);

  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  const [loadingStats, setLoadingStats] = useState(false);

  const [cutoffTime, setCutoffTime] = useState("11:00");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  // Live time
  const [now, setNow] = useState(new Date());

  /* =========================================================
     LIVE CLOCK
  ========================================================= */

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* =========================================================
     FETCH DASHBOARD DATA
  ========================================================= */

  useEffect(() => {
    if (!supplierData) return;

    const fetchDashboard = async () => {
      const token = localStorage.getItem("token");

      if (!token) return;

      try {
        setLoadingStats(true);
        setSettingsLoading(true);

        const [ordersRes, usersRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/order/all-orders`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          fetch(`${API_BASE_URL}/api/v1/user/all-user`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),

          axios.get(`${API_BASE_URL}/api/v1/settings/app-settings`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const ordersData = await ordersRes.json();
        const usersData = await usersRes.json();

        if (ordersData.success) {
          setTodayOrdersCount(ordersData.orders?.length || 0);
        }

        if (usersData.success) {
          setUserCount(usersData.users?.length || 0);
        }

        if (settingsRes.data.success) {
          setCutoffTime(settingsRes.data.settings?.dailyOrderCutoff || "11:00");
        }
      } catch (error) {
        console.warn("Dashboard error:", error);
      } finally {
        setLoadingStats(false);
        setSettingsLoading(false);
      }
    };

    fetchDashboard();
  }, [supplierData]);

  /* =========================================================
     ORDER WINDOW CALCULATION

     Before cutoff:
       🟢 Store Open

     At / after cutoff:
       🟠 Store Closed
  ========================================================= */

  const orderWindow = useMemo(() => {
    const [cutoffHour, cutoffMinute] = cutoffTime.split(":").map(Number);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();

    // Convert current time to minutes including seconds
    const currentTotal = currentHour * 60 + currentMinute + currentSecond / 60;

    // Convert cutoff to minutes
    const cutoffTotal = cutoffHour * 60 + cutoffMinute;

    /*
      We start the visual order window at 6 AM.
      Example:

      6:00 AM  → 0%
      8:00 AM  → some progress
      10:00 AM → more progress
      11:00 AM → 100%
    */

    const startOfWindow = 6 * 60;

    const totalWindow = cutoffTotal - startOfWindow;

    let progress = 0;

    if (totalWindow > 0) {
      progress = ((currentTotal - startOfWindow) / totalWindow) * 100;
    }

    progress = Math.min(100, Math.max(0, progress));

    /*
      IMPORTANT:
      Store remains open ONLY while current time
      is strictly before cutoff.

      10:59:59 → open
      11:00:00 → closed
    */

    const remaining = cutoffTotal - currentTotal;

    const isOpen = currentTotal < cutoffTotal;

    let remainingText = "";

    if (!isOpen) {
      remainingText = "आज की विंडो बंद है";
    } else if (remaining < 1) {
      remainingText = "कुछ ही सेकंड बाकी";
    } else if (remaining < 60) {
      remainingText = `${Math.ceil(remaining)} मिनट बाकी`;
    } else {
      const hours = Math.floor(remaining / 60);
      const minutes = Math.floor(remaining % 60);

      if (minutes === 0) {
        remainingText = `${hours} घंटे बाकी`;
      } else {
        remainingText = `${hours} घंटे ${minutes} मिनट बाकी`;
      }
    }

    const currentFormatted = now.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffHour, cutoffMinute, 0, 0);

    const cutoffFormatted = cutoffDate.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return {
      progress,
      remaining,
      isOpen,
      remainingText,
      currentFormatted,
      cutoffFormatted,
    };
  }, [now, cutoffTime]);

  /* =========================================================
     SAVE CUTOFF
  ========================================================= */

  const saveCutoffTime = async () => {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      setSavingSettings(true);
      setSettingsMessage("");

      const res = await axios.put(
        `${API_BASE_URL}/api/v1/settings/app-settings/dailyOrderCutoff`,
        {
          value: cutoffTime,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        setSettingsMessage("कटऑफ समय सेव हो गया");
      }
    } catch (error) {
      console.warn("Cutoff save error:", error);

      setSettingsMessage("कटऑफ समय सेव नहीं हुआ");
    } finally {
      setSavingSettings(false);
    }
  };

  /* =========================================================
     NOT LOGGED IN
  ========================================================= */

  if (!supplierData) {
    return (
      <>
        <Hero />
        <Features />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f6] pt-16">
      <main className="mx-auto max-w-6xl px-3 pb-32 pt-4 sm:px-5 sm:pt-6 lg:px-6">
        {/* =====================================================
            HERO
        ===================================================== */}

        <section
          className="
            relative
            h-[170px]
            overflow-hidden
            rounded-[32px]
            border
            border-emerald-100
            bg-[#e8f8f0]
            shadow-[0_12px_40px_rgba(15,23,42,0.06)]
            sm:h-[245px]
          "
        >
          {/* Background decoration */}

          <div
            className="
              absolute
              -right-16
              -top-20
              h-64
              w-64
              rounded-full
              bg-emerald-300/20
              blur-3xl
            "
          />

          <div
            className="
              absolute
              -bottom-28
              left-1/3
              h-64
              w-64
              rounded-full
              bg-white/70
              blur-3xl
            "
          />

          <div className="absolute right-[42%] top-8 hidden h-2 w-2 rounded-full bg-emerald-300 sm:block" />

          <div className="absolute right-[38%] top-14 hidden h-1.5 w-1.5 rounded-full bg-emerald-200 sm:block" />

          {/* Hero content */}

          <div className="absolute left-5 top-5 z-20 sm:left-8 sm:top-7">
            <h1
              className="
                mt-5
                text-[34px]
                font-black
                leading-none
                tracking-[-0.04em]
                text-slate-900
                sm:text-[46px]
              "
            >
              नमस्ते 🙏
            </h1>

            <p className="mt-2 w-[180px] text-[10px] font-medium text-slate-500">
              E-setu सप्लायर डैशबोर्ड में आपका स्वागत है।
            </p>

            {/* STORE STATUS */}

            <div
              className="
                mt-5
                flex
                w-fit
                items-center
                gap-2
                rounded-full
                bg-white/90
                px-3
                py-1.5
                shadow-sm
                transition-all
                duration-300
              "
            >
              <span className="relative flex h-2 w-2">
                {orderWindow.isOpen && (
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                )}

                <span
                  className={`
                    relative
                    h-2
                    w-2
                    rounded-full
                    transition-colors
                    duration-300
                    ${orderWindow.isOpen ? "bg-emerald-500" : "bg-orange-500"}
                  `}
                />
              </span>

              <span
                className={`
                  text-[10px]
                  font-bold
                  transition-colors
                  duration-300
                  ${orderWindow.isOpen ? "text-emerald-700" : "text-orange-700"}
                `}
              >
                {orderWindow.isOpen ? "स्टोर चालू" : "स्टोर बंद"}
              </span>
            </div>
          </div>

          {/* Character */}

          <div
            className="
              absolute
              bottom-[-15px]
              right-[-18px]
              z-10
              h-[190px]
              w-[215px]
              sm:bottom-[-28px]
              sm:right-4
              sm:h-[285px]
              sm:w-[325px]
            "
          >
            <img
              src="/sideHands.png"
              alt="e-Setu character"
              className="
                h-full
                w-full
                object-contain
                object-bottom
                drop-shadow-[0_18px_18px_rgba(15,118,110,0.12)]
                transition-transform
                duration-500
                hover:-translate-y-1
              "
            />
          </div>
        </section>

        {/* =====================================================
            2 × 2 STATS
        ===================================================== */}

        <section className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
          {/* ==================== ORDERS ==================== */}
          <button
            onClick={() => navigate("/today-orders")}
            className="
      group relative min-h-[150px] overflow-hidden rounded-[28px]
      bg-emerald-500  text-left
      shadow-[0_12px_28px_rgba(16,185,129,0.18)]
      transition-all duration-200 p-2 flex items-center flex-col
      hover:-translate-y-1 hover:bg-emerald-600
      active:scale-[0.98]
      sm:min-h-[195px] pt-4
    "
          >
            <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-white/10" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/15 px-2 py-1.5 text-white shadow-lg backdrop-blur-md">
                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/10">
                  <ShoppingBag className="h-3 w-3" />
                </div>

                <p className="text-xs font-bold text-white/90">आज के ऑर्डर</p>

                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white/10">
                  <ArrowUpRight className="h-4 w-4 text-white/80 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-5">
              {loadingStats ? (
                <Loader2 className="h-9 w-9 animate-spin text-white" />
              ) : (
                <span className="text-[44px] font-black leading-none tracking-tight text-white">
                  {todayOrdersCount}
                </span>
              )}
            </div>
          </button>

          {/* ==================== USERS ==================== */}
          <button
            onClick={() => navigate("/admin-users")}
            className="
      group relative min-h-[150px] overflow-hidden rounded-[28px]
      bg-white p-4 text-left
      border border-slate-200
      shadow-[0_6px_22px_rgba(15,23,42,0.045)]
      transition-all duration-200  p-2 flex items-center flex-col
      hover:-translate-y-1
      hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]
      active:scale-[0.98]
      sm:min-h-[195px] sm:p-5
    "
          >
            <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-slate-50" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700 shadow-sm">
                <div className="flex h-5 w-5 items-center justify-center rounded-xl bg-white">
                  <Users className="h-4 w-4 text-slate-600" />
                </div>

                <p className="text-xs font-bold text-slate-600">कुल खरीददार</p>

                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white">
                  <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-5">
              {loadingStats ? (
                <Loader2 className="h-9 w-9 animate-spin text-slate-300" />
              ) : (
                <span className="text-[44px] font-black leading-none tracking-tight text-slate-900">
                  {userCount}
                </span>
              )}
            </div>
          </button>

          {/* ==================== PRODUCTS ==================== */}
          <button
            onClick={() => navigate("/product-page")}
            className="
      group relative min-h-[150px] overflow-hidden rounded-[28px]
      bg-white p-4 text-left
      border border-slate-200
      shadow-[0_6px_22px_rgba(15,23,42,0.045)]
      transition-all duration-200  p-2 flex items-center flex-col
      hover:-translate-y-1
      hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]
      active:scale-[0.98]
      sm:min-h-[195px] sm:p-5
    "
          >
            <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-orange-50" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-2 py-1.5 text-orange-600 shadow-sm">
                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white">
                  <Package className="h-4 w-4 text-orange-500" />
                </div>

                <p className="text-xs font-bold text-orange-600">कुल उत्पाद</p>

                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
                  <ArrowUpRight className="h-4 w-4 text-orange-400 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-5">
              <span className="text-[44px] font-black leading-none tracking-tight text-slate-900">
                {productData.length}
              </span>
            </div>
          </button>

          {/* ==================== CUTOFF ==================== */}
          <div
            className="
      relative min-h-[150px] overflow-hidden rounded-[28px]
      border border-emerald-100
      bg-gradient-to-br from-white to-emerald-50
      p-4
      shadow-[0_6px_22px_rgba(15,23,42,0.045)]
      sm:min-h-[195px] sm:p-5  p-2 flex items-center flex-col
    "
          >
            <div className="absolute -bottom-20 -right-16 h-48 w-48 rounded-full bg-emerald-100/40" />

            <div className="relative z-10 flex items-start justify-between">
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700 shadow-sm">
                <div className="flex h-5 w-5 items-center justify-center rounded-xl bg-white">
                  <Clock3 className="h-3 w-3 text-emerald-600" />
                </div>

                <p className="text-xs font-bold text-emerald-700">ऑर्डर कटऑफ</p>

                <div className="flex h-6 w-6 items-center justify-center rounded-xl bg-white">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-5 flex items-end justify-between">
              <p className="text-[30px] font-black leading-none tracking-tight text-emerald-700">
                {orderWindow.cutoffFormatted}
              </p>
            </div>
            <span
              className={`
          rounded-full px-2.5 py-1 absolute bottom-3 right-3
          text-[9px] font-black
          ${
            orderWindow.isOpen
              ? "bg-emerald-100 text-emerald-700"
              : "bg-orange-100 text-orange-700"
          }
        `}
            >
              {orderWindow.isOpen ? "चालू" : "बंद"}
            </span>
          </div>
        </section>

        {/* =====================================================
            ORDER WINDOW
        ===================================================== */}

        <section
          className="
            mt-4
            overflow-hidden
            rounded-[30px]
            border
            border-slate-200
            bg-white
            shadow-[0_8px_28px_rgba(15,23,42,0.05)]
          "
        >
          {/* HEADER */}

          <div className="flex items-center justify-between px-5 pt-5 sm:px-7 sm:pt-7">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`
                    h-2
                    w-2
                    rounded-full
                    ${orderWindow.isOpen ? "bg-emerald-500" : "bg-orange-500"}
                  `}
                />

                <span
                  className={`
                    text-[10px]
                    font-black
                    uppercase
                    tracking-[0.16em]
                    ${
                      orderWindow.isOpen
                        ? "text-emerald-600"
                        : "text-orange-600"
                    }
                  `}
                >
                  {orderWindow.isOpen ? "ऑर्डर चालू" : "ऑर्डर बंद"}
                </span>
              </div>

              <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                ऑर्डर विंडो
              </h2>
            </div>

            <div className="hidden rounded-2xl bg-slate-50 px-3 py-2 text-right sm:block">
              <p className="text-[9px] font-medium text-slate-400">अभी</p>

              <p className="text-sm font-black text-slate-900">
                {orderWindow.currentFormatted}
              </p>
            </div>
          </div>
          {/* TIMELINE */}

          <div className="px-5 pb-1 pt-8 sm:px-7">
            <div className="relative h-4 rounded-full bg-slate-100">
              <div
                className={`
                  absolute
                  left-0
                  top-0
                  h-4
                  rounded-full
                  transition-all
                  duration-700
                  ${orderWindow.isOpen ? "bg-emerald-500" : "bg-orange-400"}
                `}
                style={{
                  width: `${orderWindow.progress}%`,
                }}
              />

              <div
                className={`
                  absolute
                  top-1/2
                  h-7
                  w-7
                  -translate-y-1/2
                  rounded-full
                  border-[5px]
                  border-white
                  shadow-[0_3px_12px_rgba(16,185,129,0.3)]
                  transition-all
                  duration-700
                  ${orderWindow.isOpen ? "bg-emerald-600" : "bg-orange-500"}
                `}
                style={{
                  left: `calc(${orderWindow.progress}% - 14px)`,
                }}
              />
            </div>

            <div className="mt-3 flex justify-between">
              <span className="text-[10px] font-medium text-slate-400">
                रात 12 बजे से
              </span>

              <span
                className={`
                  text-[11px]
                  font-black
                  ${orderWindow.isOpen ? "text-emerald-600" : "text-orange-600"}
                `}
              >
                {orderWindow.cutoffFormatted}
              </span>
            </div>
          </div>

          {/* STATUS */}

          <div className="px-5 pb-5 pt-6 sm:px-7 sm:pb-7">
            <div
              className={`
                flex
                items-center
                justify-between
                rounded-[22px]
                px-4
                py-4
                ${orderWindow.isOpen ? "bg-emerald-50" : "bg-orange-50"}
              `}
            >
              <div>
                <p className="text-[10px] font-semibold text-slate-400">
                  ऑर्डर की स्थिति
                </p>

                <p
                  className={`
                    mt-1
                    text-lg
                    font-black
                    ${
                      orderWindow.isOpen
                        ? "text-emerald-700"
                        : "text-orange-700"
                    }
                  `}
                >
                  {orderWindow.isOpen
                    ? `${orderWindow.remainingText}`
                    : "आज के ऑर्डर बंद हो चुके हैं"}
                </p>
              </div>

              <div
                className={`
                  flex
                  h-11
                  w-11
                  items-center
                  justify-center
                  rounded-2xl
                  bg-white
                  ${orderWindow.isOpen ? "text-emerald-600" : "text-orange-500"}
                `}
              >
                <Clock3 className="h-5 w-5" />
              </div>
            </div>
          </div>

          {/* CHANGE CUTOFF */}

          <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={cutoffTime}
                onChange={(e) => {
                  setCutoffTime(e.target.value);
                  setSettingsMessage("");
                }}
                className="
                  h-12
                  min-w-0
                  flex-1
                  rounded-2xl
                  border
                  border-slate-200
                  bg-white
                  px-4
                  text-sm
                  font-black
                  text-slate-900
                  outline-none
                  transition
                  focus:border-emerald-400
                  focus:ring-4
                  focus:ring-emerald-500/10
                "
              />

              <button
                onClick={saveCutoffTime}
                disabled={savingSettings || settingsLoading}
                className="
                  flex
                  h-12
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-slate-900
                  px-5
                  text-xs
                  font-black
                  text-white
                  transition
                  hover:bg-slate-800
                  active:scale-[0.97]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                {savingSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    सेव
                  </>
                )}
              </button>
            </div>

            {settingsMessage && (
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                {settingsMessage}
              </div>
            )}
          </div>
        </section>
        <div className="h-5" />

        {/* =====================================================
            NOTIFICATION PANEL
        ===================================================== */}

        <AdminNotificationPanel />
      </main>
    </div>
  );
};

export default AdminDashboard;
