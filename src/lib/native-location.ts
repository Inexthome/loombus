import { isNativeApp } from "@/lib/native-app";

export type ApproximateLocation = {
  latitude: number;
  longitude: number;
};

const LOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 300_000,
} as const;

function getBrowserLocation() {
  return new Promise<ApproximateLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This device does not provide current-location access."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        reject(new Error("Current location was not shared."));
      },
      LOCATION_OPTIONS
    );
  });
}

export async function getCurrentApproximateLocation() {
  if (!isNativeApp()) {
    return getBrowserLocation();
  }

  const { Geolocation } = await import("@capacitor/geolocation");
  let permissions = await Geolocation.checkPermissions();

  if (
    permissions.coarseLocation !== "granted" &&
    permissions.location !== "granted"
  ) {
    permissions = await Geolocation.requestPermissions({
      permissions: ["coarseLocation"],
    });
  }

  if (
    permissions.coarseLocation !== "granted" &&
    permissions.location !== "granted"
  ) {
    throw new Error("Current location permission was not granted.");
  }

  const position = await Geolocation.getCurrentPosition(LOCATION_OPTIONS);

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  };
}
