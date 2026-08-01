import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import {
  ArrowLeft,
  Clock3,
  UserCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

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

const AdminUserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!userId || !token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [userRes, orderRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/user/get-user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/v1/order/user-orders/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (userRes.data.success) setUser(userRes.data.user);
        if (orderRes.data.success) setOrders(orderRes.data.orders || []);
      } catch (error) {
        toast.error("यूज़र प्रोफ़ाइल लोड नहीं हो सकी।");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, token]);

  const latestOrders = useMemo(
    () => orders.filter((order) => order.isTodayOrder),
    [orders],
  );

  const handleStatusChange = async (orderId, status) => {
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
      toast.error(error.response?.data?.message || "स्टेटस अपडेट नहीं हुआ।");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-24">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 shadow-lg text-center">
          लोड हो रहा है...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-lg border border-emerald-100">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" /> पीछे जाएँ
          </button>

          <div className="grid gap-6 lg:grid-cols-[1.8fr_2fr]">
            <div className="space-y-4 rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center gap-4">
                <UserCircle className="h-12 w-12 text-emerald-600" />
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {user?.firstName} {user?.lastName}
                  </h1>
                  <p className="text-sm text-gray-600">{user?.phoneNumber}</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                  <span className="font-semibold">पता:</span>{" "}
                  {user?.address || "निरधारित"}
                </div>
                <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                  <span className="font-semibold">शहर:</span>{" "}
                  {user?.place || "निरधारित"}
                </div>
                <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                  <span className="font-semibold">ज़िप:</span>{" "}
                  {user?.zipCode || "--"}
                </div>
                <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                  <span className="font-semibold">रोल:</span>{" "}
                  {user?.role || "user"}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">
                आदेश सारांश
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-gray-700">
                  कुल ऑर्डर: {orders.length}
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-sm text-gray-700">
                  आज के ऑर्डर: {latestOrders.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg border border-emerald-100">
          <h2 className="text-2xl font-semibold text-gray-900">ऑर्डर सूची</h2>
          {orders.length === 0 ? (
            <div className="mt-8 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-gray-500">
              इस उपयोगकर्ता के पास कोई आदेश नहीं है।
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {orders.map((order) => (
                <div
                  key={order._id}
                  className="rounded-3xl border border-gray-200 bg-gray-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">
                        ऑर्डर #{order._id?.slice(-6)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                      <span>{statusLabel[order.status] || order.status}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                      <span className="font-semibold">कुल राशि:</span> ₹
                      {order.totalAmount}
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                      <span className="font-semibold">कटऑफ:</span>{" "}
                      {new Date(order.cutoffTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-sm text-gray-700">
                      <span className="font-semibold">आईटम्स:</span>{" "}
                      {order.items.length}
                    </div>
                  </div>
                  <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-gray-900">
                      ऑर्डर आइटम्स
                    </p>
                    <div className="space-y-3">
                      {order.items.map((item) => (
                        <div
                          key={item._id}
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
                              <span>कंपनी: {item.companyName}</span>
                              <span>श्रेणी: {item.categoryName || "N/A"}</span>
                              <span>
                                मात्रा: {item.qty} × {item.measurement}
                              </span>
                              <span>₹{item.total}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold">पॅमेंट:</span>{" "}
                        {order.paymentMethod}
                      </p>
                      <p>
                        <span className="font-semibold">शिपिंग:</span>{" "}
                        {order.shippingAddress || "निरधारित"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {order.status === "Pending" && (
                        <>
                          <button
                            onClick={() =>
                              handleStatusChange(order._id, "Approved")
                            }
                            disabled={updatingOrderId === order._id}
                            className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingOrderId === order._id
                              ? "अपडेट कर रहा है..."
                              : "Approve"}
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(order._id, "Declined")
                            }
                            disabled={updatingOrderId === order._id}
                            className="rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingOrderId === order._id
                              ? "अपडेट कर रहा है..."
                              : "Decline"}
                          </button>
                        </>
                      )}
                      {order.status !== "Pending" && (
                        <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />{" "}
                          स्थिर स्थिति
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUserProfile;
