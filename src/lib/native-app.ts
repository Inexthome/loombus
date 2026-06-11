type CapacitorRuntime = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

function getCapacitorRuntime() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window as Window & {
      Capacitor?: CapacitorRuntime;
    }
  ).Capacitor ?? null;
}

export function getNativePlatform() {
  const capacitor = getCapacitorRuntime();

  if (!capacitor?.isNativePlatform?.()) {
    return "web";
  }

  const platform = capacitor.getPlatform?.();

  if (platform === "ios" || platform === "android") {
    return platform;
  }

  return "unknown";
}

export function isNativeApp() {
  const platform = getNativePlatform();
  return platform === "ios" || platform === "android";
}

export function isIosNativeApp() {
  return getNativePlatform() === "ios";
}

export function isAndroidNativeApp() {
  return getNativePlatform() === "android";
}
