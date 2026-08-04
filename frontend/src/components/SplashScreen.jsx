import { motion } from "framer-motion";
const SplashScreen = () => {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
      <motion.img
        src="./logo.png"
        alt="e-Setu"
        className="h-28 w-28 rounded-3xl shadow-xl"
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{
          repeat: Infinity,
          repeatType: "reverse",
          duration: 4,
        }}
      />

      <h1 className="mt-6 text-4xl font-black text-red-600">e-Setu</h1>

      <p className="mt-2 text-gray-500">Connecting to your grocery store...</p>

      <div className="mt-8 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-red-600"></div>
    </div>
  );
};

export default SplashScreen;
