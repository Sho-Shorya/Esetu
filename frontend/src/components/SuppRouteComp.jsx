import React, { useEffect, useState } from "react";
import { Loader2, MapPin, MoveRight, Radio, Truck } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const SuppRouteComp = () => {
  const { suppliers = [] } = useSelector((state) => state.routes);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const navigate = useNavigate();

  // Set Hansraj as the default supplier
  useEffect(() => {
    if (suppliers.length === 0) return;

    const hansraj = suppliers.find(
      (supp) => supp.firstName?.toLowerCase() === "hansraj",
    );

    setSelectedSupplier(hansraj || suppliers[0]);
  }, [suppliers]);

  // Still loading suppliers
  if (!selectedSupplier) {
    return (
      <div className="w-full min-h-12 text-black border-b-1 z-21  border-red-600 rounded-b-4xl flex items-center justify-between px-8 py-1">
        {/* Supplier info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="bg-red-600/20 p-1 flex items-center relative rounded-full">
            <Truck size={15} />
          </div>

          <div className="min-w-0 items-center gap-2 flex ">
            <p className="text-sm text-red-600">सप्लायर - </p>
            <p className="font-semibold relative text-md truncate">
              <Loader2 className="text-gray-400 animate-spin h-4 w-4" />
            </p>
          </div>
        </div>

        {/* Live tracking */}
        <button
          onClick={() => navigate(`/tracking/${selectedSupplier._id}`)}
          className="flex items-center  gap-1 text-red-600 px-3 font-semibold py-1 px-2 rounded-2xl  hover:bg-red-50 active:scale-95 transition-all"
        >
          <span className="">Track</span>
          <MoveRight className=" bg-red-600 text-white rounded-full p-[1px] h-4 w-4" />
        </button>
      </div>
    );
  }

  const supplierName = `${selectedSupplier.firstName || ""} ${
    selectedSupplier.lastName || ""
  }`.trim();

  return (
    <div className="w-full min-h-12 text-black border-b-1 z-21  border-red-600 rounded-b-4xl flex items-center justify-between px-8 py-1">
      {/* Supplier info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-red-600/20 p-1 flex items-center relative rounded-full">
          <Truck size={15} />
        </div>

        <div className="min-w-0 items-end gap-2 flex ">
          <p className="text-sm text-red-600">सप्लायर - </p>
          <p className="font-semibold relative text-sm truncate">
            {supplierName}
          </p>
        </div>
      </div>

      {/* Live tracking */}
      <button
        onClick={() => navigate(`/tracking/${selectedSupplier._id}`)}
        className="flex items-center  gap-[7px] text-red-600 px-3 font-semibold py-1 px-2 rounded-2xl  hover:bg-red-50 active:scale-95 transition-all"
      >
        <span className="">Track</span>
        <MoveRight className="h-5 w-5 bg-red-600 text-white rounded-full p-[1px]" />
      </button>
    </div>
  );
};

export default SuppRouteComp;
