import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
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
  Package2,
  BadgeIndianRupee,
  Clock3,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ChefHat,
  Truck,
  PackageCheck,
  BadgeCheck,
  Ban,
} from "lucide-react";

const AdminUserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

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
    if (!token || !userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const [userRes, ordersRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/v1/user/get-user/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE_URL}/api/v1/order/user-orders/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (userRes.data?.success) {
          setUser(userRes.data.user || null);
        }

        if (ordersRes.data?.success) {
          setOrders(ordersRes.data.orders || []);
        }
      } catch (error) {
        toast.error("Unable to load user profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, userId]);

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

      if (res.data?.success) {
        setOrders((prev) =>
          prev.map((order) => (order._id === orderId ? res.data.order : order)),
        );
        toast.success(`Order status updated to ${status}.`);
      }
    } catch (error) {
      toast.error(
        error?.response?.data?.message || "Unable to update order status.",
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-100 py-20 px-4">
      <div className="mx-auto max-w-7xl">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="mb-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2 font-semibold shadow hover:bg-emerald-50"
        >
          <ArrowLeft className="h-5 w-5" />
          Back
        </button>

        {/* ===================== USER HEADER ===================== */}

        <div className="rounded-[32px] bg-white p-6 shadow-xl border border-gray-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            {/* Left */}

            <div className="flex items-center gap-5">
              {user?.profilePic ? (
                <img
                  src={user.profilePic}
                  alt=""
                  className="h-24 w-24 rounded-full object-cover border-4 border-emerald-200"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100">
                  <User className="h-12 w-12 text-emerald-700" />
                </div>
              )}

              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h1>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
                    <Phone className="h-4 w-4" />
                    {user?.phoneNumber}
                  </span>

                  <span className="flex items-center gap-2 rounded-full bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">
                    <MapPin className="h-4 w-4" />
                    {user?.place || "Unknown"}
                  </span>

                  <span
                    className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold ${
                      user?.isVerified
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {user?.isVerified ? (
                      <ShieldCheck className="h-4 w-4" />
                    ) : (
                      <ShieldX className="h-4 w-4" />
                    )}

                    {user?.isVerified ? "Verified" : "Not Verified"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <ShoppingBag className="mb-2 h-6 w-6 text-emerald-700" />
                <p className="text-2xl font-bold">{orders.length}</p>
                <p className="text-sm text-gray-600">Orders</p>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <Package className="mb-2 h-6 w-6 text-blue-700" />
                <p className="text-2xl font-bold">
                  {orders.reduce((a, b) => a + b.items.length, 0)}
                </p>
                <p className="text-sm text-gray-600">Products</p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <BadgeIndianRupee className="mb-2 h-6 w-6 text-amber-700" />
                <p className="text-2xl font-bold">
                  ₹
                  {orders.reduce(
                    (sum, order) => sum + (order.totalAmount || 0),
                    0,
                  )}
                </p>
                <p className="text-sm text-gray-600">Spent</p>
              </div>

              <div className="rounded-2xl bg-purple-50 p-4">
                <CalendarDays className="mb-2 h-6 w-6 text-purple-700" />
                <p className="text-lg font-bold">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("en-IN")
                    : "--"}
                </p>
                <p className="text-sm text-gray-600">Joined</p>
              </div>
            </div>
          </div>

          {/* ===================== USER DETAILS ===================== */}

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Home className="h-5 w-5 text-emerald-600" />
                <p className="font-semibold text-gray-800">Address</p>
              </div>

              <p className="text-gray-600">
                {user?.address || "No address added"}
              </p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-blue-600" />
                <p className="font-semibold text-gray-800">ZIP Code</p>
              </div>

              <p className="text-gray-600">{user?.zipCode || "N/A"}</p>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-purple-600" />
                <p className="font-semibold text-gray-800">Last Updated</p>
              </div>

              <p className="text-gray-600">
                {user?.updatedAt
                  ? new Date(user.updatedAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* ===================== ORDERS ===================== */}

        <div className="rounded-[32px] border border-gray-200 bg-white p-6 shadow-xl mt-3">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Order History
              </h2>

              <p className="text-sm text-gray-500">
                Total Orders : {orders.length}
              </p>
            </div>

            <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              Latest Activity
            </div>
          </div>
          {orders.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-gray-200 py-20 text-center">
              <Package className="mx-auto h-14 w-14 text-gray-300" />
              <p className="mt-4 text-xl font-semibold text-gray-700">
                No Orders Found
              </p>
              <p className="text-gray-500">
                This customer hasn't placed any orders yet.
              </p>
            </div>
          ) : (
            <div className="space-y-5 ">
              {orders.map((order, orderIndex) => (
                <div
                  key={order._id}
                  className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 shadow-sm "
                >
                  {/* ================= HEADER ================= */}

                  <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-5">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                          {orderIndex + 1}
                        </div>

                        <div>
                          <p className=" text-lg font-bold text-gray-900">
                            {new Date(order.createdAt).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </p>
                          <h3 className="mt-1 text-sm text-gray-500">
                            Order #{order._id.slice(-6).toUpperCase()}
                          </h3>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className={`rounded-full px-4 py-2 text-sm font-bold ${
                          statusStyles[order.status]
                        }`}
                      >
                        {statusLabel[order.status]}
                      </div>

                      <div className="rounded-full bg-emerald-100 px-4 py-2 font-bold text-emerald-700">
                        ₹{order.totalAmount}
                      </div>
                    </div>
                  </div>

                  {/* ================= ORDER INFO ================= */}

                  <div className="grid gap-4 border-b bg-white p-5 grid-cols-2">
                    <div className="rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-blue-600" />

                        <p className="font-semibold text-gray-800">Products</p>
                      </div>

                      <p className="mt-2 text-2xl font-bold">
                        {order.items.length}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-5 w-5 text-orange-600" />

                        <p className="font-semibold text-gray-800">Payment</p>
                      </div>

                      <p className="mt-2 font-semibold text-gray-700">
                        {order.paymentMethod}
                      </p>
                    </div>
                  </div>
                  {/* ================= PRODUCTS ================= */}

                  <div className="bg-gray-50 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-xl font-bold text-gray-900">
                        Products ({order.items.length})
                      </h4>

                      <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
                        Total ₹{order.totalAmount}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {order.items.map((item, index) => (
                        <div
                          key={item._id || `${order._id}-${index}`}
                          className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md "
                        >
                          <div className="flex items-center justify-between">
                            {/* LEFT */}

                            <div className="flex items-center gap-4">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">
                                {index + 1}
                              </div>

                              <div>
                                <h5 className="text-lg font-bold text-gray-900">
                                  {item.companyName}
                                </h5>

                                <p className="font-medium text-gray-600">
                                  {item.name}
                                </p>
                              </div>
                            </div>

                            {/* PRICE */}

                            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                              <p className="text-xl font-bold text-emerald-700">
                                ₹{item.total}
                              </p>
                            </div>
                          </div>

                          {/* BADGES */}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="flex items-center gap-2 rounded-full bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-700">
                              <Package2 className="h-4 w-4" />

                              {item.measurement}
                            </span>

                            <span className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
                              Qty × {item.qty}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ================= FOOTER ================= */}

                  <div className="flex flex-col gap-4 bg-white p-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-3 items-center">
                      {order.status === "Pending" && (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() =>
                              handleStatusChange(order._id, "Approved")
                            }
                            disabled={updatingOrderId === order._id}
                            className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                            Approve Order
                          </button>
                          <button
                            onClick={() =>
                              handleStatusChange(order._id, "Declined")
                            }
                            disabled={updatingOrderId === order._id}
                            className="flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <XCircle className="h-5 w-5" />
                            Decline Order
                          </button>
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
