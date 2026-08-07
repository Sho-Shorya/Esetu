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
    label: "पुराना हिसाब",
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

  const links = userData ? userLinks : supplierLinks;

  if (!links) return null;

  return (
    <motion.nav
      initial={{ y: 120 }}
      animate={{ y: 0 }}
      transition={{
        type: "spring",
        stiffness: 180,
        damping: 22,
      }}
      className={`fixed bottom-0 left-0 right-0 z-50 ${
        userData
          ? "bg-gradient-to-b from-red-500 via-red-600 to-red-700"
          : "bg-gradient-to-b from-emerald-500 via-emerald-600 to-emerald-700"
      }`}
    >
      {/* Top Border */}
      <div className="absolute left-0 right-0 top-0 h-px bg-white/30" />

      {/* Glow */}
      <div className="absolute inset-x-10 -top-6 h-12 rounded-full bg-white/15 blur-3xl" />

      {/* Shadow */}
      <div className="absolute -top-6 left-0 right-0 h-6 bg-black/20 blur-xl" />

      <div className="flex justify-around px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+15px)]">
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.to} to={item.to} end className="relative">
              {({ isActive }) => (
                <motion.div
                  whileTap={{
                    scale: 0.92,
                  }}
                  whileHover={{
                    y: -2,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 450,
                  }}
                  className="relative"
                >
                  {isActive && (
                    <>
                      {/* Floating Shadow */}
                      <motion.div
                        layoutId="shadow"
                        className="absolute inset-0 rounded-3xl  bg-black/20 blur-xl"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }}
                      />

                      {/* Premium Glass */}
                      <motion.div
                        layoutId="pill"
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 35,
                        }}
                        className="
                        absolute inset-0
                        overflow-hidden
                        rounded-3xl

                        border border-white/35

                        bg-gradient-to-b
                        from-white/30
                        via-white/18
                        to-white/8

                        shadow-[0_8px_25px_rgba(255,255,255,.04)]
                      "
                      >
                        {/* Animated Shine */}
                        <motion.div
                          className="absolute -left-20 top-0 h-full w-14 rotate-12 bg-white/50 blur-lg"
                          animate={{
                            x: [-100, 200],
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 3,
                            ease: "linear",
                          }}
                        />

                        {/* Top Reflection */}
                        <div className="absolute left-4 right-4 bottom-[0px] h-px rounded-full bg-white/70" />

                        {/* Bottom Reflection */}
                        <div className="absolute bottom-[0px] left-6 right-6 h-px rounded-full" />
                      </motion.div>

                      {/* Active Top Indicator */}
                      <motion.div
                        layoutId="indicator"
                        transition={{
                          type: "spring",
                          stiffness: 550,
                          damping: 30,
                        }}
                        className="absolute left-1/2 -bottom-0 h-1 w-10 -translate-x-1/2 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,.8)]"
                      />
                    </>
                  )}

                  <motion.div
                    animate={{
                      y: isActive ? -4 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 450,
                      damping: 22,
                    }}
                    className="relative z-20 flex min-w-[96px] flex-col items-center rounded-3xl px-5 py-2"
                  >
                    {/* Active Background Glow */}
                    {isActive && (
                      <motion.div
                        layoutId="iconGlow"
                        transition={{
                          type: "spring",
                          stiffness: 450,
                          damping: 28,
                        }}
                        className="absolute inset-0 rounded-3xl bg-white/5 blur-2xl"
                      />
                    )}

                    {/* Icon */}
                    <motion.div
                      animate={{
                        scale: isActive ? 1.16 : 1,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 18,
                      }}
                      className="relative"
                    >
                      {/* Halo */}
                      {isActive && (
                        <motion.div
                          animate={{
                            scale: [1, 1.4, 1],
                            opacity: [0.25, 0.1, 0.25],
                          }}
                          transition={{
                            duration: 2.2,
                            repeat: Infinity,
                          }}
                          className="absolute inset-0 rounded-full bg-white blur-lg"
                        />
                      )}

                      <Icon
                        size={24}
                        strokeWidth={2.5}
                        className={`relative transition-all duration-300 ${
                          isActive
                            ? "text-white drop-shadow-[0_2px_8px_rgba(255,255,255,.45)]"
                            : "text-white/75"
                        }`}
                      />
                    </motion.div>

                    {/* Label */}
                    <motion.span
                      animate={{
                        opacity: isActive ? 1 : 0.78,
                        y: isActive ? 1 : 0,
                        scale: isActive ? 1.02 : 1,
                      }}
                      transition={{
                        duration: 0.2,
                      }}
                      className={`mt-1 whitespace-nowrap text-[11px] font-semibold transition-all ${
                        isActive ? "text-white" : "text-white/80"
                      }`}
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
    </motion.nav>
  );
};

export default Nav;
