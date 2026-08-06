import { motion } from "framer-motion";
import { ChevronRight, Truck } from "lucide-react";

const WelcomeCard = () => {
  const hour = new Date().getHours();

  let greeting = "शुभ संध्या!";
  let message = "आज की ज़रूरत का सामान अभी ऑर्डर करें।";

  if (hour < 12) {
    greeting = "शुभ प्रभात!";
    message = "आज का ताज़ा सामान आपके इंतज़ार में है।";
  } else if (hour < 17) {
    greeting = "शुभ दोपहर!";
    message = "घर बैठे आसानी से अपना ऑर्डर करें।";
  }

  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 35,
        scale: 0.96,
      }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      transition={{
        duration: 0.65,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative mx-4 mt-3 overflow-hidden rounded-[32px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 shadow-xl"
    >
      {/* Background Blobs */}
      <div className="absolute -right-14 -top-14 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-20 -left-14 h-48 w-48 rounded-full bg-orange-300/20 blur-3xl" />

      <div className="relative flex items-center justify-between px-6 py-6">
        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: 0.15,
            duration: 0.55,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="max-w-[58%]"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-md">
            <img
              src="./namaste.png"
              alt="Namaste"
              className="h-5 w-5 object-contain"
            />

            <span className="text-sm font-semibold text-white">नमस्ते!</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold leading-tight text-white">
            {greeting}
          </h1>

          <p className="mt-2 text-sm leading-6 text-red-100">{message}</p>

          <motion.button
            whileHover={{
              scale: 1.05,
            }}
            whileTap={{
              scale: 0.96,
            }}
            className="mt-6 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-red-600 shadow-lg"
          >
            अभी खरीदें
            <ChevronRight size={18} />
          </motion.button>
        </motion.div>

        {/* Character */}
        <motion.div
          initial={{
            opacity: 0,
            x: 35,
            scale: 0.88,
          }}
          animate={{
            opacity: 1,
            x: 0,
            scale: 1,
            y: [0, -6, 0],
            rotate: [0, 2, -2, 0],
          }}
          transition={{
            opacity: {
              duration: 0.55,
              delay: 0.3,
            },
            x: {
              duration: 0.55,
              delay: 0.3,
            },
            scale: {
              duration: 0.55,
              delay: 0.3,
            },
            y: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
            rotate: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
          className="relative"
        >
          <div className="relative flex h-36 w-36 items-center justify-center">
            {/* Glow */}
            <div className="absolute inset-5 rounded-full bg-white/20 blur-xl" />

            {/* Character Card */}
            <div className="relative flex h-32 w-32 items-center justify-center rounded-[28px] bg-gradient-to-br from-white to-red-50 shadow-2xl">
              <img
                src="./holdingGrocery.png"
                alt="Shopping Character"
                className="absolute bottom-0 h-40 w-40 object-contain"
                draggable={false}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};

export default WelcomeCard;
