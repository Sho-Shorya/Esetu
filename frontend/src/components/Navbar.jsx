import {
  ShoppingCart,
  Loader2,
  Search,
  Menu,
  X,
  ChevronDown,
  LoaderCircle,
  UserRoundPen,
  ReceiptText,
  TrendingUp,
  LayoutDashboard,
} from "lucide-react";

import React, { useState, useRef, useEffect, useCallback } from "react";

import { Link, useNavigate } from "react-router-dom";

import { Button } from "./ui/button";

import { useDispatch, useSelector } from "react-redux";

import { clearUserData, clearSupplierData } from "../redux/userSlice";

import axios from "axios";
import { toast } from "sonner";

import { API_BASE_URL } from "@/lib/constants";

import { BiPowerOff } from "react-icons/bi";

import SplashScreen from "./SplashScreen";

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { userData, supplierData } = useSelector((state) => state.user || {});

  const { cartData } = useSelector((state) => state.product || {});

  // =========================================================
  // STATES
  // =========================================================

  const [slideBar, setSlideBar] = useState(false);

  const [loading, setLoading] = useState(false);

  const [cartCount, setCartCount] = useState(0);

  const [search, setSearch] = useState("");

  const [badgePulse, setBadgePulse] = useState(false);

  const [showUserMenu, setShowUserMenu] = useState(false);

  const [adminConfirmLogout, setAdminConfirmLogout] = useState(false);

  const [userConfirmLogout, setUserConfirmLogout] = useState(false);

  const [showSplash, setShowSplash] = useState(false);

  const userMenuRef = useRef(null);

  // =========================================================
  // CART BADGE
  // =========================================================

  useEffect(() => {
    const count = cartData?.items?.length || 0;

    setCartCount(count);

    if (count > 0) {
      setBadgePulse(true);

      const timer = setTimeout(() => {
        setBadgePulse(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [cartData]);

  // =========================================================
  // CLOSE USER MENU
  // =========================================================

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

  // =========================================================
  // LOGOUT API
  // =========================================================

  const performLogout = useCallback(async () => {
    const token = localStorage.getItem("token");

    // Clear local auth immediately.
    dispatch(clearUserData());
    dispatch(clearSupplierData());

    localStorage.removeItem("token");

    // API logout happens in background.
    if (!token) {
      return;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/api/v1/user/logout`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
    } catch (error) {
      console.error("Background logout error:", error);
    }
  }, [dispatch]);

  // =========================================================
  // START LOGOUT
  // =========================================================

  const startLogout = () => {
    if (loading || showSplash) return;

    setLoading(true);

    setShowUserMenu(false);
    setSlideBar(false);
    setAdminConfirmLogout(false);
    setUserConfirmLogout(false);

    // IMPORTANT:
    // Splash appears immediately.
    setShowSplash(true);

    // Logout backend in background.
    performLogout();
  };

  // =========================================================
  // SPLASH COMPLETE
  // =========================================================

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    setLoading(false);

    navigate("/login", {
      replace: true,
    });
  }, [navigate]);

  // =========================================================
  // SEARCH
  // =========================================================

  const onSearchSubmit = (e) => {
    e.preventDefault();

    if (!search.trim()) {
      navigate("/products");
      return;
    }

    navigate(`/products?search=${encodeURIComponent(search.trim())}`);
  };

  // =========================================================
  // USER DISPLAY
  // =========================================================

  const avatarInitial = (
    userData?.firstName?.[0] ||
    supplierData?.firstName?.[0] ||
    "U"
  ).toUpperCase();

  const avatarUrl = userData?.profilePic || supplierData?.profilePic || "";

  const isSupplier = Boolean(supplierData);

  const displayName = supplierData?.firstName || userData?.firstName || "User";

  // =========================================================
  // SPLASH
  // =========================================================

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // =========================================================
  // NAVBAR
  // =========================================================

  return (
    <header
      className="
        fixed
        left-0
        right-0
        top-0
        z-40
        border-b
        border-black/[0.06]
        bg-white/90
        shadow-[0_1px_12px_rgba(0,0,0,0.04)]
        backdrop-blur-xl
      "
    >
      <div className="mx-auto max-w-6xl px-4 lg:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* =================================================
              LEFT
          ================================================= */}

          <div className="flex items-center gap-3">
            {/* Mobile Menu */}

            <button
              type="button"
              className="
                rounded-xl
                p-2
                text-neutral-700
                transition
                hover:bg-red-50
                hover:text-red-600
                active:scale-95
                lg:hidden
              "
              onClick={() => setSlideBar(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo */}

            <Link
              to={supplierData ? "/admin-dashboard" : "/"}
              onClick={() => {
                window.scrollTo({
                  top: 0,
                  behavior: "smooth",
                });
              }}
              className="
                group
                flex
                items-center
                gap-2.5
              "
            >
              <div
                className="
                  relative
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  overflow-hidden
                  rounded-xl
                  bg-white
                  shadow-sm
                  ring-1
                  ring-black/[0.06]
                  transition
                  group-hover:scale-105
                "
              >
                <img
                  src="/logo.png"
                  alt="ई-सेतु"
                  className="h-9 w-9 object-contain"
                />
              </div>

              <span
                className={`
                  text-[24px]
                  font-black
                  tracking-tight
                  ${isSupplier ? "text-emerald-600" : "text-red-600"}
                `}
              >
                ई-सेतु
              </span>
            </Link>
          </div>

          {/* =================================================
              DESKTOP NAVIGATION
          ================================================= */}

          <div className="hidden items-center gap-7 lg:flex">
            <nav className="flex items-center gap-5 text-sm font-semibold text-neutral-600">
              <Link
                to="/product"
                className="
                  transition
                  hover:text-red-600
                "
              >
                Products
              </Link>
            </nav>

            {/* Search */}

            <form
              onSubmit={onSearchSubmit}
              className="
                flex
                h-10
                items-center
                overflow-hidden
                rounded-xl
                border
                border-neutral-200
                bg-neutral-50
                transition
                focus-within:border-red-300
                focus-within:bg-white
                focus-within:ring-4
                focus-within:ring-red-500/5
              "
            >
              <Search className="ml-3 h-4 w-4 text-neutral-400" />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="
                  w-56
                  bg-transparent
                  px-2.5
                  text-sm
                  outline-none
                  placeholder:text-neutral-400
                "
              />

              <Button
                type="submit"
                className="
                  mr-1
                  h-8
                  rounded-lg
                  bg-red-600
                  px-3
                  text-xs
                  font-semibold
                  hover:bg-red-700
                "
              >
                Search
              </Button>
            </form>
          </div>

          {/* =================================================
              RIGHT
          ================================================= */}

          <div className="flex items-center gap-2.5">
            {/* Cart */}

            {userData && (
              <div
                className="
    flex
    items-center
    gap-1
    rounded-2xl
    border
    border-red-100
    bg-red-50
    pl-1
    pr-3
    shadow-[0_3px_12px_rgba(239,68,68,0.10)]
    transition-all
    duration-200
    hover:bg-red-100
    hover:shadow-[0_5px_16px_rgba(239,68,68,0.15)]
  "
              >
                <Link
                  to="/cart"
                  className="
      relative
      flex
      h-10
      w-10
      items-center
      justify-center
      rounded-xl
      text-neutral-700
      transition-all
      duration-200
      hover:text-red-600
      active:scale-95
    "
                >
                  <ShoppingCart className="h-5 w-5" />

                  <span
                    className={`
        absolute
        -right-1
        -top-1
        flex
        h-5
        min-w-5
        items-center
        justify-center
        rounded-full
        bg-red-600
        px-1
        text-[10px]
        font-bold
        text-white
        shadow-sm
        transition-transform
        duration-200
        ${badgePulse ? "scale-110" : "scale-100"}
      `}
                  >
                    {cartCount}
                  </span>
                </Link>

                <span className="text-sm font-bold text-red-700">कार्ट</span>
              </div>
            )}

            {/* =================================================
                USER / SUPPLIER
            ================================================= */}

            {userData || supplierData ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="
                    flex
                    items-center
                    gap-2
                    rounded-full
                    border
                    border-black/[0.06]
                    bg-white
                    p-1
                    pr-2
                    shadow-sm
                    transition
                    hover:shadow-md
                    active:scale-[0.97]
                  "
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="
                        h-9
                        w-9
                        rounded-full
                        object-cover
                      "
                    />
                  ) : (
                    <div
                      className={`
                        flex
                        h-9
                        w-9
                        items-center
                        justify-center
                        rounded-full
                        font-bold
                        ${
                          isSupplier
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }
                      `}
                    >
                      {avatarInitial}
                    </div>
                  )}

                  <ChevronDown
                    className={`
                      h-4
                      w-4
                      text-neutral-400
                      transition-transform
                      ${showUserMenu ? "rotate-180" : ""}
                    `}
                  />
                </button>

                {/* =================================================
                    DESKTOP USER MENU
                ================================================= */}

                {showUserMenu && (
                  <div
                    className="
                      absolute
                      right-0
                      mt-2
                      w-64
                      overflow-hidden
                      rounded-2xl
                      border
                      border-black/[0.06]
                      bg-white
                      shadow-[0_20px_50px_rgba(0,0,0,0.12)]
                    "
                  >
                    {/* Profile */}

                    <div className="border-b border-neutral-100 p-4">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="Profile"
                            className="
                              h-11
                              w-11
                              rounded-full
                              object-cover
                            "
                          />
                        ) : (
                          <div
                            className={`
                              flex
                              h-11
                              w-11
                              items-center
                              justify-center
                              rounded-full
                              font-bold
                              ${
                                isSupplier
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }
                            `}
                          >
                            {avatarInitial}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h3 className="truncate font-bold text-neutral-800">
                            {displayName}
                          </h3>

                          <p className="truncate text-xs text-neutral-400">
                            {supplierData?.phoneNumber || userData?.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Links */}

                    <nav className="p-2">
                      <Link
                        to={`/profile/${(supplierData || userData)._id}`}
                        onClick={() => setShowUserMenu(false)}
                        className="
                          flex
                          items-center
                          gap-3
                          rounded-xl
                          px-3
                          py-2.5
                          text-sm
                          font-semibold
                          text-neutral-700
                          transition
                          hover:bg-neutral-50
                        "
                      >
                        <UserRoundPen className="h-4 w-4" />
                        प्रोफ़ाइल
                      </Link>

                      {!supplierData && (
                        <Link
                          to="/order-history"
                          onClick={() => setShowUserMenu(false)}
                          className="
                            flex
                            items-center
                            gap-3
                            rounded-xl
                            px-3
                            py-2.5
                            text-sm
                            font-semibold
                            text-neutral-700
                            transition
                            hover:bg-red-50
                            hover:text-red-600
                          "
                        >
                          <ReceiptText className="h-4 w-4" />
                          सभी ऑर्डर
                        </Link>
                      )}

                      {supplierData && (
                        <Link
                          to="/admin-dashboard"
                          onClick={() => setShowUserMenu(false)}
                          className="
                            flex
                            items-center
                            gap-3
                            rounded-xl
                            px-3
                            py-2.5
                            text-sm
                            font-semibold
                            text-neutral-700
                            transition
                            hover:bg-emerald-50
                            hover:text-emerald-600
                          "
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          डैशबोर्ड
                        </Link>
                      )}
                    </nav>

                    {/* Logout */}

                    <div className="border-t border-neutral-100 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserMenu(false);

                          if (supplierData) {
                            setAdminConfirmLogout(true);
                          } else {
                            setUserConfirmLogout(true);
                          }
                        }}
                        className={`
                          flex
                          w-full
                          items-center
                          justify-center
                          gap-2
                          rounded-xl
                          px-4
                          py-2.5
                          text-sm
                          font-bold
                          text-white
                          transition
                          active:scale-[0.98]
                          ${
                            supplierData
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : "bg-red-600 hover:bg-red-700"
                          }
                        `}
                      >
                        <BiPowerOff className="text-lg" />
                        लॉग आउट
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 lg:flex">
                <Button
                  onClick={() => navigate("/signup")}
                  variant="outline"
                  className="rounded-xl"
                >
                  Sign Up
                </Button>

                <Button
                  onClick={() => navigate("/login")}
                  className="
                    rounded-xl
                    bg-gradient-to-r
                    from-red-600
                    to-red-500
                    font-semibold
                    text-white
                    shadow-sm
                    hover:from-red-700
                    hover:to-red-600
                  "
                >
                  Login
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          MOBILE OVERLAY
      ====================================================== */}

      {slideBar && (
        <div
          onClick={() => setSlideBar(false)}
          className="
            fixed
            inset-0
            z-40
            bg-black/40
            backdrop-blur-[2px]
          "
        />
      )}

      {/* =====================================================
          MOBILE SIDEBAR
      ====================================================== */}

      <div
        className={`
          fixed
          right-0
          top-0
          z-50
          h-screen
          w-[82%]
          max-w-sm
          bg-white
          shadow-2xl
          transition-transform
          duration-300
          ${slideBar ? "translate-x-0" : "translate-x-full"}
        `}
      >
        <div className="p-5">
          {/* Header */}

          <div className="flex items-center justify-between">
            <Link
              to={supplierData ? "/admin-dashboard" : "/"}
              onClick={() => setSlideBar(false)}
              className="flex items-center gap-2.5"
            >
              <img
                src="/logo.png"
                alt="ई-सेतु"
                className="h-9 w-9 object-contain"
              />

              <span
                className={`
                  text-xl
                  font-black
                  ${supplierData ? "text-emerald-600" : "text-red-600"}
                `}
              >
                ई-सेतु
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setSlideBar(false)}
              className="
                rounded-xl
                bg-neutral-100
                p-2
                text-neutral-600
                active:scale-90
              "
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile Search */}

          <form
            onSubmit={(e) => {
              onSearchSubmit(e);
              setSlideBar(false);
            }}
            className="
              mt-7
              flex
              h-11
              items-center
              rounded-xl
              border
              border-neutral-200
              bg-neutral-50
            "
          >
            <Search className="ml-3 h-4 w-4 text-neutral-400" />

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="
                min-w-0
                flex-1
                bg-transparent
                px-2
                text-sm
                outline-none
              "
            />
          </form>

          {/* Links */}

          <div className="mt-7 flex flex-col gap-1">
            <Link
              to={supplierData ? "/product-view" : "/products"}
              onClick={() => setSlideBar(false)}
              className="
                flex
                items-center
                gap-3
                rounded-xl
                px-3
                py-3
                text-base
                font-semibold
                text-neutral-700
                hover:bg-red-50
                hover:text-red-600
              "
            >
              <TrendingUp className="h-5 w-5" />
              प्रोडक्ट्स
            </Link>

            {!supplierData && userData && (
              <Link
                to="/cart"
                onClick={() => setSlideBar(false)}
                className="
                  flex
                  items-center
                  justify-between
                  rounded-xl
                  px-3
                  py-3
                  text-base
                  font-semibold
                  text-neutral-700
                  hover:bg-red-50
                "
              >
                <span className="flex items-center gap-3">
                  <ShoppingCart className="h-5 w-5" />
                  कार्ट
                </span>

                <span
                  className="
                    flex
                    h-7
                    min-w-7
                    items-center
                    justify-center
                    rounded-full
                    bg-red-600
                    px-1.5
                    text-xs
                    font-bold
                    text-white
                  "
                >
                  {cartCount}
                </span>
              </Link>
            )}

            {(userData || supplierData) && (
              <>
                <Link
                  to={`/profile/${(supplierData || userData)._id}`}
                  onClick={() => setSlideBar(false)}
                  className="
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-3
                    text-base
                    font-semibold
                    text-neutral-700
                    hover:bg-neutral-50
                  "
                >
                  <UserRoundPen className="h-5 w-5" />
                  प्रोफ़ाइल
                </Link>

                <Link
                  to={supplierData ? "/admin-dashboard" : "/order-history"}
                  onClick={() => setSlideBar(false)}
                  className="
                    flex
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    py-3
                    text-base
                    font-semibold
                    text-neutral-700
                    hover:bg-neutral-50
                  "
                >
                  {supplierData ? (
                    <>
                      <LayoutDashboard className="h-5 w-5" />
                      डैशबोर्ड
                    </>
                  ) : (
                    <>
                      <ReceiptText className="h-5 w-5" />
                      सभी ऑर्डर
                    </>
                  )}
                </Link>

                {/* Mobile Logout */}

                <button
                  type="button"
                  onClick={() => {
                    setSlideBar(false);

                    if (supplierData) {
                      setAdminConfirmLogout(true);
                    } else {
                      setUserConfirmLogout(true);
                    }
                  }}
                  className={`
                    mt-5
                    flex
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    px-4
                    py-3
                    font-bold
                    text-white
                    ${supplierData ? "bg-emerald-600" : "bg-red-600"}
                  `}
                >
                  <BiPowerOff className="text-lg" />
                  लॉग आउट
                </button>
              </>
            )}

            {!userData && !supplierData && (
              <div className="mt-5 flex gap-2">
                <Button
                  className="flex-1 rounded-xl"
                  variant="outline"
                  onClick={() => {
                    setSlideBar(false);
                    navigate("/signup");
                  }}
                >
                  Sign Up
                </Button>

                <Button
                  className="flex-1 rounded-xl bg-red-600"
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

      {/* =====================================================
          ADMIN LOGOUT CONFIRMATION
      ====================================================== */}

      {adminConfirmLogout && (
        <div
          className="
            fixed
            inset-0
            z-[60]
            flex
            h-screen
            items-center
            justify-center
            bg-black/60
            p-5
            backdrop-blur-sm
          "
        >
          <div
            className="
              w-full
              max-w-sm
              rounded-3xl
              bg-white
              p-6
              shadow-2xl
            "
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <BiPowerOff className="text-2xl" />
            </div>

            <h2 className="mt-4 text-center text-xl font-bold text-neutral-900">
              लॉग आउट?
            </h2>

            <p className="mt-2 text-center text-sm text-neutral-500">
              क्या आप सच में लॉग आउट करना चाहते हैं?
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setAdminConfirmLogout(false)}
                className="rounded-xl px-6"
              >
                नहीं
              </Button>

              <Button
                disabled={loading}
                className="
                  rounded-xl
                  bg-emerald-600
                  px-6
                  hover:bg-emerald-700
                "
                onClick={startLogout}
              >
                हाँ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          USER LOGOUT CONFIRMATION
      ====================================================== */}

      {userConfirmLogout && (
        <div
          className="
            fixed
            inset-0
            z-[60]
            flex
            h-screen
            items-center
            justify-center
            bg-black/60
            p-5
            backdrop-blur-sm
          "
        >
          <div
            className="
              w-full
              max-w-sm
              rounded-3xl
              bg-white
              p-6
              shadow-2xl
            "
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <BiPowerOff className="text-2xl" />
            </div>

            <h2 className="mt-4 text-center text-xl font-bold text-neutral-900">
              लॉग आउट?
            </h2>

            <p className="mt-2 text-center text-sm text-neutral-500">
              क्या आप सच में लॉग आउट करना चाहते हैं?
            </p>

            <div className="mt-6 flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setUserConfirmLogout(false)}
                className="rounded-xl px-6"
              >
                नहीं
              </Button>

              <Button
                disabled={loading}
                className="
                  rounded-xl
                  bg-red-600
                  px-6
                  hover:bg-red-700
                "
                onClick={startLogout}
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
