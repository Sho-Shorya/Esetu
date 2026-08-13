import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const OrderSuccess = () => {
  const navigate = useNavigate();
  const audioRef = useRef(null);

  useEffect(() => {
    // =========================================================
    // PLAY SUCCESS SOUND
    // =========================================================

    const audio = new Audio("/order-success1.wav");

    audioRef.current = audio;

    audio.volume = 0.9;
    audio.preload = "auto";

    const playSound = async () => {
      try {
        await audio.play();
      } catch (error) {
        // Don't show an error to the user if browser blocks audio.
        console.log("Success sound could not play:", error);
      }
    };

    // Start loading immediately
    audio.load();

    // Play once browser has enough audio data
    if (audio.readyState >= 3) {
      playSound();
    } else {
      audio.addEventListener("canplaythrough", playSound, {
        once: true,
      });
    }

    // =========================================================
    // NAVIGATE TO TODAY'S ORDERS
    // =========================================================

    const timer = setTimeout(() => {
      navigate("/my-orders", {
        replace: true,
      });
    }, 2000);

    return () => {
      clearTimeout(timer);

      audio.removeEventListener("canplaythrough", playSound);

      // DON'T call audio.pause() here.
      //
      // Calling pause() while play() is still starting
      // causes:
      //
      // AbortError:
      // The play() request was interrupted by a call to pause()
      //
      audioRef.current = null;
    };
  }, [navigate]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white px-5">
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.92,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          duration: 0.25,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="flex flex-col items-center text-center"
      >
        {/* =====================================================
            SUCCESS CIRCLE
        ===================================================== */}

        <div className="relative flex h-32 w-32 items-center justify-center">
          {/* Outer expanding ring */}

          <motion.div
            initial={{
              scale: 0.7,
              opacity: 0,
            }}
            animate={{
              scale: 1.25,
              opacity: 1,
            }}
            transition={{
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="
              absolute
              inset-0
              rounded-full
              border-[3px]
              border-green-200
            "
          />

          {/* Green background circle */}

          <motion.div
            initial={{
              scale: 0,
            }}
            animate={{
              scale: 1,
            }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
            }}
            className="
              absolute
              inset-2
              rounded-full
              bg-green-100
            "
          />

          {/* =================================================
              SVG CHECK
          ================================================= */}

          <svg
            viewBox="0 0 52 52"
            className="
              relative
              z-10
              h-20
              w-20
              text-green-600
            "
            fill="none"
          >
            {/* Circle */}

            <motion.circle
              cx="26"
              cy="26"
              r="23"
              stroke="currentColor"
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
                duration: 0.4,
                ease: "easeOut",
              }}
            />

            {/* Tick */}

            <motion.path
              d="M15 27L22 34L38 18"
              stroke="currentColor"
              strokeWidth="4"
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
                duration: 0.4,
                delay: 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </svg>
        </div>

        {/* =====================================================
            TITLE
        ===================================================== */}

        <motion.h1
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            delay: 0.55,
            duration: 0.28,
            ease: "easeOut",
          }}
          className="
            mt-7
            text-3xl
            font-extrabold
            tracking-tight
            text-gray-900
          "
        >
          ऑर्डर हो गया!
        </motion.h1>

        {/* =====================================================
            MESSAGE
        ===================================================== */}

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
            delay: 0.7,
            duration: 0.28,
          }}
          className="
            mt-2
            text-gray-500
          "
        >
          आपका ऑर्डर आज के ऑर्डर में जोड़ दिया गया है
        </motion.p>

        {/* =====================================================
            REDIRECT
        ===================================================== */}

        <motion.div
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            delay: 0.9,
            duration: 0.25,
          }}
          className="
            mt-7
            flex
            items-center
            gap-2
            text-sm
            text-gray-400
          "
        >
          <motion.span
            animate={{
              scale: [1, 1.35, 1],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="
              h-2
              w-2
              rounded-full
              bg-green-500
            "
          />
          आज के ऑर्डर पर जा रहे हैं...
        </motion.div>
      </motion.div>
    </div>
  );
};

export default OrderSuccess;
