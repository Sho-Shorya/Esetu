import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";
import { Phone, PhoneOff, X } from "lucide-react";

const POLL_INTERVAL = 15000;

/* =========================================================
   Ring Sound — generates a short repeating beep via Web Audio
   ========================================================= */

const playRingSound = (ref) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ref.current = ctx;

    const beep = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    /* Repeating beeps for 10 seconds */
    for (let i = 0; i < 20; i++) {
      const t = ctx.currentTime + i * 0.5;
      beep(880, t, 0.15);
      beep(660, t + 0.2, 0.15);
    }
  } catch {}
};

const stopRingSound = (ref) => {
  try {
    ref.current?.close();
    ref.current = null;
  } catch {}
};

const RingsOverlay = () => {
  const [rings, setRings] = useState([]);
  const [currentRing, setCurrentRing] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissedRings") || "[]");
    } catch {
      return [];
    }
  });
  const [remaining, setRemaining] = useState(10);

  const audioCtxRef = useRef(null);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);

  const token = localStorage.getItem("token");

  const saveDismissed = useCallback(
    (ids) => {
      setDismissed(ids);
      localStorage.setItem("dismissedRings", JSON.stringify(ids));
    },
    [],
  );

  /* =========================================================
     POLL
  ========================================================= */

  const pollRings = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/ring/poll`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        const allRings = res.data.rings || [];
        setRings(allRings);
      }
    } catch (e) {
      /* silent */
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    pollRings();
    intervalRef.current = setInterval(pollRings, POLL_INTERVAL);
    return () => {
      clearInterval(intervalRef.current);
      stopRingSound(audioCtxRef);
    };
  }, [token, pollRings]);

  /* =========================================================
     SHOW RING
  ========================================================= */

  useEffect(() => {
    if (rings.length === 0 || currentRing) return;

    const next = rings.find((r) => !dismissed.includes(r._id));
    if (!next) return;

    setCurrentRing(next);
    setRemaining(10);

    /* Play ring sound */
    playRingSound(audioCtxRef);
  }, [rings, dismissed, currentRing]);

  /* =========================================================
     COUNTDOWN
  ========================================================= */

  useEffect(() => {
    if (!currentRing) {
      clearInterval(timerRef.current);
      return;
    }

    setRemaining(10);

    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          dismiss(currentRing._id, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentRing?._id]);

  /* =========================================================
     DISMISS
  ========================================================= */

  const dismiss = useCallback(
    (ringId, auto = false) => {
      clearInterval(timerRef.current);
      stopRingSound(audioCtxRef);

      const updated = [...dismissed, ringId];
      saveDismissed(updated);
      setCurrentRing(null);
      setRemaining(10);
    },
    [dismissed, saveDismissed],
  );

  /* =========================================================
     RENDER
  ========================================================= */

  if (!currentRing) return null;

  return (
    <>
      {/* =================================================
          OVERLAY
      ====================================================== */}

      <div
        className="
          fixed
          inset-0
          z-[100]
          flex
          flex-col
          items-center
          justify-center
          bg-black/80
          backdrop-blur-md
        "
      >
        {/* Close (top-right) — only visible in last 2 seconds */}

        {remaining <= 2 && (
          <button
            onClick={() => dismiss(currentRing._id)}
            className="
              absolute
              right-5
              top-5
              z-10
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-full
              bg-white/20
              text-white
              backdrop-blur-sm
              transition
              hover:bg-white/30
            "
          >
            <X className="h-5 w-5" />
          </button>
        )}

        {/* =================================================
            RINGING CARD
        ====================================================== */}

        <div
          className="
            mx-4
            w-full
            max-w-sm
            rounded-[32px]
            bg-white
            p-8
            shadow-2xl
            ring-8
            ring-red-500/20
          "
        >
          {/* Animated Phone Icon */}

          <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
            {/* Pulsing rings */}
            <div className="absolute inset-0 animate-ping rounded-full bg-red-400/30" />
            <div className="absolute inset-2 animate-pulse rounded-full bg-red-400/20" />

            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-red-500 shadow-lg shadow-red-500/40">
              <Phone className="h-7 w-7 animate-bounce text-white" />
            </div>
          </div>

          {/* Title */}

          <h2 className="text-center text-xl font-black text-slate-900">
            {currentRing.message || "अभी ऑर्डर करें!"}
          </h2>

          <p className="mt-1 text-center text-xs font-medium text-slate-500">
            ऑर्डर का समय है!
          </p>

          {/* Timer bar */}

          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-1000 ease-linear"
              style={{ width: `${(remaining / 10) * 100}%` }}
            />
          </div>

          <p className="mt-1 text-center text-[10px] font-bold text-slate-400">
            {remaining}s
          </p>

          {/* Accept + Cancel */}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                dismiss(currentRing._id);
                window.location.href = "/products";
              }}
              className="
                flex
                flex-1
                items-center
                justify-center
                gap-2
                rounded-2xl
                bg-gradient-to-r
                from-emerald-600
                to-emerald-500
                py-3.5
                text-sm
                font-black
                text-white
                shadow-lg
                shadow-emerald-500/30
                transition
                hover:from-emerald-700
                hover:to-emerald-600
                active:scale-[0.97]
              "
            >
              <Phone className="h-4 w-4" />
              ऑर्डर करें
            </button>

            <button
              onClick={() => dismiss(currentRing._id)}
              className="
                flex
                flex-1
                items-center
                justify-center
                gap-2
                rounded-2xl
                border-2
                border-slate-200
                bg-white
                py-3.5
                text-sm
                font-black
                text-slate-600
                transition
                hover:border-slate-300
                hover:bg-slate-50
                active:scale-[0.97]
              "
            >
              <PhoneOff className="h-4 w-4" />
              कैंसिल
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default RingsOverlay;
