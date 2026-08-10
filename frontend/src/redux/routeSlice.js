import { createSlice } from "@reduxjs/toolkit";

const routeSlice = createSlice({
  name: "routes",
  initialState: {
    suppliers: [],
    routes: [],
  },
  reducers: {
    setSuppliers: (state, action) => {
      state.suppliers = action.payload;
    },

    setRoutes: (state, action) => {
      state.routes = action.payload;
    },
  },
});

export const { setSuppliers, setRoutes } = routeSlice.actions;
export default routeSlice.reducer;
