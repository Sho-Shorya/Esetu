import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Check, Clock3, ShoppingBag } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

const DEFAULT_CUTOFF = "12:00";

// ======================================================
// HELPERS
// ======================================================

const pad = (value) => String(value).padStart(2, "0");

const parseCutoff = (timeString, baseDate) => {
  const [hours = "12", minutes = "00"] = String(
    timeString || DEFAULT_CUTOFF,
  ).split(":");

  const date = new Date(baseDate);

  date.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);

  return date;
};

const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));

  const hours = Math.floor(safeSeconds / 3600);

  const minutes = Math.floor((safeSeconds % 3600) / 60);

  const secs = safeSeconds % 60;

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

const getTomorrow = (date) => {
  const tomorrow = new Date(date);

  tomorrow.setDate(tomorrow.getDate() + 1);

  return tomorrow;
};

// ======================================================
// TIMER
// ======================================================

const Timer = () => {
  // IMPORTANT:
  // null means API has not returned yet.
  // We DO NOT calculate the timer until this has a value.
  const [customCutoff, setCustomCutoff] = useState(null);

  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [status, setStatus] = useState("loading");

  const [visible, setVisible] = useState(true);

  // ====================================================
  // FETCH CUT-OFF
  // ====================================================

  useEffect(() => {
    let mounted = true;

    const fetchCutoff = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/v1/settings/public/app-settings`,
        );

        if (!mounted) return;

        const backendCutoff = res.data?.settings?.dailyOrderCutoff;

        if (res.data?.success && backendCutoff) {
          setCustomCutoff(backendCutoff);
        } else {
          // Backend didn't provide a cutoff.
          // Use the default only in this case.
          setCustomCutoff(DEFAULT_CUTOFF);
        }
      } catch (error) {
        console.log("Using default cutoff");

        if (mounted) {
          setCustomCutoff(DEFAULT_CUTOFF);
        }
      }
    };

    fetchCutoff();

    return () => {
      mounted = false;
    };
  }, []);

  // ====================================================
  // CALCULATE TIMER
  // ====================================================

  useEffect(() => {
    // ==================================================
    // VERY IMPORTANT FIX
    // ==================================================
    //
    // Don't calculate anything while the API is still
    // loading.
    //
    // Previously:
    //
    // customCutoff = null
    // ↓
    // DEFAULT_CUTOFF = 12:00
    // ↓
    // timer calculates using 12:00
    // ↓
    // "ORDER CLOSED" appears
    // ↓
    // API responds
    // ↓
    // real cutoff appears
    //
    // Now:
    //
    // customCutoff = null
    // ↓
    // status = loading
    // ↓
    // Timer returns null
    // ↓
    // API responds
    // ↓
    // real cutoff is used
    // ==================================================

    if (!customCutoff) {
      setStatus("loading");
      return;
    }

    let mounted = true;

    const updateTimer = () => {
      if (!mounted) return;

      const now = new Date();

      const todayCutoff = parseCutoff(customCutoff, now);

      // -----------------------------------------------
      // BEFORE TODAY'S CUTOFF
      // -----------------------------------------------

      if (now < todayCutoff) {
        const diff = (todayCutoff.getTime() - now.getTime()) / 1000;

        setRemainingSeconds(Math.max(0, diff));

        setStatus("countdown");

        return;
      }

      // -----------------------------------------------
      // AFTER TODAY'S CUTOFF
      // -----------------------------------------------

      const tomorrow = getTomorrow(now);

      const tomorrowCutoff = parseCutoff(customCutoff, tomorrow);

      const diff = (tomorrowCutoff.getTime() - now.getTime()) / 1000;

      setRemainingSeconds(Math.max(0, diff));

      setStatus("timeout");
    };

    // Calculate immediately
    updateTimer();

    // Then update every second
    const interval = setInterval(updateTimer, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [customCutoff]);

  // ====================================================
  // AUTO HIDE / SHOW
  //
  // Visible 10 sec
  // Hidden 5 sec
  // Then repeat
  // ====================================================

  useEffect(() => {
    if (status === "loading") return;

    let hideTimeout;
    let showTimeout;

    const cycle = () => {
      setVisible(true);

      hideTimeout = setTimeout(() => {
        setVisible(false);

        showTimeout = setTimeout(() => {
          cycle();
        }, 5000);
      }, 10000);
    };

    cycle();

    return () => {
      clearTimeout(hideTimeout);
      clearTimeout(showTimeout);
    };
  }, [status]);

  // ====================================================
  // TIMER STATES
  // ====================================================

  const isCountdown = status === "countdown";

  const isTimeout = status === "timeout";

  const isLast30 = isCountdown && remainingSeconds <= 30 * 60;

  const isLast10 = isCountdown && remainingSeconds <= 10 * 60;

  const isLastMinute = isCountdown && remainingSeconds <= 60;

  // ====================================================
  // NEXT CUTOFF TEXT
  // ====================================================

  const cutoffLabel = useMemo(() => {
    const cutoff = customCutoff || DEFAULT_CUTOFF;

    const [hours, minutes] = cutoff.split(":");

    const date = new Date();

    date.setHours(Number(hours), Number(minutes), 0, 0);

    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [customCutoff]);

  // ====================================================
  // LOADING
  // ====================================================

  if (status === "loading") {
    return null;
  }

  // ====================================================
  // CLOSED STATE
  // ====================================================

  if (isTimeout) {
    return (
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{
              opacity: 0,
              y: 70,
              scale: 0.92,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 70,
              scale: 0.92,
            }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 25,
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
                relative
                flex
                h-[48px]
                items-center
                gap-3
                overflow-hidden
                rounded-full
                border
                border-white/20
                bg-black/70
                px-2
                pr-5
                text-white
                shadow-[0_10px_40px_rgba(0,0,0,0.45)]
                backdrop-blur-2xl
              "
            >
              {/* GLOW */}

              <div
                className="
                  absolute
                  -left-5
                  top-1/2
                  h-14
                  w-14
                  -translate-y-1/2
                  rounded-full
                  bg-gray-500/20
                  blur-xl
                "
              />

              {/* ICON */}

              <div
                className="
                  relative
                  flex
                  h-9
                  w-10
                  items-center
                  justify-center
                  rounded-full
                  bg-gray-400
                  shadow-lg
                  shadow-emerald-500/30
                "
              >
                <Check size={17} strokeWidth={3} />
              </div>

              {/* TEXT */}

              <div
                className="
                  relative
                  min-w-[69px]
                  leading-none
                "
              >
                <p
                  className="
                    text-[10px]
                    font-medium
                    text-white/50
                  "
                >
                  आज के ऑर्डर
                </p>

                <p
                  className="
                    mt-[4px]
                    text-[13px]
                    font-bold
                  "
                >
                  बंद हो चुके हैं
                </p>
              </div>

              {/* TOMORROW */}

              <div
                className="
                  relative
                  ml-1
                  border-l
                  border-white/10
                  pl-3
                  text-right
                "
              >
                <p
                  className="
                    min-w-[60px]
                    text-[9px]
                    text-white/40
                  "
                >
                  अगला कटऑफ
                </p>

                <p
                  className="
                    mt-[3px]
                    text-[11px]
                    font-bold
                    text-emerald-400
                  "
                >
                  {cutoffLabel.toUpperCase()}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // ====================================================
  // ACTIVE TIMER
  // ====================================================

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{
            opacity: 0,
            y: 70,
            scale: 0.88,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: 70,
            scale: 0.88,
          }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 24,
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
                : {
                    scale: 1,
                  }
            }
            transition={
              isLastMinute
                ? {
                    repeat: Infinity,
                    duration: 0.8,
                  }
                : {
                    duration: 0.2,
                  }
            }
            className={`
              relative
              flex
              h-[50px]
              items-center
              gap-2.5
              overflow-hidden
              rounded-full
              border
              px-2
              pr-4
              shadow-[0_10px_40px_rgba(0,0,0,0.45)]
              backdrop-blur-2xl
              transition-all
              duration-500

              ${
                isLastMinute
                  ? "border-red-400/50 bg-red-600"
                  : isLast10
                    ? "border-red-400/30 bg-red-950/95"
                    : isLast30
                      ? "border-orange-400/30 bg-orange-950/95"
                      : "border-white/10 bg-neutral-950/95"
              }
            `}
          >
            {/* =================================================
                BACKGROUND GLOW
            ================================================= */}

            <motion.div
              animate={{
                opacity: isLastMinute ? [0.25, 0.55, 0.25] : 0.35,
              }}
              transition={{
                repeat: isLastMinute ? Infinity : 0,
                duration: 1,
              }}
              className={`
                absolute
                -left-6
                top-1/2
                h-16
                w-16
                -translate-y-1/2
                rounded-full
                blur-2xl

                ${
                  isLastMinute
                    ? "bg-white"
                    : isLast10
                      ? "bg-red-500"
                      : isLast30
                        ? "bg-orange-500"
                        : "bg-red-500"
                }
              `}
            />

            {/* =================================================
                ICON
            ================================================= */}

            <div
              className={`
                relative
                flex
                h-9
                w-9
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
                <AlertCircle size={18} strokeWidth={2.8} />
              ) : (
                <Clock3 size={18} strokeWidth={2.5} />
              )}
            </div>

            {/* =================================================
                CONTENT
            ================================================= */}

            <div
              className="
                relative
                min-w-[92px]
                leading-none
              "
            >
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
                          : "text-white/50"
                  }
                `}
              >
                {isLastMinute
                  ? "अभी ऑर्डर करें!"
                  : isLast10
                    ? "जल्द ऑर्डर करें"
                    : isLast30
                      ? "30 मिनट से कम"
                      : "ऑर्डर कटऑफ"}
              </p>

              <p
                className="
                  mt-[4px]
                  font-mono
                  text-[16px]
                  font-extrabold
                  tracking-[0.06em]
                  text-white
                  tabular-nums
                "
              >
                {formatTime(remainingSeconds)}
              </p>
            </div>

            {/* =================================================
                LIVE INDICATOR
            ================================================= */}

            <motion.div
              animate={{
                opacity: [0.35, 1, 0.35],
                scale: [0.9, 1.15, 0.9],
              }}
              transition={{
                repeat: Infinity,
                duration: isLastMinute ? 0.7 : 1.8,
              }}
              className={`
                relative
                mr-1
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

            {/* =================================================
                SMALL BAG ICON
            ================================================= */}

            {isLast10 && (
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.7,
                }}
                animate={{
                  opacity: 1,
                  scale: 1,
                }}
                className="
                  relative
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-full
                  bg-white/10
                "
              >
                <ShoppingBag size={14} />
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Timer;
