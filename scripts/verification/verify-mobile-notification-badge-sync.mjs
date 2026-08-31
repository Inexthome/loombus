import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const nativePush = read("src/lib/native-push.ts");
const notificationsClient = read("src/app/notifications/notifications-v2-client.tsx");
const iosPlugin = read("ios/App/App/LoombusLiveUpdatesPlugin.swift");
const iosBridge = read("ios/App/App/LoombusBridgeViewController.swift");
const androidPlugin = read("android/app/src/main/java/com/loombus/app/LoombusLiveUpdatesPlugin.java");
const androidActivity = read("android/app/src/main/java/com/loombus/app/MainActivity.java");

assert(
  nativePush.includes('.from("notifications")') &&
    nativePush.includes('.is("read_at", null)') &&
    nativePush.includes('count: "exact"'),
  "Native badge sync must use the authoritative unread notifications count."
);
assert(
  nativePush.includes('table: "notifications"') &&
    nativePush.includes('filter: `user_id=eq.${userId}`') &&
    nativePush.includes('event: "*"'),
  "Native badge sync must subscribe to authenticated notification row changes."
);
assert(
  nativePush.includes('supabase.removeChannel(nativeBadgeRealtimeChannel)'),
  "Native badge realtime subscriptions must be replaced/cleared across auth changes."
);
assert(
  notificationsClient.includes('loombus:notifications-changed'),
  "Notification read mutations must keep the immediate badge reconciliation signal."
);
assert(
  iosPlugin.includes('setNotificationBadgeCount') &&
    iosPlugin.includes('setBadgeCount(count)'),
  "iOS must expose the native badge setter."
);
assert(
  iosBridge.includes('registerPluginInstance(LoombusLiveUpdatesPlugin())'),
  "iOS must register the Loombus native plugin."
);
assert(
  androidPlugin.includes('setNotificationBadgeCount') &&
    androidActivity.includes('registerPlugin(LoombusLiveUpdatesPlugin.class)'),
  "Android must expose and register the native badge bridge."
);

console.log("Mobile notification badge sync verification passed.");
