import { Home, History, ShoppingBag, IndianRupee } from "lucide-react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";

const userLinks = [
  {
    to: "/",
    label: "नया ऑर्डर",
    icon: Home,
  },
  {
    to: "/my-orders",
    label: "आज का ऑर्डर",
    icon: ShoppingBag,
  },
  {
    to: "/order-history",
    label: "मेरा हिसाब",
    icon: History,
  },
];

const supplierLinks = [
  {
    to: "/admin-dashboard",
    label: "डैशबोर्ड",
    icon: Home,
  },
  {
    to: "/today-orders",
    label: "आज के ऑर्डर",
    icon: ShoppingBag,
  },
  {
    to: "/money-control",
    label: "मनी कंट्रोल",
    icon: IndianRupee,
  },
];

const Nav = () => {
  const { userData, supplierData } = useSelector((state) => state.user);

  const isSupplier = Boolean(supplierData);
  const links = isSupplier ? supplierLinks : userLinks;

  const activeColor = isSupplier
    ? {
        gradient: "from-emerald-500 via-emerald-600 to-emerald-700",
        glow: "bg-emerald-500/20",
        shadow: "shadow-emerald-500/25",
      }
    : {
        gradient: "from-red-500 via-red-600 to-red-700",
        glow: "bg-red-500/20",
        shadow: "shadow-red-500/25",
      };

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 24,
      }}
      className="
        fixed
        bottom-3
        left-3
        right-3
        z-50
        mx-auto
        max-w-xl
      "
    >
      {/* =====================================================
          GLASS NAV
      ===================================================== */}

      <div
        className="
          relative
          overflow-hidden
          rounded-[27px]
          border
          border-slate-200/70
          bg-white/88
          shadow-[0_10px_35px_rgba(15,23,42,0.14)]
          backdrop-blur-xl
          backdrop-saturate-150
        "
      >
        {/* =================================================
            SHARP TOP REFLECTION
        ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            left-5
            right-5
            top-0
            h-px
            bg-gradient-to-r
            from-transparent
            via-white
            to-transparent
          "
        />

        {/* =================================================
            VERY SUBTLE GLASS LIGHT
        ================================================= */}

        <div
          className="
            pointer-events-none
            absolute
            inset-x-16
            -top-8
            h-12
            rounded-full
            bg-white/70
            blur-2xl
          "
        />

        {/* =================================================
            NAV ITEMS
        ================================================= */}

        <div
          className="
            relative
            flex
            items-center
            justify-around
            gap-1
            px-2
            py-2
            pb-[calc(env(safe-area-inset-bottom)+8px)]
          "
        >
          {links.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className="relative flex-1"
              >
                {({ isActive }) => (
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 28,
                    }}
                    className="relative flex justify-center"
                  >
                    {/* =================================================
                        ACTIVE SHADOW
                    ================================================= */}

                    {isActive && (
                      <motion.div
                        layoutId="activeNavGlow"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 32,
                        }}
                        className={`
                          absolute
                          inset-1
                          rounded-[21px]
                          ${activeColor.glow}
                          blur-md
                        `}
                      />
                    )}

                    {/* =================================================
                        ACTIVE PILL
                    ================================================= */}

                    {isActive && (
                      <motion.div
                        layoutId="activeNavPill"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 32,
                        }}
                        className={`
                          absolute
                          inset-0
                          overflow-hidden
                          rounded-[21px]
                          bg-gradient-to-br
                          ${activeColor.gradient}
                          shadow-md
                          ${activeColor.shadow}
                        `}
                      >
                        {/* glass shine */}
                        <div
                          className="
                            absolute
                            inset-x-2
                            top-1
                            h-[38%]
                            rounded-full
                            bg-white/20
                            blur-sm
                          "
                        />

                        {/* sharp top edge */}
                        <div
                          className="
                            absolute
                            left-3
                            right-3
                            top-0
                            h-px
                            bg-white/45
                          "
                        />

                        {/* subtle bottom edge */}
                        <div
                          className="
                            absolute
                            bottom-0
                            left-4
                            right-4
                            h-px
                            bg-black/10
                          "
                        />

                        {/* glass border */}
                        <div
                          className="
                            absolute
                            inset-0
                            rounded-[21px]
                            border
                            border-white/20
                          "
                        />
                      </motion.div>
                    )}

                    {/* =================================================
                        ITEM CONTENT
                    ================================================= */}

                    <motion.div
                      animate={{
                        y: isActive ? -1 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 25,
                      }}
                      className="
                        relative
                        z-10
                        flex
                        min-w-[88px]
                        flex-col
                        items-center
                        justify-center
                        rounded-[21px]
                        px-4
                        py-2.5
                      "
                    >
                      {/* ICON */}

                      <motion.div
                        animate={{
                          scale: isActive ? 1.06 : 1,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 25,
                        }}
                        className="relative"
                      >
                        {isActive && (
                          <motion.div
                            initial={{
                              opacity: 0,
                              scale: 0.7,
                            }}
                            animate={{
                              opacity: 1,
                              scale: 1,
                            }}
                            transition={{
                              duration: 0.2,
                            }}
                            className={`
                              absolute
                              inset-0
                              rounded-full
                              ${activeColor.glow}
                              blur-md
                            `}
                          />
                        )}

                        <Icon
                          className={`
                            relative
                            h-[22px]
                            w-[22px]
                            transition-colors
                            duration-200
                            ${
                              isActive
                                ? "text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
                                : "text-slate-400"
                            }
                          `}
                          strokeWidth={isActive ? 2.7 : 2.2}
                        />
                      </motion.div>

                      {/* LABEL */}

                      <motion.span
                        animate={{
                          opacity: isActive ? 1 : 0.72,
                          y: isActive ? 0 : 1,
                        }}
                        transition={{
                          duration: 0.18,
                        }}
                        className={`
                          mt-1
                          whitespace-nowrap
                          text-[10px]
                          font-bold
                          tracking-tight
                          ${isActive ? "text-white" : "text-slate-500"}
                        `}
                      >
                        {item.label}
                      </motion.span>
                    </motion.div>
                  </motion.div>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
};

export default Nav;
