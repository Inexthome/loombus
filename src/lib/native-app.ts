export function isIosNativeApp() {
  if (typeof window === "undefined") {
    return false;
  }

  const capacitor = (
    window as Window & {
      Capacitor?: {
        getPlatform?: () => string;
        isNativePlatform?: () => boolean;
      };
    }
  ).Capacitor;

  return Boolean(
    capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "ios"
  );
}
