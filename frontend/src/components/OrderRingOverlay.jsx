import { useEffect, useState } from "react";
import { onRing, stopRing, isRinging } from "../lib/ringManager";

/* Top bar shown while the phone is ringing (app open).
   Ok → stops the sound / dismisses. Cancel → stops sound + dismisses.
   The bar appears over the whole app, fixed at the top, like an
   incoming-call notification. */
export default function OrderRingOverlay() {
  const [visible, setVisible] = useState(isRinging());

  useEffect(() => {
    const unsub = onRing((state) => {
      setVisible(state.type === "start");
    });
    return unsub;
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    stopRing();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background:
          "linear-gradient(90deg, #DC2626 0%, #B91C1C 60%, #991B1B 100%)",
        color: "#fff",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        fontFamily: "inherit",
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
        paddingBottom: "10px",
        paddingLeft: "14px",
        paddingRight: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
          {/* ringing icon */}
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#FDE047",
              animation: "ringblink 0.9s infinite",
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
              अभी ऑर्डर करें!
            </div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              ऑर्डर का समय है — जल्दी करें
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button
            onClick={dismiss}
            style={{
              background: "#fff",
              color: "#991B1B",
              border: "none",
              fontWeight: 700,
              fontSize: 14,
              padding: "7px 18px",
              borderRadius: "999px",
              cursor: "pointer",
            }}
          >
            OK
          </button>
          <button
            onClick={dismiss}
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              border: "1px solid rgba(255,255,255,0.7)",
              fontWeight: 700,
              fontSize: 14,
              padding: "7px 18px",
              borderRadius: "999px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* blink keyframes */}
      <style>{`@keyframes ringblink { 0%,100%{opacity:1} 50%{opacity:.25} }`}</style>
    </div>
  );
}
