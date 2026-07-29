import { createSlice } from "@reduxjs/toolkit";

const productSlice = createSlice({
  name: "product",
  initialState: {
    productData: [],
    cart: { items: [] },
  },
  reducers: {
    // actions
    setProductData: (state, action) => {
      state.productData = action.payload;
    },
    addProduct: (state, action) => {
      state.productData.unshift(action.payload);
    },
    setCart: (state, action) => {
      state.cart = action.payload;
    },
    clearCart: (state) => {
      state.cart = null;
    },
  },
});

export const { setProductData, addProduct, setCart, clearCart } =
  productSlice.actions;
export default productSlice.reducer;
