import Features from "@/components/Features";
import Hero from "@/components/Hero";
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  BookOpenText,
  CircleAlert,
  CircleCheckBig,
  IndianRupee,
  Plus,
  ShoppingCart,
  Zap,
} from "lucide-react";
const AdminDashboard = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { productData } = useSelector((state) => state.product);
  const { supplierData } = useSelector((state) => state.user);

  const onSearchSubmit = (e) => {
    e.preventDefault();

    if (!search.trim()) return navigate("/products");

    navigate(`/products?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="pt-16 min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white">
      {supplierData ? (
        <div className="max-w-6xl mx-auto p-6">
          {/* Welcome */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-3xl p-6 shadow-lg">
            <h1 className="text-3xl font-bold">नमस्ते 🙏</h1>
            <p className="mt-2 text-emerald-100">
              ई-सेतु विक्रेता डैशबोर्ड में आपका स्वागत है।
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mt-8">
            <div
              onClick={() => navigate("/product-view")}
              className="bg-white rounded-2xl shadow-md p-5 border border-emerald-100"
            >
              <p className="text-3xl">
                <CircleCheckBig />
              </p>
              <h2 className="text-2xl font-bold text-emerald-600 mt-2">
                {productData.length}
              </h2>
              <p className="text-gray-600">कुल उत्पाद</p>
            </div>

            <div
              onClick={() => navigate("/today-orders")}
              className="bg-white rounded-2xl shadow-md p-5 border border-emerald-100"
            >
              <p className="text-3xl">
                <ShoppingCart />
              </p>
              <h2 className="text-2xl font-bold text-emerald-600 mt-2">18</h2>
              <p className="text-gray-600">नए ऑर्डर</p>
            </div>

            <div
              onClick={() => navigate("/money-control")}
              className="bg-white rounded-2xl shadow-md p-5 border border-emerald-100"
            >
              <p className="text-3xl">
                <IndianRupee />
              </p>
              <h2 className="text-2xl font-bold text-emerald-600 mt-2">
                ₹12,540
              </h2>
              <p className="text-gray-600">कल की बिक्री</p>
            </div>

            <div className="bg-white rounded-2xl shadow-md p-5 border border-emerald-100">
              <p className="text-3xl">
                <CircleAlert />
              </p>
              <h2 className="text-2xl font-bold text-red-500 mt-2">5</h2>
              <p className="text-gray-600">कम स्टॉक</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-md p-6 mt-8 border border-emerald-100">
            <h2 className="text-xl font-semibold flex gap-[10px] text-gray-700 mb-4">
              <Zap /> <p>त्वरित विकल्प</p>
            </h2>

            <div className="flex justify-around items-center w-full h-full">
              <button
                onClick={() => navigate("/add-product")}
                className="flex justify-center gap-[10px] itmes-center bg-emerald-600 hover:bg-emerald-700 w-[44%] px-2 py-3 text-white rounded-xl font-medium transition"
              >
                <Plus /> <p>नया उत्पाद</p>
              </button>

              <button className="flex justify-center gap-[10px]  itmes-center bg-emerald-100 hover:bg-emerald-200 w-[44%] text-emerald-700 px-2 py-3 rounded-xl font-bold transition">
                <BookOpenText /> <p>रिपोर्ट</p>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <Hero />
          <Features />
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
