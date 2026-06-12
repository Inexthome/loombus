import { isNativeApp } from "@/lib/native-app";

export const BIOMETRIC_UNLOCK_ENABLED_KEY =
  "loombus:native-biometric-unlock-enabled";

export const BIOMETRIC_UNLOCK_SETTING_EVENT =
  "loombus:native-biometric-unlock-setting-changed";

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
