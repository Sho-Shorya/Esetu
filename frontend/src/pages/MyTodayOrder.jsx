import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { FaClock } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";
import { Check, Dot } from "lucide-react";

import { API_BASE_URL } from "../lib/constants";

import {
  setLoading,
  setTodayOrders,
  removeOrder,
  updateOrderItems,
} from "../redux/orderSlice";

import Timer from "@/components/Timer";

// ======================================================
// HELPERS
// ======================================================

const getCountdown = (cutoffTime, now) => {
  const diff = Math.max(0, new Date(cutoffTime).getTime() - now.getTime());

  const hours = Math.floor(diff / 3600000);

  const minutes = Math.floor((diff % 3600000) / 60000);

  const seconds = Math.floor((diff % 60000) / 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// ======================================================
// COMPONENT
// ======================================================

const MyTodayOrder = () => {
  const dispatch = useDispatch();

  const { todayOrders, loading } = useSelector((state) => state.orders);

  const [removingId, setRemovingId] = useState(null);

  const token = localStorage.getItem("token");

  // ====================================================
  // FETCH TODAY'S ORDERS
  // ====================================================

  const getTodayOrders = useCallback(async () => {
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
  }, [token, dispatch]);

  // ====================================================
  // LOAD ONCE
  // ====================================================

  useEffect(() => {
    getTodayOrders();
  }, [getTodayOrders]);

  // ====================================================
  // FAST OPTIMISTIC REMOVE
  // ====================================================

  const removeItem = useCallback(
    async (orderId, itemId) => {
      // Prevent duplicate requests
      if (removingId === itemId) {
        return;
      }

      // Find the order before modifying Redux
      const order = todayOrders.find((order) => order._id === orderId);

      if (!order) return;

      // Find the item
      const item = order.items.find((item) => item._id === itemId);

      if (!item) return;

      // ------------------------------------------------
      // SAVE ORIGINAL STATE
      // ------------------------------------------------

      const originalOrder = order;

      // ------------------------------------------------
      // UI UPDATES IMMEDIATELY
      // ------------------------------------------------

      setRemovingId(itemId);

      const remainingItems = order.items.filter((item) => item._id !== itemId);

      // If this was the last item,
      // optimistically remove the entire order.
      if (remainingItems.length === 0) {
        dispatch(removeOrder(orderId));
      } else {
        // Otherwise immediately update
        // the order's items.
        dispatch(
          updateOrderItems({
            ...order,
            items: remainingItems,

            // Recalculate total
            totalAmount: remainingItems.reduce(
              (sum, item) => sum + Number(item.total || 0),
              0,
            ),
          }),
        );
      }

      // ------------------------------------------------
      // BACKGROUND API REQUEST
      // ------------------------------------------------

      try {
        const res = await axios.delete(
          `${API_BASE_URL}/api/v1/order/remove-item/${orderId}/${itemId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.data.success) {
          // --------------------------------------------
          // ROLLBACK
          // --------------------------------------------

          dispatch(updateOrderItems(originalOrder));

          toast.error(res.data.message || "Item remove nahi hua.");

          return;
        }

        // ------------------------------------------------
        // SERVER RESPONSE
        // ------------------------------------------------

        if (res.data.deleted) {
          // Server confirms whole order deleted
          dispatch(removeOrder(orderId));
        } else if (res.data.order) {
          // Server confirms updated order
          dispatch(updateOrderItems(res.data.order));
        }

        toast.success("आइटम हटा दिया", {
          duration: 1000,
        });
      } catch (error) {
        // ------------------------------------------------
        // ROLLBACK IF REQUEST FAILS
        // ------------------------------------------------

        dispatch(updateOrderItems(originalOrder));

        toast.error(error.response?.data?.message || "Item remove nahi hua.");
      } finally {
        setRemovingId(null);
      }
    },
    [todayOrders, removingId, token, dispatch],
  );

  // ====================================================
  // LOADING
  // ====================================================

  if (loading) {
    return (
      <div className="absolute h-full w-full flex items-center justify-center">
        <div
          className="
            h-12
            w-12
            animate-spin
            rounded-full
            border-4
            border-red-600
            border-t-transparent
          "
        />
      </div>
    );
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <div
      className="
        min-h-screen
        bg-gray-100
        pb-60
        pt-18
      "
    >
      <div
        className="
          mx-auto
          max-w-6xl
          px-3
        "
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <Timer />

        <div
          className="
            mb-5
            rounded-3xl
            border
            border-gray-200
            bg-white
            p-5
            shadow-md
          "
        >
          <div
            className="
              relative
              flex
              items-center
              justify-between
            "
          >
            <div>
              <h1
                className="
                  text-2xl
                  font-bold
                  text-gray-800
                "
              >
                आज का ऑर्डर
              </h1>

              <p
                className="
                  mt-3
                  text-sm
                  text-gray-500
                "
              >
                आपके Pending और Approved ऑर्डर
              </p>
            </div>

            <div
              className="
                relative
                h-full
                w-35
              "
            >
              <img
                src="./penpaper.png"
                alt=""
                className="
                  z-5
                  h-30
                  w-35
                "
              />
            </div>
          </div>
        </div>

        {/* ==================================================
            EMPTY STATE
        ================================================== */}

        {todayOrders.length === 0 ? (
          <div
            className="
              rounded-3xl
              border
              border-gray-200
              bg-white
              p-12
              text-center
              shadow-md
            "
          >
            <img src="/empty-cart.png" alt="" className="mx-auto w-44" />

            <h2
              className="
                mt-4
                text-2xl
                font-bold
              "
            >
              आज कोई ऑर्डर नहीं है
            </h2>

            <p
              className="
                mt-2
                text-gray-500
              "
            >
              Cart से ऑर्डर करने के बाद वह यहां दिखाई देगा।
            </p>
          </div>
        ) : (
          /* ==================================================
             ORDERS
          ================================================== */

          <div className="space-y-5">
            {todayOrders.map((order) => (
              <div
                key={order._id}
                className="
                    overflow-hidden
                    rounded-3xl
                    border
                    border-gray-200
                    bg-white
                    shadow-md
                  "
              >
                {/* ==========================================
                      ORDER HEADER
                  ========================================== */}

                <div
                  className="
                      flex
                      items-center
                      justify-between
                      border-b
                      bg-gray-50
                      px-5
                      py-4
                    "
                >
                  <div>
                    <p
                      className="
                          text-lg
                          font-bold
                        "
                    >
                      {new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>

                    <h2
                      className="
                          mt-1
                          text-xs
                          text-gray-500
                        "
                    >
                      Order #{order._id.slice(-6)}
                    </h2>
                  </div>

                  {/* STATUS */}

                  <div className="relative flex">
                    {order.status === "Pending" && (
                      <span
                        className="
                      rounded-2xl
                            bg-yellow-100
                            px-4
                            py-2
                            flex
                            gap-2
                            items-center
                            text-sm
                            font-semibold
                            text-orange-700
                            "
                      >
                        <p
                          className={`
                                  h-3
                                  w-3
                                  rounded-full
                                  animate-ping bg-red-600
                                  ${!order.status === "Approved" && "bg-green-600"}
                                  ${!order.status === "Declined" && "bg-gray-600"}
                                  
                                  
                                `}
                        ></p>
                        Pending
                      </span>
                    )}

                    {order.status === "Approved" && (
                      <span
                        className="
                            rounded-full
                            bg-green-100
                            px-4
                            flex
                            items-center
                            py-2
                            text-sm
                            font-semibold
                            text-green-700
                          "
                      >
                        <p
                          className={`
                                  h-3
                                  w-3
                                  rounded-full
                                  bg-green-600
                                `}
                        ></p>
                        Approved
                      </span>
                    )}

                    {order.status === "Declined" && (
                      <span
                        className="
                            rounded-full
                            bg-red-100
                            px-4
                            py-2
                            text-sm
                            font-semibold
                            text-red-700
                          "
                      >
                        <p
                          className={`
                                  h-3
                                  w-3
                                  rounded-full
                                  bg-gray-600
                                  
                                  
                                `}
                        ></p>
                        Declined
                      </span>
                    )}
                  </div>
                </div>

                {/* ==========================================
                      CUTOFF
                  ========================================== */}

                <div
                  className="
                      flex
                      items-center
                      gap-2
                      border-b
                      bg-orange-50
                      px-5
                      py-3
                    "
                >
                  <FaClock className="text-orange-600" />

                  <p
                    className="
                        text-sm
                        font-medium
                        text-orange-700
                      "
                  >
                    <span
                      className="
                          ml-2
                          mr-[5px]
                          font-bold
                        "
                    >
                      {new Date(order.cutoffTime).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    तक एडिट करें!
                  </p>
                </div>

                {/* ==========================================
                      ITEMS
                  ========================================== */}

                <div className="divide-y">
                  {order.items.map((item) => (
                    <div
                      key={item._id}
                      className="
                            flex
                            gap-4
                            p-5
                          "
                    >
                      <div className="flex-1">
                        {/* PRODUCT INFO */}

                        <div
                          className="
                                flex
                                justify-between
                              "
                        >
                          <div>
                            <p
                              className="
                                    mt-1
                                    text-sm
                                    text-green-700
                                  "
                            >
                              {item.companyName}
                            </p>

                            <h2
                              className="
                                    text-lg
                                    font-bold
                                    text-gray-800
                                  "
                            >
                              {item.name}
                            </h2>
                          </div>

                          <div className="text-right">
                            <h2
                              className="
                                    text-xl
                                    font-bold
                                    text-green-700
                                  "
                            >
                              ₹{item.total}
                            </h2>

                            <p
                              className="
                                    text-sm
                                    text-gray-500
                                  "
                            >
                              ₹{item.price} each
                            </p>
                          </div>
                        </div>

                        {/* ITEM ACTIONS */}

                        <div
                          className="
                                mt-4
                                flex
                                items-center
                                justify-between
                              "
                        >
                          <div className="flex gap-3">
                            <span
                              className="
                                    rounded-xl
                                    bg-gray-100
                                    px-3
                                    py-2
                                    text-sm
                                  "
                            >
                              Qty : {item.qty}
                            </span>

                            <span
                              className="
                                    rounded-xl
                                    bg-gray-100
                                    px-3
                                    py-2
                                    text-sm
                                  "
                            >
                              {item.measurement}
                            </span>
                          </div>

                          {order.status === "Pending" && (
                            <button
                              disabled={removingId === item._id}
                              onClick={() => removeItem(order._id, item._id)}
                              className="
                                    flex
                                    items-center
                                    gap-2
                                    rounded-xl
                                    bg-red-50
                                    px-4
                                    py-2
                                    text-red-600
                                    transition-all
                                    hover:bg-red-100
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                  "
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
                </div>

                {/* ==========================================
                      ORDER FOOTER
                  ========================================== */}

                <div
                  className="
                      border-t
                      bg-gray-50
                      px-5
                      py-4
                    "
                >
                  <p
                    className="
                        flex
                        w-full
                        items-center
                        justify-center
                        text-2xl
                        font-bold
                        text-red-600
                      "
                  >
                    Total
                  </p>

                  <div
                    className="
                        mb-3
                        flex
                        items-center
                        justify-between
                      "
                  >
                    <span
                      className="
                          font-medium
                          text-gray-600
                        "
                    >
                      Payment Method
                    </span>

                    <span
                      className="
                          font-semibold
                          text-gray-800
                        "
                    >
                      {order.paymentMethod}
                    </span>
                  </div>

                  <div
                    className="
                        flex
                        items-center
                        justify-between
                        border-t
                        pt-4
                      "
                  >
                    <div>
                      <p
                        className="
                            text-sm
                            text-gray-500
                          "
                      >
                        Total Items
                      </p>

                      <h2
                        className="
                            text-xl
                            font-bold
                          "
                      >
                        {order.items.reduce((sum, item) => sum + item.qty, 0)}
                      </h2>
                    </div>

                    <div className="text-right">
                      <p
                        className="
                            text-sm
                            text-gray-500
                          "
                      >
                        Grand Total
                      </p>

                      <h2
                        className="
                            text-3xl
                            font-bold
                            text-green-700
                          "
                      >
                        ₹{order.totalAmount}
                      </h2>
                    </div>
                  </div>

                  {/* ========================================
                        PENDING
                    ======================================== */}

                  {order.status === "Pending" && (
                    <div
                      className="
                          mt-5
                          rounded-2xl
                          border
                          border-yellow-200
                          bg-yellow-50
                          p-4
                        "
                    >
                      <h3
                        className="
                            font-semibold
                            text-yellow-700
                          "
                      >
                        Order Pending
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-yellow-700
                          "
                      >
                        आपका ऑर्डर अभी Pending है। Admin के approve करने तक या
                        तय समय तक आप items remove कर सकते हैं।
                      </p>
                    </div>
                  )}

                  {/* ========================================
                        APPROVED
                    ======================================== */}

                  {order.status === "Approved" && (
                    <div
                      className="
                          mt-5
                          rounded-2xl
                          border
                          border-green-200
                          bg-green-50
                          p-4
                        "
                    >
                      <h3
                        className="
                            font-semibold
                            text-green-700
                          "
                      >
                        Order Approved
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-green-700
                          "
                      >
                        आपका ऑर्डर स्वीकार कर लिया गया है और जल्द तैयार किया
                        जाएगा।
                      </p>
                    </div>
                  )}

                  {/* ========================================
                        PREPARING
                    ======================================== */}

                  {order.status === "Preparing" && (
                    <div
                      className="
                          mt-5
                          rounded-2xl
                          border
                          border-blue-200
                          bg-blue-50
                          p-4
                        "
                    >
                      <h3
                        className="
                            font-semibold
                            text-blue-700
                          "
                      >
                        Preparing Your Order
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-blue-700
                          "
                      >
                        आपकी grocery पैक की जा रही है।
                      </p>
                    </div>
                  )}

                  {/* ========================================
                        OUT FOR DELIVERY
                    ======================================== */}

                  {order.status === "Out For Delivery" && (
                    <div
                      className="
                          mt-5
                          rounded-2xl
                          border
                          border-purple-200
                          bg-purple-50
                          p-4
                        "
                    >
                      <h3
                        className="
                            font-semibold
                            text-purple-700
                          "
                      >
                        Out For Delivery
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-purple-700
                          "
                      >
                        आपका ऑर्डर रास्ते में है।
                      </p>
                    </div>
                  )}

                  {/* ========================================
                        DELIVERED
                    ======================================== */}

                  {order.status === "Delivered" && (
                    <div
                      className="
                          mt-5
                          rounded-2xl
                          border
                          border-emerald-200
                          bg-emerald-50
                          p-4
                        "
                    >
                      <h3
                        className="
                            font-semibold
                            text-emerald-700
                          "
                      >
                        Delivered Successfully
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-emerald-700
                          "
                      >
                        धन्यवाद! आपका ऑर्डर सफलतापूर्वक डिलीवर हो गया।
                      </p>
                    </div>
                  )}

                  {/* ========================================
                        CANCELLED
                    ======================================== */}

                  {order.status === "Cancelled" && (
                    <div
                      className="
                          mt-5
                          rounded-2xl
                          border
                          border-red-200
                          bg-red-50
                          p-4
                        "
                    >
                      <h3
                        className="
                            font-semibold
                            text-red-700
                          "
                      >
                        Order Cancelled
                      </h3>

                      <p
                        className="
                            mt-1
                            text-sm
                            text-red-700
                          "
                      >
                        यह ऑर्डर रद्द कर दिया गया है।
                      </p>
                    </div>
                  )}
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
