import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { FaClock } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";
import { API_BASE_URL } from "../lib/constants";
import {
  setLoading,
  setTodayOrders,
  removeOrder,
  updateOrderItems,
} from "../redux/orderSlice";
import { Check, Dot } from "lucide-react";

const getCountdown = (cutoffTime, now) => {
  const diff = Math.max(0, new Date(cutoffTime).getTime() - now.getTime());
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const MyTodayOrder = () => {
  const dispatch = useDispatch();

  const { todayOrders, loading } = useSelector((state) => state.orders);

  const [removingId, setRemovingId] = useState(null);
  const [now, setNow] = useState(new Date());

  const token = localStorage.getItem("token");

  /* ========================================
            Fetch Today's Orders
  ======================================== */

  const getTodayOrders = async () => {
    if (!token) return;

    dispatch(setLoading(true));

    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/order/today-orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data.success) {
        dispatch(setTodayOrders(res.data.orders));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Orders load nahi hue.");
    } finally {
      dispatch(setLoading(false));
    }
  };

  useEffect(() => {
    getTodayOrders();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* ========================================
              Remove Item
  ======================================== */

  const removeItem = async (orderId, itemId) => {
    try {
      setRemovingId(itemId);

      const res = await axios.delete(
        `${API_BASE_URL}/api/v1/order/remove-item/${orderId}/${itemId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        if (res.data.deleted) {
          dispatch(removeOrder(orderId));
        } else {
          dispatch(updateOrderItems(res.data.order));
        }

        toast.success("आइटम हटा दिया", { duration: 1000 });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Item remove nahi hua.");
    } finally {
      setRemovingId(null);
    }
  };

  /* ========================================
            Total Orders
  ======================================== */

  const totalOrders = useMemo(() => {
    return todayOrders.length;
  }, [todayOrders]);

  if (loading) {
    return (
      <div className="mt-20 flex justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-100 pb-28 pt-18">
      <div className="max-w-6xl mx-auto px-3">
        {/* Header */}

        <div className="bg-white rounded-3xl shadow-md border border-gray-200 p-5 mb-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">आज का ऑर्डर</h1>

              <p className="text-sm text-gray-500 mt-1">
                आपके Pending और Approved ऑर्डर
              </p>
            </div>

            <div className="bg-green-100 relative px-4 py-2 rounded-2xl">
              <p className="text-xs text-gray-500">Total Orders</p>

              <h2 className="text-2xl   flex items-center justify-center font-bold text-green-700">
                {totalOrders}
              </h2>
            </div>
          </div>
        </div>

        {todayOrders.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-md border border-gray-200 p-12 text-center">
            <img src="/empty-cart.png" alt="" className="w-44 mx-auto" />

            <h2 className="text-2xl font-bold mt-4">आज कोई ऑर्डर नहीं है</h2>

            <p className="text-gray-500 mt-2">
              Cart से ऑर्डर करने के बाद वह यहां दिखाई देगा।
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {todayOrders.map((order) => (
              <div
                key={order._id}
                className="bg-white rounded-3xl shadow-md border border-gray-200 overflow-hidden"
              >
                {/* Order Header */}

                <div className="bg-gray-50 px-5 py-4 border-b flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg">
                      {new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                    <h2 className=" text-xs text-gray-500 mt-1">
                      Order #{order._id.slice(-6)}
                    </h2>
                  </div>

                  <div className="relative">
                    {order.status === "Pending" && (
                      <span className="bg-yellow-100 text-orange-700 text-sm font-semibold px-4 py-2 rounded-1xl">
                        Pending
                        <Dot className="-top-4 animate-ping -right-3 absolute bg-red h-10 w-10" />
                      </span>
                    )}

                    {order.status === "Approved" && (
                      <span className="bg-green-100 text-green-700 text-sm font-semibold px-4 py-2 rounded-full">
                        Approved
                        <Dot className="top-6 -left-6 absolute h-7 w-7" />
                      </span>
                    )}

                    {order.status === "Preparing" && (
                      <span className="bg-blue-100 text-blue-700 text-sm font-semibold px-4 py-2 rounded-full">
                        Preparing
                      </span>
                    )}

                    {order.status === "Out For Delivery" && (
                      <span className="bg-purple-100 text-purple-700 text-sm font-semibold px-4 py-2 rounded-full">
                        Out For Delivery
                      </span>
                    )}

                    {order.status === "Delivered" && (
                      <span className="bg-emerald-100 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-full">
                        Delivered
                      </span>
                    )}

                    {order.status === "Cancelled" && (
                      <span className="bg-red-100 text-red-700 text-sm font-semibold px-4 py-2 rounded-full">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Cutoff Time */}

                <div className="px-5 py-3 border-b bg-orange-50 flex items-center gap-2">
                  <FaClock className="text-orange-600" />

                  <p className="text-sm text-orange-700  font-medium">
                    <span className="ml-2 mr-[5px] font-bold">
                      {new Date(order.cutoffTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    तक एडिट करें!
                  </p>
                </div>

                {/* Items */}

                <div className="divide-y">
                  {order.items.map((item) => (
                    <div key={item._id} className="p-5 flex gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between">
                          <div>
                            <p className="text-sm text-green-700 mt-1">
                              {item.companyName}
                            </p>
                            <h2 className="font-bold text-lg text-gray-800">
                              {item.name}
                            </h2>
                          </div>

                          <div className="text-right">
                            <h2 className="text-xl font-bold text-green-700">
                              ₹{item.total}
                            </h2>

                            <p className="text-sm text-gray-500">
                              ₹{item.price} each
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <div className="flex gap-3">
                            <span className="bg-gray-100 rounded-xl px-3 py-2 text-sm">
                              Qty : {item.qty}
                            </span>

                            <span className="bg-gray-100 rounded-xl px-3 py-2 text-sm">
                              {item.measurement}
                            </span>
                          </div>

                          {order.status === "Pending" && (
                            <button
                              disabled={removingId === item._id}
                              onClick={() => removeItem(order._id, item._id)}
                              className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl transition-all"
                            >
                              <MdDeleteOutline size={20} />
                              {removingId === item._id
                                ? "Removing..."
                                : "Remove"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* <div className="border-b bg-yellow-50 px-5 py-3 text-sm text-yellow-800 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="font-semibold">Order Edit Cutoff</div>
                    <div>
                      {new Date(order.cutoffTime) <= now ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">
                          Cutoff passed — order locked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                          Edit available till{" "}
                          {getCountdown(order.cutoffTime, now)}
                        </span>
                      )}
                    </div>
                  </div> */}

                  {/* Order Footer */}

                  <div className="border-t bg-gray-50 px-5 py-4">
                    <p className="w-full flex items-center justify-center text-red-600 font-bold text-2xl">
                      Total
                    </p>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-600 font-medium">
                        Payment Method
                      </span>

                      <span className="font-semibold text-gray-800">
                        {order.paymentMethod}
                      </span>
                    </div>

                    <div className="border-t pt-4 flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">Total Items</p>

                        <h2 className="text-xl font-bold">
                          {order.items.reduce((sum, item) => sum + item.qty, 0)}
                        </h2>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-500">Grand Total</p>

                        <h2 className="text-3xl font-bold text-green-700">
                          ₹{order.totalAmount}
                        </h2>
                      </div>
                    </div>

                    {order.status === "Pending" && (
                      <div className="mt-5 rounded-2xl bg-yellow-50 border border-yellow-200 p-4">
                        <h3 className="font-semibold text-yellow-700">
                          Order Pending
                        </h3>

                        <p className="text-sm text-yellow-700 mt-1">
                          आपका ऑर्डर अभी Pending है। Admin के approve करने तक या
                          तय समय तक आप items remove कर सकते हैं।
                        </p>
                      </div>
                    )}

                    {order.status === "Approved" && (
                      <div className="mt-5 rounded-2xl bg-green-50 border border-green-200 p-4">
                        <h3 className="font-semibold text-green-700">
                          Order Approved
                        </h3>

                        <p className="text-sm text-green-700 mt-1">
                          आपका ऑर्डर स्वीकार कर लिया गया है और जल्द तैयार किया
                          जाएगा।
                        </p>
                      </div>
                    )}

                    {order.status === "Preparing" && (
                      <div className="mt-5 rounded-2xl bg-blue-50 border border-blue-200 p-4">
                        <h3 className="font-semibold text-blue-700">
                          Preparing Your Order
                        </h3>

                        <p className="text-sm text-blue-700 mt-1">
                          आपकी grocery पैक की जा रही है।
                        </p>
                      </div>
                    )}

                    {order.status === "Out For Delivery" && (
                      <div className="mt-5 rounded-2xl bg-purple-50 border border-purple-200 p-4">
                        <h3 className="font-semibold text-purple-700">
                          Out For Delivery
                        </h3>

                        <p className="text-sm text-purple-700 mt-1">
                          आपका ऑर्डर रास्ते में है।
                        </p>
                      </div>
                    )}

                    {order.status === "Delivered" && (
                      <div className="mt-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                        <h3 className="font-semibold text-emerald-700">
                          Delivered Successfully
                        </h3>

                        <p className="text-sm text-emerald-700 mt-1">
                          धन्यवाद! आपका ऑर्डर सफलतापूर्वक डिलीवर हो गया।
                        </p>
                      </div>
                    )}

                    {order.status === "Cancelled" && (
                      <div className="mt-5 rounded-2xl bg-red-50 border border-red-200 p-4">
                        <h3 className="font-semibold text-red-700">
                          Order Cancelled
                        </h3>

                        <p className="text-sm text-red-700 mt-1">
                          यह ऑर्डर रद्द कर दिया गया है।
                        </p>
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
  );
};

export default MyTodayOrder;
