import AdminProductView from "@/components/AdminProductView";
import React, { useState } from "react";
import { BsSearch } from "react-icons/bs";
import { FiPlus } from "react-icons/fi";
import { IoChevronBackOutline } from "react-icons/io5";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const AdminProductPage = () => {
  const navigate = useNavigate();
  return (
    <div>
      <div className="max-w-7xl mt-[80px] px-5">
        {/* Hero Card */}

        <div className="rounded-3xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-2xl overflow-hidden">
          <div className="p-10 relative flex flex-col lg:flex-row justify-between items-center gap-8">
            <div>
              <h1 className="text-4xl font-bold">नया प्रोडक्ट👇</h1>

              <p className="mt-3 text-emerald-100 text-lg">
                प्रोडक्ट्स खोजें या अपनी इन्वेंट्री मैनेज करें।
              </p>
            </div>

            <button
              onClick={() => navigate("/add-product")}
              className="flex items-center gap-2 bg-white text-emerald-600 font-semibold px-6 py-3 rounded-xl shadow-lg hover:scale-105 duration-300"
            >
              <FiPlus size={22} />
              जोड़े
            </button>
          </div>
        </div>
        <AdminProductView tailwind="mt-5" />
      </div>
    </div>
  );
};

export default AdminProductPage;
