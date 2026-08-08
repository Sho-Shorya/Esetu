import { createSlice } from "@reduxjs/toolkit";

const productSlice = createSlice({
  name: "product",
  initialState: {
    productData: [],
    prodLoading: true,
    cartData: { items: [] },
  },
  reducers: {
    // actions
    setProductData: (state, action) => {
      state.productData = action.payload;
    },
    addProduct: (state, action) => {
      state.productData.unshift(action.payload);
    },
    updateProduct: (state, action) => {
      const updated = action.payload;
      state.productData = state.productData.map((p) =>
        p._id === updated._id ? updated : p,
      );
    },
    removeProduct: (state, action) => {
      state.productData = state.productData.filter(
        (p) => p._id !== action.payload,
      );
    },
    setCartData: (state, action) => {
      state.cartData = action.payload;
    },
    clearCart: (state) => {
      state.cartData = { items: [], totalPrice: 0 };
    },
    setProdLoading: (state, action) => {
      state.prodLoading = action.payload;
    },
  },
});

export const {
  setProductData,
  addProduct,
  updateProduct,
  removeProduct,
  setCartData,
  clearCart,
  setProdLoading,
} = productSlice.actions;
export default productSlice.reducer;
