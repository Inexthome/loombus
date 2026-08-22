import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { XMLParser } from "fast-xml-parser";

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
  infoPlist,
  androidManifest,
  nativeLocation,
  localDiscovery,
  localManage,
  permissionsCard,
  privacySecurity,
] = await Promise.all([
  read("package.json"),
  read("ios/App/App/Info.plist"),
  read("android/app/src/main/AndroidManifest.xml"),
  read("src/lib/native-location.ts"),
  read("src/components/local-discovery-page.tsx"),
  read("src/components/local-manage-page.tsx"),
  read("src/components/native-app-permissions-card.tsx"),
  read("src/app/privacy-security/privacy-security-v2-client.tsx"),
]);

JSON.parse(packageJson);
new XMLParser({ ignoreAttributes: false }).parse(infoPlist);
new XMLParser({ ignoreAttributes: false }).parse(androidManifest);

for (const dependency of ["@capacitor/camera", "@capacitor/geolocation"]) {
  requireText(
    packageJson,
    `"${dependency}"`,
    `${dependency} must be installed for native permission handling.`
  );
}

for (const key of [
  "NSLocationAlwaysAndWhenInUseUsageDescription",
  "NSLocationWhenInUseUsageDescription",
  "NSPhotoLibraryAddUsageDescription",
  "NSPhotoLibraryUsageDescription",
]) {
  requireText(infoPlist, key, `The iOS ${key} declaration is missing.`);
}

requireText(
  androidManifest,
  "android.permission.ACCESS_COARSE_LOCATION",
  "The Android approximate-location declaration is missing."
);

const effectiveAndroidManifest = androidManifest.replace(
  /<uses-permission\b(?=[^>]*tools:node=["']remove["'])[^>]*\/>/g,
  ""
);

for (const [permission, message] of [
  [
    "android.permission.ACCESS_FINE_LOCATION",
    "Android precise location must remain undeclared while Loombus only uses approximate location.",
  ],
  [
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "Android background location must remain undeclared while Loombus only uses foreground approximate location.",
  ],
]) {
  if (effectiveAndroidManifest.includes(permission)) {
    throw new Error(message);
  }
}

requireText(
  androidManifest,
  "photopicker_activity:0:required",
  "The Android selected-media Photo Picker backport is missing."
);
requireText(
  nativeLocation,
  'permissions: ["coarseLocation"]',
  "Native Local features must request approximate location first."
);

for (const source of [localDiscovery, localManage]) {
  requireText(
    source,
    "getCurrentApproximateLocation",
    "Local location actions must use the native-aware permission helper."
  );
}

for (const permission of [
  "Approximate location",
  "Camera",
  "Photos and videos",
  "Notifications",
  "Face ID or device biometrics",
  "Background App Refresh",
  "Live Activities and updates",
  "Cross-app tracking",
]) {
  requireText(
    permissionsCard,
    permission,
    `The mobile permission center is missing ${permission}.`
  );
}

requireText(
  infoPlist,
  "NSSupportsLiveActivities",
  "iOS Live Activities support is missing."
);
requireText(
  androidManifest,
  "android.permission.POST_PROMOTED_NOTIFICATIONS",
  "Android promoted Live Updates permission is missing."
);

requireText(
  permissionsCard,
  'tracking: "not-used"',
  "Tracking must remain accurately marked as unused until Loombus introduces cross-app tracking."
);
requireText(
  privacySecurity,
  "<NativeAppPermissionsCard />",
  "The mobile permission center must be available from Privacy & Account Security."
);

console.log(
  "Mobile permission verification passed: the in-app status center, on-demand approximate location, selected media, and tracking disclosure are configured for iOS and Android."
);
