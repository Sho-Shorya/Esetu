import AdminProductView from "@/components/AdminProductView";
import React, { useEffect, useRef } from "react";
import { FiPlus } from "react-icons/fi";
import { Package, Layers3, ChevronLeft } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const AdminProductPage = () => {
  useEffect(() => {
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
    }, [500]);
  }, []);
  const navigate = useNavigate();

  const { productData } = useSelector((state) => state.product);

  const totalProducts = productData?.length || 0;

  const totalVariants =
    productData?.reduce(
      (total, product) => total + (product.variants?.length || 0),
      0,
    ) || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 pt-[80px] sm:px-5">
        {/* =====================================================
            HEADER
        ====================================================== */}
        <div
          onClick={() => navigate("/admin-dashboard")}
          className="px-2 py-2  w-[80px] flex mb-3 border-t-1 border-r-1 rounded-full border-emerald-400 items-center gap-3"
        >
          <ChevronLeft className="h-4 w-4 " />
          पीछे
        </div>
        <div
          className="
            relative
            overflow-hidden
            rounded-3xl
            bg-gradient-to-br
            from-emerald-700
            via-emerald-600
            to-emerald-500
            text-white
            shadow-xl
          "
        >
          {/* Decorative background */}

          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10" />

          <div className="relative flex items-center justify-between gap-4 px-5 py-6 sm:px-8 sm:py-8">
            {/* HEADING */}

            <div>
              <h1
                className="
                  text-4xl
                  font-black
                  leading-none
                  tracking-tight
                  sm:text-5xl
                "
              >
                प्रोडक्ट्स
              </h1>

              <p className="mt-2 text-sm font-medium text-emerald-100 sm:text-base">
                इन्वेंट्री मैनेज करें
              </p>
            </div>

            {/* ADD BUTTON */}

            <button
              type="button"
              onClick={() => navigate("/add-product")}
              className="
                flex
                h-12
                shrink-0
                items-center
                gap-2
                rounded-xl
                bg-white
                px-4
                font-bold
                text-emerald-700
                shadow-lg
                transition
                hover:-translate-y-0.5
                hover:shadow-xl
                active:scale-95
                sm:h-14
                sm:px-6
                sm:text-base
              "
            >
              <FiPlus size={21} />
              <span>जोड़ें</span>
            </button>
          </div>

          {/* ===================================================
              SMALL STATS
          ==================================================== */}

          <div className="relative grid grid-cols-2 border-t border-white/15">
            {/* PRODUCTS */}

            <div className="flex items-center gap-3 px-5 py-3.5 sm:px-8">
              <Package size={20} className="text-emerald-100" />

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black sm:text-2xl">
                  {totalProducts}
                </span>

                <span className="text-xs font-medium text-emerald-100 sm:text-sm">
                  प्रोडक्ट
                </span>
              </div>
            </div>

            {/* VARIANTS */}

            <div className="flex items-center gap-3 border-l border-white/15 px-5 py-3.5 sm:px-8">
              <Layers3 size={20} className="text-emerald-100" />

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black sm:text-2xl">
                  {totalVariants}
                </span>

                <span className="text-xs font-medium text-emerald-100 sm:text-sm">
                  वेरिएंट
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            PRODUCTS
        ====================================================== */}

        <div className="mt-4">
          <AdminProductView />
        </div>
      </div>
    </div>
  );
};

export default AdminProductPage;
