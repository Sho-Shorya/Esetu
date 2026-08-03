import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SignUp from "./pages/Signup";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Profile from "./pages/Profile.jsx";
import EditProfile from "./pages/EditProfile";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import getCurrentUser from "../hooks/getCurrentUser";
import useGetAllProducts from "../hooks/getAllProducts";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import AdminSignup from "./pages/admin/AdminSignup";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProductPage from "./pages/admin/AdminProductPage";
import AdminTodayOrders from "./pages/admin/AdminTodayOrders";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserProfile from "./pages/admin/AdminUserProfile";
import AdminMoneyControl from "./pages/admin/AdminMoneyControl";
import AdminProductView from "./components/AdminProductView";
import AddProduct from "./components/AddProduct";
import Cart from "./pages/Cart";
import ProductsList from "./pages/ProductsList";
import MyTodayOrder from "./pages/MyTodayOrder";
import OrderHistory from "./pages/Orders";
import Timer from "./components/Timer";
import { initOneSignal } from "./OneSignalInit";
function App() {
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (token) {
      initOneSignal(token);
    }
  }, [token]);
  const { userData, supplierData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  getCurrentUser();
  useGetAllProducts();
  return (
    <Routes>
      <Route
        path="/login"
        element={userData ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/signup"
        element={userData ? <Navigate to="/" replace /> : <SignUp />}
      />
      <Route
        path="/admin-login"
        element={
          supplierData ? (
            <Navigate to="/admin-dashboard" replace />
          ) : (
            <AdminLogin />
          )
        }
      />

      <Route
        path="/admin-signup"
        element={
          supplierData ? (
            <Navigate to="/admin-dashboard" replace />
          ) : (
            <AdminSignup />
          )
        }
      />
      <Route
        path="/"
        element={
          userData ? (
            <>
              <Nav />
              <Home />
              <Navbar />
              <Footer />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/products"
        element={
          userData ? (
            <>
              <Nav />
              <Navbar />
              <div className="mt-16">
                <ProductsList />
              </div>
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/admin-dashboard"
        element={
          supplierData ? (
            <>
              <Nav />
              <Navbar />
              <AdminDashboard />
            </>
          ) : (
            <Navigate to="/admin-login" replace />
          )
        }
      />
      <Route
        path="/product-page"
        element={
          supplierData ? (
            <>
              <Nav />
              <Navbar />
              <AdminProductPage />
              <Footer />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/product-view"
        element={
          supplierData ? (
            <>
              <Nav />
              <Navbar />
              <div className="pb-20">
                <AdminProductView />
              </div>

              <Footer />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/add-product"
        element={
          supplierData ? (
            <>
              <Nav />
              <AddProduct />
              <Navbar />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/today-orders"
        element={
          supplierData ? (
            <>
              <Nav />
              <div className="mx-5 mt-18 mb-20">
                <AdminTodayOrders />
              </div>
              <Navbar />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/admin-users"
        element={
          supplierData ? (
            <>
              <Nav />
              <AdminUsers />
              <Navbar />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/admin/user/:userId"
        element={
          supplierData ? (
            <>
              <Nav />
              <AdminUserProfile />
              <Navbar />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/money-control"
        element={
          supplierData ? (
            <>
              <Nav />
              <AdminMoneyControl />
              <Navbar />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/profile/:userName"
        element={
          userData || supplierData ? (
            <>
              <Navbar />
              <Profile />
            </>
          ) : (
            <Navigate to={"/login"} />
          )
        }
      />
      <Route
        path="/editprofile"
        element={
          userData || supplierData ? (
            <EditProfile />
          ) : (
            <Navigate to={"/login"} />
          )
        }
      />
      <Route
        path="/cart"
        element={
          userData ? (
            <>
              {" "}
              <Cart />
              <Nav />
              <Navbar />
            </>
          ) : (
            <Navigate to={"/login"} />
          )
        }
      />
      <Route
        path="/my-orders"
        element={
          userData ? (
            <>
              <Nav />
              <Navbar />
              <MyTodayOrder />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/order-history"
        element={
          userData ? (
            <>
              <Nav />
              <Navbar />
              <OrderHistory />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/orders"
        element={
          userData ? (
            <>
              <Nav />
              <Navbar />
              <OrderHistory />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
