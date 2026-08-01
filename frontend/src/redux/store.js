import userReducer from "./userSlice";
import productReducer from "./ProductSlice";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import orderReducer from "./orderSlice";
import {
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";

const persistConfig = {
  key: "Ekart",
  version: 1,
  storage,
};

const rootReducer = combineReducers({
  user: userReducer,
  product: productReducer,
  orders: orderReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export default store;
