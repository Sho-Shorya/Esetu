import {
  CircleAlert,
  IndianRupee,
  MoveLeft,
  Pencil,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { BsSearch } from "react-icons/bs";
import { CgClose } from "react-icons/cg";
import { GiCrossMark } from "react-icons/gi";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const AdminProductView = ({ tailwind, condition }) => {
  const { productData } = useSelector((state) => state.product);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { supplierData } = useSelector((state) => state.user);

  const onSearchSubmit = (e) => {
    e.preventDefault();

    if (!search.trim()) return navigate("/products");

    navigate(`/products?search=${encodeURIComponent(search)}`);
  };
  return (
    <div className={tailwind}>
      {tailwind == "mt-18" && (
        <div className="w-full h-full">
          <div className="w-full rounded-2xl ">
            <div className="relative h-full text-[20px] w-full flex gap-[10px] items-center justify-center">
              <MoveLeft
                onClick={() => navigate("/admin-dashboard")}
                className="absolute left-3"
              />
              <div className="rounded-lg font-medium px-5 py-2 flex items-center gap-[5px]">
                <ShoppingBag className="h-5 text-emerald-800" />
                <p>प्रोडक्ट्स</p>
              </div>
              <CircleAlert className="absolute right-3" />
            </div>
          </div>
        </div>
      )}
      <div>
        <form
          onSubmit={onSearchSubmit}
          className="bg-white relative rounded-2xl shadow-xl p-3  flex items-center"
        >
          <BsSearch className="text-emerald-600 " size={22} />
          <input
            type="text"
            placeholder="प्रोडक्ट्स खोजें..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-3 outline-none text-lg  pl-4 "
          />
          <button
            type="submit"
            className="bg-emerald-600 relative hover:bg-emerald-700 text-white px-8 py-3 rounded-xl transition-all duration-300 shadow-md"
          >
            खोजें
          </button>
        </form>
      </div>

      <div className=" min-h-screen w-full  bg-gray-100 shadow-xl rounded-4xl mt-2">
        <div className="mt-8 overflow-x-auto">
          <div className="space-y-2">
            {productData.map((product) => (
              <div
                key={product._id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Product Header */}

                <div className="relative flex gap-4 p-4">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-20 h-20 rounded-xl object-cover border"
                  />

                  <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-800">
                      {product.name} / {product.hinglishName}
                    </h2>

                    <div className="mt-2 inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm">
                      {product.category?.name}
                    </div>
                  </div>
                </div>

                {/* Variants */}

                <div className="px-4 pb-4">
                  <h3 className="font-semibold mb-3">
                    उपलब्ध वेरिएंट ({product.variants.length})
                  </h3>

                  <div className="space-y-3 overflow-auto max-h-[180px]">
                    {product.variants.map((variant, index) => (
                      <div
                        key={index}
                        className="border rounded-xl p-3 flex justify-between items-center bg-gray-50"
                      >
                        <div className="flex gap-3 items-center">
                          <img
                            src={variant.company?.logo}
                            className="w-12 h-12 rounded-lg border object-cover"
                          />

                          <div>
                            <h4 className="font-semibold">
                              {variant.company?.name}
                            </h4>

                            <div className="flex gap-2 mt-1 flex-wrap">
                              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-xs">
                                📦 {variant.measurement}
                              </span>

                              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs">
                                ₹ {variant.price}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200">
                            <Pencil size={18} />
                          </button>

                          <button className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProductView;
