import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const particles = [
  { x: -70, y: -42, r: -25, d: 0 },
  { x: 70, y: -45, r: 25, d: 0.03 },
  { x: -82, y: 4, r: -40, d: 0.02 },
  { x: 82, y: 8, r: 40, d: 0.04 },
  { x: -52, y: 65, r: -15, d: 0.05 },
  { x: 55, y: 68, r: 20, d: 0.07 },
  { x: -18, y: -78, r: -10, d: 0.025 },
  { x: 20, y: -78, r: 10, d: 0.05 },
];

const OrderSuccess = () => {
  const navigate = useNavigate();
  const audioRef = useRef(null);

  useEffect(() => {
    /* ========================================================
       PRELOAD SOUND
    ======================================================== */

    const audio = new Audio("/new.mp3");

    audio.volume = 0.9;
    audio.preload = "auto";

    audioRef.current = audio;
    audio.load();

    /* ========================================================
       SOUND — WHEN SUCCESS APPEARS
    ======================================================== */

    const soundTimer = setTimeout(() => {
      audio.play().catch(() => {});
    }, 900);

    /* ========================================================
       2 SEC LOADING + 1 SEC SUCCESS
    ======================================================== */

    const redirectTimer = setTimeout(() => {
      navigate("/my-orders", {
        replace: true,
      });
    }, 4000);

    return () => {
      clearTimeout(soundTimer);
      clearTimeout(redirectTimer);

      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [navigate]);

  return (
    <div
      className="
        fixed
        inset-0
        z-[999]
        flex
        items-center
        justify-center
        overflow-hidden
        bg-white
      "
    >
      <div className="relative flex flex-col items-center">
        {/* ====================================================
            PARTICLES
            ONLY AFTER SUCCESS
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[72px]
            z-30
          "
        >
          {particles.map((particle, index) => (
            <motion.span
              key={index}
              initial={{
                x: 0,
                y: 0,
                scale: 0,
                opacity: 0,
                rotate: 0,
              }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: [0, 1.2, 0],
                opacity: [0, 1, 0],
                rotate: particle.r,
              }}
              transition={{
                duration: 0.55,
                delay: 2.08 + particle.d,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="
                absolute
                left-[-4px]
                top-[-4px]
                h-2
                w-2
                rounded-[2px]
                bg-green-500
              "
            />
          ))}
        </div>

        {/* ====================================================
            ICON AREA
        ==================================================== */}

        <div
          className="
            relative
            flex
            h-32
            w-32
            items-center
            justify-center
          "
        >
          {/* ==================================================
              LOADING STATE
              0 → 2 SECONDS
          ================================================== */}

          <motion.div
            initial={{
              opacity: 1,
              scale: 1,
            }}
            animate={{
              opacity: 0,
              scale: 0.8,
            }}
            transition={{
              delay: 1.88,
              duration: 0.12,
              ease: "easeIn",
            }}
            className="
              absolute
              flex
              h-24
              w-24
              items-center
              justify-center
            "
          >
            {/* Outer subtle ring */}

            <div
              className="
                absolute
                inset-0
                rounded-full
                border-[3px]
                border-gray-100
              "
            />

            {/* Animated loader */}

            <motion.div
              animate={{
                rotate: 360,
              }}
              transition={{
                duration: 0.8,
                repeat: 2,
                ease: "linear",
              }}
              className="
                absolute
                inset-0
                rounded-full
                border-[3px]
                border-transparent
                border-t-green-500
                border-r-green-400
              "
            />

            {/* Center */}

            <motion.div
              animate={{
                scale: [1, 1.12, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: 1,
                ease: "easeInOut",
              }}
              className="
                h-3
                w-3
                rounded-full
                bg-green-500
              "
            />
          </motion.div>

          {/* ==================================================
              SUCCESS CIRCLE
              APPEARS AT 2 SECONDS
          ================================================== */}

          <motion.div
            initial={{
              scale: 0,
              opacity: 0,
            }}
            animate={{
              scale: [0, 1.14, 1],
              opacity: 1,
            }}
            transition={{
              delay: 2,
              duration: 0.38,
              times: [0, 0.65, 1],
              ease: [0.16, 1, 0.3, 1],
            }}
            className="
              absolute
              flex
              h-28
              w-28
              items-center
              justify-center
              rounded-full
              bg-green-500
              shadow-[0_14px_40px_rgba(34,197,94,0.28)]
            "
          >
            {/* Inner ring */}

            <div
              className="
                absolute
                inset-[5px]
                rounded-full
                border
                border-white/20
              "
            />

            {/* Check */}

            <svg
              viewBox="0 0 64 64"
              className="relative z-10 h-[68px] w-[68px]"
              fill="none"
            >
              <motion.path
                d="M18 32L27 41L46 22"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                transition={{
                  delay: 2.22,
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            </svg>
          </motion.div>

          {/* ==================================================
              SUCCESS RIPPLE
          ================================================== */}

          <motion.div
            initial={{
              scale: 0.8,
              opacity: 0,
            }}
            animate={{
              scale: [0.8, 1.45],
              opacity: [0.45, 0],
            }}
            transition={{
              delay: 2.05,
              duration: 0.5,
              ease: "easeOut",
            }}
            className="
              absolute
              h-28
              w-28
              rounded-full
              border-2
              border-green-300
            "
          />
        </div>

        {/* ====================================================
            SUCCESS TEXT
        ==================================================== */}

        <motion.h1
          initial={{
            opacity: 0,
            y: 7,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 2.35,
            duration: 0.25,
          }}
          className="
            mt-7
            text-2xl
            font-black
            tracking-tight
            text-gray-900
          "
        >
          ऑर्डर हो गया!
        </motion.h1>

        {/* Very small subtitle */}

        <motion.p
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 2.48,
            duration: 0.2,
          }}
          className="
            mt-1
            text-xs
            font-medium
            text-gray-400
          "
        >
          कृपया ऑर्डर के approve का इंतज़ार करें।
        </motion.p>
      </div>
    </div>
  );
};

export default OrderSuccess;
