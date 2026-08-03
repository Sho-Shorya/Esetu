import OneSignal from "react-onesignal";

let initialized = false;

export async function initOneSignal() {
  if (initialized) return;
  initialized = true;

  await OneSignal.init({
    appId: "d62603a2-aad9-431a-a1c9-a86ec46e4a5b",
  });

  await OneSignal.Notifications.requestPermission();
}
