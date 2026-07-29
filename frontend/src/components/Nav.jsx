import {
  CarTaxiFront,
  History,
  Home,
  List,
  ListOrdered,
  Package2,
  Plus,
  ShoppingBag,
} from "lucide-react";
import React from "react";
import { CgToday } from "react-icons/cg";
import { IoToday } from "react-icons/io5";
import { LiaStickyNote } from "react-icons/lia";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";

const Nav = () => {
  const { userData, supplierData } = useSelector((state) => state.user);
  return (
    <div>
      {userData && (
        <div className="flex justify-around items-center bg-red-600 text-[15px] text-white h-[70px] fixed left-0 right-0 bottom-0">
          <Link to="/">
            <div className="  flex flex-col items-center">
              <Home className="mb-[5px] h-6" />
              <h1 classn>नया ऑर्डर</h1>
            </div>
          </Link>
          <Link to="/cart">
            <div className=" flex flex-col items-center">
              <ShoppingBag className="mb-[4px] h-6" />
              <h1>आज का ऑर्डर</h1>
            </div>
          </Link>
          <Link to="/orders">
            <div className=" flex flex-col items-center">
              <History className="mb-[4px] h-6" />
              <h1>पुराना हिसाब</h1>
            </div>
          </Link>
        </div>
      )}
      {supplierData && (
        <div className="flex justify-around items-center bg-emerald-700 text-[15px] text-white h-[70px] fixed left-0 right-0 bottom-0">
          <Link to="/admin-dashboard">
            <div className="  flex flex-col items-center">
              <Home className="mb-[5px] h-6" />
              <h1 classn>आज के ऑर्डर</h1>
            </div>
          </Link>
          <Link to="/product-page">
            <div className=" flex flex-col items-center">
              <ShoppingBag className="mb-[4px] h-6" />
              <h1>सभी प्रोडक्ट्स</h1>
            </div>
          </Link>
          <Link to="/orders">
            <div className=" flex flex-col items-center">
              <History className="mb-[4px] h-6" />
              <h1>पुराना हिसाब</h1>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
};

export default Nav;
