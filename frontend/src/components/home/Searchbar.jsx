import { motion } from "framer-motion";
import { Search, X } from "lucide-react";

const SearchBar = ({ value, onChange }) => {
  return (
    <motion.header
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="sticky top-0 z-20 bg-gray-50 px-4 py-4"
    >
      <div className="relative">
        <Search
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="सामान खोजें..."
          className="h-14 w-full rounded-2xl border border-gray-200 bg-white pl-12 pr-12 text-[15px] font-medium text-gray-700 shadow-sm outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
        />

        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </motion.header>
  );
};

export default SearchBar;
