import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const requireStoreBaseline = process.argv.includes("--require-store-baseline");

async function read(relativePath) {
  return readFile(resolve(root, relativePath), "utf8");
}

function requireMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`Unable to read ${label}.`);
  return match[1];
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

function versionParts(value) {
  if (!/^\d+(?:\.\d+){1,2}$/.test(value)) {
    throw new Error(`Invalid dotted release version: ${value}`);
  }
  return value.split(".").map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function positiveInteger(value, label) {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return Number(value);
}

const [androidBuild, androidVariables, androidManifest, iosProject, iosInfo] =
  await Promise.all([
    read("android/app/build.gradle"),
    read("android/variables.gradle"),
    read("android/app/src/main/AndroidManifest.xml"),
    read("ios/App/App.xcodeproj/project.pbxproj"),
    read("ios/App/App/Info.plist"),
  ]);

const androidVersionCode = positiveInteger(
  requireMatch(androidBuild, /versionCode\s+(\d+)/, "Android versionCode"),
  "Android versionCode"
);
const androidVersionName = requireMatch(
  androidBuild,
  /versionName\s+"([^"]+)"/,
  "Android versionName"
);
versionParts(androidVersionName);

const compileSdk = positiveInteger(
  requireMatch(
    androidVariables,
    /compileSdkVersion\s*=\s*(\d+)/,
    "Android compile SDK"
  ),
  "Android compile SDK"
);
const targetSdk = positiveInteger(
  requireMatch(
    androidVariables,
    /targetSdkVersion\s*=\s*(\d+)/,
    "Android target SDK"
  ),
  "Android target SDK"
);

if (compileSdk < 36 || targetSdk < 36) {
  throw new Error("Android Live Updates require compileSdk and targetSdk 36 or later.");
}

for (const permission of [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.POST_PROMOTED_NOTIFICATIONS",
  "android.permission.ACCESS_COARSE_LOCATION",
]) {
  requireText(androidManifest, permission, `Android is missing ${permission}.`);
}

const iosVersions = [
  ...iosProject.matchAll(/MARKETING_VERSION = ([^;]+);/g),
].map((match) => match[1].replaceAll('"', "").trim());
const iosBuilds = [
  ...iosProject.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g),
].map((match) => match[1].replaceAll('"', "").trim());

if (!iosVersions.length || new Set(iosVersions).size !== 1) {
  throw new Error("The iOS app and Live Activities extension versions are not aligned.");
}
if (!iosBuilds.length || new Set(iosBuilds).size !== 1) {
  throw new Error("The iOS app and Live Activities extension build numbers are not aligned.");
}

const iosVersion = iosVersions[0];
const iosBuild = positiveInteger(iosBuilds[0], "iOS build number");
versionParts(iosVersion);

for (const bundleId of [
  "PRODUCT_BUNDLE_IDENTIFIER = com.loombus.mobile;",
  "PRODUCT_BUNDLE_IDENTIFIER = com.loombus.mobile.LiveActivities;",
]) {
  requireText(iosProject, bundleId, `The Xcode project is missing ${bundleId}`);
}
requireText(
  iosInfo,
  "NSSupportsLiveActivities",
  "The iOS app must declare Live Activities support."
);

const iosStoreVersion = process.env.LOOMBUS_IOS_STORE_VERSION;
const iosStoreBuildValue = process.env.LOOMBUS_IOS_STORE_BUILD;
const androidStoreCodeValue = process.env.LOOMBUS_ANDROID_STORE_VERSION_CODE;
const hasCompleteStoreBaseline = Boolean(
  iosStoreVersion && iosStoreBuildValue && androidStoreCodeValue
);

if (!hasCompleteStoreBaseline && requireStoreBaseline) {
  throw new Error(
    "Store baselines are required. Set LOOMBUS_IOS_STORE_VERSION, LOOMBUS_IOS_STORE_BUILD, and LOOMBUS_ANDROID_STORE_VERSION_CODE from App Store Connect and Play Console."
  );
}

if (hasCompleteStoreBaseline) {
  const iosStoreBuild = positiveInteger(
    iosStoreBuildValue,
    "Distributed iOS build number"
  );
  const androidStoreCode = positiveInteger(
    androidStoreCodeValue,
    "Distributed Android version code"
  );
  const iosVersionComparison = compareVersions(iosVersion, iosStoreVersion);

  if (
    iosVersionComparison < 0 ||
    (iosVersionComparison === 0 && iosBuild <= iosStoreBuild)
  ) {
    throw new Error(
      `iOS candidate ${iosVersion} (${iosBuild}) is not newer than distributed ${iosStoreVersion} (${iosStoreBuild}).`
    );
  }
  if (androidVersionCode <= androidStoreCode) {
    throw new Error(
      `Android candidate versionCode ${androidVersionCode} is not newer than distributed ${androidStoreCode}.`
    );
  }
}

console.log(
  `Mobile release metadata verification passed: iOS ${iosVersion} (${iosBuild}) with aligned Live Activities extension; Android ${androidVersionName} versionCode ${androidVersionCode}, SDK ${targetSdk}.`
);
if (!hasCompleteStoreBaseline) {
  console.log(
    "Store monotonicity was not asserted because the current App Store Connect and Play Console baselines were not supplied."
  );
}
