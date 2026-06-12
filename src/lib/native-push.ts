import { supabase } from "@/lib/supabase/client";
import { getNativePlatform } from "@/lib/native-app";

type PushNotificationsPlugin = typeof import("@capacitor/push-notifications")["PushNotifications"];

let pushRegistrationStarted = false;
let pushListenersRegistered = false;
let pushPluginPromise: Promise<PushNotificationsPlugin> | null = null;
let pendingPushToken: { token: string; platform: string } | null = null;

async function getPushNotificationsPlugin() {
  if (!pushPluginPromise) {
    pushPluginPromise = import("@capacitor/push-notifications").then(
      ({ PushNotifications }) => PushNotifications
    );
  }

  return pushPluginPromise;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? "";

  console.info(
    `Loombus native push diagnostics: access token present=${Boolean(accessToken)}`
  );

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
  const tokenType = getNativePushTokenType(platform);

  console.info(
    `Loombus native push diagnostics: token received platform=${platform} tokenType=${tokenType} tokenLength=${token.length}`
  );

  const accessToken = await getAccessToken();

  if (!accessToken) {
    pendingPushToken = { token, platform };
    console.warn(
      "Loombus native push diagnostics: no access token, queued token registration"
    );
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
      tokenType,
    }),
  });

  console.info(
    `Loombus native push diagnostics: device-token route response ok=${response.ok} status=${response.status}`
  );

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

  console.info("Loombus native push diagnostics: flushing queued token registration");

  await registerPushToken(pendingPushToken.token, pendingPushToken.platform);
}

export async function initializeNativePushListeners() {
  if (typeof window === "undefined") {
    return;
  }

  const platform = getNativePlatform();

  console.info(
    `Loombus native push diagnostics: listener initialization requested platform=${platform}`
  );

  if (platform !== "ios" && platform !== "android") {
    console.info("Loombus native push diagnostics: not a native push platform");
    return;
  }

  if (pushListenersRegistered) {
    console.info("Loombus native push diagnostics: listeners already registered");
    return;
  }

  pushListenersRegistered = true;

  try {
    const PushNotifications = await getPushNotificationsPlugin();

    console.info("Loombus native push diagnostics: PushNotifications plugin imported");

    await PushNotifications.addListener("registration", (token) => {
      console.info(
        `Loombus native push diagnostics: registration listener fired hasToken=${Boolean(
          token.value
        )} tokenLength=${token.value?.length ?? 0}`
      );

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
  }
}

export async function registerNativePushNotifications() {
  if (typeof window === "undefined") {
    return;
  }

  const platform = getNativePlatform();

  console.info(
    `Loombus native push diagnostics: registration requested platform=${platform}`
  );

  if (platform !== "ios" && platform !== "android") {
    console.info("Loombus native push diagnostics: not a native push platform");
    return;
  }

  await initializeNativePushListeners();
  await flushPendingPushToken();

  if (pushRegistrationStarted) {
    console.info("Loombus native push diagnostics: registration already started");
    return;
  }

  pushRegistrationStarted = true;

  try {
    const PushNotifications = await getPushNotificationsPlugin();

    const permissionStatus = await PushNotifications.checkPermissions();

    console.info(
      `Loombus native push diagnostics: permission status receive=${permissionStatus.receive}`
    );

    const receive =
      permissionStatus.receive === "granted"
        ? "granted"
        : (await PushNotifications.requestPermissions()).receive;

    console.info(`Loombus native push diagnostics: permission result=${receive}`);

    if (receive !== "granted") {
      console.warn("Loombus native push diagnostics: permission not granted");
      return;
    }

    console.info("Loombus native push diagnostics: calling PushNotifications.register()");
    await PushNotifications.register();
    await flushPendingPushToken();
  } catch (error) {
    console.error("Unable to initialize Loombus native push notifications.", error);
  }
}
