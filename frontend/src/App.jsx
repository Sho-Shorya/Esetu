import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import SignUp from "./pages/Signup";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Profile from "./pages/Profile.jsx";
import EditProfile from "./pages/EditProfile";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
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
import AdminCompanyPage from "./pages/admin/AdminCompanyPage";
import AdminCategoryPage from "./pages/admin/AdminCategoryPage";
import AdminRingsPage from "./pages/admin/AdminRingsPage";
import RingsOverlay from "./components/RingsOverlay";
import AdminProductView from "./components/AdminProductView";
import AddProduct from "./components/AddProduct";
import Cart from "./pages/Cart";
import ProductsList from "./pages/ProductsList";
import MyTodayOrder from "./pages/MyTodayOrder";
import OrderHistory from "./pages/Orders";
import Timer from "./components/Timer";
import { initOneSignal } from "./OneSignalInit";
import SplashScreen from "./components/SplashScreen";
import useGetCurrentUser from "../hooks/getCurrentUser";
import getRoutes from "../hooks/getRoutes";
import VerifyOtp from "./pages/VerifyOtp";
import EditProduct from "./components/EditProduct";
import LiveTracking from "./components/LiveTracking";
import OrderSuccess from "./pages/OrderSuccess";
import InvoiceHistory from "./components/InvoiceHistory";
import TermsAndConditions from "./pages/TermsAndConditions";
import RefundCancellation from "./pages/RefundPolicy";
import ReturnPolicy from "./pages/ReturnPolicy";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import PaymentStatus from "./components/PaymentStatus";
import DailyOrders from "./pages/DailyOrders";
function App() {
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (token) {
      initOneSignal();
    }
  }, [token]);
  const { userData, supplierData, appLoading } = useSelector(
    (state) => state.user,
  );
  const dispatch = useDispatch();
  useGetCurrentUser();
  useGetAllProducts();
  getRoutes();
  if (appLoading) {
    return <SplashScreen />;
  }
  return (
    <>
    {userData && <RingsOverlay />}
    <Routes>
      <Route
        path="/login"
        element={userData ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/signup"
        element={userData ? <Navigate to="/" replace /> : <SignUp />}
      />
      <Route path="/verify-otp" element={<VerifyOtp />} />
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
          ) : supplierData ? (
            <Navigate to="/admin-login" replace />
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
      <Route path="/order-success" element={<OrderSuccess />} />
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
        path="/admin-companies"
        element={
          supplierData ? (
            <>
              <Nav />
              <Navbar />
              <AdminCompanyPage />
            </>
          ) : (
            <Navigate to={"/admin-login"} />
          )
        }
      />
      <Route
        path="/admin-categories"
        element={
          supplierData ? (
            <>
              <Nav />
              <Navbar />
              <AdminCategoryPage />
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
      <Route
        path="/edit-product/:id"
        element={
          <>
            <Navbar />
            <EditProduct />
          </>
        }
      />
      <Route path="/tracking/:supplierId" element={<LiveTracking />} />
      <Route
        path="/invoice-history"
        element={
          <>
            <InvoiceHistory />
            <Nav />
            <Footer />
            <Navbar />
          </>
        }
      />
      <Route
        path="/daily-orders"
        element={
          <>
            <Navbar />
            <DailyOrders />
          </>
        }
      />
      <Route path="/payment/status" element={<PaymentStatus />} />
      <Route path="/T&C" element={<TermsAndConditions />} />
      <Route path="/refund-policy" element={<RefundCancellation />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route
        path="/admin-rings"
        element={
          supplierData ? (
            <>
              <Nav />
              <Navbar />
              <AdminRingsPage />
            </>
          ) : (
            <Navigate to="/admin-login" replace />
          )
        }
      />
    </Routes>
    </>
  );
}

export default App;
