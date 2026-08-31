import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";

import {
  ArrowLeft,
  Check,
  Hash,
  IndianRupee,
  Loader2,
  LocationEditIcon,
  LogIn,
  Minus,
  Phone,
  Plus,
  RotateCcw,
  ShoppingBag,
  Table,
  Trash2,
  X,
  Pencil,
} from "lucide-react";

const AdminTodayOrders = () => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const [confirmModal, setConfirmModal] = useState(null);

  const [editingOrder, setEditingOrder] = useState(null);
  const [saving, setSaving] = useState(false);

  const [confirmRemoveItem, setConfirmRemoveItem] = useState(null);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  /* ==========================================================
     STATUS
  ========================================================== */

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

  /* ==========================================================
     FETCH ORDERS
  ========================================================== */

  useEffect(() => {
    if (!token) return;

    const fetchOrders = async () => {
      try {
        setLoading(true);

        const res = await axios.get(`${API_BASE_URL}/api/v1/order/all-orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      } catch (error) {
        console.error("Fetch orders error:", error);

        toast.error(
          error.response?.data?.message || "ऑर्डर लोड करने में समस्या हुई।",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  /* ==========================================================
     FETCH USERS
  ========================================================== */

  useEffect(() => {
    const fetchUsers = async () => {
      const currentToken = localStorage.getItem("token");

      if (!currentToken) return;

      try {
        const res = await axios.get(`${API_BASE_URL}/api/v1/user/all-user`, {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        if (res.data.success) {
          setUsers(res.data.users || []);
        }
      } catch (error) {
        console.error("Fetch users error:", error);

        toast.error(
          error.response?.data?.message ||
            "उपयोगकर्ताओं को लोड करने में समस्या हुई।",
        );
      }
    };

    fetchUsers();
  }, []);

  /* ==========================================================
     CONFIRM STATUS CHANGE
  ========================================================== */

  const askStatusConfirmation = (order, status) => {
    if (!order?._id || updatingOrderId) return;

    const customerName =
      `${order.userId?.firstName || ""} ${
        order.userId?.lastName || ""
      }`.trim() || "यह ग्राहक";

    if (status === "Approved") {
      setConfirmModal({
        orderId: order._id,
        status: "Approved",
        title: "ऑर्डर Approve करें?",
        message: `${customerName} के ऑर्डर को Approved करना चाहते हैं?`,
        confirmText: "हाँ, Approve करें",
        confirmClass: "bg-emerald-600 hover:bg-emerald-700",
      });

      return;
    }

    if (status === "Declined") {
      setConfirmModal({
        orderId: order._id,
        status: "Declined",
        title: "ऑर्डर रद्द करें?",
        message: `${customerName} के ऑर्डर को Declined करना चाहते हैं?`,
        confirmText: "हाँ, रद्द करें",
        confirmClass: "bg-red-600 hover:bg-red-700",
      });

      return;
    }

    if (status === "Pending") {
      setConfirmModal({
        orderId: order._id,
        status: "Pending",
        title: "स्टेटस वापस बदलें?",
        message: "इस ऑर्डर का स्टेटस वापस Pending किया जाएगा।",
        confirmText: "हाँ, Pending करें",
        confirmClass: "bg-orange-500 hover:bg-orange-600",
      });
    }
  };

  /* ==========================================================
     UPDATE STATUS
  ========================================================== */

  const handleStatus = async (orderId, status) => {
    if (!token || updatingOrderId) return;

    setUpdatingOrderId(orderId);

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/v1/order/update-status/${orderId}`,
        {
          status,
        },
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

        if (status === "Approved") {
          toast.success("ऑर्डर Approved हो गया।");
        } else if (status === "Declined") {
          toast.success("ऑर्डर Declined कर दिया गया।");
        } else if (status === "Pending") {
          toast.success("ऑर्डर वापस Pending कर दिया गया।");
        } else {
          toast.success(res.data.message);
        }
      }
    } catch (error) {
      console.error("Status update error:", error);

      toast.error(
        error.response?.data?.message || "स्टेटस बदलने में समस्या हुई।",
      );
    } finally {
      setUpdatingOrderId(null);
      setConfirmModal(null);
    }
  };

  /* ==========================================================
     CONFIRM ACTION
  ========================================================== */

  const confirmStatusChange = () => {
    if (!confirmModal) return;

    handleStatus(confirmModal.orderId, confirmModal.status);
  };

  /* ==========================================================
     EDIT ORDER ITEMS
  ========================================================== */

  const openEditSheet = (order) => {
    if (saving) return;

    setEditingOrder(JSON.parse(JSON.stringify(order)));
  };

  const closeEditSheet = () => {
    if (saving) return;

    setEditingOrder(null);
  };

  const changeQuantity = (itemId, change) => {
    if (!editingOrder) return;

    setEditingOrder((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.map((item) => {
          if (item._id !== itemId) return item;

          const newQty = Math.max(0, Number(item.qty || 0) + change);

          return {
            ...item,
            qty: newQty,
            total: newQty * Number(item.price || 0),
          };
        }),
      };
    });
  };

  const removeItem = (itemId) => {
    if (!editingOrder) return;

    setConfirmRemoveItem(itemId);
  };

  const confirmRemoveEdit = () => {
    if (!confirmRemoveItem || !editingOrder) return;

    setEditingOrder((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.filter((item) => item._id !== confirmRemoveItem),
      };
    });

    setConfirmRemoveItem(null);
  };

  const editingTotal = useMemo(() => {
    if (!editingOrder) return 0;

    return (
      editingOrder.items?.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0),
        0,
      ) || 0
    );
  }, [editingOrder]);

  const saveOrderChanges = async () => {
    if (!editingOrder) return;

    if (!editingOrder.items || editingOrder.items.length === 0) {
      toast.error("ऑर्डर में कम से कम एक सामान होना चाहिए।");
      return;
    }

    try {
      setSaving(true);

      const items = editingOrder.items.map((item) => ({
        originalItemId: item._id,
        productId: item.productId,
        name: item.name,
        hinglishName: item.hinglishName || "",
        image: item.image || "",
        companyId: item.companyId || null,
        companyName: item.companyName || "",
        categoryId: item.categoryId || null,
        categoryName: item.categoryName || "",
        measurement: item.measurement,
        qty: Number(item.qty),
        price: Number(item.price),
      }));

      const res = await axios.put(
        `${API_BASE_URL}/api/v1/order/update-items/${editingOrder._id}`,
        { items },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        const updatedOrder = res.data.order;

        setOrders((prev) =>
          prev.map((order) =>
            order._id === updatedOrder._id ? updatedOrder : order,
          ),
        );

        setEditingOrder(null);

        toast.success("ऑर्डर अपडेट हो गया।");
      }
    } catch (error) {
      console.error("Order update error:", error);
      toast.error(error.response?.data?.message || "ऑर्डर अपडेट नहीं हो सका।");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     COUNTS
  ========================================================== */

  const counts = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === "Pending").length,

      approved: orders.filter((order) => order.status === "Approved").length,

      declined: orders.filter((order) => order.status === "Declined").length,
    }),
    [orders],
  );

  /* ==========================================================
     GET USER PLACE
  ========================================================== */

  const getUserPlace = (order) => {
    const userId = order.userId?._id?.toString();

    const user = users.find((user) => user._id?.toString() === userId);

    return user?.place || "जगह उपलब्ध नहीं";
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-auto rounded-2xl pb-10 lg:px-8">
      <div className="mt-20 max-w-7xl space-y-5">
        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-lg">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl flex justify-between font-bold text-gray-900">
                आज के ऑर्डर ({orders.length})
                <div
                  onClick={() => navigate("/daily-orders")}
                  className="rounded-full flex items-center"
                >
                  <Table className="h-8 w-8 mt-1 " />
                  {/* <p>ऑर्डर</p> */}
                </div>
              </h1>

              <p className="mt-2 text-gray-600">
                यहाँ आप सभी आज के ऑर्डर देख सकते हैं।
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col rounded-3xl bg-amber-50 p-4 text-center text-sm font-semibold text-amber-700">
                <p>Pending:</p>
                <p className="text-[18px]">{counts.pending}</p>
              </div>

              <div className="flex flex-col rounded-3xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">
                <p>Approved:</p>
                <p className="text-[18px]">{counts.approved}</p>
              </div>

              <div className="flex flex-col rounded-3xl bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
                <p>Declined:</p>
                <p className="text-[18px]">{counts.declined}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ====================================================
            LOADING
        ==================================================== */}

        {loading ? (
          <div className="flex items-center justify-center gap-4 rounded-3xl bg-gray-50 p-10 text-center text-md text-gray-600">
            <Loader2 className="h-10 w-10 animate-spin" />
            लोड हो रहा है!
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-gray-600">
            कोई आज का ऑर्डर उपलब्ध नहीं है।
          </div>
        ) : (
          /* ==================================================
             ORDER LIST
          ================================================== */

          <div className="grid gap-4">
            {orders.map((order, index) => {
              const isUpdating = updatingOrderId === order._id;

              return (
                <div
                  key={order._id}
                  className={`relative rounded-3xl border bg-white p-5 shadow-sm ${
                    order.status === "Pending"
                      ? "border-orange-300"
                      : order.status === "Approved"
                        ? "border-emerald-400"
                        : order.status === "Declined"
                          ? "border-red-400"
                          : "border-gray-200"
                  }`}
                >
                  {/* ==================================================
                      TOP
                  ================================================== */}

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full">
                      <div className="mb-4 flex items-center justify-between">
                        {/* ORDER NUMBER */}

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

                        {/* STATUS */}

                        <div className="flex items-center gap-2">
                          <div
                            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold shadow-sm ${
                              statusStyles[order.status] ||
                              "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {order.status === "Pending" && (
                              <span className="h-3 w-3 animate-ping rounded-full bg-red-600" />
                            )}

                            {statusLabel[order.status] || order.status}
                          </div>

                          {/* PAYMENT STATUS */}

                          {order.paymentStatus === "Paid" && (
                            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2 text-[12px] font-bold text-white shadow-sm">
                              <Check className="h-4 w-4" />
                              पैसे जमा
                            </div>
                          )}
                        </div>
                      </div>

                      {/* CUSTOMER */}

                      <div className="mt-2 flex items-center gap-2 text-lg font-bold text-red-700">
                        <p className="text-sm text-gray-600">खरीदार :</p>
                        {order.userId?.firstName} {order.userId?.lastName}
                      </div>

                      {/* PHONE */}

                      <div className="flex items-center gap-1 text-[13px] font-bold">
                        <p className="mr-1 text-sm text-gray-600">फोन:</p>

                        {order.userId?.phoneNumber && (
                          <a
                            href={`tel:${order.userId.phoneNumber}`}
                            className="
                              flex items-center gap-2
                              rounded-xl
                              bg-red-50
                              px-4 py-2.5
                              text-sm font-bold
                              text-red-700
                              transition
                              hover:bg-emerald-100
                              active:scale-95
                            "
                          >
                            <Phone className="h-4 w-4" />

                            <span>{order.userId.phoneNumber}</span>
                          </a>
                        )}
                      </div>

                      {/* PLACE */}

                      <div className="my-1 flex items-center gap-1 text-[13px] font-semibold">
                        <p className="mr-1 text-sm text-gray-600">जगह:</p>

                        <LocationEditIcon className="h-5 w-4 text-red-600" />

                        <p className="text-md font-bold uppercase">
                          {getUserPlace(order)}
                        </p>
                      </div>

                      {/* ORDER ID */}

                      <p className="absolute right-5 top-46 rounded-full bg-gray-50 px-4 py-2 text-[16px] text-gray-400">
                        ऑर्डर #{order._id?.slice(-6).toUpperCase()}
                      </p>
                    </div>
                  </div>

                  {/* DATE */}

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <p className="text-md font-bold text-gray-700">
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

                  {/* ==================================================
                      ITEMS
                  ================================================== */}

                  <div className="mt-2 rounded-3xl  bg-slate-50 p-2 pt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="mb-3 text-md font-bold text-gray-800">
                        ऑर्डर आइटम्स ({order.items?.length || 0})
                      </h3>
                      <div>
                        {(order.status === "Pending" ||
                          order.status === "Approved") && (
                          <button
                            onClick={() => openEditSheet(order)}
                            disabled={isUpdating}
                            className="flex items-center  mb-3 gap-2  rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            <Pencil className="h-4 w-4" />
                            एडिट करें
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {order.items?.map((item, itemIndex) => (
                        <div
                          key={item._id || `${order._id}-${itemIndex}`}
                          className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            {/* NUMBER */}

                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                              {itemIndex + 1}
                            </div>

                            {/* PRODUCT */}

                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 text-lg font-bold text-gray-900">
                                <p className="rounded-2xl bg-emerald-50 text-sm text-emerald-700">
                                  {item.companyName}
                                </p>

                                <span>{item.name}</span>
                              </div>

                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-blue-100 px-2 py-1 text-[13px] font-semibold text-blue-800">
                                  {item.measurement} × {item.qty} Qty
                                </span>

                                <span className="rounded-full bg-orange-100 px-2 py-1 text-[13px] font-semibold text-orange-700">
                                  {item.categoryName}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* PRICE */}

                          <div className="text-right">
                            <p className="text-lg font-bold text-emerald-600">
                              ₹{item.total}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ==================================================
                      TOTAL
                  ================================================== */}

                  <div className="w-full">
                    <div className="flex w-full items-center justify-end gap-3 px-3 text-green-600">
                      <p className="text-[20px]">Total:</p>

                      <p className="text-[30px] font-bold">
                        ₹{order.totalAmount}/-
                      </p>
                    </div>
                  </div>

                  {/* ==================================================
                      ACTIONS
                  ================================================== */}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {/* ================================================
                        EDIT ITEMS (Pending + Approved)
                    ================================================= */}

                    {/* ================================================
                        PENDING
                    ================================================= */}

                    {order.status === "Pending" && (
                      <>
                        <button
                          onClick={() =>
                            askStatusConfirmation(order, "Approved")
                          }
                          disabled={isUpdating}
                          className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Check className="h-6 animate-bounce mt-2" />
                          )}
                          Approve करें
                        </button>

                        <button
                          onClick={() =>
                            askStatusConfirmation(order, "Declined")
                          }
                          disabled={isUpdating}
                          className="flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <X className=" animate-bounce mt-2" />
                          )}
                          रद्द करें
                        </button>
                      </>
                    )}

                    {/* ================================================
                        APPROVED → PENDING
                    ================================================= */}

                    {order.status === "Approved" && (
                      <button
                        onClick={() => askStatusConfirmation(order, "Pending")}
                        disabled={isUpdating}
                        className="flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-5 w-5" />
                        )}
                        गलती से Approved?
                      </button>
                    )}

                    {/* ================================================
                        DECLINED → PENDING
                    ================================================= */}

                    {order.status === "Declined" && (
                      <button
                        onClick={() => askStatusConfirmation(order, "Pending")}
                        disabled={isUpdating}
                        className="flex items-center gap-2 rounded-2xl bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-5 w-5" />
                        )}
                        गलती से Declined?
                      </button>
                    )}

                    {/* ================================================
                        USER PROFILE
                    ================================================= */}

                    <button
                      onClick={() =>
                        navigate(`/admin/user/${order.userId?._id}`)
                      }
                      className="mt-1 flex items-center gap-2 rounded-2xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200"
                    >
                      User प्रोफ़ाइल देखें
                      <LogIn />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==========================================================
          CONFIRMATION MODAL
      ========================================================== */}

      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl">
            {/* ICON */}

            <div className="flex items-start justify-between">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  confirmModal.status === "Declined"
                    ? "bg-red-50 text-red-600"
                    : confirmModal.status === "Approved"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-orange-50 text-orange-600"
                }`}
              >
                {confirmModal.status === "Declined" ? (
                  <X className="h-6 w-6" />
                ) : confirmModal.status === "Approved" ? (
                  <Check className="h-6 w-6" />
                ) : (
                  <RotateCcw className="h-6 w-6" />
                )}
              </div>

              <button
                onClick={() => setConfirmModal(null)}
                disabled={updatingOrderId}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* TEXT */}

            <div className="mt-5">
              <h2 className="text-xl font-black text-slate-900">
                {confirmModal.title}
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {confirmModal.message}
              </p>

              {confirmModal.status === "Approved" && (
                <div className="mt-4 rounded-2xl bg-emerald-50 p-3 text-xs font-bold text-emerald-700">
                  कृपया एक बार ऑर्डर और ग्राहक की जानकारी जाँच लें।
                </div>
              )}

              {confirmModal.status === "Declined" && (
                <div className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700">
                  यह ऑर्डर Declined हो जाएगा। आगे बढ़ने से पहले जाँच लें।
                </div>
              )}

              {confirmModal.status === "Pending" && (
                <div className="mt-4 rounded-2xl bg-orange-50 p-3 text-xs font-bold text-orange-700">
                  स्टेटस वापस Pending हो जाएगा और आप इसे फिर से Approve या
                  Decline कर सकते हैं।
                </div>
              )}
            </div>

            {/* ACTIONS */}

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                disabled={updatingOrderId}
                className="h-12 flex-1 rounded-2xl bg-slate-100 text-sm font-black text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                वापस
              </button>

              <button
                onClick={confirmStatusChange}
                disabled={Boolean(updatingOrderId)}
                className={`flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl text-sm font-black text-white shadow-lg disabled:opacity-50 ${confirmModal.confirmClass}`}
              >
                {updatingOrderId ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    अपडेट हो रहा...
                  </>
                ) : (
                  <>
                    {confirmModal.status === "Declined" ? (
                      <X className="h-5 w-5" />
                    ) : confirmModal.status === "Approved" ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <RotateCcw className="h-5 w-5" />
                    )}

                    {confirmModal.confirmText}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          EDIT ORDER BOTTOM SHEET
      ========================================================== */}

      {editingOrder && (
        <div className="fixed inset-0 z-[200]">
          {/* BACKDROP */}

          <button
            aria-label="Close"
            onClick={closeEditSheet}
            disabled={saving}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          />

          {/* SHEET */}

          <div
            className="
              absolute
              bottom-0
              left-0
              right-0
              mx-auto
              flex
              h-[88vh]
              max-h-[88vh]
              w-full
              max-w-2xl
              flex-col
              overflow-hidden
              rounded-t-[30px]
              bg-white
              shadow-2xl
            "
          >
            {/* HANDLE */}

            <div className="flex shrink-0 justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* HEADER */}

            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-xl font-black text-slate-900">
                  ऑर्डर एडिट करें
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  #{editingOrder._id?.slice(-6).toUpperCase()}
                </p>
              </div>

              <button
                onClick={closeEditSheet}
                disabled={saving}
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  bg-slate-100
                  disabled:opacity-50
                "
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            {/* SCROLLABLE ITEMS */}

            <div
              className="
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
                px-4
                py-4
              "
            >
              <div className="space-y-3">
                {editingOrder.items?.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-[22px] border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      {/* IMAGE */}

                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ShoppingBag className="h-5 w-5 text-slate-400" />
                        )}
                      </div>

                      {/* INFO */}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-slate-900">
                          {item.name}
                        </p>

                        {item.companyName && (
                          <p className="mt-0.5 text-xs font-semibold text-slate-500">
                            {item.companyName}
                          </p>
                        )}

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {item.measurement} • ₹
                          {Number(item.price || 0).toLocaleString("en-IN")}
                        </p>
                      </div>

                      {/* QTY CONTROLS */}

                      <div className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 p-1">
                        <button
                          type="button"
                          onClick={() => changeQuantity(item._id, -1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm active:scale-95"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <span className="w-7 text-center text-sm font-black">
                          {item.qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => changeQuantity(item._id, 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm active:scale-95"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* REMOVE */}

                      <button
                        type="button"
                        onClick={() => removeItem(item._id)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 active:scale-95"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* EMPTY STATE */}

                {editingOrder.items?.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
                    <ShoppingBag className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-400">
                      कोई सामान नहीं बचा
                    </p>
                  </div>
                )}

                {/* NEW TOTAL */}

                <div className="mt-4 rounded-[22px] bg-slate-900 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white/60">
                      नया बिल
                    </span>

                    <span className="flex items-center text-2xl font-black">
                      <IndianRupee className="h-5 w-5" />
                      {editingTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM ACTIONS */}

            <div
              className="
                shrink-0
                border-t
                border-slate-100
                bg-white
                px-4
                pb-[max(1rem,env(safe-area-inset-bottom))]
                pt-3
              "
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeEditSheet}
                  disabled={saving}
                  className="
                    h-12
                    flex-1
                    rounded-2xl
                    bg-slate-100
                    text-sm
                    font-black
                    text-slate-700
                    disabled:opacity-50
                  "
                >
                  रद्द करें
                </button>

                <button
                  type="button"
                  onClick={saveOrderChanges}
                  disabled={saving || !editingOrder.items?.length}
                  className="
                    flex
                    h-12
                    flex-[1.5]
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    bg-emerald-500
                    text-sm
                    font-black
                    text-white
                    shadow-lg
                    shadow-emerald-500/20
                    disabled:opacity-50
                  "
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      सेव हो रहा...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      सेव करें
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          CONFIRM REMOVE ITEM MODAL (ADMIN)
      ========================================================== */}

      {confirmRemoveItem && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <Trash2 className="h-6 w-6" />
              </div>

              <button
                onClick={() => setConfirmRemoveItem(null)}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <h2 className="text-xl font-black text-slate-900">
                सामान हटाएँ?
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                क्या आप इस सामान को ऑर्डर से हटाना चाहते हैं?
              </p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setConfirmRemoveItem(null)}
                disabled={saving}
                className="h-12 flex-1 rounded-2xl bg-slate-100 text-sm font-black text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                नहीं
              </button>

              <button
                onClick={confirmRemoveEdit}
                disabled={saving}
                className="flex h-12 flex-[1.2] items-center justify-center gap-2 rounded-2xl bg-red-600 text-sm font-black text-white shadow-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                हाँ, हटाएँ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTodayOrders;
