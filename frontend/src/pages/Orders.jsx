import React, { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        setLoading(true);
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/order/order-history`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (res.data.success) {
          setOrders(res.data.orders || []);
        }
      } catch (error) {
        console.error("Failed to load orders", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl rounded-3xl bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">
            पुराना हिसाब
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            आपके सभी पुराने ऑर्डर यहाँ दिखाई देंगे।
          </p>
        </div>

        {loading ? (
          <div className="rounded-xl bg-gray-50 p-6 text-center text-sm text-gray-500">
            ऑर्डर लोड हो रहे हैं...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            आपके पास अभी कोई पुराना ऑर्डर नहीं है।
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => (
              <div
                key={order._id || index}
                className="rounded-2xl border border-gray-200 p-4"
              >
                <div className="flex flex-col gap-3 overflow-hidden text-[23px] sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      ऑर्डर #{order._id?.slice(-6) || index + 1}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${order.status === "Delivered" ? "bg-emerald-100 text-emerald-700" : order.status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                    >
                      {order.status || "Processing"}
                    </span>
                    <span className="text-sm font-semibold text-gray-700">
                      ₹{order.totalAmount || 0}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {order.items?.map((item, itemIndex) => (
                    <div
                      key={`${order._id || index}-${itemIndex}`}
                      className="flex items-center gap-3 rounded-lg bg-gray-50 p-2"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-200 text-xs text-gray-500">
                        {"⏩"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.qty || item.quantity || 1}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.measurement}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;
