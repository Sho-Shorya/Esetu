import React, { useEffect, useState } from "react";
import { MapPin, Radio, Truck } from "lucide-react";
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
    <div className="w-full min-h-16 bg-gradient-to-br from-red-700 to-red-400 text-white flex items-center justify-between gap-4 px-5 py-2">
      {/* Supplier info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="bg-white/20 p-2 rounded-full">
          <Truck size={20} />
        </div>

        <div className="min-w-0">
          <p className="text-xs text-red-100">सप्लायर मार्ग</p>

          <p className="font-semibold text-lg truncate">{supplierName}</p>
        </div>
      </div>

      {/* Live tracking */}
      <button
        onClick={() => navigate(`/tracking/${selectedSupplier._id}`)}
        className="flex items-center gap-2 bg-white text-red-600 font-semibold py-2.5 px-4 rounded-2xl shadow-md hover:bg-red-50 active:scale-95 transition-all"
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-green-600" />
        </span>

        <span>लाइव ट्रैक करें</span>
      </button>
    </div>
  );
};

export default SuppRouteComp;
