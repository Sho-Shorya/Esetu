import { createSlice } from "@reduxjs/toolkit";

const productSlice = createSlice({
  name: "product",
  initialState: {
    productData: [],
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
    setCartData: (state, action) => {
      state.cartData = action.payload;
    },
    clearCart: (state) => {
      state.cartData = { items: [], totalPrice: 0 };
    },
  },
});

export const { setProductData, addProduct, setCartData, clearCart } =
  productSlice.actions;
export default productSlice.reducer;
