import fs from "node:fs";

const files = {
  packageSwift: "ios/App/CapApp-SPM/Package.swift",
  plugin: "ios/App/CapApp-SPM/Sources/CapApp-SPM/LoombusGoogleAuthPlugin.swift",
  bridgeController: "ios/App/App/LoombusBridgeViewController.swift",
  appDelegate: "ios/App/App/AppDelegate.swift",
  clientBridge: "src/lib/native-google-auth.ts",
  login: "src/app/login/page.tsx",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing required native Google Sign-In file: ${path}`);
  }
}

const packageSwift = fs.readFileSync(files.packageSwift, "utf8");
const plugin = fs.readFileSync(files.plugin, "utf8");
const bridgeController = fs.readFileSync(files.bridgeController, "utf8");
const appDelegate = fs.readFileSync(files.appDelegate, "utf8");
const clientBridge = fs.readFileSync(files.clientBridge, "utf8");
const login = fs.readFileSync(files.login, "utf8");

const requiredChecks = [
  [packageSwift.includes("GoogleSignIn-iOS"), "GoogleSignIn-iOS Swift package is missing."],
  [packageSwift.includes('.product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")'), "GoogleSignIn Swift product is not linked."],
  [plugin.includes("GIDSignIn.sharedInstance.signIn"), "Native plugin does not launch Google Sign-In."],
  [plugin.includes("GIDClientID"), "Native plugin does not require the iOS Google client ID."],
  [plugin.includes("GIDServerClientID"), "Native plugin does not support the server/web Google client ID."],
  [plugin.includes("handleLoombusGoogleSignInURL"), "Native plugin does not expose the Google callback handler."],
  [bridgeController.includes("import CapApp_SPM"), "Bridge controller does not import the native package module."],
  [bridgeController.includes("registerPluginInstance(LoombusGoogleAuthPlugin())"), "Bridge controller does not register native Google auth."],
  [appDelegate.includes("handleLoombusGoogleSignInURL(url)"), "App delegate does not route Google callback URLs."],
  [clientBridge.includes('registerPlugin<LoombusGoogleAuthPlugin>("LoombusGoogleAuth")'), "TypeScript native Google plugin is not registered."],
  [clientBridge.includes("unavailable:"), "Native client bridge does not preserve old-build fallback behavior."],
  [login.includes("signInWithNativeGoogle"), "Login page does not invoke native Google Sign-In."],
  [login.includes("signInWithIdToken"), "Login page does not exchange the Google ID token with Supabase."],
  [login.includes("signInWithOAuth"), "Existing web/old-build OAuth fallback is missing."],
  [login.includes('provider === "google" && isIosNativeApp()'), "Native Google path is not scoped to iOS."],
];

for (const [passes, message] of requiredChecks) {
  if (!passes) {
    throw new Error(message);
  }
}

const googleCallbackIndex = appDelegate.indexOf("handleLoombusGoogleSignInURL(url)");
const loombusCallbackIndex = appDelegate.indexOf("handleLoombusAuthCallback(url)");
if (googleCallbackIndex < 0 || loombusCallbackIndex < 0 || googleCallbackIndex > loombusCallbackIndex) {
  throw new Error("Google callback routing must run before the Loombus custom callback handler.");
}

console.log("iOS native Google Sign-In structural verification passed.");
