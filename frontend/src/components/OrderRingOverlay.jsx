import { useEffect, useState } from "react";
import { onRing, stopRing, isRinging } from "../lib/ringManager";

/* Incoming-call style top bar while the phone rings (app open).
   OK / Cancel both stop the sound and dismiss the bar. */
export default function OrderRingOverlay() {
  const [visible, setVisible] = useState(isRinging());

  useEffect(() => {
    const unsub = onRing((state) => setVisible(state.type === "start"));
    return unsub;
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    stopRing();
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9999] px-3"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-red-700 to-rose-900 text-white shadow-2xl shadow-red-900/50 ring-1 ring-white/20 backdrop-blur-xl animate-in slide-in-from-top-4 fade-in duration-300">
        {/* soft glow */}
        <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-rose-400/20 blur-2xl" />

        <div className="relative flex items-center gap-3 p-4 pl-5">
          {/* pulsing phone icon */}
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/25" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
          </div>

          {/* text */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-100">
              Incoming Order Ring
            </p>
            <p className="truncate text-base font-extrabold leading-tight">
              अभी ऑर्डर करें!
            </p>
            <p className="truncate text-xs font-medium text-red-100/90">
              ऑर्डर का समय है — जल्दी करें
            </p>
          </div>

          {/* actions */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={dismiss}
              aria-label="Cancel"
              className="flex h-10 w-14 items-center justify-center gap-1.5 rounded-full border border-white/30 bg-white/10 text-sm font-bold tracking-wide transition active:scale-95 hover:bg-white/20"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              onClick={dismiss}
              aria-label="OK"
              className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-white px-5 text-sm font-extrabold tracking-wide text-red-700 shadow-lg shadow-black/20 transition active:scale-95 hover:bg-red-50"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}