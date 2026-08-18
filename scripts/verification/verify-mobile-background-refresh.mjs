import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) {
    throw new Error(message);
  }
}

const [
  packageJson,
  capacitorConfig,
  runner,
  infoPlist,
  appDelegate,
  pushDelivery,
  androidPlugins,
  iosPackage,
] = await Promise.all([
  read("package.json"),
  read("capacitor.config.ts"),
  read("public/runners/loombus-background.js"),
  read("ios/App/App/Info.plist"),
  read("ios/App/App/AppDelegate.swift"),
  read("src/lib/push-delivery.ts"),
  read("android/app/capacitor.build.gradle"),
  read("ios/App/CapApp-SPM/Package.swift"),
]);

requireText(
  packageJson,
  '"@capacitor/background-runner"',
  "The native background runner dependency is missing."
);

for (const expected of [
  'label: "com.loombus.mobile.background.refresh"',
  'src: "runners/loombus-background.js"',
  'event: "refreshLoombus"',
  "repeat: false",
]) {
  requireText(
    capacitorConfig,
    expected,
    `The background runner config is missing ${expected}.`
  );
}

for (const event of ["refreshLoombus", "remoteNotification"]) {
  requireText(runner, event, `The background runner is missing ${event}.`);
}

if (/\bfetch\s*\(/.test(runner)) {
  throw new Error(
    "Background refresh must remain push-driven and must not introduce periodic network egress."
  );
}

const scheduledRefreshHandler = runner.match(
  /addEventListener\("refreshLoombus",[\s\S]*?\n}\);/
)?.[0];

if (!scheduledRefreshHandler) {
  throw new Error("The scheduled background refresh handler is missing.");
}

if (scheduledRefreshHandler.includes("setBadge")) {
  throw new Error(
    "Scheduled refresh must not create an Android badge notification; badges arrive with push delivery."
  );
}

for (const expected of [
  "BGTaskSchedulerPermittedIdentifiers",
  "com.loombus.mobile.background.refresh",
  "remote-notification",
  "processing",
  "fetch",
]) {
  requireText(infoPlist, expected, `The iOS background config is missing ${expected}.`);
}

for (const expected of [
  "import CapacitorBackgroundRunner",
  "BackgroundRunnerPlugin.registerBackgroundTask()",
  'event: "remoteNotification"',
]) {
  requireText(appDelegate, expected, `The iOS delegate is missing ${expected}.`);
}

for (const expected of [
  '"content-available": 1',
  "badge: args.unreadCount",
  "notification_count: args.unreadCount",
  "getUnreadNotificationCount",
]) {
  requireText(pushDelivery, expected, `Push badge refresh is missing ${expected}.`);
}

requireText(
  androidPlugins,
  "capacitor-background-runner",
  "The Android background runner was not synchronized."
);
requireText(
  iosPackage,
  "CapacitorBackgroundRunner",
  "The iOS background runner was not synchronized."
);

console.log(
  "Mobile background refresh verification passed: badge updates are push-driven, system-scheduled, and add no periodic content polling."
);
