import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp } from "@/lib/native-app";

let pushRegistrationStarted = false;
let pushListenersRegistered = false;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function registerPushToken(token: string) {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return;
  }

  const response = await fetch("/api/push/device-tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      token,
      platform: "ios",
      tokenType: "apns",
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.error("Loombus push token registration failed.", payload);
  }
}

export async function registerNativePushNotifications() {
  if (typeof window === "undefined" || !isIosNativeApp()) {
    return;
  }

  if (pushRegistrationStarted) {
    return;
  }

  pushRegistrationStarted = true;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    if (!pushListenersRegistered) {
      pushListenersRegistered = true;

      await PushNotifications.addListener("registration", (token) => {
        if (token.value) {
          void registerPushToken(token.value);
        }
      });

      await PushNotifications.addListener("registrationError", (error) => {
        console.error("Loombus native push registration error.", error);
      });

      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const targetUrl =
            typeof action.notification.data?.url === "string"
              ? action.notification.data.url
              : "/notifications";

          if (targetUrl.startsWith("/") && !targetUrl.startsWith("//")) {
            window.location.assign(targetUrl);
          } else {
            window.location.assign("/notifications");
          }
        }
      );
    }

    const permissionStatus = await PushNotifications.checkPermissions();
    const receive =
      permissionStatus.receive === "granted"
        ? "granted"
        : (await PushNotifications.requestPermissions()).receive;

    if (receive !== "granted") {
      return;
    }

    await PushNotifications.register();
  } catch (error) {
    console.error("Unable to initialize Loombus native push notifications.", error);
  }
}
