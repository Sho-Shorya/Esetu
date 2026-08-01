import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import { ArrowLeft } from "lucide-react";

const AdminTodayOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const statusLabel = {
    Pending: "लंबित",
    Approved: "स्वीकृत",
    Preparing: "तैयार",
    "Out For Delivery": "वितरण में",
    Delivered: "डिलीवर हो चुका",
    Cancelled: "रद्द",
    Declined: "अस्वीकृत",
  };

  const statusStyles = {
    Pending: "bg-yellow-100 text-yellow-800",
    Approved: "bg-emerald-100 text-emerald-800",
    Preparing: "bg-sky-100 text-sky-800",
    "Out For Delivery": "bg-blue-100 text-blue-800",
    Delivered: "bg-emerald-100 text-emerald-800",
    Cancelled: "bg-red-100 text-red-800",
    Declined: "bg-red-100 text-red-800",
  };

  useEffect(() => {
    if (!token) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/api/v1/order/all-orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      } catch (error) {
        toast.error("ऑर्डर लोड करने में समस्या हुई।");
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  const handleStatus = async (orderId, status) => {
    if (!token) return;
    setUpdatingOrderId(orderId);
    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/order/update-status/${orderId}`,
        { status },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.data.success) {
        setOrders((prev) =>
          prev.map((order) => (order._id === orderId ? res.data.order : order)),
        );
        toast.success(`Order ${status} कर दिया गया।`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "स्टेटस बदलने में समस्या।");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === "Pending").length,
      approved: orders.filter((order) => order.status === "Approved").length,
      declined: orders.filter((order) => order.status === "Declined").length,
    }),
    [orders],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-lg border border-emerald-100">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> वापस जाएँ
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                सबसे ताजा ऑर्डर
              </h1>
              <p className="mt-2 text-gray-600">
                यहाँ आप सभी आज के सक्रिय ऑर्डर देख सकते हैं।
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700">
                लंबित: {counts.pending}
              </div>
              <div className="rounded-3xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
                स्वीकृत: {counts.approved}
              </div>
              <div className="rounded-3xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
                अस्वीकृत: {counts.declined}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-gray-50 p-10 text-center text-gray-600">
            लोड हो रहा है...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-600">
            कोई आज का ऑर्डर उपलब्ध नहीं है।
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => (
              <div
                key={order._id}
                className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      ऑर्डर #{order._id?.slice(-6)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm text-gray-700">
                      उपयोगकर्ता: {order.userId?.firstName}{" "}
                      {order.userId?.lastName}
                    </p>
                    <p className="text-sm text-gray-700">
                      फोन: {order.userId?.phoneNumber}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                      statusStyles[order.status] || "bg-gray-50 text-gray-700"
                    }`}
                  >
                    {statusLabel[order.status] || order.status}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-gray-50 p-4 text-sm text-gray-700">
                    कुल ₹{order.totalAmount}
                  </div>
                  <div className="rounded-3xl bg-gray-50 p-4 text-sm text-gray-700">
                    कटऑफ समय:{" "}
                    {new Date(order.cutoffTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="rounded-3xl bg-gray-50 p-4 text-sm text-gray-700">
                    सामान: {order.items.length}
                  </div>
                </div>
                <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-900">
                    ऑर्डर आइटम्स
                  </p>
                  <div className="space-y-3">
                    {order.items.map((item, index) => (
                      <div
                        key={item._id || `${order._id}-${index}`}
                        className="rounded-3xl border border-gray-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-14 w-14 rounded-2xl object-cover"
                              />
                            )}
                            <div>
                              <p className="font-semibold text-gray-900">
                                {item.hinglishName || item.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {item.name}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-2 text-sm text-gray-700 sm:text-right">
                            <span>कंपनी: {item.companyName || "N/A"}</span>
                            <span>श्रेणी: {item.categoryName || "N/A"}</span>
                            <span>
                              मात्रा: {item.qty} × {item.measurement || "1"}
                            </span>
                            <span>₹{item.total}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "Pending" && (
                    <>
                      <button
                        onClick={() => handleStatus(order._id, "Approved")}
                        disabled={updatingOrderId === order._id}
                        className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        स्वीकृत करें
                      </button>
                      <button
                        onClick={() => handleStatus(order._id, "Declined")}
                        disabled={updatingOrderId === order._id}
                        className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        अस्वीकृत करें
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/admin/user/${order.userId?._id}`)}
                    className="rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"
                  >
                    यूज़र प्रोफ़ाइल देखें
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTodayOrders;
