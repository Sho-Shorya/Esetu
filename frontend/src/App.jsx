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
function App() {
  const { userData, supplierData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  getCurrentUser();
  useGetAllProducts();

  // 1. Grab your location path strings
  const { pathname } = useLocation();
  const scrollRegistry = useRef({});

  useEffect(() => {
    // 2. Select the scrollable layout div container
    const scrollContainer = document.querySelector(".overflow-y-auto");
    if (!scrollContainer) return;

    // 3. RESTORE: If we have a saved height position, jump there; if not, go to the top
    if (scrollRegistry.current[pathname] !== undefined) {
      scrollContainer.scrollTo(0, scrollRegistry.current[pathname]);
    } else {
      scrollContainer.scrollTo(0, 0);
    }

    // 4. SAVE: Track manual scrolling actions in real-time to log active heights
    const handleScroll = () => {
      scrollRegistry.current[pathname] = scrollContainer.scrollTop;
    };

    scrollContainer.addEventListener("scroll", handleScroll);
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, [pathname]); // Fires cleanly every single time you navigate paths

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
              <Footer />
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
                <AdminProductView tailwind="mt-18" />
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
              <AdminTodayOrders />
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
