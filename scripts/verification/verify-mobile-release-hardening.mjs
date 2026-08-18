import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { XMLParser } from "fast-xml-parser";

const root = process.cwd();
const requireProductionConfig = process.argv.includes(
  "--require-production-config"
);
const requireNativeToolchains = process.argv.includes(
  "--require-native-toolchains"
);
const fingerprintPattern = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

function forbidText(source, forbidden, message) {
  if (source.includes(forbidden)) throw new Error(message);
}

async function fileExists(relativePath) {
  try {
    await access(resolve(root, relativePath), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function validSigningFingerprints() {
  return (process.env.LOOMBUS_ANDROID_APP_SIGNING_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .every((value) => fingerprintPattern.test(value));
}

const [
  androidManifest,
  backupRules,
  extractionRules,
  filePaths,
  androidBuild,
  androidVariables,
  downloadPage,
  assetLinksRoute,
  iosPrivacyManifest,
  iosProject,
  gitignore,
] = await Promise.all([
  read("android/app/src/main/AndroidManifest.xml"),
  read("android/app/src/main/res/xml/backup_rules.xml"),
  read("android/app/src/main/res/xml/data_extraction_rules.xml"),
  read("android/app/src/main/res/xml/file_paths.xml"),
  read("android/build.gradle"),
  read("android/variables.gradle"),
  read("src/app/download/page.tsx"),
  read("src/app/.well-known/assetlinks.json/route.ts"),
  read("ios/App/App/PrivacyInfo.xcprivacy"),
  read("ios/App/App.xcodeproj/project.pbxproj"),
  read(".gitignore"),
]);

const parser = new XMLParser({ ignoreAttributes: false });
for (const [name, source] of [
  ["Android manifest", androidManifest],
  ["Android backup rules", backupRules],
  ["Android extraction rules", extractionRules],
  ["Android FileProvider paths", filePaths],
  ["iOS privacy manifest", iosPrivacyManifest],
]) {
  parser.parse(source);
  if (!source.trim()) throw new Error(`${name} is empty.`);
}

for (const expected of [
  'android:allowBackup="false"',
  'android:dataExtractionRules="@xml/data_extraction_rules"',
  'android:fullBackupContent="@xml/backup_rules"',
]) {
  requireText(
    androidManifest,
    expected,
    `Android session backup hardening is missing ${expected}.`
  );
}

requireText(
  androidManifest,
  "android.permission.ACCESS_COARSE_LOCATION",
  "Android approximate location permission is missing."
);
forbidText(
  androidManifest,
  "android.permission.ACCESS_FINE_LOCATION",
  "Android precise location is declared even though Loombus only requests approximate location."
);

for (const source of [backupRules, extractionRules]) {
  for (const domain of ["root", "file", "database", "sharedpref", "external"]) {
    requireText(
      source,
      `domain="${domain}" path="."`,
      `Android backup exclusions do not cover ${domain}.`
    );
  }
}

requireText(
  filePaths,
  '<external-files-path name="captured_images" path="Pictures/" />',
  "Android camera capture sharing must be limited to app-owned Pictures files."
);
requireText(
  filePaths,
  '<cache-path name="edited_images" path="." />',
  "Android edited-image sharing must be limited to the app cache."
);
forbidText(
  filePaths,
  "<external-path",
  "Android FileProvider must not expose the entire shared external-storage root."
);

requireText(
  downloadPage,
  "https://play.google.com/store/apps/details?id=com.loombus.app",
  "The public Google Play link must use the production Android package."
);
forbidText(
  downloadPage,
  "https://play.google.com/store/apps/details?id=com.loombus.mobile",
  "The public Google Play link still uses the iOS bundle identifier."
);

for (const expected of [
  "LOOMBUS_ANDROID_APP_SIGNING_SHA256",
  "delegate_permission/common.get_login_creds",
  'package_name: ANDROID_PACKAGE_NAME',
  'const ANDROID_PACKAGE_NAME = "com.loombus.app"',
]) {
  requireText(
    assetLinksRoute,
    expected,
    `Android credential association is missing ${expected}.`
  );
}

for (const expected of [
  "NSPrivacyAccessedAPITypes",
  "NSPrivacyCollectedDataTypes",
  "NSPrivacyTrackingDomains",
  "NSPrivacyTracking",
  "<false/>",
]) {
  requireText(
    iosPrivacyManifest,
    expected,
    `The iOS app privacy manifest is missing ${expected}.`
  );
}
requireText(
  iosProject,
  "PrivacyInfo.xcprivacy in Resources",
  "The iOS privacy manifest is not attached to the app target."
);

requireText(
  androidBuild,
  "com.android.tools.build:gradle:8.13.0",
  "Android Gradle Plugin 8.13.0 must remain locked for 16 KB packaging support."
);
for (const expected of ["compileSdkVersion = 36", "targetSdkVersion = 36"]) {
  requireText(
    androidVariables,
    expected,
    `Android release metadata is missing ${expected}.`
  );
}
requireText(
  gitignore,
  "android/app/google-services.json",
  "Firebase client configuration must remain ignored."
);

if (requireProductionConfig) {
  if (!(await fileExists("android/app/google-services.json"))) {
    throw new Error(
      "Production Android push requires local android/app/google-services.json. Do not commit it."
    );
  }

  const googleServices = JSON.parse(
    await read("android/app/google-services.json")
  );
  const androidPackages = (googleServices.client ?? [])
    .map(
      (client) =>
        client?.client_info?.android_client_info?.package_name ?? ""
    )
    .filter(Boolean);
  if (!androidPackages.includes("com.loombus.app")) {
    throw new Error(
      "google-services.json does not contain the production package com.loombus.app."
    );
  }

  if (!process.env.LOOMBUS_ANDROID_APP_SIGNING_SHA256?.trim()) {
    throw new Error(
      "Set LOOMBUS_ANDROID_APP_SIGNING_SHA256 to the Play app-signing SHA-256 fingerprint."
    );
  }
  if (!validSigningFingerprints()) {
    throw new Error(
      "LOOMBUS_ANDROID_APP_SIGNING_SHA256 must contain colon-separated SHA-256 fingerprints, separated by commas when more than one is needed."
    );
  }

  for (const name of [
    "APNS_TEAM_ID",
    "APNS_KEY_ID",
    "APNS_ENVIRONMENT",
    "APNS_BUNDLE_ID",
  ]) {
    if (!process.env[name]?.trim()) {
      throw new Error(`Production push configuration is missing ${name}.`);
    }
  }
  if (
    !process.env.APNS_PRIVATE_KEY?.trim() &&
    !process.env.APNS_PRIVATE_KEY_BASE64?.trim()
  ) {
    throw new Error(
      "Production push configuration needs APNS_PRIVATE_KEY or APNS_PRIVATE_KEY_BASE64."
    );
  }
  if (process.env.APNS_ENVIRONMENT !== "production") {
    throw new Error("App Store and TestFlight push requires APNS_ENVIRONMENT=production.");
  }
  if (process.env.APNS_BUNDLE_ID !== "com.loombus.mobile") {
    throw new Error("APNS_BUNDLE_ID must be com.loombus.mobile.");
  }

  const hasFirebaseServiceAccount = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim() ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
      (process.env.FIREBASE_PROJECT_ID?.trim() &&
        process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
        (process.env.FIREBASE_PRIVATE_KEY?.trim() ||
          process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim()))
  );
  if (!hasFirebaseServiceAccount) {
    throw new Error(
      "Production FCM delivery requires a Firebase service account configuration."
    );
  }
}

if (requireNativeToolchains) {
  if (process.platform !== "darwin") {
    throw new Error("The final iOS archive gate must run on macOS.");
  }

  const xcode = spawnSync("xcodebuild", ["-version"], {
    encoding: "utf8",
  });
  if (xcode.status !== 0) {
    throw new Error("xcodebuild is unavailable on this Mac.");
  }
  const version = Number(xcode.stdout.match(/Xcode\s+(\d+(?:\.\d+)?)/)?.[1]);
  if (!Number.isFinite(version) || version < 26) {
    throw new Error("The final iOS archive requires Xcode 26 or later.");
  }
}

console.log(
  "Mobile release hardening verification passed: backups are disabled, permission scope is minimal, FileProvider is restricted, store links and credential associations are correct, privacy metadata is bundled, and current SDK packaging requirements are locked."
);
if (!requireProductionConfig) {
  console.log(
    "Production secrets and the Play app-signing fingerprint were not asserted. Re-run with --require-production-config on the secured release machine."
  );
}
if (!requireNativeToolchains) {
  console.log(
    "Native toolchains were not asserted. Re-run with --require-native-toolchains on the release Mac."
  );
}
