import { supabase } from "@/lib/supabase/client";
import { getNativePlatform } from "@/lib/native-app";

let pushRegistrationStarted = false;
let pushListenersRegistered = false;

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? "";

  console.info("Loombus native push diagnostics: access token present", Boolean(accessToken));

  return accessToken;
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
  console.info("Loombus native push diagnostics: token received", {
    platform,
    tokenType: getNativePushTokenType(platform),
    tokenLength: token.length,
  });

  const accessToken = await getAccessToken();

  if (!accessToken) {
    console.warn("Loombus native push diagnostics: no access token, skipping token registration");
    return;
  }

  console.info("Loombus native push diagnostics: posting token to device-token route");

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

  console.info("Loombus native push diagnostics: device-token route response", {
    ok: response.ok,
    status: response.status,
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

  console.info("Loombus native push diagnostics: registration requested", {
    platform,
  });

  if (platform !== "ios" && platform !== "android") {
    console.info("Loombus native push diagnostics: not a native push platform");
    return;
  }

  if (pushRegistrationStarted) {
    console.info("Loombus native push diagnostics: registration already started");
    return;
  }

  pushRegistrationStarted = true;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    console.info("Loombus native push diagnostics: PushNotifications plugin imported");

    if (!pushListenersRegistered) {
      pushListenersRegistered = true;

      await PushNotifications.addListener("registration", (token) => {
        console.info("Loombus native push diagnostics: registration listener fired", {
          hasToken: Boolean(token.value),
          tokenLength: token.value?.length ?? 0,
        });

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

    console.info("Loombus native push diagnostics: permission status", permissionStatus);

    const receive =
      permissionStatus.receive === "granted"
        ? "granted"
        : (await PushNotifications.requestPermissions()).receive;

    console.info("Loombus native push diagnostics: permission result", receive);

    if (receive !== "granted") {
      console.warn("Loombus native push diagnostics: permission not granted");
      return;
    }

    console.info("Loombus native push diagnostics: calling PushNotifications.register()");
    await PushNotifications.register();
  } catch (error) {
    console.error("Unable to initialize Loombus native push notifications.", error);
  }
}
