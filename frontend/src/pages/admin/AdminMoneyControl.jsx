import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

import {
  ArrowDown,
  Check,
  IndianRupee,
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";

const AdminMoneyControl = () => {
  /* ==========================================================
     STATE
  ========================================================== */

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedOrder, setSelectedOrder] = useState(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentUpdating, setPaymentUpdating] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();

    return [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");
  });

  /* ==========================================================
     TOKEN
  ========================================================== */

  const token = localStorage.getItem("token");

  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  /* ==========================================================
     FETCH ORDERS
  ========================================================== */

  const fetchOrders = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/order/all-orders`,
        {
          params: {
            date: selectedDate,
          },

          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.success) {
        setOrders(response.data.orders || []);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);

      toast.error(error.response?.data?.message || "ऑर्डर लोड नहीं हो सके।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [selectedDate]);

  /* ==========================================================
     ONLY APPROVED ORDERS
     ----------------------------------------------------------
     Money Control should ONLY contain approved orders.
     Cancelled, Declined, Pending, Rejected etc. are excluded.
  ========================================================== */

  const approvedOrders = useMemo(() => {
    return orders.filter((order) => order.status === "Approved");
  }, [orders]);

  /* ==========================================================
     TOTAL SALES
  ========================================================== */

  const totalSales = useMemo(() => {
    return approvedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );
  }, [approvedOrders]);

  /* ==========================================================
     PAID
  ========================================================== */

  const paidAmount = useMemo(() => {
    return approvedOrders
      .filter((order) => order.paymentStatus === "Paid")
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  }, [approvedOrders]);

  /* ==========================================================
     PENDING
  ========================================================== */

  const pendingAmount = Math.max(totalSales - paidAmount, 0);

  /* ==========================================================
     DATE
  ========================================================== */

  const formattedDate = new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
    "hi-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  );

  /* ==========================================================
     CUSTOMER NAME
  ========================================================== */

  const getCustomerName = (order) => {
    const user = order?.userId;

    if (!user) {
      return "नाम उपलब्ध नहीं";
    }

    const name = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return name || "नाम उपलब्ध नहीं";
  };

  /* ==========================================================
     OPEN ORDER
  ========================================================== */

  const openOrder = (order) => {
    setSelectedOrder(order);
    setEditing(false);
  };

  /* ==========================================================
     CLOSE SHEET
  ========================================================== */

  const closeOrder = () => {
    if (saving || paymentUpdating) return;

    setSelectedOrder(null);
    setEditing(false);
  };

  /* ==========================================================
     UPDATE LOCAL QUANTITY
  ========================================================== */

  const changeQuantity = (itemId, change) => {
    if (!selectedOrder) return;

    setSelectedOrder((prev) => {
      if (!prev) return prev;

      return {
        ...prev,

        items: prev.items.map((item) => {
          if (item._id !== itemId) {
            return item;
          }

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

  /* ==========================================================
     REMOVE ITEM
  ========================================================== */

  const removeItem = (itemId) => {
    if (!selectedOrder) return;

    setSelectedOrder((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.filter((item) => item._id !== itemId),
      };
    });
  };

  /* ==========================================================
     EDIT TOTAL
  ========================================================== */

  const editingTotal = useMemo(() => {
    if (!selectedOrder) return 0;

    return (
      selectedOrder.items?.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0),
        0,
      ) || 0
    );
  }, [selectedOrder]);

  /* ==========================================================
     SAVE ORDER CHANGES
  ========================================================== */

  const saveOrderChanges = async () => {
    if (!selectedOrder) return;

    if (!selectedOrder.items || selectedOrder.items.length === 0) {
      toast.error("ऑर्डर में कम से कम एक सामान होना चाहिए।");

      return;
    }

    try {
      setSaving(true);

      const items = selectedOrder.items.map((item) => ({
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

      const response = await axios.put(
        `${API_BASE_URL}/api/v1/order/update-items/${selectedOrder._id}`,
        {
          items,
        },
        axiosConfig,
      );

      if (response.data?.success) {
        const updatedOrder = response.data.order;

        /*
         * Update original orders.
         */
        setOrders((prev) =>
          prev.map((order) =>
            order._id === updatedOrder._id ? updatedOrder : order,
          ),
        );

        /*
         * Update bottom sheet.
         */
        setSelectedOrder(updatedOrder);

        setEditing(false);

        toast.success("ऑर्डर और बिल अपडेट हो गया।");
      }
    } catch (error) {
      console.error("Order update error:", error);

      toast.error(error.response?.data?.message || "ऑर्डर अपडेट नहीं हो सका।");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================
     MARK PAID
  ========================================================== */

  const markPaid = async () => {
    if (!selectedOrder) return;

    try {
      setPaymentUpdating(true);

      const response = await axios.put(
        `${API_BASE_URL}/api/v1/order/payment/${selectedOrder._id}/paid`,
        {},
        axiosConfig,
      );

      if (response.data?.success) {
        const updatedOrder = response.data.order;

        setOrders((prev) =>
          prev.map((order) =>
            order._id === updatedOrder._id ? updatedOrder : order,
          ),
        );

        setSelectedOrder(updatedOrder);

        toast.success("Payment मिल गया।");
      }
    } catch (error) {
      console.error("Payment update error:", error);

      toast.error(error.response?.data?.message || "Payment update नहीं हुआ।");
    } finally {
      setPaymentUpdating(false);
    }
  };

  /* ==========================================================
     MARK PENDING
  ========================================================== */

  const markPending = async () => {
    if (!selectedOrder) return;

    try {
      setPaymentUpdating(true);

      const response = await axios.put(
        `${API_BASE_URL}/api/v1/order/payment/${selectedOrder._id}/pending`,
        {},
        axiosConfig,
      );

      if (response.data?.success) {
        const updatedOrder = response.data.order;

        setOrders((prev) =>
          prev.map((order) =>
            order._id === updatedOrder._id ? updatedOrder : order,
          ),
        );

        setSelectedOrder(updatedOrder);

        toast.success("Payment pending कर दिया।");
      }
    } catch (error) {
      console.error("Payment update error:", error);

      toast.error(error.response?.data?.message || "Payment update नहीं हुआ।");
    } finally {
      setPaymentUpdating(false);
    }
  };

  /* ==========================================================
     FORMAT TIME
  ========================================================== */

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString("hi-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-screen bg-slate-50 px-3 pb-40 pt-22 sm:px-5">
      <div className="mx-auto w-full max-w-2xl">
        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="mb-6 text-center">
          <div className="relative mx-auto inline-flex items-center justify-center">
            <span className="absolute -left-5 -top-1 h-2 w-2 rounded-full bg-emerald-400" />

            <span className="absolute -right-5 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />

            <span className="absolute -left-3 bottom-0 h-1.5 w-1.5 rounded-full bg-orange-300" />

            <span className="absolute -right-3 -bottom-1 h-2 w-2 rounded-full bg-red-300" />

            <span className="absolute -top-3 left-1/2 h-1.5 w-1.5 rounded-full bg-slate-300" />

            <h1 className="relative text-[26px] font-black tracking-tight text-slate-900">
              हिसाब
            </h1>
          </div>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            {formattedDate}
          </p>
        </div>

        {/* ==================================================
            DATE
        ================================================== */}

        <div className="mb-4 rounded-[22px] border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-slate-400">दिन चुनें</p>

              <p className="mt-0.5 text-sm font-black text-slate-800">
                {formattedDate}
              </p>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none"
            />
          </div>
        </div>

        {/* ==================================================
            SALES SUMMARY
        ================================================== */}

        <section className="mb-5 rounded-[26px] bg-emerald-500 p-5 text-white shadow-lg shadow-emerald-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-white/70">कुल बिक्री</p>

              <div className="mt-1 flex items-center gap-1">
                <IndianRupee className="h-7 w-7" />

                <span className="text-[38px] font-black leading-none">
                  {totalSales.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <ReceiptText className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold text-white/60">ऑर्डर</p>

              <p className="mt-1 text-lg font-black">{approvedOrders.length}</p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-white/60">मिला</p>

              <p className="mt-1 text-lg font-black">
                ₹{paidAmount.toLocaleString("en-IN")}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold text-white/60">बाकी</p>

              <p className="mt-1 text-lg font-black">
                ₹{pendingAmount.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================
            ORDER LIST
        ================================================== */}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">ऑर्डर</h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
              {approvedOrders.length}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-500" />
            </div>
          ) : approvedOrders.length === 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <ShoppingBag className="h-6 w-6 text-slate-400" />
              </div>

              <p className="mt-4 text-base font-black text-slate-700">
                कोई स्वीकृत ऑर्डर नहीं
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                इस दिन कोई approved order नहीं है।
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvedOrders.map((order) => {
                const isPaid = order.paymentStatus === "Paid";

                const itemCount =
                  order.items?.reduce(
                    (sum, item) => sum + Number(item.qty || 0),
                    0,
                  ) || 0;

                return (
                  <button
                    key={order._id}
                    onClick={() => openOrder(order)}
                    className="
                      group
                      w-full
                      rounded-[24px]
                      border
                      border-slate-200
                      bg-white
                      p-4
                      text-left
                      shadow-[0_4px_18px_rgba(15,23,42,0.04)]
                      transition
                      active:scale-[0.99]
                      hover:border-emerald-200
                      hover:shadow-[0_8px_25px_rgba(16,185,129,0.08)]
                    "
                  >
                    <div className="flex items-center gap-3">
                      {/* USER */}

                      <div
                        className={`
                          flex h-12 w-12 shrink-0
                          items-center justify-center
                          rounded-2xl
                          ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-orange-50 text-orange-600"
                          }
                        `}
                      >
                        <UserRound className="h-5 w-5" />
                      </div>

                      {/* NAME */}

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-slate-900">
                          {getCustomerName(order)}
                        </p>

                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-400">
                            {itemCount} सामान
                          </span>

                          <span className="h-1 w-1 rounded-full bg-slate-300" />

                          <span className="text-xs font-semibold text-slate-400">
                            {formatTime(order.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* PRICE */}

                      <div className="shrink-0 text-right">
                        <p className="text-lg font-black text-slate-900">
                          ₹
                          {Number(order.totalAmount || 0).toLocaleString(
                            "en-IN",
                          )}
                        </p>

                        <span
                          className={`
                            mt-1 inline-block
                            text-[10px]
                            font-black
                            ${isPaid ? "text-emerald-600" : "text-orange-600"}
                          `}
                        >
                          {isPaid ? "पैसा मिला" : "पैसा बाकी"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ======================================================
          BOTTOM SHEET
      ====================================================== */}

      {selectedOrder && (
        <div className="fixed inset-0 z-[100]">
          {/* BACKDROP */}

          <button
            aria-label="Close"
            onClick={closeOrder}
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
              max-h-[92vh]
              w-full
              max-w-2xl
              overflow-hidden
              rounded-t-[30px]
              bg-white
              shadow-2xl
            "
          >
            {/* HANDLE */}

            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-xl font-black text-slate-900">
                  {getCustomerName(selectedOrder)}
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  #{selectedOrder._id?.slice(-6).toUpperCase()}
                  {" • "}
                  {formatTime(selectedOrder.createdAt)}
                </p>
              </div>

              <button
                onClick={closeOrder}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            {/* CONTENT */}

            <div className="max-h-[calc(92vh-170px)] overflow-y-auto px-4 py-4">
              {editing ? (
                /* ==================================================
                   EDIT MODE
                ================================================== */

                <div className="space-y-3">
                  {selectedOrder.items?.map((item) => (
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

                        {/* QTY */}

                        <div className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 p-1">
                          <button
                            onClick={() => changeQuantity(item._id, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <span className="w-7 text-center text-sm font-black">
                            {item.qty}
                          </span>

                          <button
                            onClick={() => changeQuantity(item._id, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* REMOVE */}

                        <button
                          onClick={() => removeItem(item._id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* EDIT TOTAL */}

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
              ) : (
                /* ==================================================
                   VIEW MODE
                ================================================== */

                <div className="space-y-3">
                  {selectedOrder.items?.map((item) => (
                    <div
                      key={item._id}
                      className="flex items-center gap-3 rounded-[20px] bg-slate-50 p-3"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
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

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-black text-slate-900">
                          {item.name}
                        </p>

                        {item.companyName && (
                          <p className="mt-0.5 text-xs font-bold text-slate-500">
                            {item.companyName}
                          </p>
                        )}

                        <p className="mt-1 text-xs font-semibold text-slate-400">
                          {item.qty} × {item.measurement}
                        </p>
                      </div>

                      <p className="text-base font-black text-slate-900">
                        ₹{Number(item.total || 0).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}

                  {/* TOTAL */}

                  <div className="mt-4 flex items-center justify-between rounded-[22px] bg-slate-900 px-5 py-4 text-white">
                    <span className="text-sm font-bold text-white/60">
                      कुल बिल
                    </span>

                    <span className="flex items-center text-2xl font-black">
                      <IndianRupee className="h-5 w-5" />

                      {Number(selectedOrder.totalAmount || 0).toLocaleString(
                        "en-IN",
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ==================================================
                BOTTOM ACTIONS
            ================================================== */}

            <div className="border-t border-slate-100 bg-white p-4">
              {editing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    disabled={saving}
                    className="h-12 flex-1 rounded-2xl bg-slate-100 text-sm font-black text-slate-700"
                  >
                    रद्द करें
                  </button>

                  <button
                    onClick={saveOrderChanges}
                    disabled={saving}
                    className="flex h-12 flex-[1.5] items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-sm font-black text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        सेव हो रहा...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        बिल सेव करें
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* EDIT */}

                  <button
                    onClick={() => setEditing(true)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-black text-white"
                  >
                    ऑर्डर में बदलाव करें
                  </button>

                  {/* PAYMENT */}

                  {selectedOrder.paymentStatus === "Paid" ? (
                    <button
                      onClick={markPending}
                      disabled={paymentUpdating}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-50 text-sm font-black text-orange-700 disabled:opacity-50"
                    >
                      {paymentUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <ArrowDown className="h-4 w-4" />
                          पैसा बाकी करें
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={markPaid}
                      disabled={paymentUpdating}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700 disabled:opacity-50"
                    >
                      {paymentUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          पैसा मिल गया
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMoneyControl;
