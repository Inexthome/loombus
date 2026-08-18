import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";

const root = process.cwd();

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

const [
  packageJson,
  iosInfo,
  iosWidgetInfo,
  iosWidgetEntitlements,
  iosProject,
  iosPlugin,
  iosWidget,
  iosAttributes,
  iosBridgeController,
  iosStoryboard,
  androidManifest,
  androidDrawable,
  androidPlugin,
  mainActivity,
  nativeClient,
  appointments,
  authSignOut,
] = await Promise.all([
  read("package.json"),
  read("ios/App/App/Info.plist"),
  read("ios/App/LiveActivities/Info.plist"),
  read("ios/App/LiveActivities/LoombusLiveActivities.entitlements"),
  read("ios/App/App.xcodeproj/project.pbxproj"),
  read("ios/App/App/LoombusLiveUpdatesPlugin.swift"),
  read("ios/App/LiveActivities/LoombusAppointmentLiveActivity.swift"),
  read("ios/App/App/LoombusAppointmentActivity.swift"),
  read("ios/App/App/LoombusBridgeViewController.swift"),
  read("ios/App/App/Base.lproj/Main.storyboard"),
  read("android/app/src/main/AndroidManifest.xml"),
  read("android/app/src/main/res/drawable/ic_loombus_live_update.xml"),
  read("android/app/src/main/java/com/loombus/app/LoombusLiveUpdatesPlugin.java"),
  read("android/app/src/main/java/com/loombus/app/MainActivity.java"),
  read("src/lib/native-live-updates.ts"),
  read("src/components/unified-appointments-overview.tsx"),
  read("src/lib/auth-sign-out.ts"),
]);

const parsedPackage = JSON.parse(packageJson);
new XMLParser({ ignoreAttributes: false }).parse(iosInfo);
new XMLParser({ ignoreAttributes: false }).parse(iosWidgetInfo);
new XMLParser({ ignoreAttributes: false }).parse(iosWidgetEntitlements);
new XMLParser({ ignoreAttributes: false }).parse(iosStoryboard);
new XMLParser({ ignoreAttributes: false }).parse(androidManifest);
new XMLParser({ ignoreAttributes: false }).parse(androidDrawable);

if (
  iosProject.split("{").length !== iosProject.split("}").length ||
  iosProject.split("(").length !== iosProject.split(")").length
) {
  throw new Error("The Xcode project file has unbalanced delimiters.");
}

if (parsedPackage.dependencies?.["@capgo/capacitor-live-activities"]) {
  throw new Error(
    "The audited third-party Live Activities package must not be shipped because it does not create an ActivityKit activity."
  );
}

for (const expected of [
  "Activity.request(",
  "Activity<LoombusAppointmentAttributes>.activities",
  "activity.update(",
  "activity.end(",
]) {
  requireText(iosPlugin, expected, `The iOS ActivityKit bridge is missing ${expected}.`);
}

for (const expected of [
  "ActivityConfiguration(for: LoombusAppointmentAttributes.self)",
  "DynamicIsland",
  ".widgetURL(",
  "calendar.badge.clock",
]) {
  requireText(iosWidget, expected, `The iOS Live Activity widget is missing ${expected}.`);
}

requireText(
  iosAttributes,
  "struct LoombusAppointmentAttributes: ActivityAttributes",
  "The shared appointment ActivityAttributes model is missing."
);

for (const expected of [
  "LoombusLiveActivities.appex in Embed App Extensions",
  'productType = "com.apple.product-type.app-extension"',
  "IPHONEOS_DEPLOYMENT_TARGET = 16.2",
  "LoombusAppointmentActivity.swift in Sources",
  "LoombusBridgeViewController.swift in Sources",
]) {
  requireText(iosProject, expected, `The iOS Widget target is missing ${expected}.`);
}

requireText(
  iosBridgeController,
  "registerPluginInstance(LoombusLiveUpdatesPlugin())",
  "The iOS Capacitor bridge does not register the Loombus Live Updates plugin."
);
requireText(
  iosStoryboard,
  'customClass="LoombusBridgeViewController"',
  "The iOS storyboard does not load the custom bridge controller."
);
for (const expected of [
  "CFBundleExecutable",
  "CFBundleIdentifier",
  "CFBundlePackageType",
  "CFBundleShortVersionString",
  "CFBundleVersion",
]) {
  requireText(
    iosWidgetInfo,
    expected,
    `The Live Activities extension Info.plist is missing ${expected}.`
  );
}
requireText(
  iosInfo,
  "NSSupportsLiveActivities",
  "The iOS app does not declare Live Activities support."
);

for (const expected of [
  ".setOngoing(true)",
  ".setUsesChronometer(true)",
  "setRequestPromotedOngoing(true)",
  "canPostPromotedNotifications()",
]) {
  requireText(androidPlugin, expected, `The Android Live Update is missing ${expected}.`);
}

requireText(
  mainActivity,
  "registerPlugin(LoombusLiveUpdatesPlugin.class)",
  "The Android Capacitor bridge does not register the Loombus Live Updates plugin."
);
requireText(
  mainActivity,
  "openLoombusDestination(getIntent())",
  "Android does not handle a Live Update tap from a terminated launch."
);
requireText(
  androidManifest,
  "android.permission.POST_PROMOTED_NOTIFICATIONS",
  "The Android promoted-notification permission is missing."
);

for (const expected of [
  "START_WINDOW_MS",
  "getAppointmentLiveUpdateStatus",
  "isEligibleForLiveUpdate",
  "startAppointmentLiveUpdate",
  "reconcileAppointmentLiveUpdates",
  "endAllAppointmentLiveUpdates",
  "openAppointmentLiveUpdateSettings",
]) {
  requireText(nativeClient, expected, `The shared Live Update client is missing ${expected}.`);
}

requireText(
  authSignOut,
  "endAllAppointmentLiveUpdates()",
  "Sign-out must close appointment live surfaces before clearing the session."
);

for (const expected of [
  "Show live update",
  "startLiveUpdate",
  "liveUpdateCandidate",
  "liveUpdatesAvailable",
  "getAppointmentLiveUpdateStatus",
]) {
  requireText(appointments, expected, `The appointment UI is missing ${expected}.`);
}

console.log(
  "Mobile live update verification passed: iOS ActivityKit, the embedded Widget extension, Android promoted ongoing notifications, and user-initiated appointment wiring are present."
);
