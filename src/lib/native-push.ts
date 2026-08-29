import { supabase } from "@/lib/supabase/client";
import { getNativePlatform } from "@/lib/native-app";
import { setNativeNotificationBadgeCount } from "@/lib/native-live-updates";

type PushNotificationsModule = typeof import("@capacitor/push-notifications");

let pushRegistrationInFlight = false;
let pushListenersRegistered = false;
let nativeBadgeListenersRegistered = false;
let nativeBadgeSyncSequence = 0;
let pushPluginModulePromise: Promise<PushNotificationsModule> | null = null;
let pendingPushToken: { token: string; platform: string } | null = null;

const NATIVE_PUSH_TOKEN_STORAGE_KEY = "loombus:native-push-token";

type StoredNativePushToken = {
  token: string;
  platform: string;
};

function getStoredNativePushToken(): StoredNativePushToken | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
    const parsed = value ? (JSON.parse(value) as unknown) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as { token?: unknown; platform?: unknown };
    if (typeof candidate.token !== "string" || typeof candidate.platform !== "string") return null;
    return { token: candidate.token, platform: candidate.platform };
  } catch {
    return null;
  }
}

function storeNativePushToken(token: string, platform: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    NATIVE_PUSH_TOKEN_STORAGE_KEY,
    JSON.stringify({ token, platform })
  );
}

function clearStoredNativePushToken(token: string) {
  if (typeof window === "undefined") return;
  if (getStoredNativePushToken()?.token === token) {
    window.localStorage.removeItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
  }
}

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
  if (platform === "android") return "fcm";
  if (platform === "ios") return "apns";
  return "unknown";
}

function parseUnreadCount(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

async function applyNativeNotificationBadgeCount(count: number) {
  try {
    await setNativeNotificationBadgeCount(count);
  } catch (error) {
    console.error("Unable to update the Loombus native notification badge.", error);
  }
}

export async function syncNativeNotificationBadge() {
  if (typeof window === "undefined") return;

  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") return;

  const sequence = ++nativeBadgeSyncSequence;
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;

  if (!userId) {
    if (sequence === nativeBadgeSyncSequence) {
      await applyNativeNotificationBadgeCount(0);
    }
    return;
  }

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) {
    console.error("Unable to load the Loombus native notification badge count.", error);
    return;
  }

  if (sequence !== nativeBadgeSyncSequence) return;
  await applyNativeNotificationBadgeCount(count ?? 0);
}

function registerNativeBadgeSyncListeners() {
  if (typeof window === "undefined" || nativeBadgeListenersRegistered) return;
  nativeBadgeListenersRegistered = true;

  window.addEventListener("loombus:notifications-changed", () => {
    void syncNativeNotificationBadge();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void syncNativeNotificationBadge();
    }
  });
}

async function registerPushToken(token: string, platform: string) {
  storeNativePushToken(token, platform);
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
    body: JSON.stringify({ token, platform, tokenType }),
  });

  if (response.ok) {
    if (pendingPushToken?.token === token) pendingPushToken = null;
    return;
  }

  const payload = await response.json().catch(() => ({}));
  console.error("Loombus push token registration failed.", payload);
}

export async function disableNativePushNotificationsForCurrentSession() {
  const storedToken = getStoredNativePushToken() ?? pendingPushToken;
  if (!storedToken) return { ok: true };

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ok: false, error: "No authenticated session was available." };
  }

  try {
    const response = await fetch("/api/push/device-tokens", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token: storedToken.token }),
    });

    if (!response.ok) {
      return { ok: false, error: "The push token could not be disabled." };
    }

    clearStoredNativePushToken(storedToken.token);
    if (pendingPushToken?.token === storedToken.token) pendingPushToken = null;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The push token could not be disabled.",
    };
  }
}

async function flushPendingPushToken() {
  if (!pendingPushToken) return;
  await registerPushToken(pendingPushToken.token, pendingPushToken.platform);
}

export async function initializeNativePushListeners() {
  if (typeof window === "undefined") return;

  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") return;

  registerNativeBadgeSyncListeners();
  if (pushListenersRegistered) {
    await syncNativeNotificationBadge();
    return;
  }

  pushListenersRegistered = true;

  try {
    const { PushNotifications } = await getPushNotificationsModule();

    await PushNotifications.addListener("registration", (token) => {
      if (token.value) void registerPushToken(token.value, platform);
    });

    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Loombus native push registration error.", error);
    });

    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      const unreadCount = parseUnreadCount(notification.data?.unreadCount);
      if (unreadCount !== null) {
        void applyNativeNotificationBadgeCount(unreadCount);
      } else {
        void syncNativeNotificationBadge();
      }
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

    await syncNativeNotificationBadge();
  } catch (error) {
    console.error("Unable to initialize Loombus native push listeners.", error);
    pushListenersRegistered = false;
  }
}

export async function registerNativePushNotifications() {
  if (typeof window === "undefined") return;

  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") return;

  await initializeNativePushListeners();
  await flushPendingPushToken();

  if (pushRegistrationInFlight) return;
  pushRegistrationInFlight = true;

  try {
    const { PushNotifications } = await getPushNotificationsModule();

    const permissionStatus = await PushNotifications.checkPermissions();
    const receive =
      permissionStatus.receive === "granted"
        ? "granted"
        : (await PushNotifications.requestPermissions()).receive;

    if (receive !== "granted") return;

    await PushNotifications.register();
    await flushPendingPushToken();
    await syncNativeNotificationBadge();
  } catch (error) {
    console.error("Unable to initialize Loombus native push notifications.", error);
  } finally {
    pushRegistrationInFlight = false;
  }
}
