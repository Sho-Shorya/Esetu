import OneSignal from "react-onesignal";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL;

let initialized = false;

const RING_MP3 = "/orderRing.mp3";

/* =========================================================
   Helpers
   ========================================================= */

const getUserIdFromToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.id || null;
  } catch {
    return null;
  }
};

const saveSubscription = async (subscriptionId) => {
  try {
    const token = localStorage.getItem("token");
    if (!token || !subscriptionId) return;
    await axios.put(
      `${API_BASE_URL}/api/v1/user/save-subscription`,
      { subscriptionId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    console.log("✅ Subscription saved:", subscriptionId);
  } catch (err) {
    console.error("Save Subscription Error:", err);
  }
};

/* The SDK returns PushSubscription.id asynchronously after permission
   is granted. Poll until it actually exists, then save. */
const waitForSubscriptionId = async (timeoutMs = 10000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const id = OneSignal.User.PushSubscription.id;
    if (id) return id;
    await new Promise((r) => setTimeout(r, 400));
  }
  return null;
};

/* Unlock audio once the user taps anywhere — required by iOS Safari
   autoplay policy so orderRing.mp3 can actually play later. */
const installAudioUnlock = () => {
  const unlock = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
    } catch {}
    document.removeEventListener("pointerdown", unlock);
    document.removeEventListener("touchstart", unlock);
  };
  document.addEventListener("pointerdown", unlock);
  document.addEventListener("touchstart", unlock);
};

/* =========================================================
   Ring sound — plays /orderRing.mp3 for ~15s + vibration
   ========================================================= */

let audio = null;

const playOrderRingSound = () => {
  try {
    if (!audio) {
      audio = new Audio(RING_MP3);
      audio.loop = true;
    }
    audio.currentTime = 0;
    const p = audio.play();
    if (p) p.catch(() => {});
    setTimeout(() => {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }, 15000);
  } catch {}

  if (navigator.vibrate) {
    navigator.vibrate([300, 120, 300, 120, 300, 120, 300, 120, 300, 120, 300]);
  }
};

/* =========================================================
   Init
   ========================================================= */

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  const userId = getUserIdFromToken();

  try {
    await OneSignal.init({
      appId: "d62603a2-aad9-431a-a1c9-a86ec46e4a5b",
      allowLocalhostAsSecureOrigin: true,
    });

    /* Link the browser subscription to this user's account
       (external id), enabling reliable targeting. */
    if (userId) {
      try {
        OneSignal.login(String(userId));
      } catch {}
    }

    installAudioUnlock();

    /* Foreground ring — plays orderRing.mp3 when an Order Ring
       push is received while the app is open. */
    OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
      const data = event?.notification?.additionalData || {};
      if (data?.type === "order-ring") {
        playOrderRingSound();
      }
    });

    await OneSignal.Notifications.requestPermission();

    /* Save the push subscription id — retry until it exists. */
    let subscriptionId = OneSignal.User.PushSubscription.id;
    if (!subscriptionId) {
      subscriptionId = await waitForSubscriptionId();
    }

    if (subscriptionId) {
      await saveSubscription(subscriptionId);
    } else {
      console.warn("⚠️ No OneSignal push subscription id available on this device");
    }

    /* Re-save if the subscription id changes (e.g. browser rotation). */
    try {
      OneSignal.User.PushSubscription.addEventListener("change", () => {
        const id = OneSignal.User.PushSubscription.id;
        if (id && id !== subscriptionId) saveSubscription(id);
      });
    } catch {}
  } catch (err) {
    console.error("OneSignal init error:", err);
    /* Allow retry on next login/token change — e.g. push is not
       supported on this browser (iPhone Safari without Home-screen app). */
    initialized = false;
  }
}