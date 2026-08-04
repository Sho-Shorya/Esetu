import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",

  initialState: {
    userData: null,
    supplierData: null,
    appLoading: true,
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

    setAppLoading: (state, action) => {
      state.appLoading = action.payload;
    },
  },
});

export const {
  setUserData,
  clearUserData,
  setSupplierData,
  clearSupplierData,
  setAppLoading,
} = userSlice.actions;

export default userSlice.reducer;
