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
    return {
      ok: false as const,
      unavailable: false as const,
      error: error instanceof Error ? error.message : "Native Google Sign-In failed.",
    };
  }
}
