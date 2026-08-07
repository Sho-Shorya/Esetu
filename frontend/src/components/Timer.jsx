import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Clock3 } from "lucide-react";
import { API_BASE_URL } from "@/lib/constants";

const DEFAULT_CUTOFF = "12:00";

const parseCutoff = (timeString, now) => {
  const [hours = "12", minutes = "00"] = String(
    timeString || DEFAULT_CUTOFF,
  ).split(":");
  const cutoff = new Date(now);
  cutoff.setHours(parseInt(hours, 10) || 12);
  cutoff.setMinutes(parseInt(minutes, 10) || 0);
  cutoff.setSeconds(0);
  cutoff.setMilliseconds(0);
  return cutoff;
};

const pad = (v) => String(v).padStart(2, "0");
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
};

const Timer = () => {
  const [customCutoff, setCustomCutoff] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [status, setStatus] = useState("countdown"); // 'countdown' | 'timeout'

  // Fetch admin-updated cutoff (public endpoint)
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
      } catch (err) {
        // ignore, use default
      }
    };
    fetchCutoff();
    return () => {
      mounted = false;
    };
  }, []);

  // Tick every second; depends on customCutoff so it uses updated value
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

      if (now < todayCutoff) {
        setStatus("countdown");
        setCountdown(Math.max(0, Math.floor((todayCutoff - now) / 1000)));
      } else if (now >= todayCutoff && now < midnight) {
        // cutoff passed for today until midnight
        setStatus("timeout");
        setCountdown(0);
      } else {
        // after midnight, compute next day's cutoff
        const nextCutoff = parseCutoff(source, midnight);
        setStatus("countdown");
        setCountdown(Math.max(0, Math.floor((nextCutoff - now) / 1000)));
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [customCutoff]);

  const isActive = status === "countdown" && countdown > 0;
  const display = isActive ? formatTime(countdown) : "00:00:00";
  const label = "कटऑफ़";
  const diffSeconds = countdown;
  const diffMinutes = Math.floor(diffSeconds / 60);

  const bgColor =
    diffMinutes <= 10
      ? "from-red-500 to-red-700"
      : diffMinutes <= 30
        ? "from-orange-500 to-orange-700"
        : "from-emerald-500 to-green-700";

  const isLast10Minutes = diffSeconds <= 10 * 60 && diffSeconds > 0;
  const isLastMinute = diffSeconds <= 60 && diffSeconds > 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      drag
      dragConstraints={{ left: -160, right: 0, top: -90, bottom: 0 }}
      dragElastic={0.12}
      className={`fixed mb-20 ${isLast10Minutes ? "animate-bounce" : ""}  right-4 border-2 border-red-500 bottom-8 z-50 flex h-25 w-25 cursor-grab items-center justify-center rounded-full bg-gradient-to-br  ${bgColor} p-2 text-center text-white shadow-2xl`}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-0 text-center">
        <div className="relative flex items-center justify-center rounded-full bg-white/18 p-[7px] bg-red-500 text-white">
          <div className="absolute border-2 border-white-600 animate-ping h-7 w-7 rounded-full"></div>
          <Clock3 className={isActive ? "animate-spin h-6 w-6" : "h-6 w-6"} />
        </div>
        <div className="mt-1 text-lg font-semibold">{display}</div>
        <div className="text-[12px] font-semibold text-white/80">{label}</div>
      </div>
    </motion.div>
  );
};

export default Timer;
