import {
  ShoppingCart,
  Loader2,
  Search,
  Menu,
  X,
  ChevronDown,
  LoaderCircle,
  BadgePercent,
  UserRoundPen,
  ReceiptText,
  ListChecks,
  MoveUpRight,
  TrendingUp,
  LayoutDashboard,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useDispatch, useSelector } from "react-redux";
import {
  setUserData,
  clearUserData,
  clearSupplierData,
} from "../redux/userSlice";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import { BiPowerOff } from "react-icons/bi";
import { CgProductHunt } from "react-icons/cg";

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { userData, supplierData } = useSelector((state) => state.user || {});

  const { cartData } = useSelector((state) => state.product || {});

  const [slideBar, setSlideBar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState("");
  const [badgePulse, setBadgePulse] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [adminConfirmLogout, setAdminConfirmLogout] = useState(false);
  const [userConfirmLogout, setUserConfirmLogout] = useState(false);

  const userMenuRef = useRef(null);

  // Update cart badge
  useEffect(() => {
    const count = cartData?.items?.length || 0;
    setCartCount(count);

    if (count > 0) {
      setBadgePulse(true);
      const timer = setTimeout(() => setBadgePulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [cartData]);

  // Close user menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showUserMenu &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target)
      ) {
        setShowUserMenu(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showUserMenu]);

  const logoutHandler = async () => {
    setLoading(true);

    const token = localStorage.getItem("token");

    if (!token) {
      dispatch(clearUserData());
      dispatch(clearSupplierData());
      localStorage.removeItem("token");
      navigate(supplierData ? "/admin-login" : "/login");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/user/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data.success) {
        toast.success(res.data.message || "Logged out successfully");
        dispatch(clearUserData());
        dispatch(clearSupplierData());
        localStorage.removeItem("token");
        navigate(supplierData ? "/admin-login" : "/login");
      } else {
        toast.error(res.data.message || "Logout failed");
      }
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message || err.message || "Logout failed";

      console.error("Logout Error:", err);

      if (status === 401 || status === 403) {
        dispatch(clearUserData());
        dispatch(clearSupplierData());
        localStorage.removeItem("token");
        navigate(supplierData ? "/admin-login" : "/login");
      }

      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();

    if (!search.trim()) {
      navigate("/products");
      return;
    }

    navigate(`/products?search=${encodeURIComponent(search.trim())}`);
  };

  const avatarInitial = (
    userData?.firstName?.[0] ||
    supplierData?.firstName?.[0] ||
    "U"
  ).toUpperCase();

  const avatarUrl = userData?.profilePic || supplierData?.profilePic || "";

  return (
    <header className=" fixed top-0 left-0 right-0 z-40 border-b bg-gray-100 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-gray-700 hover:text-red-500"
              onClick={() => setSlideBar(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            <Link
              to={supplierData ? "/admin-dashboard" : "/"}
              className="flex items-center gap-3"
            >
              <img src="/logo2.png" alt="logo" className="h-10" />

              <span className="text-2xl font-bold">E-Setu</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            <nav className="flex items-center gap-6 text-sm font-medium">
              <Link to="/product" className="hover:text-emerald-600">
                Products
              </Link>

              <Link to="/categories" className="hover:text-emerald-600">
                Categories
              </Link>

              <Link to="/offers" className="hover:text-emerald-600">
                Offers
              </Link>
            </nav>

            <form
              onSubmit={onSearchSubmit}
              className="flex items-center rounded-lg bg-white px-3 py-2 shadow-sm"
            >
              <Search className="h-5 w-5 text-gray-400" />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-64 bg-transparent px-2 outline-none"
              />
              <Button type="submit" className="ml-2 px-3">
                Search
              </Button>
            </form>
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-4">
            {/* Cart */}
            {userData && (
              <Link to="/cart" className="relative p-2">
                <ShoppingCart className="text-2xl text-gray-700" />

                <span
                  className={`absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs font-semibold text-white transition-transform ${
                    badgePulse ? "scale-110" : "scale-100"
                  }`}
                >
                  {cartCount}
                </span>
              </Link>
            )}

            {/* User / Supplier Menu */}
            {userData || supplierData ? (
              <div className="relative" ref={userMenuRef}>
                {supplierData && (
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-emerald-700 bg-emerald-100">
                        {avatarInitial}
                      </div>
                    )}

                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                )}
                {userData && (
                  <button
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="Profile"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-red-700 bg-red-100">
                        {avatarInitial}
                      </div>
                    )}

                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </button>
                )}

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 rounded-lg border bg-white shadow-xl">
                    <div className="border-b px-4 py-3">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Profile"
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : userData && (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-semibold text-red-700">
                              {avatarInitial}
                            </div>
                          ) ? (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 font-semibold text-red-700">
                            {avatarInitial}
                          </div>
                        ) : (
                          ""
                        )}

                        <div>
                          <h3 className="font-semibold">
                            {supplierData?.firstName || userData?.firstName}
                          </h3>

                          <p className="text-sm text-gray-500">
                            {supplierData?.phoneNumber || userData?.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </div>

                    <nav className="flex flex-col py-2">
                      <Link
                        to={`/profile/${(supplierData || userData)._id}`}
                        onClick={() => setShowUserMenu(false)}
                        className="px-4 py-3 text-lg hover:bg-emerald-50 transition"
                      >
                        प्रोफ़ाइल
                      </Link>

                      {!supplierData && (
                        <Link
                          to="/order-history"
                          onClick={() => setShowUserMenu(false)}
                          className="px-4 py-3 text-lg hover:bg-emerald-50 transition"
                        >
                          सभी ऑर्डर
                        </Link>
                      )}

                      {supplierData && (
                        <Link
                          to="/admin-dashboard"
                          onClick={() => setShowUserMenu(false)}
                          className="px-4 py-3 text-lg hover:bg-emerald-50 transition"
                        >
                          डैशबोर्ड
                        </Link>
                      )}
                    </nav>

                    <div className="border-t px-4 py-3">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);

                          if (supplierData) {
                            setAdminConfirmLogout(true);
                          }
                          if (userData) {
                            setUserConfirmLogout(true);
                          }
                        }}
                        disabled={loading}
                        className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-white transition ${
                          supplierData
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                      >
                        {loading ? (
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <BiPowerOff className="text-lg" />
                            <span>लॉग आउट</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <Button onClick={() => navigate("/signup")} variant="outline">
                  Sign Up
                </Button>

                <Button
                  onClick={() => navigate("/login")}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  Login
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {slideBar && (
        <div
          onClick={() => setSlideBar(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 right-0 z-50 h-screen w-[80%] bg-white transition-transform duration-300 ${
          slideBar ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-5">
          <div className="flex items-center justify-between">
            <Link
              to={supplierData ? "/admin-dashboard" : "/"}
              onClick={() => setSlideBar(false)}
              className="flex items-center gap-3"
            >
              <img src="/logo2.png" alt="logo" className="h-8" />
              <span className="text-xl font-bold">E-Setu</span>
            </Link>

            <button
              onClick={() => setSlideBar(false)}
              className="rounded-md p-2 hover:bg-gray-100"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-5">
            <Link
              to={supplierData ? "/product-view" : "/products"}
              onClick={() => setSlideBar(false)}
              className="rounded-md  flex gap-2 items-center  px-3 py-2 text-lg hover:bg-emerald-50"
            >
              <TrendingUp className="animate-pulse" /> प्रोडक्ट्स
            </Link>

            <Link
              to="/categories"
              onClick={() => setSlideBar(false)}
              className="rounded-md  flex gap-2 items-center px-3 py-2 text-lg hover:bg-emerald-50"
            >
              📂 Categories
            </Link>

            <Link
              to="/offers"
              onClick={() => setSlideBar(false)}
              className="rounded-md flex gap-2 items-center px-3 py-2 text-lg hover:bg-emerald-50"
            >
              <BadgePercent className="animate-pulse" /> ऑफर्स
            </Link>

            <form
              onSubmit={(e) => {
                onSearchSubmit(e);
                setSlideBar(false);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="उत्पाद खोजें..."
                className="flex-1 rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"
              />

              <Button type="submit">Go</Button>
            </form>

            {!supplierData && userData && (
              <Link
                to="/cart"
                onClick={() => setSlideBar(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-emerald-50"
              >
                <span className="text-lg  flex gap-2 items-center">
                  <ShoppingCart /> कार्ट
                </span>

                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-sm font-semibold text-white">
                  {cartCount}
                </span>
              </Link>
            )}

            {userData || supplierData ? (
              <>
                <Link
                  to={`/profile/${(supplierData || userData)._id}`}
                  onClick={() => setSlideBar(false)}
                  className="rounded-md px-3 py-2  flex gap-2 items-center text-lg hover:bg-emerald-50"
                >
                  <UserRoundPen /> प्रोफ़ाइल
                </Link>

                <Link
                  to={supplierData ? "/admin-dashboard" : "/order-history"}
                  onClick={() => setSlideBar(false)}
                  className="rounded-md px-3  flex gap-2 items-center py-2 text-lg hover:bg-emerald-50"
                >
                  {supplierData ? (
                    <div className="flex items-center gap-2">
                      <LayoutDashboard /> डैशबोर्ड
                    </div>
                  ) : (
                    <>
                      <ReceiptText /> सभी ऑर्डर
                    </>
                  )}
                </Link>

                <Button
                  onClick={() => {
                    setSlideBar(false);

                    if (supplierData) {
                      setAdminConfirmLogout(true);
                    }
                    if (userData) {
                      setUserConfirmLogout(true);
                    } else {
                      logoutHandler();
                    }
                  }}
                  disabled={loading}
                  className="mt-4 bg-red-600"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <BiPowerOff className="text-lg" />
                      <span>लॉग आउट</span>
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="mt-6 flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    setSlideBar(false);
                    navigate("/signup");
                  }}
                >
                  Sign Up
                </Button>

                <Button
                  className="flex-1"
                  onClick={() => {
                    setSlideBar(false);
                    navigate("/login");
                  }}
                >
                  Login
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Logout Confirmation */}
      {adminConfirmLogout && (
        <div className="fixed inset-0 z-[60] absolute flex items-center h-screen justify-center bg-black/60">
          <div className="w-[90%] max-w-sm rounded-xl bg-emerald-50 p-6 shadow-xl">
            <h2 className="text-center text-xl font-semibold">लॉग आउट?</h2>

            <p className="mt-2 text-center text-gray-500">
              क्या आप सच में लॉग आउट करना चाहते हैं?
            </p>

            <div className="mt-6 flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => setAdminConfirmLogout(false)}
              >
                नहीं
              </Button>

              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  setAdminConfirmLogout(false);
                  logoutHandler();
                }}
              >
                हाँ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* user Logout Confirmation */}
      {userConfirmLogout && (
        <div className="fixed inset-0 z-[60] absolute flex items-center h-screen justify-center bg-black/60">
          <div className="w-[90%] max-w-sm rounded-xl bg-emerald-50 p-6 shadow-xl">
            <h2 className="text-center text-xl font-semibold">लॉग आउट?</h2>

            <p className="mt-2 text-center text-gray-500">
              क्या आप सच में लॉग आउट करना चाहते हैं?
            </p>

            <div className="mt-6 flex justify-center gap-4">
              <Button
                variant="outline"
                onClick={() => setUserConfirmLogout(false)}
              >
                नहीं
              </Button>

              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setUserConfirmLogout(false);
                  logoutHandler();
                }}
              >
                हाँ
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
