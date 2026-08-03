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

    console.log("Subscription ID:", subscriptionId);

    if (!subscriptionId || !token) return;

    await axios.put(
      `${API_BASE_URL}/api/v1/user/save-subscription`,
      {
        subscriptionId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    console.log("Subscription saved.");
  } catch (err) {
    console.error(err);
  }
}
