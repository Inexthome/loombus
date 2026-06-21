import { supabase } from "@/lib/supabase/client";
import { getNativePlatform } from "@/lib/native-app";

type PushNotificationsModule = typeof import("@capacitor/push-notifications");

let pushRegistrationInFlight = false;
let pushListenersRegistered = false;
let pushPluginModulePromise: Promise<PushNotificationsModule> | null = null;
let pendingPushToken: { token: string; platform: string } | null = null;

async function getPushNotificationsModule() {
  if (!pushPluginModulePromise) {
    pushPluginModulePromise = import("@capacitor/push-notifications");
  }

  return pushPluginModulePromise;
}

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
  const tokenType = getNativePushTokenType(platform);
  const accessToken = await getAccessToken();

  if (!accessToken) {
    pendingPushToken = { token, platform };
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
      tokenType,
    }),
  });

  if (response.ok) {
    if (pendingPushToken?.token === token) {
      pendingPushToken = null;
    }

    return;
  }

  const payload = await response.json().catch(() => ({}));
  console.error("Loombus push token registration failed.", payload);
}

async function flushPendingPushToken() {
  if (!pendingPushToken) {
    return;
  }

  await registerPushToken(pendingPushToken.token, pendingPushToken.platform);
}

export async function initializeNativePushListeners() {
  if (typeof window === "undefined") {
    return;
  }

  const platform = getNativePlatform();

  if (platform !== "ios" && platform !== "android") {
    return;
  }

  if (pushListenersRegistered) {
    return;
  }

  pushListenersRegistered = true;

  try {
    const { PushNotifications } = await getPushNotificationsModule();

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
  } catch (error) {
    console.error("Unable to initialize Loombus native push listeners.", error);
    pushListenersRegistered = false;
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

  await initializeNativePushListeners();
  await flushPendingPushToken();

  if (pushRegistrationInFlight) {
    return;
  }

  pushRegistrationInFlight = true;

  try {
    const { PushNotifications } = await getPushNotificationsModule();

    const permissionStatus = await PushNotifications.checkPermissions();
    const receive =
      permissionStatus.receive === "granted"
        ? "granted"
        : (await PushNotifications.requestPermissions()).receive;

    if (receive !== "granted") {
      return;
    }

    await PushNotifications.register();
    await flushPendingPushToken();
  } catch (error) {
    console.error("Unable to initialize Loombus native push notifications.", error);
  } finally {
    pushRegistrationInFlight = false;
  }
}
