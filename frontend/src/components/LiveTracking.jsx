import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Check, Clock3, MapPin, Radio, Truck } from "lucide-react";

import { API_BASE_URL } from "@/lib/constants";

const LiveTracking = () => {
  const { supplierId } = useParams();

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Visual journey progress
  const [progress, setProgress] = useState(0);

  // Previous GPS location
  const previousLocation = useRef(null);

  // Number of actual location updates received
  const updateCount = useRef(0);

  const animationRef = useRef(null);

  // --------------------------------------------------
  // FETCH LOCATION
  // --------------------------------------------------

  const fetchLocation = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/tracking/supplier/${supplierId}`,
      );

      if (!response.data.success) {
        throw new Error("Location unavailable");
      }

      const newLocation = response.data.location;

      setLocation(newLocation);
      setError("");

      // First location
      if (!previousLocation.current) {
        previousLocation.current = newLocation;

        setProgress(15);
        setLoading(false);

        return;
      }

      // Check whether the GPS location actually changed
      const oldLocation = previousLocation.current;

      const locationChanged =
        oldLocation.latitude !== newLocation.latitude ||
        oldLocation.longitude !== newLocation.longitude;

      if (locationChanged) {
        updateCount.current += 1;

        /*
         * Every new GPS location moves the visual
         * delivery journey forward.
         *
         * This is only the visual journey for now.
         */
        const nextProgress = Math.min(15 + updateCount.current * 12, 88);

        animateProgress(progress, nextProgress);

        previousLocation.current = newLocation;
      }
    } catch (err) {
      console.error("Tracking error:", err);

      setError(
        err.response?.data?.message || "Unable to update delivery location",
      );

      setLoading(false);
    }
  };

  // --------------------------------------------------
  // SMOOTH TRUCK MOVEMENT
  // --------------------------------------------------

  const animateProgress = (from, to) => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();

    // 3 seconds of smooth movement
    const duration = 3000;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;

      const rawProgress = Math.min(elapsed / duration, 1);

      // Smooth ease-in-out
      const eased =
        rawProgress < 0.5
          ? 2 * rawProgress * rawProgress
          : 1 - Math.pow(-2 * rawProgress + 2, 2) / 2;

      const current = from + (to - from) * eased;

      setProgress(current);

      if (rawProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  // --------------------------------------------------
  // POLLING
  // --------------------------------------------------

  useEffect(() => {
    if (!supplierId) return;

    fetchLocation();

    /*
     * Android sends GPS every 30 seconds.
     * We check every 10 seconds.
     */
    const interval = setInterval(() => {
      fetchLocation();
    }, 10000);

    return () => {
      clearInterval(interval);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [supplierId]);

  // --------------------------------------------------
  // LOADING
  // --------------------------------------------------

  if (loading) {
    return (
      <div className="relative min-h-screen bg-white flex items-center justify-center px-5 overflow-hidden">
        <div className="w-full max-w-sm text-center">
          {/* Animated truck */}
          <div className="relative mx-auto mb-7 h-28 w-28">
            <div className="absolute inset-0 rounded-full bg-red-100 animate-ping opacity-40" />

            <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-lg border border-red-100">
              <Truck className="h-12 w-12 text-red-600 animate-pulse" />
            </div>
          </div>

          {/* Loading dots */}
          <div className="my-6 flex justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-red-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-red-500 animate-bounce" />
          </div>
          {/* Main text */}
          <h2 className="text-2xl font-bold text-gray-900">
            लाइव ट्रैकिंग उपलब्ध है! 🤗
          </h2>

          <p className="mt-3 text-sm text-gray-500 leading-6">
            आपके सप्लायर से कनेक्ट किया जा रहा है...
          </p>

          {/* Footer */}
          <p className="mt-30 text-xs text-gray-400">
            Powered by{" "}
            <span className="font-semibold text-gray-500">e-Setu</span>
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // ERROR
  // --------------------------------------------------

  if (error && !location) {
    return (
      <div className="min-h-screen bg-[#fff7f7] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-7 text-center shadow-xl shadow-red-100/40">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Truck className="h-8 w-8 text-red-600" />
          </div>

          <h2 className="mt-5 text-xl font-extrabold">
            माफ़ करें, ट्रैकिंग उपलब्ध नहीं है। 😓
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            हमें अभी डिलीवरी नहीं मिल पाई।
          </p>

          <button
            onClick={fetchLocation}
            className="mt-6 w-full rounded-2xl bg-red-600 py-3.5 text-sm font-bold text-white transition active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // UI CALCULATIONS
  // --------------------------------------------------

  const trackingActive = location?.trackingActive;

  const lastUpdated = location?.updatedAt
    ? new Date(location.updatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--";

  /*
   * Calculate truck position along the visual path.
   *
   * The SVG path is roughly:
   *
   * START → checkpoint → checkpoint → checkpoint → YOU
   */

  const pathStartX = 40;
  const pathEndX = 320;

  const truckX = pathStartX + ((pathEndX - pathStartX) * progress) / 100;

  /*
   * Curved Y position.
   */
  const truckY = 210 - Math.sin((progress / 100) * Math.PI * 2) * 45;

  return (
    <div className="min-h-screen bg-[#fff8f8] text-gray-900">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="border-b border-red-100 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 transition active:scale-90"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>

            <div>
              <h1 className="text-lg font-black tracking-tight">e-Setu</h1>

              <p className="text-[11px] font-medium text-gray-400">
                Delivery tracking
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
              trackingActive
                ? "bg-red-50 text-red-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                trackingActive ? "bg-red-500 animate-pulse" : "bg-gray-400"
              }`}
            />

            {trackingActive ? "LIVE" : "ENDED"}
          </div>
        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="mx-auto max-w-lg px-4 pb-8">
        {/* =================================================
            STATUS
        ================================================= */}
        {/* 
        <section className="pt-6">
          <div className="rounded-[30px] bg-red-600 p-6 text-white shadow-xl shadow-red-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold tracking-wider text-red-100">
                  DELIVERY STATUS
                </p>

                <h2 className="mt-2 text-2xl font-black leading-tight">
                  {trackingActive
                    ? "Your order is on the way!"
                    : "Delivery tracking ended"}
                </h2>

                <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-red-100">
                  {trackingActive
                    ? "Your supplier is heading towards you."
                    : "The supplier has stopped tracking this delivery."}
                </p>
              </div>

              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <Truck className="h-7 w-7" />
              </div>
            </div>
          </div>
        </section> */}

        {/* =================================================
            JOURNEY
        ================================================= */}

        <section className="mt-5 overflow-hidden rounded-[30px] bg-white shadow-sm border border-red-50">
          <div className="px-5 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black">Delivery journey</h3>

                <p className="mt-1 text-xs text-gray-400">
                  Follow your delivery
                </p>
              </div>

              <div className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">
                {Math.round(progress)}%
              </div>
            </div>
          </div>

          {/* =================================================
              CANDY-STYLE JOURNEY
          ================================================= */}

          <div className="relative mt-2 h-[390px] overflow-hidden">
            {/* Soft background circles */}

            <div className="absolute -right-20 top-10 h-40 w-40 rounded-full bg-red-50" />

            <div className="absolute -left-24 bottom-5 h-52 w-52 rounded-full bg-red-50/60" />

            {/* SVG ROAD */}

            <svg
              viewBox="0 0 360 390"
              className="absolute inset-0 h-full w-full"
              preserveAspectRatio="none"
            >
              {/* Shadow road */}

              <path
                d="
                  M40 325
                  C90 325 70 270 125 250
                  C185 230 150 175 205 155
                  C260 135 230 90 320 65
                "
                fill="none"
                stroke="#fee2e2"
                strokeWidth="22"
                strokeLinecap="round"
              />

              {/* Main road */}

              <path
                d="
                  M40 325
                  C90 325 70 270 125 250
                  C185 230 150 175 205 155
                  C260 135 230 90 320 65
                "
                fill="none"
                stroke="#ef4444"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* White road markings */}

              <path
                d="
                  M40 325
                  C90 325 70 270 125 250
                  C185 230 150 175 205 155
                  C260 135 230 90 320 65
                "
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeDasharray="8 10"
                strokeLinecap="round"
              />

              {/* Checkpoint 1 */}

              <circle
                cx="40"
                cy="325"
                r="17"
                fill="white"
                stroke="#dc2626"
                strokeWidth="5"
              />

              <circle cx="40" cy="325" r="6" fill="#dc2626" />

              {/* Checkpoint 2 */}

              <circle
                cx="125"
                cy="250"
                r="17"
                fill="white"
                stroke={progress >= 35 ? "#dc2626" : "#fecaca"}
                strokeWidth="5"
              />

              <circle
                cx="125"
                cy="250"
                r="6"
                fill={progress >= 35 ? "#dc2626" : "#fecaca"}
              />

              {/* Checkpoint 3 */}

              <circle
                cx="205"
                cy="155"
                r="17"
                fill="white"
                stroke={progress >= 60 ? "#dc2626" : "#fecaca"}
                strokeWidth="5"
              />

              <circle
                cx="205"
                cy="155"
                r="6"
                fill={progress >= 60 ? "#dc2626" : "#fecaca"}
              />

              {/* Destination */}

              <circle cx="320" cy="65" r="19" fill="#dc2626" />

              <circle
                cx="320"
                cy="65"
                r="19"
                fill="none"
                stroke="#fecaca"
                strokeWidth="6"
              />
            </svg>

            {/* =================================================
                TRUCK
            ================================================= */}

            <div
              className="absolute z-20 transition-none"
              style={{
                left: `${(truckX / 360) * 100}%`,
                top: `${(truckY / 390) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="relative">
                {/* Glow */}

                <div className="absolute inset-0 scale-150 rounded-full bg-red-400/20 blur-xl" />

                {/* Truck */}

                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-red-600 shadow-xl shadow-red-300">
                  <span className="text-3xl">🚚</span>
                </div>

                {/* LIVE */}

                {trackingActive && (
                  <div className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-green-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </div>

            {/* =================================================
                START LABEL
            ================================================= */}

            <div className="absolute bottom-5 left-5">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100">
                  <Truck className="h-4 w-4 text-red-600" />
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Start
                  </p>

                  <p className="text-xs font-black">Supplier</p>
                </div>
              </div>
            </div>

            {/* =================================================
                DESTINATION LABEL
            ================================================= */}

            <div className="absolute right-4 top-5">
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Destination
                  </p>

                  <p className="text-xs font-black">Your home</p>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            LIVE UPDATE CARD
        ================================================= */}

        <section className="mt-4 rounded-[26px] bg-white p-5 shadow-sm border border-red-50">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50">
              <Radio className="h-5 w-5 text-green-600" />
            </div>

            <div className="flex-1">
              <p className="text-sm font-black">
                {trackingActive ? "Live tracking active" : "Tracking stopped"}
              </p>

              <p className="mt-0.5 text-xs text-gray-400">
                Last updated at {lastUpdated}
              </p>
            </div>

            {trackingActive && (
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
        </section>

        {/* =================================================
            LOCATION CARD
        ================================================= */}

        <section className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[24px] bg-white p-4 shadow-sm border border-red-50">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
              <MapPin className="h-4 w-4 text-red-600" />
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Location
            </p>

            <p className="mt-1 text-sm font-black">Live</p>
          </div>

          <div className="rounded-[24px] bg-white p-4 shadow-sm border border-red-50">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
              <Clock3 className="h-4 w-4 text-red-600" />
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
              Updates
            </p>

            <p className="mt-1 text-sm font-black">Every 30 sec</p>
          </div>
        </section>

        {/* =================================================
            ERROR DURING POLLING
        ================================================= */}

        {error && (
          <div className="mt-4 rounded-2xl bg-yellow-50 px-4 py-3 text-xs font-medium text-yellow-800">
            Live update temporarily unavailable. Showing the last known
            location.
          </div>
        )}

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Check className="h-3.5 w-3.5 text-green-500" />

            <span>Powered by e-Setu</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveTracking;
