import { Book, CircleAlert, MoveLeft, ShoppingCart } from "lucide-react";
import React from "react";
import { BiLeftArrow } from "react-icons/bi";
import { useNavigate } from "react-router-dom";

const TodayOrders = () => {
  const navigate = useNavigate();
  return (
    <div className="w-full h-full mt-16">
      <div className="min-h-[400px] w-full  rounded-2xl px-2 py-5">
        <div className="relative h-full text-[20px] w-full flex gap-[10px] items-center justify-center">
          <MoveLeft
            onClick={() => navigate("/admin-dashboard")}
            className="absolute left-2"
          />
          <div className="bg-emerald-100 rounded-lg font-medium px-3 py-2 flex gap-[10px]">
            <ShoppingCart />
            <p>आज के नए ऑर्डर</p>
          </div>
          <CircleAlert className="absolute right-2" />
        </div>
      </div>
    </div>
  );
};

export default TodayOrders;
