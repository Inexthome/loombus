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
  nativePush,
  signOutHelper,
  iosEntitlements,
  appleAssociation,
  androidAssociation,
] = await Promise.all([
  read("src/lib/supabase/client.ts"),
  read("src/components/session-lifecycle-guard.tsx"),
  read("src/app/login/page.tsx"),
  read("src/lib/native-push.ts"),
  read("src/lib/auth-sign-out.ts"),
  read("ios/App/Loombus.entitlements"),
  read("public/.well-known/apple-app-site-association"),
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
requireText(
  loginPage,
  "Remember this login with device biometrics on this device?",
  "Saved-login copy must work for both iOS and Android biometrics."
);
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

console.log(
  "Mobile auth persistence verification passed: cookie sessions, legacy migration, transient-error preservation, push cleanup, iOS webcredentials, and Android credential association are present."
);
