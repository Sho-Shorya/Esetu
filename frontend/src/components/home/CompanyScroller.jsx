import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { LayoutGrid, Building2, ChevronRight, Search } from "lucide-react";

const CompanyScroller = ({ onSelect }) => {
  const { productData } = useSelector((state) => state.product);

  const [selected, setSelected] = useState("all");

  const companies = useMemo(() => {
    const map = new Map();

    productData.forEach((product) => {
      product.variants?.forEach((variant) => {
        const company = variant.company;

        if (company && typeof company === "object" && !map.has(company._id)) {
          map.set(company._id, company);
        }
      });
    });

    return [
      {
        _id: "all",
        name: "सभी",
        logo: "",
      },
      ...Array.from(map.values()),
    ];
  }, [productData]);

  const handleSelect = (id) => {
    setSelected(id);
    onSelect?.(id);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.35,
        duration: 0.45,
      }}
      className="mt-5"
    >
      <div className="mb-4 flex items-center justify-between px-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">कंपनी</h2>
        </div>

        <button className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
          सभी देखें
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-3">
        {companies.map((company, index) => {
          const active = selected === company._id;

          return (
            <motion.button
              key={company._id}
              initial={{
                opacity: 0,
                y: 15,
                scale: 0.9,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: active ? 1.05 : 1,
              }}
              transition={{
                delay: index * 0.05 + 0.4,
                type: "spring",
                stiffness: 250,
              }}
              whileHover={{
                y: -4,
                scale: 1.05,
              }}
              whileTap={{
                scale: 0.95,
              }}
              onClick={() => handleSelect(company._id)}
              className={`flex min-w-[90px]  flex-col items-center rounded-3xl p-3 transition-all duration-300 ${
                active
                  ? "bg-gradient-to-br from-red-600 to-red-500 text-white shadow-xl"
                  : "bg-white text-gray-700 shadow-md"
              }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl ${
                  active ? "bg-white/20" : "bg-red-50"
                }`}
              >
                {company._id === "all" ? (
                  <LayoutGrid
                    size={28}
                    className={active ? "text-white" : "text-red-600"}
                  />
                ) : company.logo ? (
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="h-15 w-15 object-contain"
                  />
                ) : (
                  <Building2
                    size={28}
                    className={active ? "text-white" : "text-red-600"}
                  />
                )}
              </div>

              <span className="mt-3 line-clamp-1 text-xs font-semibold">
                {company.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.section>
  );
};

export default CompanyScroller;
