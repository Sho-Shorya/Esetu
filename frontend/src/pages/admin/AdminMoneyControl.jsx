import { CircleAlert, IndianRupee, MoveLeft, ShoppingCart } from "lucide-react";
import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const AdminMoneyControl = () => {
  const navigate = useNavigate();

  const { supplierData } = useSelector((state) => state.user);
  return (
    <div className="w-full h-full mt-15">
      <div className="min-h-[400px] w-full  rounded-2xl px-2 py-5">
        <div className="relative h-full text-[20px] w-full flex gap-[10px] items-center justify-center">
          <MoveLeft
            onClick={() => navigate("/admin-dashboard")}
            className="absolute left-3"
          />
          <div className="rounded-lg font-medium px-3 py-2 flex items-center gap-[5px]">
            <IndianRupee className="h-5 text-emerald-800" />
            <p>हिसाब सेक्शन</p>
          </div>
          <CircleAlert className="absolute right-3" />
        </div>
      </div>
    </div>
  );
};

export default AdminMoneyControl;
