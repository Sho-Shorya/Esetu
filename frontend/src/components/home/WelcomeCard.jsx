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
      className="relative mx-3 mt-6 overflow-hidden rounded-[32px] bg-gradient-to-br from-red-600 via-red-500 to-orange-500 shadow-xl"
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
        </motion.div>

        {/* Character */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          {/* Background Card */}
          <div className="relative h-28 w-28 rounded-[28px] bg-gradient-to-br from-white via-red-50 to-red-100 shadow-[0_20px_60px_rgba(239,68,68,0.18)] ring-1 ring-red-100" />

          {/* Character */}
          <motion.img
            src="./holdingGrocery.png"
            alt="Shopping Character"
            draggable={false}
            className="absolute -bottom-15 h-80 w-80 object-contain pointer-events-none"
            initial={{
              opacity: 0,
              y: 30,
              scale: 0.75,
              rotate: -8,
            }}
            animate={{
              opacity: 1,
              y: [0, -8, 0],
              scale: [1, 1.03, 1],
              rotate: [0, 1.5, -1.5, 0],
            }}
            transition={{
              opacity: {
                duration: 0.6,
              },
              scale: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
              y: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
              rotate: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
          />
        </div>
      </div>
    </motion.section>
  );
};

export default WelcomeCard;
