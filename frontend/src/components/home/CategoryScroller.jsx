import { useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  Milk,
  Wheat,
  Apple,
  Beef,
  Candy,
  CookingPot,
  Sandwich,
  SprayCan,
  ChevronRight,
} from "lucide-react";

const categories = [
  {
    id: "all",
    name: "सभी",
    icon: LayoutGrid,
  },
  {
    id: "milk",
    name: "दूध",
    icon: Milk,
  },
  {
    id: "bakery",
    name: "बेकरी",
    icon: Wheat,
  },
  {
    id: "fruits",
    name: "फल",
    icon: Apple,
  },
  {
    id: "snacks",
    name: "स्नैक्स",
    icon: Candy,
  },
  {
    id: "care",
    name: "देखभाल",
    icon: SprayCan,
  },
];

const CategoryScroller = ({ onSelect }) => {
  const [selected, setSelected] = useState("all");

  const handleClick = (id) => {
    setSelected(id);
    onSelect?.(id);
  };

  return (
    <section className="mt-5">
      {/* Heading */}
      <div className="mb-4 flex items-center justify-between px-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">श्रेणियाँ</h2>
          <p className="text-xs text-gray-500">अपनी पसंद का सामान चुनें</p>
        </div>

        <button className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100">
          सभी देखें
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Categories */}
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const active = selected === category.id;

          return (
            <motion.button
              key={category.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleClick(category.id)}
              className={`flex min-w-[88px] flex-col items-center rounded-3xl p-3 transition-all duration-300
                ${
                  active
                    ? "bg-gradient-to-br from-red-600 to-red-500 text-white shadow-xl"
                    : "bg-white text-gray-700 shadow-md"
                }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-2xl transition
                  ${active ? "bg-white/20" : "bg-red-50"}`}
              >
                <Icon
                  size={28}
                  strokeWidth={2}
                  className={active ? "text-white" : "text-red-600"}
                />
              </div>

              <span className="mt-3 text-xs font-semibold">
                {category.name}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

export default CategoryScroller;
