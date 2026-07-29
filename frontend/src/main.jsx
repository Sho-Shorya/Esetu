import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { Toaster } from "./components/ui/sonner";
import { Provider } from "react-redux";
import store from "./redux/store";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Provider store={store}>
      <div className="h-full overflow-y-auto hide-scrollbar">
        <App />
      </div>
      <Toaster richColors position="top-right" />
    </Provider>
  </BrowserRouter>,
);
