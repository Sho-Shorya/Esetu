import Features from "@/components/Features";
import Hero from "@/components/Hero";
import React, { useState } from "react";
import ProductsList from "@/pages/ProductsList";
import { useSelector } from "react-redux";
import { BsSearch } from "react-icons/bs";
import { useNavigate } from "react-router-dom";
import Timer from "@/components/Timer";

const Home = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { userData } = useSelector((state) => state.user);
  const searchQuery =
    new URLSearchParams(location.search).get("search")?.trim().toLowerCase() ||
    "";

  const onSearchSubmit = (e) => {
    e.preventDefault();
    if (!search) return navigate("/products");
    navigate(`/products?search=${encodeURIComponent(search)}`);
  };

  return (
    <div className="w-full overflow-hidden pt-14">
      <Timer />
      {userData ? (
        <div className="w-full">
          <div className="w-full">
            <div className="w-full flex gap-[5px] flex-col items-center mt-5">
              <form
                onSubmit={(e) => {
                  onSearchSubmit(e);
                }}
                className="flex gap-2"
              >
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="उत्पाद खोजें..."
                  className="w-full outline-none focus:border-2 border-red-300 flex-1 px-3 text-[20px] rounded border"
                />
                <div
                  onClick={() => setSearch("")}
                  className="bg-red-600 text-white px-3 rounded-2xl"
                >
                  <BsSearch className="min-h-12 " />
                </div>
              </form>
            </div>
          </div>
          <ProductsList />
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

export default Home;
