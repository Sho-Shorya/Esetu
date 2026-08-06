import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SearchBar = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleSearch = (e) => {
    if (e.key === "Enter" && search.trim()) {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <motion.header
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        delay: 0.18,
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="sticky top-0 z-40 bg-gray-50 px-4 py-4"
    >
      <div className="flex items-center gap-3">
        {/* Search Input */}
        <motion.div
          initial={{
            opacity: 0,
            width: "92%",
          }}
          animate={{
            opacity: 1,
            width: "100%",
          }}
          transition={{
            delay: 0.3,
            duration: 0.45,
          }}
          className="relative flex-1"
        >
          <Search
            size={20}
            strokeWidth={2.2}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearch}
            type="text"
            placeholder="सामान खोजें..."
            className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-4 text-[15px] font-medium text-gray-700 shadow-sm outline-none transition-all duration-300 placeholder:text-gray-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
          />
        </motion.div>

        {/* Search Button */}
        <motion.button
          whileHover={{
            scale: 1.06,
            rotate: 8,
          }}
          whileTap={{
            scale: 0.94,
          }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 15,
          }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-red-500 hover:bg-red-50"
        >
          <Search size={22} strokeWidth={2.2} className="text-red-600" />
        </motion.button>
      </div>
    </motion.header>
  );
};

export default SearchBar;
