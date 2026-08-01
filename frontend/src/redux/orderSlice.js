import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  todayOrders: [],
  orderHistory: [],

  loading: false,
  checkoutLoading: false,
  statusUpdating: false,

  error: null,
};

const orderSlice = createSlice({
  name: "orders",

  initialState,

  reducers: {
    setLoading: (state, action) => {
      state.loading = action.payload;
    },

    setCheckoutLoading: (state, action) => {
      state.checkoutLoading = action.payload;
    },

    setStatusUpdating: (state, action) => {
      state.statusUpdating = action.payload;
    },

    setTodayOrders: (state, action) => {
      state.todayOrders = action.payload;
    },

    setOrderHistory: (state, action) => {
      state.orderHistory = action.payload;
    },

    addTodayOrder: (state, action) => {
      const order = action.payload;

      const index = state.todayOrders.findIndex((o) => o._id === order._id);

      if (index !== -1) {
        state.todayOrders[index] = order;
      } else {
        state.todayOrders.unshift(order);
      }
    },

    removeOrder: (state, action) => {
      state.todayOrders = state.todayOrders.filter(
        (order) => order._id !== action.payload,
      );
    },

    updateOrderStatus: (state, action) => {
      const updatedOrder = action.payload;

      const index = state.todayOrders.findIndex(
        (order) => order._id === updatedOrder._id,
      );

      if (index !== -1) {
        state.todayOrders[index] = updatedOrder;
      }
    },

    updateOrderItems: (state, action) => {
      const updatedOrder = action.payload;

      const index = state.todayOrders.findIndex(
        (order) => order._id === updatedOrder._id,
      );

      if (index !== -1) {
        state.todayOrders[index] = updatedOrder;
      }
    },

    moveToHistory: (state, action) => {
      const order = action.payload;

      state.todayOrders = state.todayOrders.filter(
        (item) => item._id !== order._id,
      );

      state.orderHistory.unshift(order);
    },

    clearOrders: (state) => {
      state.todayOrders = [];
      state.orderHistory = [];
    },

    setError: (state, action) => {
      state.error = action.payload;
    },
  },
});

export const {
  setLoading,
  setCheckoutLoading,
  setStatusUpdating,

  setTodayOrders,
  setOrderHistory,

  addTodayOrder,
  removeOrder,
  updateOrderStatus,
  updateOrderItems,
  moveToHistory,

  clearOrders,

  setError,
} = orderSlice.actions;

export default orderSlice.reducer;
