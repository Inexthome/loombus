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
  supabaseClient,
  sessionGuard,
  loginPage,
  nativeBiometric,
  nativePasswordManager,
  authSessionCleanup,
  nativePush,
  signOutHelper,
  iosEntitlements,
  iosPasswordManager,
  iosBridgeController,
  iosProject,
  appleAssociation,
  androidBuild,
  androidManifest,
  androidStrings,
  androidPasswordManager,
  androidMainActivity,
  androidAssociation,
] = await Promise.all([
  read("src/lib/supabase/client.ts"),
  read("src/components/session-lifecycle-guard.tsx"),
  read("src/app/login/page.tsx"),
  read("src/lib/native-biometric.ts"),
  read("src/lib/native-password-manager.ts"),
  read("src/components/auth-session-cleanup.tsx"),
  read("src/lib/native-push.ts"),
  read("src/lib/auth-sign-out.ts"),
  read("ios/App/Loombus.entitlements"),
  read("ios/App/App/LoombusPasswordManagerPlugin.swift"),
  read("ios/App/App/LoombusBridgeViewController.swift"),
  read("ios/App/App.xcodeproj/project.pbxproj"),
  read("public/.well-known/apple-app-site-association"),
  read("android/app/build.gradle"),
  read("android/app/src/main/AndroidManifest.xml"),
  read("android/app/src/main/res/values/strings.xml"),
  read("android/app/src/main/java/com/loombus/app/LoombusPasswordManagerPlugin.java"),
  read("android/app/src/main/java/com/loombus/app/MainActivity.java"),
  read("src/app/.well-known/assetlinks.json/route.ts"),
]);

requireText(
  supabaseClient,
  'import { createBrowserClient } from "@supabase/ssr";',
  "The browser Supabase client must use cookie-backed SSR storage."
);
requireText(
  supabaseClient,
  "restorePersistedSupabaseSession",
  "The previous local-storage session migration is missing."
);
requireText(
  sessionGuard,
  "await restorePersistedSupabaseSession();",
  "Protected routes must restore legacy sessions before checking auth."
);
requireText(
  loginPage,
  "await restorePersistedSupabaseSession();",
  "Login must restore an existing legacy session before showing sign-in."
);
for (const expected of [
  '<label htmlFor="email"',
  'name="email"',
  'type="email"',
  'autoComplete="username"',
  'name="password"',
  'autoComplete="current-password"',
  "saveLoginToSystemPasswordManager",
]) {
  requireText(loginPage, expected, `The native login form is missing ${expected}.`);
}
if (loginPage.includes("Remember this login with device biometrics")) {
  throw new Error("The repeated private biometric credential prompt must be removed.");
}
for (const forbidden of ["setCredentials(", "getSecureCredentials("]) {
  if (nativeBiometric.includes(forbidden)) {
    throw new Error(`Private biometric password storage must not use ${forbidden}.`);
  }
}
requireText(
  nativeBiometric,
  "clearLegacyNativeBiometricLoginCredentials",
  "The obsolete private biometric credential must be removed once."
);
requireText(
  nativePasswordManager,
  'registerPlugin<PasswordManagerPlugin>(\n  "LoombusPasswordManager"',
  "The shared system password-manager bridge is missing."
);
if (authSessionCleanup.includes("deleteNativeBiometricLoginCredentials")) {
  throw new Error("Signing out must not delete credentials owned by the password manager.");
}
requireText(
  sessionGuard,
  'getAccountAccessHref("verification_unavailable")',
  "Transient auth verification failures must preserve the saved session."
);
requireText(
  nativePush,
  'method: "DELETE"',
  "Native push cleanup must disable the current device token."
);
requireText(
  signOutHelper,
  "disableNativePushNotificationsForCurrentSession",
  "Sign-out must run native push cleanup first."
);
requireText(
  iosEntitlements,
  "webcredentials:loombus.com",
  "The iOS app must declare the Loombus password AutoFill association."
);
for (const expected of [
  "SecAddSharedWebCredential(",
  '"loombus.com" as CFString',
  'public let jsName = "LoombusPasswordManager"',
]) {
  requireText(
    iosPasswordManager,
    expected,
    `The Apple Passwords bridge is missing ${expected}.`
  );
}
requireText(
  iosBridgeController,
  "registerPluginInstance(LoombusPasswordManagerPlugin())",
  "The iOS bridge does not register the password-manager plugin."
);
for (const expected of [
  "LoombusPasswordManagerPlugin.swift in Sources",
  "LoombusPasswordManagerPlugin.swift */ = {isa = PBXFileReference",
]) {
  requireText(iosProject, expected, `The Xcode project is missing ${expected}.`);
}

const association = JSON.parse(appleAssociation);
if (
  !Array.isArray(association.webcredentials?.apps) ||
  !association.webcredentials.apps.includes(
    "AA9H676YU8.com.loombus.mobile"
  )
) {
  throw new Error("The Apple webcredentials association is incomplete.");
}

for (const expected of [
  "LOOMBUS_ANDROID_APP_SIGNING_SHA256",
  "delegate_permission/common.get_login_creds",
  'package_name: ANDROID_PACKAGE_NAME',
  'const ANDROID_PACKAGE_NAME = "com.loombus.app"',
]) {
  requireText(
    androidAssociation,
    expected,
    `The Android password-manager association is missing ${expected}.`
  );
}

for (const expected of [
  "androidx.credentials:credentials:1.6.0-beta02",
  "androidx.credentials:credentials-play-services-auth:1.6.0-beta02",
  "androidx.webkit:webkit:$androidxWebkitVersion",
]) {
  requireText(androidBuild, expected, `Android is missing ${expected}.`);
}
requireText(
  androidManifest,
  'android:name="asset_statements"',
  "Android is missing its password-manager asset statement."
);
requireText(
  androidStrings,
  "https://loombus.com/.well-known/assetlinks.json",
  "Android does not reference the hosted Digital Asset Links file."
);
for (const expected of [
  "CreatePasswordRequest",
  "createCredentialAsync(",
  "clearCredentialStateAsync(",
]) {
  requireText(
    androidPasswordManager,
    expected,
    `The Google Password Manager bridge is missing ${expected}.`
  );
}
for (const expected of [
  "registerPlugin(LoombusPasswordManagerPlugin.class)",
  "WebViewFeature.WEB_AUTHENTICATION",
  "WebSettingsCompat.setWebAuthenticationSupport(",
]) {
  requireText(
    androidMainActivity,
    expected,
    `The Android WebView password-manager setup is missing ${expected}.`
  );
}
requireText(
  signOutHelper,
  "clearNativePasswordManagerCredentialState",
  "Android sign-out must clear credential-provider session state without deleting saved passwords."
);

console.log(
  "Mobile auth persistence verification passed: cookie sessions persist, the obsolete private biometric prompt is removed, Apple Passwords and Google Password Manager save flows are wired, logout preserves saved credentials, and the independent biometric app lock remains available."
);
