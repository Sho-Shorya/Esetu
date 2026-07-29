import React from "react";
import { Outlet, useLocation } from "react-router-dom";

import Navbar from "../components/Navbar";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

const Layout = () => {
  const location = useLocation();

  const showBottomNav = [
    "/",
    "/products",
    "/product",
    "/cart",
    "/orders",
  ].includes(location.pathname);

  return (
    <>
      <Navbar />

      <Outlet />

      {showBottomNav && <Nav />}

      <Footer />
    </>
  );
};

export default Layout;
