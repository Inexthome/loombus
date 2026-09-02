import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), "utf8");

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

const [
  androidBuild,
  androidManifest,
  androidActivity,
  androidPlugin,
  androidAssociation,
  iosEntitlements,
  iosAssociation,
  iosDelegate,
  iosPlugin,
  iosInfo,
  iosWidgetInfo,
  nativeBridge,
] = await Promise.all([
  read("android/app/build.gradle"),
  read("android/app/src/main/AndroidManifest.xml"),
  read("android/app/src/main/java/com/loombus/app/MainActivity.java"),
  read("android/app/src/main/java/com/loombus/app/LoombusLiveUpdatesPlugin.java"),
  read("src/app/.well-known/assetlinks.json/route.ts"),
  read("ios/App/Loombus.entitlements"),
  read("public/.well-known/apple-app-site-association"),
  read("ios/App/App/AppDelegate.swift"),
  read("ios/App/App/LoombusLiveUpdatesPlugin.swift"),
  read("ios/App/App/Info.plist"),
  read("ios/App/LiveActivities/Info.plist"),
  read("src/lib/native-live-updates.ts"),
]);

for (const expected of [
  "versionCode 14",
  'versionName "1.0.6"',
  "androidx.swiperefreshlayout:swiperefreshlayout:1.1.0",
]) {
  requireText(androidBuild, expected, `Android native release is missing ${expected}.`);
}

for (const expected of [
  'android:autoVerify="true"',
  'android.intent.action.VIEW',
  'android.intent.category.BROWSABLE',
  'android:scheme="https"',
  'android:host="loombus.com"',
]) {
  requireText(androidManifest, expected, `Android App Links are missing ${expected}.`);
}

for (const expected of [
  "SwipeRefreshLayout",
  "setOnRefreshListener",
  "performHapticFeedback",
  '"https".equalsIgnoreCase(data.getScheme())',
  'LOOMBUS_HOST.equalsIgnoreCase(data.getHost())',
  "getWebView().canGoBack()",
  "getWebView().goBack()",
]) {
  requireText(androidActivity, expected, `Android native experience is missing ${expected}.`);
}

for (const expected of [
  "public void share(PluginCall call)",
  "Intent.ACTION_SEND",
  "Intent.createChooser",
  "public void haptic(PluginCall call)",
  "HapticFeedbackConstants",
]) {
  requireText(androidPlugin, expected, `Android native share/haptics are missing ${expected}.`);
}

requireText(
  androidAssociation,
  "delegate_permission/common.handle_all_urls",
  "Android Digital Asset Links must authorize URL handling."
);

requireText(
  iosEntitlements,
  "applinks:loombus.com",
  "iOS Associated Domains must include applinks:loombus.com."
);
const association = JSON.parse(iosAssociation);
const details = association?.applinks?.details;
if (!Array.isArray(details) || !details.some((entry) =>
  Array.isArray(entry?.appIDs) && entry.appIDs.includes("AA9H676YU8.com.loombus.mobile")
)) {
  throw new Error("Apple AASA does not associate Loombus Universal Links with the iOS app.");
}

for (const expected of [
  "UIRefreshControl",
  "refreshLoombus",
  "UIImpactFeedbackGenerator",
  "NSUserActivityTypeBrowsingWeb",
  "handleLoombusUniversalLink",
  'url.host?.lowercased() == "loombus.com"',
]) {
  requireText(iosDelegate, expected, `iOS native experience is missing ${expected}.`);
}

for (const expected of [
  'CAPPluginMethod(name: "share"',
  'CAPPluginMethod(name: "haptic"',
  "UIActivityViewController",
  "UINotificationFeedbackGenerator",
  "UIImpactFeedbackGenerator",
]) {
  requireText(iosPlugin, expected, `iOS native share/haptics are missing ${expected}.`);
}

for (const expected of [
  "shareFromLoombus",
  "performLoombusHaptic",
  '"LoombusLiveUpdates"',
]) {
  requireText(nativeBridge, expected, `Shared native bridge is missing ${expected}.`);
}

for (const source of [iosInfo, iosWidgetInfo]) {
  requireText(
    source,
    "<key>CFBundleVersion</key>\n\t<string>2</string>",
    "The iOS app and Live Activities extension must both package build 2."
  );
}

console.log(
  "Native Experience verification passed: Android 1.0.6 (14) after store build 13; iOS 1.0.6 (2) after store build 1; pull-to-refresh, tactile feedback, verified web links, native sharing, and Android Back navigation are wired."
);
