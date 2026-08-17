import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { FaClock } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";
import { Loader2, X } from "lucide-react";

import { API_BASE_URL } from "../lib/constants";

import {
  setLoading,
  setTodayOrders,
  removeOrder,
  updateOrderItems,
} from "../redux/orderSlice";

import Timer from "@/components/Timer";

// ============================================================
// COMPONENT
// ============================================================

const MyTodayOrder = () => {
  const dispatch = useDispatch();

  const { todayOrders, loading } = useSelector((state) => state.orders);

  // ==========================================================
  // REMOVE CONFIRMATION
  // ==========================================================

  /*
    Instead of only keeping a boolean, we remember exactly
    which order + item the user wants to remove.

    Example:
    {
      orderId: "abc123",
      itemId: "xyz789"
    }
  */
  const [confirmRemoveItem, setConfirmRemoveItem] = useState(null);

  const [removingId, setRemovingId] = useState(null);

  const token = localStorage.getItem("token");

  /*
    Prevents the full-screen loading spinner from appearing
    again whenever Redux data changes.
  */
  const hasFetchedRef = useRef(false);

  // ==========================================================
  // FETCH TODAY'S ORDERS
  // ==========================================================

  const getTodayOrders = useCallback(async () => {
    if (!token) {
      dispatch(setTodayOrders([]));
      dispatch(setLoading(false));
      return;
    }

    /*
      Only show the full-screen loader on the first request.

      If Redux already has orders, keep showing them while
      the API refreshes in the background.
    */
    const isFirstLoad = !hasFetchedRef.current;

    if (isFirstLoad) {
      dispatch(setLoading(true));
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/order/today-orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },

        timeout: 8000,
      });

      if (res.data?.success) {
        dispatch(
          setTodayOrders(Array.isArray(res.data.orders) ? res.data.orders : []),
        );
      }
    } catch (error) {
      console.error("Today's orders error:", error);

      /*
        Only show an error on the initial request.

        Background refresh failures should not annoy the user.
      */
      if (isFirstLoad) {
        toast.error(error.response?.data?.message || "Orders load nahi hue.");
      }
    } finally {
      hasFetchedRef.current = true;

      if (isFirstLoad) {
        dispatch(setLoading(false));
      }
    }
  }, [token, dispatch]);

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    getTodayOrders();
  }, [getTodayOrders]);

  // ==========================================================
  // OPEN REMOVE CONFIRMATION
  // ==========================================================

  const openRemoveConfirmation = useCallback((orderId, itemId) => {
    /*
      Store the exact item that the user wants to remove.

      This is the important fix.
    */
    setConfirmRemoveItem({
      orderId,
      itemId,
    });
  }, []);

  // ==========================================================
  // CLOSE REMOVE CONFIRMATION
  // ==========================================================

  const closeRemoveConfirmation = useCallback(() => {
    /*
      Don't close the modal while the request is processing.
    */
    if (removingId) return;

    setConfirmRemoveItem(null);
  }, [removingId]);

  // ==========================================================
  // OPTIMISTIC REMOVE ITEM
  // ==========================================================

  const removeItem = useCallback(
    async (orderId, itemId) => {
      /*
        Safety check.
      */
      if (!orderId || !itemId) {
        toast.error("Item information missing.");
        return;
      }

      /*
        Prevent duplicate requests for the same item.
      */
      if (removingId === itemId) {
        return;
      }

      // --------------------------------------------------------
      // FIND ORDER
      // --------------------------------------------------------

      const order = todayOrders.find(
        (currentOrder) => currentOrder._id === orderId,
      );

      if (!order) {
        toast.error("Order नहीं मिला।");
        setConfirmRemoveItem(null);
        return;
      }

      // --------------------------------------------------------
      // FIND ITEM
      // --------------------------------------------------------

      const item = order.items?.find(
        (currentItem) => currentItem._id === itemId,
      );

      if (!item) {
        toast.error("Item नहीं मिला।");
        setConfirmRemoveItem(null);
        return;
      }

      // --------------------------------------------------------
      // SAVE ORIGINAL ORDER FOR ROLLBACK
      // --------------------------------------------------------

      /*
        Create a snapshot instead of keeping the same nested
        object reference.

        This makes rollback safer.
      */
      const originalOrder = {
        ...order,
        items: [...(order.items || [])],
      };

      // --------------------------------------------------------
      // LOCK BUTTON
      // --------------------------------------------------------

      setRemovingId(itemId);

      /*
        Close confirmation modal immediately.

        The item itself will now show "Removing..."
      */
      setConfirmRemoveItem(null);

      // --------------------------------------------------------
      // REMOVE IMMEDIATELY FROM UI
      // --------------------------------------------------------

      const remainingItems = (order.items || []).filter(
        (currentItem) => currentItem._id !== itemId,
      );

      /*
        If this was the last item, remove the whole order
        immediately from Redux.
      */
      if (remainingItems.length === 0) {
        dispatch(removeOrder(orderId));
      } else {
        /*
          Otherwise update the order immediately.
        */
        dispatch(
          updateOrderItems({
            ...order,
            items: remainingItems,

            totalAmount: remainingItems.reduce(
              (sum, currentItem) => sum + Number(currentItem.total || 0),
              0,
            ),
          }),
        );
      }

      // --------------------------------------------------------
      // BACKGROUND API REQUEST
      // --------------------------------------------------------

      try {
        const res = await axios.delete(
          `${API_BASE_URL}/api/v1/order/remove-item/${orderId}/${itemId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },

            timeout: 8000,
          },
        );

        // ------------------------------------------------------
        // SERVER FAILURE
        // ------------------------------------------------------

        if (!res.data?.success) {
          /*
            Rollback optimistic update.
          */
          dispatch(updateOrderItems(originalOrder));

          toast.error(res.data?.message || "Item remove nahi hua.");

          return;
        }

        // ------------------------------------------------------
        // SERVER CONFIRMATION
        // ------------------------------------------------------

        /*
          Backend says the whole order was deleted.
        */
        if (res.data.deleted) {
          dispatch(removeOrder(orderId));
        } else if (res.data.order) {
          /*
          Backend returned the updated order.
        */
          dispatch(updateOrderItems(res.data.order));
        }

        toast.success("आइटम हटा दिया", {
          duration: 1000,
        });
      } catch (error) {
        console.error("Remove item error:", error);

        // ------------------------------------------------------
        // ROLLBACK
        // ------------------------------------------------------

        dispatch(updateOrderItems(originalOrder));

        toast.error(error.response?.data?.message || "Item remove nahi hua.");
      } finally {
        setRemovingId(null);
      }
    },
    [todayOrders, removingId, token, dispatch],
  );

  // ==========================================================
  // CONFIRM REMOVE
  // ==========================================================

  const confirmRemove = useCallback(() => {
    if (!confirmRemoveItem) return;

    const { orderId, itemId } = confirmRemoveItem;

    removeItem(orderId, itemId);
  }, [confirmRemoveItem, removeItem]);

  // ==========================================================
  // INITIAL LOADING ONLY
  // ==========================================================

  /*
    Do NOT show this spinner during background refresh.

    If Redux already has today's orders, they remain visible.
  */
  if (loading && !hasFetchedRef.current && todayOrders.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="
            h-10
            w-10
            animate-spin
            rounded-full
            border-[3px]
            border-gray-200
            border-t-red-600
          "
        />
      </div>
    );
  }

  // ==========================================================
  // UI
  // ==========================================================

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
            TIMER
        ================================================== */}

        <Timer />

        {/* ==================================================
            HEADER
        ================================================== */}

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
                          flex
                          items-center
                          gap-2
                          rounded-2xl
                          bg-yellow-100
                          px-4
                          py-2
                          text-sm
                          font-semibold
                          text-orange-700
                        "
                      >
                        <span
                          className="
                            h-3
                            w-3
                            animate-ping
                            rounded-full
                            bg-red-600
                          "
                        />
                        Pending
                      </span>
                    )}

                    {order.status === "Approved" && (
                      <span
                        className="
                          flex
                          items-center
                          gap-2
                          rounded-full
                          bg-green-100
                          px-4
                          py-2
                          text-sm
                          font-semibold
                          text-green-700
                        "
                      >
                        <span
                          className="
                            h-3
                            w-3
                            rounded-full
                            bg-green-600
                          "
                        />
                        Approved
                      </span>
                    )}

                    {order.status === "Declined" && (
                      <span
                        className="
                          flex
                          items-center
                          gap-2
                          rounded-full
                          bg-red-100
                          px-4
                          py-2
                          text-sm
                          font-semibold
                          text-red-700
                        "
                      >
                        <span
                          className="
                            h-3
                            w-3
                            rounded-full
                            bg-gray-600
                          "
                        />
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
                  {order.items?.map((item) => (
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

                          {/* REMOVE */}

                          {order.status === "Pending" && (
                            <button
                              type="button"
                              disabled={removingId === item._id}
                              onClick={() =>
                                openRemoveConfirmation(order._id, item._id)
                              }
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
                              {removingId === item._id ? (
                                <>
                                  <Loader2 size={18} className="animate-spin" />
                                  Removing...
                                </>
                              ) : (
                                <>
                                  <MdDeleteOutline size={20} />
                                  Remove
                                </>
                              )}
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
                        {(order.items || []).reduce(
                          (sum, item) => sum + Number(item.qty || 0),
                          0,
                        )}
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

      {/* ======================================================
          REMOVE CONFIRMATION MODAL
      ====================================================== */}

      {confirmRemoveItem && (
        <div
          className="
            fixed
            inset-0
            z-[100]
            flex
            h-screen
            items-center
            justify-center
            bg-black/60
            p-5
            backdrop-blur-sm
          "
          onClick={closeRemoveConfirmation}
        >
          <div
            className="
              w-full
              max-w-sm
              rounded-3xl
              bg-white
              p-6
              shadow-2xl
            "
            onClick={(event) => event.stopPropagation()}
          >
            {/* ICON */}

            <div
              className="
                mx-auto
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                bg-red-100
                text-red-600
              "
            >
              <MdDeleteOutline size={30} />
            </div>

            {/* TITLE */}

            <h2
              className="
                mt-4
                text-center
                text-xl
                font-bold
                text-neutral-900
              "
            >
              सामान हटाएँ?
            </h2>

            {/* DESCRIPTION */}

            <p
              className="
                mt-2
                text-center
                text-sm
                leading-6
                text-neutral-500
              "
            >
              क्या आप इस सामान को अपने आज के ऑर्डर से हटाना चाहते हैं?
            </p>

            {/* ACTIONS */}

            <div
              className="
                mt-6
                flex
                gap-3
              "
            >
              {/* CANCEL */}

              <button
                type="button"
                disabled={Boolean(removingId)}
                onClick={closeRemoveConfirmation}
                className="
                  flex
                  h-12
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-gray-200
                  bg-white
                  px-5
                  text-sm
                  font-bold
                  text-gray-700
                  transition
                  hover:bg-gray-50
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                <X size={17} />
                नहीं
              </button>

              {/* CONFIRM */}

              <button
                type="button"
                disabled={Boolean(removingId)}
                onClick={confirmRemove}
                className="
                  flex
                  h-12
                  flex-1
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-red-600
                  px-5
                  text-sm
                  font-bold
                  text-white
                  shadow-lg
                  shadow-red-600/20
                  transition
                  hover:bg-red-700
                  active:scale-[0.98]
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {removingId ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    हट रहा...
                  </>
                ) : (
                  <>
                    <MdDeleteOutline size={19} />
                    हाँ, हटाएँ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTodayOrder;
