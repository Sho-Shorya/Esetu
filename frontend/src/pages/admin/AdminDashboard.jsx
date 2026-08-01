import Features from "@/components/Features";
import Hero from "@/components/Hero";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  BookOpenText,
  Package,
  Plus,
  ShoppingCart,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";
const AdminDashboard = () => {
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);
  const navigate = useNavigate();
  const [cutoffTime, setCutoffTime] = useState("11:00");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  const { productData } = useSelector((state) => state.product);
  const { supplierData } = useSelector((state) => state.user);

  useEffect(() => {
    if (!supplierData) return;

    const fetchStatsAndSettings = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        setLoadingStats(true);
        setSettingsLoading(true);

        const [ordersRes, usersRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/order/all-orders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/api/v1/user/all-user`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/v1/settings/app-settings`, {
            headers: { Authorization: `Bearer ${token}` },
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
        console.warn("Failed to fetch admin stats", error);
      } finally {
        setLoadingStats(false);
        setSettingsLoading(false);
      }
    };

    fetchStatsAndSettings();
  }, [supplierData]);

  return (
    <div className="pt-16 min-h-screen bg-slate-50">
      {supplierData ? (
        <div className="max-w-6xl mx-auto p-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h1 className="text-3xl font-bold text-slate-900">
              एडमिन डैशबोर्ड
            </h1>
            <p className="mt-3 text-slate-600">
              यहां सरल हिंदी में आज के ऑर्डर, उपयोगकर्ता और कटऑफ जानकारी मिलती
              है।
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">आज के ऑर्डर</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {loadingStats ? "..." : todayOrdersCount}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">
                कुल उपयोगकर्ता
              </p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {loadingStats ? "..." : userCount}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">उत्पाद</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {productData.length}
              </p>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500">काटऑफ समय</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">
                {cutoffTime}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              कटऑफ समय सेट करें
            </h2>
            <p className="mt-2 text-slate-600">
              उपयोगकर्ता हर दिन इस समय तक ही ऑर्डर कर सकते हैं।
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">
                  नया कटऑफ समय
                </span>
                <input
                  type="time"
                  value={cutoffTime}
                  onChange={(e) => setCutoffTime(e.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500"
                />
              </label>
              <button
                onClick={async () => {
                  const token = localStorage.getItem("token");
                  if (!token) return;
                  setSavingSettings(true);
                  setSettingsMessage("");
                  try {
                    const res = await axios.put(
                      `${API_BASE_URL}/api/v1/settings/app-settings/dailyOrderCutoff`,
                      { value: cutoffTime },
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      },
                    );
                    if (res.data.success) {
                      setSettingsMessage("कटऑफ समय अपडेट हो गया।");
                    }
                  } catch (error) {
                    setSettingsMessage("कटऑफ समय अपडेट नहीं हुआ।");
                  } finally {
                    setSavingSettings(false);
                  }
                }}
                disabled={savingSettings || settingsLoading}
                className="rounded-3xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingSettings ? "सेव कर रहे हैं..." : "सेव करें"}
              </button>
            </div>
            {settingsMessage ? (
              <p className="mt-4 text-sm text-emerald-700">{settingsMessage}</p>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <button
              onClick={() => navigate("/today-orders")}
              className="rounded-3xl bg-white p-5 text-left shadow-sm border border-slate-200 transition hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-500">आज के ऑर्डर</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                ऑर्डर देखें
              </p>
            </button>
            <button
              onClick={() => navigate("/admin-users")}
              className="rounded-3xl bg-white p-5 text-left shadow-sm border border-slate-200 transition hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-500">उपयोगकर्ता</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                यूज़र देखें
              </p>
            </button>
            <button
              onClick={() => navigate("/product-view")}
              className="rounded-3xl bg-white p-5 text-left shadow-sm border border-slate-200 transition hover:bg-slate-50"
            >
              <p className="text-sm font-medium text-slate-500">उत्पाद</p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                मैनेज करें
              </p>
            </button>
          </div>
        </div>
      ) : (
        <>
          <Hero />
          <Features />
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
