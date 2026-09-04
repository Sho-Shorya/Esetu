/* Shared "Order Ring" controller for the frontend.
   Plays /orderRing.mp3 + vibration and exposes a top-bar overlay
   (OK / Cancel) so the user can stop the sound while the app is open.
   Works together with the OneSignal push: when the app is in the
   foreground and a push with data.type === "order-ring" arrives, the
   overlay shows. */

const RING_MP3 = "/orderRing.mp3";

let audio = null;
let ringTimer = null;
let ringing = false;

const listeners = new Set();

const emit = (state) => {
  listeners.forEach((fn) => fn(state));
};

export const onRing = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const isRinging = () => ringing;

const stopImmediate = () => {
  if (ringTimer) {
    clearTimeout(ringTimer);
    ringTimer = null;
  }
  if (audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}
  }
  if (navigator.vibrate) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
};

export const stopRing = () => {
  if (!ringing) return;
  ringing = false;
  stopImmediate();
  emit({ type: "stop" });
};

export const playRing = () => {
  if (ringing) return;
  ringing = true;

  try {
    if (!audio) {
      audio = new Audio(RING_MP3);
      audio.loop = true;
    }
    audio.currentTime = 0;
    const p = audio.play();
    if (p) p.catch(() => {});
  } catch {}

  if (navigator.vibrate) {
    navigator.vibrate([300, 120, 300, 120, 300, 120, 300, 120, 300, 120, 300]);
  }

  /* Auto-stop after ~15s so it doesn't ring forever. */
  ringTimer = setTimeout(stopRing, 15000);

  emit({ type: "start" });
};
