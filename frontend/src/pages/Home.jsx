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
  const { userData, prodLoading } = useSelector((state) => state.user);
  const searchQuery =
    new URLSearchParams(location.search).get("search")?.trim().toLowerCase() ||
    "";

  const onSearchSubmit = (e) => {
    e.preventDefault();
    if (!search) return navigate("/products");
    navigate(`/products?search=${encodeURIComponent(search)}`);
  };

  const [selectedCompany, setSelectedCompany] = useState("all");
  return (
    <div className="w-full overflow-hidden pt-14">
      {!prodLoading && <Timer />}
      {userData ? (
        <div className="w-full">
          <ProductsList selectedCompany={selectedCompany} />
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
