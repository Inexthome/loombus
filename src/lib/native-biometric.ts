import { isNativeApp } from "@/lib/native-app";

export const BIOMETRIC_UNLOCK_ENABLED_KEY =
  "loombus:native-biometric-unlock-enabled";

export const BIOMETRIC_UNLOCK_SETTING_EVENT =
  "loombus:native-biometric-unlock-setting-changed";

const BIOMETRIC_LOGIN_SERVER = "loombus.com";
const BIOMETRIC_LOGIN_EMAIL_KEY = "loombus:native-biometric-login-email";

type NativeBiometricModule = typeof import("@capgo/capacitor-native-biometric");

let nativeBiometricModulePromise: Promise<NativeBiometricModule> | null = null;

async function getNativeBiometricModule() {
  if (!nativeBiometricModulePromise) {
    nativeBiometricModulePromise = import("@capgo/capacitor-native-biometric");
  }

  return nativeBiometricModulePromise;
}

export function isBiometricUnlockEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(BIOMETRIC_UNLOCK_ENABLED_KEY) === "true";
}

export function setBiometricUnlockEnabled(enabled: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(BIOMETRIC_UNLOCK_ENABLED_KEY, "true");
  } else {
    window.localStorage.removeItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
  }

  window.dispatchEvent(new Event(BIOMETRIC_UNLOCK_SETTING_EVENT));
}

export function getRememberedBiometricLoginEmail() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(BIOMETRIC_LOGIN_EMAIL_KEY) ?? "";
}

export async function isNativeBiometricLoginSaved() {
  if (!isNativeApp()) {
    return false;
  }

  try {
    const { NativeBiometric } = await getNativeBiometricModule();
    const result = await NativeBiometric.isCredentialsSaved({
      server: BIOMETRIC_LOGIN_SERVER,
    });

    return Boolean(result.isSaved);
  } catch {
    return false;
  }
}

export async function saveNativeBiometricLoginCredentials(
  username: string,
  password: string
) {
  if (!isNativeApp()) {
    return {
      ok: false,
      error: "Face ID login is only available in the installed mobile app.",
    };
  }

  try {
    const { NativeBiometric, AccessControl } = await getNativeBiometricModule();

    const availability = await NativeBiometric.isAvailable({
      useFallback: true,
    });

    if (!availability.isAvailable) {
      return {
        ok: false,
        error:
          "Set up Face ID, Touch ID, fingerprint, or a device passcode before saving biometric sign-in.",
      };
    }

    await NativeBiometric.setCredentials({
      server: BIOMETRIC_LOGIN_SERVER,
      username,
      password,
      accessControl: AccessControl.BIOMETRY_ANY,
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(BIOMETRIC_LOGIN_EMAIL_KEY, username);
      window.localStorage.removeItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to save biometric sign-in on this device.",
    };
  }
}

export async function getNativeBiometricLoginCredentials() {
  if (!isNativeApp()) {
    return {
      ok: false,
      error: "Face ID login is only available in the installed mobile app.",
    };
  }

  try {
    const { NativeBiometric } = await getNativeBiometricModule();
    const credentials = await NativeBiometric.getSecureCredentials({
      server: BIOMETRIC_LOGIN_SERVER,
      reason: "Sign in to Loombus.",
      title: "Sign in to Loombus",
      subtitle: "Use Face ID, fingerprint, or device passcode.",
      description: "Loombus will use your saved login for this device.",
      negativeButtonText: "Cancel",
    });

    return {
      ok: true,
      username: credentials.username,
      password: credentials.password,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to unlock saved biometric sign-in.",
    };
  }
}

export async function deleteNativeBiometricLoginCredentials() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(BIOMETRIC_LOGIN_EMAIL_KEY);
    window.localStorage.removeItem(BIOMETRIC_UNLOCK_ENABLED_KEY);
    window.dispatchEvent(new Event(BIOMETRIC_UNLOCK_SETTING_EVENT));
  }

  if (!isNativeApp()) {
    return;
  }

  try {
    const { NativeBiometric } = await getNativeBiometricModule();
    await NativeBiometric.deleteCredentials({
      server: BIOMETRIC_LOGIN_SERVER,
    });
  } catch {
    // Ignore cleanup failures. Local display state is still cleared above.
  }
}

export async function getNativeBiometricAvailability() {
  if (!isNativeApp()) {
    return {
      isNative: false,
      isAvailable: false,
      deviceIsSecure: false,
      biometryType: "none",
    };
  }

  try {
    const { NativeBiometric } = await getNativeBiometricModule();
    const result = await NativeBiometric.isAvailable({
      useFallback: true,
    });

    return {
      isNative: true,
      isAvailable: Boolean(result.isAvailable),
      deviceIsSecure: Boolean(result.deviceIsSecure),
      biometryType: String(result.biometryType ?? "unknown"),
    };
  } catch {
    return {
      isNative: true,
      isAvailable: false,
      deviceIsSecure: false,
      biometryType: "unknown",
    };
  }
}

export async function verifyNativeBiometric(reason = "Unlock Loombus") {
  if (!isNativeApp()) {
    return { ok: true, skipped: true };
  }

  try {
    const { NativeBiometric } = await getNativeBiometricModule();

    const availability = await NativeBiometric.isAvailable({
      useFallback: true,
    });

    if (!availability.isAvailable) {
      return {
        ok: false,
        skipped: false,
        error: "Biometric or device unlock is not available on this device.",
      };
    }

    await NativeBiometric.verifyIdentity({
      reason,
      title: "Unlock Loombus",
      subtitle: "Confirm it is you to continue.",
      description: "Loombus is locked on this device.",
      negativeButtonText: "Cancel",
      useFallback: true,
      fallbackTitle: "Use Passcode",
      maxAttempts: 3,
    });

    return { ok: true, skipped: false };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to verify your identity.",
    };
  }
}
