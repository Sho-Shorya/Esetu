import {
  ShoppingCart,
  Loader2,
  Search,
  User,
  Menu,
  X,
  ChevronDown,
  LoaderCircle,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { useDispatch, useSelector } from "react-redux";
import { setUserData } from "../redux/userSlice";
import axios from "axios";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/constants";
import { BiPowerOff } from "react-icons/bi";

const Navbar = () => {
  const { userData, supplierData } = useSelector((store) => store.user);
  const { productData } = useSelector((store) => store.product);
  const { cart } = useSelector(
    (store) => store.product || { cart: { items: [] } },
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [slideBar, setSlideBar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState("");
  const [badgePulse, setBadgePulse] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const { cartData } = useSelector((state) => state.product);
  useEffect(() => {
    setCartCount(cartData.items.length);
  });
  // close user menu on outside click or Escape
  useEffect(() => {
    const onDocClick = (e) => {
      if (
        showUserMenu &&
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target)
      ) {
        setShowUserMenu(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setShowUserMenu(false);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [showUserMenu]);

  const logoutHandler = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    if (!token) {
      // no token — just clear local state
      dispatch(setUserData(null));
      localStorage.removeItem("token");
      setLoading(false);
      navigate("/login");
      return;
    }

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/v1/user/logout`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data && res.data.success) {
        toast.success(res.data.message || "Logged out");
        dispatch(setUserData(null));
        localStorage.removeItem("token");
        navigate("/login");
      } else {
        // server didn't accept logout — keep client state but notify
        toast.error(res.data?.message || "Logout failed on server");
      }
    } catch (err) {
      const status = err?.response?.status;
      const serverMessage =
        err?.response?.data?.message || err?.response?.data || err?.message;
      console.warn("Logout request failed", err, err?.response?.data);
      if (status === 401 || status === 403) {
        dispatch(setUserData(null));
        localStorage.removeItem("token");
        navigate("/login");
        toast.error(serverMessage || "Logged out!");
      } else {
        toast.error(serverMessage || "Logout failed — please try again");
      }
    } finally {
      setLoading(false);
    }
  };

  const onSearchSubmit = (e) => {
    e.preventDefault();
    if (!search) return navigate("/products");
    navigate(`/products?search=${encodeURIComponent(search)}`);
  };

  const displayName = (() => {
    if (!userData || !supplierData) return "";
    const fn = userData.firstName || supplierData.firstName || "";
    const ln = userData.lastName || supplierData.lastName || "";
    const name = `${fn} ${ln}`.trim();
    if (name) return name;
    if (userData.phoneNumber || supplierData.phoneNumber)
      return userData.phoneNumber[0] || supplierData.phoneNumber[0];
    return "userData" || "supplierData";
  })();

  const avatarInitial = (() => {
    const ch = userData?.firstName?.[0] || supplierData?.firstName?.[0] || "U";
    return String(ch).toUpperCase();
  })();

  const avatarUrl = userData?.profilePic || supplierData?.profilePic || "";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gray-100 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: logo + mobile hamburger */}
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 text-gray-700 hover:text-red-400"
              aria-label="Open menu"
              onClick={() => setSlideBar(true)}
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex justify-between items-center">
              <Link
                to={(userData && "/") || (supplierData && "/admin-dashboard")}
                onClick={() => setSlideBar(false)}
                className="flex items-center gap-3"
              >
                <img src="/logo2.png" className="h-10" alt="logo" />
                <span className="font-bold text-[24px]">E-Setu</span>
              </Link>
            </div>
          </div>

          {/* Center: nav links + search (hidden on small) */}
          <div className="hidden lg:flex lg:items-center lg:gap-8">
            <nav className="flex items-center gap-6 text-sm text-gray-700">
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
              className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded shadow-sm"
            >
              <Search className="text-gray-400" />
              <input
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products, brands..."
                className="w-64 bg-transparent px-2 py-2 text-sm placeholder:text-gray-400 focus:outline-none"
              />
              <Button type="submit" className="px-3 py-1 text-sm">
                Search
              </Button>
            </form>
          </div>

          {/* Right: cart + auth */}
          <div className="flex items-center gap-4">
            {userData && (
              <Link
                to="/cart"
                className="relative p-2"
                aria-label={`Cart with ${cartCount} items`}
                title="View cart"
              >
                <ShoppingCart className="text-2xl text-gray-700" />
                <span
                  className={`absolute -top-2 -right-2 bg-red-600 text-white text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center transform ${badgePulse ? "scale-110" : "scale-100"} transition-transform`}
                >
                  {cartCount}
                </span>
              </Link>
            )}

            {userData ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  id="user-menu-button"
                  onClick={() => setShowUserMenu((s) => !s)}
                  className="flex items-center gap-2 px-2 py-1 rounded-full bg-white hover:shadow-sm focus:shadow-outline focus:outline-none"
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                  aria-controls="user-menu"
                >
                  <div className="relative flex items-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-red-50 shadow-sm"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-red-100 text-emerald-700 flex items-center justify-center font-medium ring-2 ring-red-50 shadow-sm">
                        {avatarInitial}
                      </div>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
                {showUserMenu && (
                  <div
                    id="user-menu"
                    className="absolute right-0 mt-2 w-64 bg-white border shadow-lg z-40 rounded-md ring-1 ring-black ring-opacity-5 transform transition ease-out duration-150"
                    role="menu"
                    aria-labelledby="user-menu-button"
                  >
                    <div
                      className="absolute right-4 -top-3 w-3 h-3 bg-white rotate-45 border-l border-t border-gray-100"
                      aria-hidden="true"
                    />
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="avatar"
                            className="max-h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-red-100 text-emerald-700 flex items-center justify-center font-medium">
                            {avatarInitial}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-lg">
                            {userData.firstName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {userData.phoneNumber}
                          </div>
                        </div>
                      </div>
                    </div>
                    <nav className="py-1" aria-label="User options">
                      <Link
                        to={`/profile/${userData._id}`}
                        className="text-[20px] flex items-center gap-3 px-4 py-2 hover:bg-emerald-50"
                        role="menuitem"
                      >
                        प्रोफ़ाइल
                      </Link>
                      <Link
                        to="/orders"
                        className="text-[20px] flex items-center gap-3 px-4 py-2 hover:bg-emerald-50"
                        role="menuitem"
                      >
                        सभी ऑर्डर
                      </Link>
                      {/* <Link to="/settings" className="text-[20px] flex items-center gap-3 px-4 py-2 hover:bg-emerald-50" role="menuitem">Settings</Link> */}
                    </nav>
                    <div className="px-4 py-3">
                      <button
                        onClick={logoutHandler}
                        disabled={loading}
                        className="text-[20px] w-full text-left px-4 py-2 bg-red-600 hover:bg-emerald-700 text-white rounded"
                      >
                        {loading ? (
                          <LoaderCircle className="animate-spin ml-20" />
                        ) : (
                          <div className="flex items-center gap-[10px]">
                            <BiPowerOff />
                            लॉग आउट
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <Button
                  onClick={() => navigate("/signup")}
                  className="px-3 py-2 border text-sm"
                >
                  Sign Up
                </Button>
                <Button
                  onClick={() => navigate("/login")}
                  className="bg-gradient-to-tl from-blue-600 to-purple-600 text-white px-3 py-2 text-sm"
                >
                  Login
                </Button>
              </div>
            )}
            {supplierData ? (
              <div className="relative" ref={userMenuRef}>
                <button
                  id="user-menu-button"
                  onClick={() => setShowUserMenu((s) => !s)}
                  className="flex items-center gap-2 px-2 py-1 rounded-full bg-white hover:shadow-sm focus:shadow-outline focus:outline-none"
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                  aria-controls="user-menu"
                >
                  <div className="relative flex items-center">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt="avatar"
                        className="h-9 w-9 rounded-full object-cover ring-2 ring-emerald-50 shadow-sm"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium ring-2 ring-red-50 shadow-sm">
                        {avatarInitial}
                      </div>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                </button>
                {showUserMenu && (
                  <div
                    id="user-menu"
                    className="absolute right-0 mt-2 w-64 bg-white border shadow-lg z-40 rounded-md ring-1 ring-black ring-opacity-5 transform transition ease-out duration-150"
                    role="menu"
                    aria-labelledby="user-menu-button"
                  >
                    <div
                      className="absolute right-4 -top-3 w-3 h-3 bg-white rotate-45 border-l border-t border-gray-100"
                      aria-hidden="true"
                    />
                    <div className="px-4 py-3 border-b">
                      <div className="flex items-center gap-3">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt="avatar"
                            className="max-h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-medium">
                            {avatarInitial}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-lg">
                            {supplierData.firstName}
                          </div>
                          <div className="text-1xl text-gray-500">
                            {supplierData.phoneNumber}
                          </div>
                        </div>
                      </div>
                    </div>
                    <nav className="py-1" aria-label="User options">
                      <Link
                        to={`/profile/${supplierData._id}`}
                        className="text-[20px] flex items-center gap-3 px-4 py-2 hover:bg-emerald-50"
                        role="menuitem"
                      >
                        प्रोफ़ाइल
                      </Link>
                      <Link
                        to="/orders"
                        className="text-[20px] flex items-center gap-3 px-4 py-2 hover:bg-emerald-50"
                        role="menuitem"
                      >
                        सभी ऑर्डर
                      </Link>
                      {/* <Link to="/settings" className="text-[20px] flex items-center gap-3 px-4 py-2 hover:bg-emerald-50" role="menuitem">Settings</Link> */}
                    </nav>
                    <div className="px-4 py-3">
                      <button
                        onClick={logoutHandler}
                        disabled={loading}
                        className="text-[20px] w-full text-left px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                      >
                        {loading ? (
                          <LoaderCircle className="animate-spin ml-20" />
                        ) : (
                          <div className="flex items-center gap-[10px]">
                            <BiPowerOff />
                            लॉग आउट
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-2">
                <Button
                  onClick={() => navigate("/signup")}
                  className="px-3 py-2 border text-sm"
                >
                  Sign Up
                </Button>
                <Button
                  onClick={() => navigate("/login")}
                  className="bg-gradient-to-tl from-blue-600 to-purple-600 text-white px-3 py-2 text-sm"
                >
                  Login
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay for mobile panel */}
      {slideBar && (
        <div
          onClick={() => setSlideBar(false)}
          className="fixed inset-0 bg-black/40 z-40"
        />
      )}

      {userData && (
        <div
          className={`fixed top-0 right-0 h-screen w-[80%] bg-white transition-transform duration-300 ease-in-out ${slideBar ? "translate-x-0" : "translate-x-full"} z-50`}
        >
          <div className="p-4">
            <div className="flex justify-between items-center">
              <Link
                to="/"
                onClick={() => setSlideBar(false)}
                className="flex items-center gap-3"
              >
                <img src="/logo2.png" className="h-8" alt="logo" />
                <span className="font-bold text-lg">e-Setu</span>
              </Link>
              <button
                onClick={() => setSlideBar(false)}
                aria-label="Close menu"
                className="text-gray-700 hover:text-emerald-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <Link
                to="/product"
                onClick={() => setSlideBar(false)}
                className="text-lg"
              >
                प्रोडक्ट्स
              </Link>
              <Link
                to="/offers"
                onClick={() => setSlideBar(false)}
                className="text-lg"
              >
                ऑफर
              </Link>
              <form
                onSubmit={(e) => {
                  onSearchSubmit(e);
                  setSlideBar(false);
                }}
                className="flex gap-2"
              >
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="उत्पाद खोजें..."
                  className="flex-1 px-3 py-2 rounded border"
                />
                <Button type="submit">Go</Button>
              </form>
              <Link
                to="/cart"
                onClick={() => setSlideBar(false)}
                className="flex items-center gap-2"
              >
                कार्ट{" "}
                <span className="ml-2  top-2 right-2 inline-block bg-red-500 text-white rounded-full w-7 h-full text-center">
                  {cartCount}
                </span>
              </Link>
              {userData || supplierData ? (
                <>
                  <Link
                    to={`/profile/${(supplierData || userData)._id}`}
                    onClick={() => setSlideBar(false)}
                  >
                    प्रोफ़ाइल
                  </Link>

                  <Link
                    to={supplierData ? "/admin/dashboard" : "/orders"}
                    onClick={() => setSlideBar(false)}
                  >
                    {supplierData ? "Dashboard" : "सभी ऑर्डर"}
                  </Link>

                  <Button
                    onClick={logoutHandler}
                    disabled={loading}
                    className="mt-4"
                  >
                    {loading ? "Logging out..." : "Logout"}
                  </Button>
                </>
              ) : (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => {
                      setSlideBar(false);
                      navigate("/signup");
                    }}
                    className="flex-1"
                  >
                    Sign Up
                  </Button>

                  <Button
                    onClick={() => {
                      setSlideBar(false);
                      navigate("/login");
                    }}
                    className="flex-1"
                  >
                    Login
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {supplierData && (
        <div
          className={`fixed top-0 right-0 h-screen w-[80%] bg-white transition-transform duration-300 ease-in-out ${slideBar ? "translate-x-0" : "translate-x-full"} z-50`}
        >
          <div className="p-4">
            <div className="flex justify-between items-center">
              <Link
                to="/"
                onClick={() => setSlideBar(false)}
                className="flex items-center gap-3"
              >
                <img src="/logo2.png" className="h-8" alt="logo" />
                <span className="font-bold text-lg">e-Setu</span>
              </Link>
              <button
                onClick={() => setSlideBar(false)}
                aria-label="Close menu"
                className="text-gray-700 hover:text-emerald-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <Link
                to="/product"
                onClick={() => setSlideBar(false)}
                className="text-lg"
              >
                प्रोडक्ट्स
              </Link>
              <Link
                to="/offers"
                onClick={() => setSlideBar(false)}
                className="text-lg"
              >
                ऑफर
              </Link>
              <form
                onSubmit={(e) => {
                  onSearchSubmit(e);
                  setSlideBar(false);
                }}
                className="flex gap-2"
              >
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="उत्पाद खोजें..."
                  className="flex-1 px-3 py-2 rounded border"
                />
                <Button type="submit">Go</Button>
              </form>
              {/* <Link
                to="/cart"
                onClick={() => setSlideBar(false)}
                className="flex items-center gap-2"
              >
                कार्ट{" "}
                <span className="ml-2  top-2 right-2 inline-block bg-red-500 text-white rounded-full w-7 h-full text-center">
                  {cartCount}
                </span>
              </Link> */}
              {userData || supplierData ? (
                <>
                  <Link
                    to={`/profile/${(supplierData || userData)._id}`}
                    onClick={() => setSlideBar(false)}
                  >
                    प्रोफ़ाइल
                  </Link>

                  <Link
                    to={supplierData ? "/admin-dashboard" : "/orders"}
                    onClick={() => setSlideBar(false)}
                  >
                    {supplierData ? "डैशबोर्ड" : "सभी ऑर्डर"}
                  </Link>

                  <Button
                    onClick={logoutHandler}
                    disabled={loading}
                    className="mt-4 bg-emerald-600"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : "Logout"}
                  </Button>
                </>
              ) : (
                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={() => {
                      setSlideBar(false);
                      navigate("/signup");
                    }}
                    className="flex-1"
                  >
                    Sign Up
                  </Button>

                  <Button
                    onClick={() => {
                      setSlideBar(false);
                      navigate("/login");
                    }}
                    className="flex-1"
                  >
                    Login
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
