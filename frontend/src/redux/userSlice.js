import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    userData: null,
    supplierData: null,
  },
  reducers: {
    setUserData: (state, action) => {
      state.userData = action.payload;
    },
    setSupplierData: (state, action) => {
      state.supplierData = action.payload;
    },
    clearSupplierData: (state) => {
      state.supplierData = null;
    },
    clearUserData: (state) => {
      state.userData = null;
    },
  },
});

export const {
  setUserData,
  clearUserData,
  setSupplierData,
  clearSupplierData,
} = userSlice.actions;
export default userSlice.reducer;
