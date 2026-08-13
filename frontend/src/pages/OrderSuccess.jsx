import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const particles = [
  { x: -72, y: -42, r: -25, delay: 0.05 },
  { x: 72, y: -48, r: 25, delay: 0.08 },
  { x: -82, y: 8, r: -40, delay: 0.02 },
  { x: 82, y: 12, r: 40, delay: 0.06 },
  { x: -52, y: 72, r: -15, delay: 0.1 },
  { x: 55, y: 70, r: 20, delay: 0.12 },
  { x: -18, y: -82, r: -10, delay: 0.04 },
  { x: 20, y: -82, r: 10, delay: 0.09 },
];

const OrderSuccess = () => {
  const navigate = useNavigate();
  const audioRef = useRef(null);

  useEffect(() => {
    // =========================================================
    // SOUND
    // =========================================================

    const audio = new Audio("/order-success.mp3");

    audio.volume = 0.95;
    audio.preload = "auto";

    audioRef.current = audio;

    audio.play().catch((error) => {
      console.log("Success sound could not play:", error);
    });

    // =========================================================
    // EXACTLY 3 SECONDS
    // =========================================================

    const timer = setTimeout(() => {
      navigate("/my-orders", {
        replace: true,
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
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
      {/* =====================================================
          BACKGROUND FLASH
      ====================================================== */}

      <motion.div
        initial={{
          scale: 0.2,
          opacity: 0,
        }}
        animate={{
          scale: 2.5,
          opacity: [0, 0.25, 0],
        }}
        transition={{
          duration: 0.8,
          times: [0, 0.2, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
        className="
          pointer-events-none
          absolute
          h-56
          w-56
          rounded-full
          bg-green-400
          blur-3xl
        "
      />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <div className="relative flex flex-col items-center">
        {/* =================================================
            PARTICLES
        ================================================== */}

        <div className="pointer-events-none absolute left-1/2 top-16 z-20">
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
                scale: [0, 1.5, 0.8],
                opacity: [0, 1, 0],
                rotate: particle.r,
              }}
              transition={{
                duration: 0.75,
                delay: particle.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="
                absolute
                left-[-5px]
                top-[-5px]
                h-2.5
                w-2.5
                rounded-[3px]
                bg-green-500
              "
            />
          ))}
        </div>

        {/* =================================================
            SUCCESS ICON
        ================================================== */}

        <div className="relative flex h-36 w-36 items-center justify-center">
          {/* -----------------------------------------------
              HUGE IMPACT RING
          ------------------------------------------------ */}

          <motion.div
            initial={{
              scale: 0.25,
              opacity: 0.9,
            }}
            animate={{
              scale: 1.65,
              opacity: 0,
            }}
            transition={{
              duration: 0.65,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="
              absolute
              h-28
              w-28
              rounded-full
              border-[5px]
              border-green-300
            "
          />

          {/* -----------------------------------------------
              SECOND RING
          ------------------------------------------------ */}

          <motion.div
            initial={{
              scale: 0.4,
              opacity: 0.8,
            }}
            animate={{
              scale: 1.4,
              opacity: 0,
            }}
            transition={{
              duration: 0.7,
              delay: 0.12,
              ease: "easeOut",
            }}
            className="
              absolute
              h-28
              w-28
              rounded-full
              border-2
              border-green-200
            "
          />

          {/* -----------------------------------------------
              MAIN GREEN CIRCLE
          ------------------------------------------------ */}

          <motion.div
            initial={{
              scale: 0,
              rotate: -18,
            }}
            animate={{
              scale: [0, 1.18, 0.94, 1.03, 1],
              rotate: [-18, 4, -2, 1, 0],
            }}
            transition={{
              duration: 0.65,
              times: [0, 0.38, 0.58, 0.78, 1],
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
              shadow-[0_18px_55px_rgba(34,197,94,0.38)]
            "
          >
            {/* INNER HIGHLIGHT */}

            <motion.div
              initial={{
                scale: 0,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              transition={{
                duration: 0.3,
                delay: 0.22,
              }}
              className="
                absolute
                h-24
                w-24
                rounded-full
                border
                border-white/20
              "
            />

            {/* =================================================
                CHECK
            ================================================== */}

            <svg
              viewBox="0 0 64 64"
              className="
                relative
                z-10
                h-[72px]
                w-[72px]
              "
              fill="none"
            >
              {/* Check circle */}

              <motion.circle
                cx="32"
                cy="32"
                r="24"
                stroke="white"
                strokeWidth="3"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                transition={{
                  duration: 0.25,
                  delay: 0.34,
                  ease: "easeOut",
                }}
              />

              {/* Tick */}

              <motion.path
                d="M19 32L27.5 40.5L46 21.5"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                  scale: 0.6,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                  scale: [0.6, 1.18, 0.96, 1],
                }}
                transition={{
                  pathLength: {
                    duration: 0.34,
                    delay: 0.52,
                    ease: [0.22, 1, 0.36, 1],
                  },
                  opacity: {
                    duration: 0.05,
                    delay: 0.52,
                  },
                  scale: {
                    duration: 0.42,
                    delay: 0.52,
                    times: [0, 0.45, 0.75, 1],
                    ease: [0.16, 1, 0.3, 1],
                  },
                }}
              />
            </svg>
          </motion.div>

          {/* -----------------------------------------------
              FINAL PULSE
          ------------------------------------------------ */}

          <motion.div
            initial={{
              scale: 0.9,
              opacity: 0,
            }}
            animate={{
              scale: [0.9, 1.15, 1],
              opacity: [0, 0.45, 0],
            }}
            transition={{
              duration: 0.65,
              delay: 0.78,
              ease: "easeOut",
            }}
            className="
              absolute
              h-28
              w-28
              rounded-full
              bg-green-300
            "
          />
        </div>

        {/* =================================================
            TITLE
        ================================================== */}

        <motion.h1
          initial={{
            opacity: 0,
            y: 16,
            scale: 0.85,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: [0.85, 1.08, 0.98, 1],
          }}
          transition={{
            opacity: {
              delay: 0.75,
              duration: 0.15,
            },
            y: {
              delay: 0.75,
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1],
            },
            scale: {
              delay: 0.75,
              duration: 0.45,
              times: [0, 0.45, 0.75, 1],
              ease: [0.16, 1, 0.3, 1],
            },
          }}
          className="
            mt-8
            text-3xl
            font-black
            tracking-tight
            text-gray-900
          "
        >
          ऑर्डर हो गया!
        </motion.h1>

        {/* =================================================
            SUBTITLE
        ================================================== */}

        <motion.p
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 1.05,
            duration: 0.3,
          }}
          className="
            mt-2
            text-sm
            font-medium
            text-gray-400
          "
        >
          आज के ऑर्डर में जोड़ दिया गया
        </motion.p>

        {/* =================================================
            3 SECOND PROGRESS
        ================================================== */}

        <div
          className="
            mt-8
            h-1
            w-28
            overflow-hidden
            rounded-full
            bg-gray-100
          "
        >
          <motion.div
            initial={{
              width: "0%",
            }}
            animate={{
              width: "100%",
            }}
            transition={{
              duration: 3,
              ease: "linear",
            }}
            className="
              h-full
              rounded-full
              bg-green-500
            "
          />
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
