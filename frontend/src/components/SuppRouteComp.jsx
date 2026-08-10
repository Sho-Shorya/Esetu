import React, { useEffect, useState } from "react";
import { MapPin, MoveRight, Radio, Truck } from "lucide-react";
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
      <div className="w-full h-full bg-gradient-to-br from-red-700 to-red-400 text-white flex items-center px-5 py-2">
        <div className="animate-pulse">सप्लायर मार्ग लोड हो रहा है...</div>
      </div>
    );
  }

  const supplierName = `${selectedSupplier.firstName || ""} ${
    selectedSupplier.lastName || ""
  }`.trim();

  return (
    <div className="w-full min-h-12 text-black border-b-2  border-red-300 rounded-b-2xl flex items-center justify-between px-5 py-2">
      {/* Supplier info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-red-600/20 p-2 flex relative rounded-full">
          <Truck size={20} />
        </div>

        <div className="min-w-0 ">
          <p className="text-sm text-red-600">सप्लायर मार्ग</p>

          <p className="font-semibold relative text-lg truncate">
            <span className="absolute -top-2 -right-3 inline-flex animate-pulse h-2 w-2 rounded-full bg-green-600" />

            {supplierName}
          </p>
        </div>
      </div>

      {/* Live tracking */}
      <button
        onClick={() => navigate(`/tracking/${selectedSupplier._id}`)}
        className="flex items-center  gap-1 bg-white text-red-600 font-semibold py-2.5 px-4 rounded-2xl  hover:bg-red-50 active:scale-95 transition-all"
      >
        <span className=" inline-flex h-3 w-3 rounded-full mr-1 bg-red-500 opacity-75" />
        <span className="underline underline-offset-2">Track Live</span>
        <MoveRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default SuppRouteComp;
