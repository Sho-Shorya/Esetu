import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import { ArrowLeft, Check, Dot, Hash, LogIn, X } from "lucide-react";

const AdminTodayOrders = (page) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const statusLabel = {
    Pending: "Pending",
    Approved: "Approved",
    Preparing: "तैयार",
    "Out For Delivery": "वितरण में",
    Delivered: "Delivered",
    Cancelled: "Cancelled",
    Declined: "Declined",
  };

  const statusStyles = {
    Pending: "bg-yellow-100 text-yellow-900",
    Approved: "bg-emerald-100 text-emerald-900",
    Preparing: "bg-sky-100 text-sky-900",
    "Out For Delivery": "bg-blue-100 text-blue-900",
    Delivered: "bg-emerald-100 text-emerald-900",
    Cancelled: "bg-red-100 text-red-900",
    Declined: "bg-red-100 text-red-900",
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
  const [users, setUsers] = useState([]);
  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE_URL}/api/v1/user/all-user`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          setUsers(res.data.users || []);
        }
      } catch (error) {
        toast.error("उपयोगकर्ताओं को लोड करने में समस्या हुई।");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);
  const handleStatus = async (orderId, status) => {
    if (!token || updatingOrderId) return;

    setUpdatingOrderId(orderId);

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/order/update-status/${orderId}`,
        { status },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        setOrders((prev) =>
          prev.map((order) => (order._id === orderId ? res.data.order : order)),
        );

        toast.success(res.data.message);
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white rounded-2xl sm:px-6 lg:px-8">
      <div className="mx-auto  max-w-7xl space-y-6">
        <div className="rounded-3xl bg-white p-6 shadow-lg border border-emerald-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold   text-gray-900">
                आज के ऑर्डर ({orders.length})
              </h1>
              <p className="mt-2 text-gray-600">
                यहाँ आप सभी आज के सक्रिय ऑर्डर देख सकते हैं।
              </p>
            </div>
            <div className="grid gap-3 grid-cols-3">
              <div className="rounded-3xl bg-amber-50 p-4 flex flex-col text-center text-sm font-semibold text-amber-700">
                <p>Pending:</p> {counts.pending}
              </div>
              <div className="rounded-3xl bg-emerald-50 p-4 flex-col flex text-center text-sm font-semibold text-emerald-700">
                <p>Approved:</p> {counts.approved}
              </div>
              <div className="rounded-3xl bg-red-50 p-4 flex-col flex text-center text-sm font-semibold text-red-700">
                <p>Declined:</p> {counts.declined}
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
            {orders.map((order, index) => (
              <div
                key={order._id}
                className=" relative rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      {/* Order Number */}
                      <div className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 shadow-md">
                        <Hash className="h-5 w-5 text-white" />
                        <div className="flex flex-col leading-none">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-100">
                            Order
                          </span>
                          <span className="text-lg font-bold text-white">
                            {orders.length - index}
                          </span>
                        </div>
                      </div>

                      {/* Status */}
                      <div
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm ${
                          statusStyles[order.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        <div className="relative flex items-center gap-2">
                          {order.status === "Pending" && (
                            <>
                              <span className="absolute -left-1 h-3 w-3 animate-ping rounded-full bg-red-500"></span>
                              <span className="h-3 w-3 rounded-full bg-red-600"></span>
                            </>
                          )}

                          {statusLabel[order.status] || order.status}
                        </div>
                      </div>
                    </div>
                    <div className="text-lg flex gap-2 font-bold items-center mt-2 text-gray-700">
                      <p className="text-gray-600 text-sm">खरीददार : </p>{" "}
                      {order.userId?.firstName} {order.userId?.lastName}
                    </div>
                    <div className="text-lg flex gap-2 text-[16px] font-bold items-center  ">
                      <p className="text-gray-600 text-sm">फोन: </p>
                      {order.userId?.phoneNumber}
                    </div>
                    <div className="flex items-center text-[16px] my-1 font-semibold font-semibold ">
                      <p className="mr-1 text-sm text-gray-600">जगह:</p>
                      <p className="text-md font-bold">
                        {users
                          .find(
                            (user) =>
                              user._id.toString() ===
                              order.userId?._id?.toString(),
                          )
                          ?.place.toUpperCase()}
                      </p>
                    </div>

                    <p className="absolute top-46 right-5 text-[16px] bg-gray-50 rounded-full px-4 py-2 text-sm text-gray-400">
                      ऑर्डर #{order._id?.slice(-6)}
                    </p>
                    <p className="text-sm text-gray-500">{}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <p className="font-bold text-gray-700 text-md">
                    {new Date(order.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </p>
                </div>
                <div className="mt-2 rounded-3xl bg-slate-50 p-2 pt-4">
                  <h3 className="mb-3 text-md font-bold text-gray-800">
                    ऑर्डर आइटम्स ({order.items.length})
                  </h3>

                  <div className="space-y-2">
                    {order.items.map((item, index) => (
                      <div
                        key={item._id || `${order._id}-${index}`}
                        className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                      >
                        {/* Left */}
                        <div className="flex items-center gap-3">
                          {/* Number */}
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                            {index + 1}
                          </div>

                          {/* Product Info */}
                          <div className="flex flex-col">
                            <p className="text-lg font-bold text-gray-900">
                              {item.companyName}{" "}
                              <span className="font-bold">{item.name}</span>
                            </p>

                            <div className="mt-1 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-blue-100 px-2 py-1  font-semibold text-[13px] text-blue-800">
                                {item.measurement} x {item.qty} Qty
                              </span>
                              <span className="rounded-full bg-orange-100 px-2 py-1  font-semibold text-[13px] text-orange-700">
                                {item.categoryName}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-600">
                            ₹{item.total}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-full">
                  <div className="text-green-600 flex gap-3 items-center justify-end w-full px-3">
                    <p className="text-[20px]">Total: </p>{" "}
                    <p className="font-bold text-[30px]">
                      {order.totalAmount}/-
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status === "Pending" && (
                    <>
                      <button
                        onClick={() => handleStatus(order._id, "Approved")}
                        disabled={updatingOrderId === order._id}
                        className="items-center rounded-2xl gap-2 flex bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="h-6" />
                        Approve करें
                      </button>
                      <button
                        onClick={() => handleStatus(order._id, "Declined")}
                        disabled={updatingOrderId === order._id}
                        className="flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <X />
                        रद्द करें
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => navigate(`/admin/user/${order.userId?._id}`)}
                    className="rounded-2xl flex items-center mt-1 gap-2 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"
                  >
                    User प्रोफ़ाइल देखें <LogIn />
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
