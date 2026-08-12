import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const SplashScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }

        return prev + 2;
      });
    }, 35);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-white">
      {/* =====================================================
          BACKGROUND
      ====================================================== */}

      <div className="pointer-events-none absolute inset-0">
        {/* Top red glow */}

        <div
          className="
            absolute
            -top-32
            left-1/2
            h-72
            w-72
            -translate-x-1/2
            rounded-full
            bg-red-500/10
            blur-3xl
          "
        />

        {/* Bottom orange glow */}

        <div
          className="
            absolute
            -bottom-40
            -left-20
            h-80
            w-80
            rounded-full
            bg-orange-400/10
            blur-3xl
          "
        />

        {/* Small decorative dots */}

        <div className="absolute left-[15%] top-[22%] h-1.5 w-1.5 rounded-full bg-red-300" />

        <div className="absolute right-[18%] top-[30%] h-1 w-1 rounded-full bg-orange-300" />

        <div className="absolute bottom-[25%] right-[20%] h-1.5 w-1.5 rounded-full bg-red-200" />
      </div>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div className="relative flex flex-col items-center">
        {/* Logo glow */}

        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{
            opacity: [0.15, 0.3, 0.15],
            scale: [0.9, 1.1, 0.9],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="
            absolute
            h-36
            w-36
            rounded-[38px]
            bg-red-500
            blur-2xl
          "
        />

        {/* =================================================
            LOGO
        ================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            scale: 0.65,
            y: 20,
          }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
          }}
          transition={{
            duration: 0.8,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="relative"
        >
          <div
            className="
              relative
              overflow-hidden
              rounded-[30px]
              bg-white
              p-1
              shadow-[0_18px_50px_rgba(239,68,68,0.22)]
            "
          >
            <img
              src="./logolow.png"
              alt="e-Setu"
              draggable={false}
              className="
                h-28
                w-28
                rounded-[26px]
                object-cover
              "
            />

            {/* Glass shine */}

            <motion.div
              initial={{ x: -100 }}
              animate={{ x: 150 }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                repeatDelay: 2,
                ease: "easeInOut",
              }}
              className="
                pointer-events-none
                absolute
                inset-y-0
                w-10
                -skew-x-12
                bg-white/40
                blur-md
              "
            />
          </div>
        </motion.div>

        {/* =================================================
            BRAND
        ================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.25,
            duration: 0.6,
          }}
          className="mt-6 text-center"
        >
          <h1 className="text-[38px] font-black tracking-tight text-red-600">
            e-Setu
          </h1>

          <p className="mt-1 text-sm font-medium text-neutral-500">
            आपका अपना ऑनलाइन स्टोर
          </p>
        </motion.div>

        {/* =================================================
            LOADING
        ================================================== */}

        <motion.div
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.45,
            duration: 0.5,
          }}
          className="mt-10 w-48"
        >
          {/* Progress track */}

          <div className="relative h-[4px] overflow-hidden rounded-full bg-red-100">
            <motion.div
              className="
                absolute
                inset-y-0
                left-0
                rounded-full
                bg-gradient-to-r
                from-red-600
                via-red-500
                to-orange-500
              "
              animate={{
                width: `${progress}%`,
              }}
              transition={{
                duration: 0.15,
                ease: "linear",
              }}
            />
          </div>

          {/* Loading text */}

          <div className="mt-3 flex items-center justify-center gap-2">
            <motion.span
              animate={{
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
              }}
              className="h-1.5 w-1.5 rounded-full bg-red-500"
            />

            <span className="text-[11px] font-semibold tracking-wide text-neutral-400">
              {progress < 100 ? "शुरू हो रहा है..." : "तैयार है"}
            </span>

            <motion.span
              animate={{
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: 0.2,
              }}
              className="h-1.5 w-1.5 rounded-full bg-red-500"
            />
          </div>
        </motion.div>
      </div>

      {/* =====================================================
          BOTTOM BRAND MESSAGE
      ====================================================== */}

      <motion.div
        initial={{
          opacity: 0,
          y: 15,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 0.7,
          duration: 0.6,
        }}
        className="
          absolute
          bottom-10
          flex
          flex-col
          items-center
          gap-2
        "
      >
        <div className="flex items-center gap-2">
          <div className="h-px w-8 bg-neutral-200" />

          <span className="text-[11px] font-medium text-neutral-400">
            ❤️ भारत में बनाया गया
          </span>

          <div className="h-px w-8 bg-neutral-200" />
        </div>

        <span className="text-[9px] font-semibold tracking-[0.18em] text-neutral-300">
          SIMPLE • FAST • APNA
        </span>
      </motion.div>
    </div>
  );
};

export default SplashScreen;
