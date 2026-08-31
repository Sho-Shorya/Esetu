import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { FaClock } from "react-icons/fa";
import { MdDeleteOutline } from "react-icons/md";
import {
  Check,
  IndianRupee,
  Loader2,
  Minus,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

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

  const [downloadingReceiptId, setDownloadingReceiptId] = useState(null);

  const [editingOrder, setEditingOrder] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const token = localStorage.getItem("token");

  /*
    Prevents the full-screen loading spinner from appearing
    again whenever Redux data changes.
  */
  const hasFetchedRef = useRef(false);

  // ==========================================================
  // DOWNLOAD RECEIPT PDF
  // ==========================================================

  const downloadReceipt = async (order) => {
    if (!order || downloadingReceiptId) return;

    try {
      setDownloadingReceiptId(order._id);

      const res = await axios.get(
        `${API_BASE_URL}/api/v1/order/receipt/${order._id}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },

          responseType: "blob",
          timeout: 15000,
        },
      );

      const blob = new Blob([res.data], {
        type: "application/pdf",
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = `e-setu-receipt-${String(order._id).slice(-8)}.pdf`;

      link.style.display = "none";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (error) {
      console.error("Receipt download error:", error);

      toast.error("रसीद डाउनलोड नहीं हो सकी।");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

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
  // EDIT ORDER SHEET
  // ==========================================================

  const openEditSheet = useCallback(
    (order) => {
      if (savingEdit) return;

      const orderInList = todayOrders.find((o) => o._id === order._id);

      if (!orderInList || orderInList.status !== "Pending") return;

      setEditingOrder(JSON.parse(JSON.stringify(orderInList)));
    },
    [savingEdit, todayOrders],
  );

  const closeEditSheet = useCallback(() => {
    if (savingEdit) return;

    setEditingOrder(null);
  }, [savingEdit]);

  const changeQty = useCallback((itemId, change) => {
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
  }, []);

  const removeItemFromEdit = useCallback((itemId) => {
    setEditingOrder((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        items: prev.items.filter((item) => item._id !== itemId),
      };
    });
  }, []);

  const editingTotal = useCallback(() => {
    if (!editingOrder) return 0;

    return (
      editingOrder.items?.reduce(
        (sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0),
        0,
      ) || 0
    );
  }, [editingOrder]);

  const saveOrderEdit = useCallback(async () => {
    if (!editingOrder || savingEdit) return;

    try {
      setSavingEdit(true);

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
        `${API_BASE_URL}/api/v1/order/user/update-items/${editingOrder._id}`,
        { items },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 8000,
        },
      );

      if (res.data?.success) {
        if (res.data.deleted) {
          dispatch(removeOrder(editingOrder._id));
        } else if (res.data.order) {
          dispatch(updateOrderItems(res.data.order));
        }

        setEditingOrder(null);

        toast.success("ऑर्डर अपडेट हो गया।", { duration: 1000 });
      }
    } catch (error) {
      console.error("Edit order error:", error);

      toast.error(error.response?.data?.message || "ऑर्डर अपडेट नहीं हो सका।");
    } finally {
      setSavingEdit(false);
    }
  }, [editingOrder, savingEdit, todayOrders, token, dispatch]);

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
                    CUTOFF (edit allowed only while Pending)
                ========================================== */}

                {order.status === "Pending" && (
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      gap-2
                      border-b
                      bg-orange-50
                      px-5
                      py-3
                    "
                  >
                    <div className="flex items-center gap-1">
                      <FaClock className="text-orange-600" />

                      <p
                        className="
                        text-sm
                        font-medium
                        text-orange-700
                      "
                      >
                        Approve होने तक एडिट करें!
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => openEditSheet(order)}
                      className="
                          
                          flex
                          w-[130px]
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          bg-red-600
                          px-3
                          py-2
                          text-sm
                          font-bold
                          text-white
                          transition
                          hover:bg-slate-800
                          active:scale-[0.99]
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                        "
                    >
                      <Pencil size={16} />
                      एडिट करें
                    </button>
                  </div>
                )}

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

                  {/* RECEIPT DOWNLOAD */}

                  {order.receiptGenerated && (
                    <div className="mt-5">
                      <button
                        type="button"
                        disabled={downloadingReceiptId === order._id}
                        onClick={() => downloadReceipt(order)}
                        className="
                          flex
                          w-full
                          items-center
                          justify-center
                          gap-2
                          rounded-2xl
                          border
                          border-red-100
                          bg-red-50
                          px-4
                          py-3.5
                          font-semibold
                          text-red-600
                          transition-all
                          hover:bg-red-100
                          disabled:cursor-not-allowed
                          disabled:opacity-60
                        "
                      >
                        {downloadingReceiptId === order._id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <ReceiptText size={18} />
                        )}

                        {downloadingReceiptId === order._id
                          ? "डाउनलोड हो रहा..."
                          : "रसीड डाउनलोड करें"}
                      </button>
                    </div>
                  )}

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
                        आपका ऑर्डर अभी Pending है। Admin के approve करने तक आप
                        items बदल सकते हैं।
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
          EDIT ORDER BOTTOM SHEET
      ====================================================== */}

      {editingOrder && (
        <div className="fixed inset-0 z-[110]">
          {/* BACKDROP */}

          <button
            aria-label="Close"
            onClick={closeEditSheet}
            disabled={savingEdit}
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

            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                border-b
                border-slate-100
                px-5
                py-4
              "
            >
              <div className="min-w-0">
                <p className="truncate text-xl font-black text-slate-900">
                  ऑर्डर एडिट करें
                </p>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Order #{editingOrder._id?.slice(-6)}
                </p>
              </div>

              <button
                onClick={closeEditSheet}
                disabled={savingEdit}
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

                      <div
                        className="
                          flex
                          h-14
                          w-14
                          shrink-0
                          items-center
                          justify-center
                          overflow-hidden
                          rounded-2xl
                          bg-slate-100
                        "
                      >
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

                      <div
                        className="
                          flex
                          shrink-0
                          items-center
                          gap-1
                          rounded-xl
                          bg-slate-100
                          p-1
                        "
                      >
                        <button
                          type="button"
                          onClick={() => changeQty(item._id, -1)}
                          className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            bg-white
                            shadow-sm
                            active:scale-95
                          "
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <span
                          className="
                            w-7
                            text-center
                            text-sm
                            font-black
                          "
                        >
                          {item.qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => changeQty(item._id, 1)}
                          className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            bg-white
                            shadow-sm
                            active:scale-95
                          "
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      {/* REMOVE */}

                      <button
                        type="button"
                        onClick={() => removeItemFromEdit(item._id)}
                        className="
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-red-50
                          text-red-500
                          active:scale-95
                        "
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* EMPTY STATE */}

                {editingOrder.items?.length === 0 && (
                  <div
                    className="
                      rounded-[22px]
                      border
                      border-dashed
                      border-slate-200
                      bg-slate-50
                      py-10
                      text-center
                    "
                  >
                    <ShoppingBag className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-bold text-slate-400">
                      कोई सामान नहीं बचा
                    </p>
                  </div>
                )}

                {/* NEW TOTAL */}

                <div
                  className="
                    mt-4
                    rounded-[22px]
                    bg-slate-900
                    p-4
                    text-white
                  "
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white/60">
                      नया बिल
                    </span>

                    <span
                      className="
                        flex
                        items-center
                        text-2xl
                        font-black
                      "
                    >
                      <IndianRupee className="h-5 w-5" />
                      {editingTotal().toLocaleString("en-IN")}
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
                  disabled={savingEdit}
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
                  onClick={saveOrderEdit}
                  disabled={savingEdit}
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
                  {savingEdit ? (
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
