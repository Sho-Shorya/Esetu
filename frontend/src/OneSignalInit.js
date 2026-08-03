import OneSignal from "react-onesignal";
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

let initialized = false;

export async function initOneSignal(token) {
  if (initialized) return;
  initialized = true;

  try {
    await OneSignal.init({
      appId: "d62603a2-aad9-431a-a1c9-a86ec46e4a5b",
      allowLocalhostAsSecureOrigin: true,
    });

    await OneSignal.Notifications.requestPermission();

    const subscriptionId = OneSignal.User.PushSubscription.id;

    console.log("Permission:", OneSignal.Notifications.permission);
    console.log("Opted In:", OneSignal.User.PushSubscription.optedIn);
    console.log("Subscription ID:", subscriptionId);
    console.log("Token:", token);

    if (!subscriptionId || !token) {
      console.log("Subscription ID or token missing.");
      return;
    }

    const res = await axios.put(
      `${API_BASE_URL}/api/v1/user/save-subscription`,
      { subscriptionId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log("Subscription saved:", res.data);
  } catch (err) {
    console.error("Save Subscription Error:", err);
  }
}
