import React, { useEffect, useState } from "react";
import { ChevronDown, Loader2, MoveRight, Truck, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const SuppRouteComp = () => {
  const { suppliers = [] } = useSelector((state) => state.routes);

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [selectSupp, setSelectSupp] = useState(false);

  const navigate = useNavigate();

  // =========================================================
  // DEFAULT SUPPLIER
  // =========================================================

  useEffect(() => {
    if (!suppliers.length) {
      setSelectedSupplier(null);
      return;
    }

    setSelectedSupplier((current) => {
      if (current) {
        const stillExists = suppliers.find((supp) => supp._id === current._id);

        if (stillExists) {
          return stillExists;
        }
      }

      // Otherwise first supplier
      return suppliers[0];
    });
  }, [suppliers]);

  // =========================================================
  // LOADING
  // =========================================================

  if (!selectedSupplier) {
    return (
      <div
        className="
          relative
          z-30
          flex
          min-h-12
          w-full
          items-center
          justify-between
          border-b
          border-red-600/20
          px-5
          py-1.5
        "
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              bg-red-50
              text-red-600
            "
          >
            <Truck size={15} />
          </div>

          <div className="animate-pulse flex items-center gap-2">
            <span className="text-xs font-medium text-red-500">सप्लायर -</span>

            <Loader2 size={12} className="animate-spin text-gray-800" />
          </div>
        </div>
      </div>
    );
  }

  const supplierName =
    `${selectedSupplier.firstName || ""} ${
      selectedSupplier.lastName || ""
    }`.trim() || "Supplier";

  // =========================================================
  // SELECT SUPPLIER
  // =========================================================

  const handleSelectSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setSelectSupp(false);
  };

  // =========================================================
  // TRACK
  // =========================================================

  const handleTrack = () => {
    if (!selectedSupplier?._id) return;

    navigate(`/tracking/${selectedSupplier._id}`);
  };

  return (
    <>
      {/* =====================================================
          SUPPLIER BAR
      ====================================================== */}

      <div
        className="
          relative
          z-30
          flex
          min-h-12
          w-full
          items-center
          justify-between
          border-b
          rounded-b-4xl
          border-red-600/50
          px-5
          py-1.5
        "
      >
        {/* ===================================================
            SUPPLIER INFO
        ==================================================== */}

        <button
          type="button"
          onClick={() => setSelectSupp(true)}
          className="
            flex
            min-w-0
            items-center
            gap-2.5
            rounded-2xl
            py-1
            text-left
            transition-transform
            active:scale-[0.97]
          "
        >
          {/* Truck */}

          <div
            className="
              flex
              h-7
              w-7
              shrink-0
              items-center
              justify-center
              rounded-full
              bg-red-50
              text-red-600
            "
          >
            <Truck size={15} />
          </div>

          {/* Name */}

          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 text-xs font-medium text-red-500">
              सप्लायर -
            </span>

            <span className="flex min-w-0 items-center gap-1 text-sm font-bold text-neutral-800">
              <span className="max-w-[110px] truncate">{supplierName}</span>

              <ChevronDown
                size={16}
                className={`
                  shrink-0
                  text-red-500
                  transition-transform
                  duration-300
                  ${selectSupp ? "rotate-180" : ""}
                `}
              />
            </span>
          </div>
        </button>

        {/* ===================================================
            TRACK BUTTON
        ==================================================== */}

        <motion.button
          whileTap={{ scale: 0.94 }}
          type="button"
          onClick={handleTrack}
          className="
            flex
            shrink-0
            items-center
            gap-1
            rounded-full
            px-2
            py-1
            font-bold
            text-red-600
            transition-colors
            hover:bg-red-50
          "
        >
          <span className="text-xs">Track</span>

          <span
            className="
              flex
              h-5
              w-5
              items-center
              justify-center
              rounded-full
              bg-red-600
              text-white
            "
          >
            <MoveRight size={13} />
          </span>
        </motion.button>
      </div>

      {/* =====================================================
          SUPPLIER SELECTOR
      ====================================================== */}

      <AnimatePresence>
        {selectSupp && (
          <>
            {/* =================================================
                BACKDROP
            ================================================== */}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSelectSupp(false)}
              className="
                fixed
                inset-0
                z-40
                bg-black/20
                backdrop-blur-[2px]
              "
            />

            {/* =================================================
                BOTTOM SHEET
            ================================================== */}

            <motion.div
              initial={{
                opacity: 0,
                y: 25,
                scale: 0.98,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 25,
                scale: 0.98,
              }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 30,
              }}
              className="
                fixed
                bottom-0
                left-3
                right-3
                z-50
                min-h-120
                mx-auto
                max-w-[430px]
                overflow-hidden
                rounded-t-[28px]
                border
                border-white/80
                bg-white/95
                shadow-[0_20px_60px_rgba(0,0,0,0.22)]
              "
            >
              {/* =================================================
                  HEADER
              ================================================== */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b
                  border-neutral-100
                  px-5
                  py-4
                "
              >
                <div>
                  <p className="text-base font-extrabold text-neutral-900">
                    सप्लायर चुनें
                  </p>

                  <p className="mt-0.5 text-[11px] font-medium text-neutral-400">
                    ट्रैक करने के लिए सप्लायर चुनें
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectSupp(false)}
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-full
                    bg-neutral-100
                    text-neutral-500
                    transition
                    active:scale-90
                  "
                >
                  <X size={16} />
                </button>
              </div>

              {/* =================================================
                  SUPPLIER LIST
              ================================================== */}

              <div className="max-h-[45vh] overflow-y-auto p-3">
                {suppliers.map((supplier) => {
                  const name =
                    `${supplier.firstName || ""} ${
                      supplier.lastName || ""
                    }`.trim() || "Supplier";

                  const isSelected = selectedSupplier?._id === supplier._id;

                  return (
                    <motion.button
                      key={supplier._id}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectSupplier(supplier)}
                      className={`
                        relative
                        mb-2
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-2xl
                        border
                        px-3
                        py-3
                        text-left
                        transition-all

                        ${
                          isSelected
                            ? "border-red-200 bg-red-50"
                            : "border-transparent bg-neutral-50 hover:bg-neutral-100"
                        }
                      `}
                    >
                      {/* Truck icon */}

                      <div
                        className={`
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl

                          ${
                            isSelected
                              ? "bg-red-500 text-white"
                              : "bg-white text-neutral-500 shadow-sm"
                          }
                        `}
                      >
                        <Truck size={18} />
                      </div>

                      {/* Supplier name */}

                      <div className="min-w-0 flex-1">
                        <p
                          className={`
                            truncate
                            text-sm
                            font-bold

                            ${isSelected ? "text-red-700" : "text-neutral-800"}
                          `}
                        >
                          {name}
                        </p>

                        <p className="mt-0.5 text-[10px] font-medium text-neutral-400">
                          सप्लायर
                        </p>
                      </div>

                      {/* Selected */}

                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="
                            flex
                            h-7
                            w-7
                            items-center
                            justify-center
                            rounded-full
                            bg-red-500
                            text-white
                          "
                        >
                          <Check size={15} strokeWidth={3} />
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="h-1" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default SuppRouteComp;
