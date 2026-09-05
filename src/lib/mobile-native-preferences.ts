export type MobileNativePreferences = {
  hapticFeedbackEnabled: boolean;
  liveAppointmentUpdatesEnabled: boolean;
};

const STORAGE_KEY = "loombus:mobile-native-preferences";

export const DEFAULT_MOBILE_NATIVE_PREFERENCES: MobileNativePreferences = {
  hapticFeedbackEnabled: true,
  liveAppointmentUpdatesEnabled: true,
};

export function getMobileNativePreferences(): MobileNativePreferences {
  if (typeof window === "undefined") {
    return DEFAULT_MOBILE_NATIVE_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MOBILE_NATIVE_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<MobileNativePreferences>;
    return {
      hapticFeedbackEnabled:
        typeof parsed.hapticFeedbackEnabled === "boolean"
          ? parsed.hapticFeedbackEnabled
          : true,
      liveAppointmentUpdatesEnabled:
        typeof parsed.liveAppointmentUpdatesEnabled === "boolean"
          ? parsed.liveAppointmentUpdatesEnabled
          : true,
    };
  } catch {
    return DEFAULT_MOBILE_NATIVE_PREFERENCES;
  }
}

export function setMobileNativePreferences(
  next: MobileNativePreferences
): MobileNativePreferences {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent("loombus:mobile-native-preferences-changed", {
        detail: next,
      })
    );
  }
  return next;
}

export function isHapticFeedbackEnabled() {
  return getMobileNativePreferences().hapticFeedbackEnabled;
}

export function areLiveAppointmentUpdatesEnabled() {
  return getMobileNativePreferences().liveAppointmentUpdatesEnabled;
}
