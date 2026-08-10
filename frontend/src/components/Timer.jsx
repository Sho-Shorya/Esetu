import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, Clock3 } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

const DEFAULT_CUTOFF = "12:00";

// ==========================================
// HELPERS
// ==========================================

const parseCutoff = (timeString, now) => {
  const [hours = "12", minutes = "00"] = String(
    timeString || DEFAULT_CUTOFF,
  ).split(":");

  const cutoff = new Date(now);

  cutoff.setHours(parseInt(hours, 10) || 12, parseInt(minutes, 10) || 0, 0, 0);

  return cutoff;
};

const pad = (value) => String(value).padStart(2, "0");

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  const secs = seconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

// ==========================================
// TIMER
// ==========================================

const Timer = () => {
  const [customCutoff, setCustomCutoff] = useState(null);

  const [countdown, setCountdown] = useState(0);

  const [status, setStatus] = useState("countdown");

  const [visible, setVisible] = useState(true);

  // ========================================
  // FETCH CUTOFF
  // ========================================

  useEffect(() => {
    let mounted = true;

    const fetchCutoff = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/settings/public/app-settings`,
        );

        if (
          mounted &&
          res.data?.success &&
          res.data.settings?.dailyOrderCutoff
        ) {
          setCustomCutoff(res.data.settings.dailyOrderCutoff);
        }
      } catch (error) {
        console.log("Using default cutoff");
      }
    };

    fetchCutoff();

    return () => {
      mounted = false;
    };
  }, []);

  // ========================================
  // COUNTDOWN
  // ========================================

  useEffect(() => {
    let mounted = true;

    const tick = () => {
      if (!mounted) return;

      const now = new Date();

      const source = customCutoff || DEFAULT_CUTOFF;

      const todayCutoff = parseCutoff(source, now);

      const midnight = new Date(now);

      midnight.setHours(0, 0, 0, 0);

      midnight.setDate(midnight.getDate() + 1);

      // BEFORE CUTOFF
      if (now < todayCutoff) {
        setStatus("countdown");

        setCountdown(Math.max(0, Math.floor((todayCutoff - now) / 1000)));

        return;
      }

      // AFTER CUTOFF
      if (now >= todayCutoff && now < midnight) {
        setStatus("timeout");
        setCountdown(0);

        return;
      }

      // NEXT DAY
      const nextCutoff = parseCutoff(source, midnight);

      setStatus("countdown");

      setCountdown(Math.max(0, Math.floor((nextCutoff - now) / 1000)));
    };

    tick();

    const interval = setInterval(tick, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [customCutoff]);

  // ========================================
  // SHOW / HIDE EVERY 10 SECONDS
  // ========================================

  useEffect(() => {
    if (status === "timeout") return;

    let hideTimer;
    let showTimer;

    const startCycle = () => {
      // Visible for 10 seconds
      hideTimer = setTimeout(() => {
        setVisible(false);

        // Hidden for 10 seconds
        showTimer = setTimeout(() => {
          setVisible(true);

          startCycle();
        }, 10000);
      }, 10000);
    };

    startCycle();

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
    };
  }, [status]);

  // ========================================
  // STATES
  // ========================================

  const isActive = status === "countdown" && countdown > 0;

  const isTimeout = status === "timeout";

  const isLast30 = isActive && countdown <= 30 * 60;

  const isLast10 = isActive && countdown <= 10 * 60;

  const isLastMinute = isActive && countdown <= 60;

  // ========================================
  // CLOSED
  // ========================================

  if (isTimeout) {
    return (
      <motion.div
        initial={{
          opacity: 0,
          y: 50,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        className="
          fixed
          bottom-[92px]
          left-1/2
          z-40
          -translate-x-1/2
        "
      >
        <div
          className="
            flex
            h-11
            items-center
            gap-2.5
            rounded-full
            border
            border-white/20
            bg-[#171717]/90
            px-4
            shadow-[0_8px_30px_rgba(0,0,0,0.35)]
            backdrop-blur-xl
          "
        >
          <div
            className="
              flex
              h-7
              w-7
              items-center
              justify-center
              rounded-full
              bg-emerald-500
            "
          >
            <Check size={15} strokeWidth={3} className="text-white" />
          </div>

          <span
            className="
              text-xs
              font-bold
              text-white
            "
          >
            आज के ऑर्डर बंद
          </span>
        </div>
      </motion.div>
    );
  }

  // ========================================
  // ACTIVE TIMER
  // ========================================

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="timer"
          initial={{
            opacity: 0,
            y: 65,
            scale: 0.9,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: 65,
            scale: 0.9,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 23,
          }}
          className="
            fixed
            bottom-[92px]
            left-1/2
            z-40
            -translate-x-1/2
          "
        >
          <motion.div
            animate={
              isLastMinute
                ? {
                    scale: [1, 1.035, 1],
                  }
                : {}
            }
            transition={
              isLastMinute
                ? {
                    repeat: Infinity,
                    duration: 0.8,
                  }
                : {}
            }
            className={`
              relative
              flex
              h-[46px]
              items-center
              gap-2.5
              overflow-hidden
              rounded-full
              border
              px-2
              pr-4
              shadow-[0_8px_30px_rgba(0,0,0,0.35)]
              backdrop-blur-xl
              transition-all
              duration-300

              ${
                isLastMinute
                  ? "border-red-400 bg-red-600"
                  : isLast10
                    ? "border-red-400/60 bg-[#241313]/95"
                    : isLast30
                      ? "border-orange-400/60 bg-[#241b10]/95"
                      : "border-white/20 bg-[#171717]/90"
              }
            `}
          >
            {/* ================================= */}
            {/* ACCENT GLOW */}
            {/* ================================= */}

            <div
              className={`
                absolute
                -left-5
                top-1/2
                h-14
                w-14
                -translate-y-1/2
                rounded-full
                blur-xl

                ${
                  isLastMinute
                    ? "bg-white/25"
                    : isLast10
                      ? "bg-red-500/40"
                      : isLast30
                        ? "bg-orange-500/40"
                        : "bg-red-500/25"
                }
              `}
            />

            {/* ================================= */}
            {/* ICON */}
            {/* ================================= */}

            <div
              className={`
                relative
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full

                ${
                  isLastMinute
                    ? "bg-white text-red-600"
                    : isLast10
                      ? "bg-red-500 text-white"
                      : isLast30
                        ? "bg-orange-500 text-white"
                        : "bg-red-500 text-white"
                }
              `}
            >
              {isLast10 ? (
                <AlertCircle size={17} strokeWidth={2.7} />
              ) : (
                <Clock3 size={17} strokeWidth={2.7} />
              )}
            </div>

            {/* ================================= */}
            {/* LABEL */}
            {/* ================================= */}

            <div className="relative leading-none">
              <p
                className={`
                  text-[10px]
                  font-semibold
                  ${
                    isLastMinute
                      ? "text-white/80"
                      : isLast10
                        ? "text-red-300"
                        : isLast30
                          ? "text-orange-300"
                          : "text-white/65"
                  }
                `}
              >
                {isLast10 ? "जल्द ऑर्डर करें" : "ऑर्डर कटऑफ"}
              </p>

              {/* ================================= */}
              {/* TIME */}
              {/* ================================= */}

              <p
                className={`
                  mt-[3px]
                  font-mono
                  text-[15px]
                  font-extrabold
                  tracking-[0.05em]

                  ${isLastMinute ? "text-white" : "text-white"}
                `}
              >
                {formatTime(countdown)}
              </p>
            </div>

            {/* ================================= */}
            {/* LIVE DOT */}
            {/* ================================= */}

            <motion.div
              animate={
                isLastMinute
                  ? {
                      opacity: [0.3, 1, 0.3],
                      scale: [0.9, 1.2, 0.9],
                    }
                  : {
                      opacity: [0.5, 1, 0.5],
                    }
              }
              transition={{
                repeat: Infinity,
                duration: isLastMinute ? 0.8 : 2,
              }}
              className={`
                relative
                ml-0.5
                h-2
                w-2
                rounded-full

                ${
                  isLastMinute
                    ? "bg-white"
                    : isLast10
                      ? "bg-red-400"
                      : isLast30
                        ? "bg-orange-400"
                        : "bg-red-400"
                }
              `}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Timer;