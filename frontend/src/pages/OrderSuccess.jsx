import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

/* ============================================================
   PARTICLES
   Small + few = very cheap
============================================================ */

const particles = [
  { x: -68, y: -38, r: -35, d: 0 },
  { x: 68, y: -40, r: 35, d: 0.03 },
  { x: -78, y: 4, r: -50, d: 0.02 },
  { x: 78, y: 8, r: 50, d: 0.04 },
  { x: -48, y: 62, r: -20, d: 0.05 },
  { x: 52, y: 65, r: 20, d: 0.07 },
];

const OrderSuccess = () => {
  const navigate = useNavigate();
  const riserRef = useRef(null);
  const successAudioRef = useRef(null);

  useEffect(() => {
    // ========================================================
    // PRELOAD BOTH SOUNDS
    // ========================================================

    const riser = new Audio("/riser.mp3");
    const successAudio = new Audio("/new.mp3");

    riser.preload = "auto";
    successAudio.preload = "auto";

    riser.volume = 0.8;
    successAudio.volume = 1;

    riserRef.current = riser;
    successAudioRef.current = successAudio;

    riser.load();
    successAudio.load();

    // ========================================================
    // RISER STARTS WITH LOADING — 0.0s
    // ========================================================

    riser.currentTime = -1;

    riser.play().catch(() => {});

    // ========================================================
    // SUCCESS SOUND — 2.0s
    // ========================================================

    const successTimer = setTimeout(() => {
      successAudio.currentTime = 0;
      successAudio.play().catch(() => {});
    }, 2000);

    // ========================================================
    // REDIRECT — 3.0s
    // ========================================================

    const redirectTimer = setTimeout(() => {
      navigate("/my-orders", {
        replace: true,
      });
    }, 3000);

    return () => {
      clearTimeout(successTimer);
      clearTimeout(redirectTimer);

      riser.pause();
      successAudio.pause();

      riser.currentTime = 0;
      successAudio.currentTime = 0;

      riserRef.current = null;
      successAudioRef.current = null;
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
            START ONLY AFTER TICK
        ==================================================== */}

        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[64px]
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
              }}
              animate={{
                x: particle.x,
                y: particle.y,
                scale: [0, 1, 0.65],
                opacity: [0, 1, 0],
                rotate: particle.r,
              }}
              transition={{
                delay: 2.05 + particle.d,
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="
                absolute
                left-[-3px]
                top-[-3px]
                h-1.5
                w-1.5
                rounded-[2px]
                bg-green-500
              "
            />
          ))}
        </div>

        {/* ====================================================
            ICON
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
              LOADING
              EXACTLY 2 SECONDS
          ================================================== */}

          <motion.div
            initial={{
              opacity: 1,
              scale: 1,
            }}
            animate={{
              opacity: 0,
              scale: 0.88,
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
            {/* Static ring */}

            <svg viewBox="0 0 100 100" className="absolute h-24 w-24">
              <circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="3"
              />

              {/* Progress ring */}

              <motion.circle
                cx="50"
                cy="50"
                r="43"
                fill="none"
                stroke="#22c55e"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="270"
                initial={{
                  strokeDashoffset: 270,
                }}
                animate={{
                  strokeDashoffset: 0,
                }}
                transition={{
                  duration: 1.9,
                  ease: "linear",
                }}
                style={{
                  transform: "rotate(-90deg)",
                  transformOrigin: "50% 50%",
                }}
              />
            </svg>

            {/* Center pulse */}

            <motion.div
              initial={{
                scale: 0.7,
                opacity: 0.5,
              }}
              animate={{
                scale: [0.7, 1.15, 0.7],
                opacity: [0.45, 1, 0.45],
              }}
              transition={{
                duration: 0.9,
                repeat: 1,
                ease: "easeInOut",
              }}
              className="
                h-2.5
                w-2.5
                rounded-full
                bg-green-500
              "
            />
          </motion.div>

          {/* ==================================================
              SUCCESS CIRCLE
              EXACTLY AT 2 SECONDS
          ================================================== */}

          <motion.div
            initial={{
              scale: 0.55,
              opacity: 0,
            }}
            animate={{
              scale: [0.55, 1.1, 1],
              opacity: 1,
            }}
            transition={{
              delay: 2,
              duration: 0.32,
              times: [0, 0.65, 1],
              ease: [0.22, 1, 0.36, 1],
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
              shadow-[0_12px_30px_rgba(34,197,94,0.22)]
            "
          >
            {/* Inner ring */}

            <div
              className="
                pointer-events-none
                absolute
                inset-[5px]
                rounded-full
                border
                border-white/20
              "
            />

            {/* =================================================
                CHECK
            ================================================= */}

            <svg
              viewBox="0 0 64 64"
              className="
                relative
                z-10
                h-[68px]
                w-[68px]
              "
              fill="none"
            >
              <motion.circle
                cx="32"
                cy="32"
                r="23"
                stroke="white"
                strokeWidth="2.5"
                initial={{
                  pathLength: 0,
                  opacity: 0,
                }}
                animate={{
                  pathLength: 1,
                  opacity: 1,
                }}
                transition={{
                  delay: 2.1,
                  duration: 0.2,
                  ease: "easeOut",
                }}
              />

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
                  delay: 2.23,
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
              scale: 0.85,
              opacity: 0,
            }}
            animate={{
              scale: 1.5,
              opacity: 0,
            }}
            transition={{
              delay: 2,
              duration: 0.45,
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
            y: 6,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 2.42,
            duration: 0.22,
            ease: "easeOut",
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
      </div>
    </div>
  );
};

export default OrderSuccess;
