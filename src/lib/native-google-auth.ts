import { registerPlugin } from "@capacitor/core";
import { isIosNativeApp } from "@/lib/native-app";

type NativeGoogleSignInResult = {
  idToken: string;
  accessToken?: string;
};

type LoombusGoogleAuthPlugin = {
  signIn: () => Promise<NativeGoogleSignInResult>;
};

const LoombusGoogleAuth = registerPlugin<LoombusGoogleAuthPlugin>("LoombusGoogleAuth");

function isUnavailablePluginError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not implemented") ||
    normalized.includes("not available") ||
    normalized.includes("does not have an implementation") ||
    normalized.includes("plugin is not implemented")
  );
}

export async function signInWithNativeGoogle() {
  if (!isIosNativeApp()) {
    return {
      ok: false as const,
      unavailable: true as const,
      error: "Native Google Sign-In is only available in the iOS app.",
    };
  }

  try {
    const result = await LoombusGoogleAuth.signIn();

    if (!result?.idToken) {
      return {
        ok: false as const,
        unavailable: false as const,
        error: "Google did not return an ID token.",
      };
    }

    return {
      ok: true as const,
      idToken: result.idToken,
      accessToken: result.accessToken,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Native Google Sign-In failed.";

    return {
      ok: false as const,
      unavailable: isUnavailablePluginError(message),
      error: message,
    };
  }
}
