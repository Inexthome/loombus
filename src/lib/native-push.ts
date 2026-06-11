import { supabase } from "@/lib/supabase/client";
import { getNativePlatform } from "@/lib/native-app";

let pushRegistrationStarted = false;
let pushListenersRegistered = false;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function getNativePushTokenType(platform: string) {
  if (platform === "android") {
    return "fcm";
  }

  if (platform === "ios") {
    return "apns";
  }

  return "unknown";
}

async function registerPushToken(token: string, platform: string) {
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
      platform,
      tokenType: getNativePushTokenType(platform),
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    console.error("Loombus push token registration failed.", payload);
  }
}

export async function registerNativePushNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  const platform = getNativePlatform();

  if (platform !== "ios" && platform !== "android") {
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
          void registerPushToken(token.value, platform);
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
