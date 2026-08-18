"use client";

import {
  Bell,
  Camera,
  Images,
  MapPin,
  RefreshCw,
  ScanFace,
  ShieldBan,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getNativePlatform } from "@/lib/native-app";
import { getNativeBiometricAvailability } from "@/lib/native-biometric";

type PermissionValue =
  | "granted"
  | "limited"
  | "denied"
  | "prompt"
  | "prompt-with-rationale"
  | "selected-only"
  | "not-used"
  | "unavailable"
  | "checking";

type PermissionKind = "location" | "camera" | "photos" | "notifications";

type PermissionState = {
  location: PermissionValue;
  camera: PermissionValue;
  photos: PermissionValue;
  notifications: PermissionValue;
  biometrics: PermissionValue;
  tracking: PermissionValue;
};

const INITIAL_PERMISSIONS: PermissionState = {
  location: "checking",
  camera: "checking",
  photos: "checking",
  notifications: "checking",
  biometrics: "checking",
  tracking: "not-used",
};

const PERMISSION_LABELS: Record<PermissionValue, string> = {
  granted: "Allowed",
  limited: "Limited access",
  denied: "Not allowed",
  prompt: "Not requested",
  "prompt-with-rationale": "Permission needed",
  "selected-only": "Selected media only",
  "not-used": "Not used",
  unavailable: "Unavailable",
  checking: "Checking…",
};

function normalizePermission(value: unknown): PermissionValue {
  if (
    value === "granted" ||
    value === "limited" ||
    value === "denied" ||
    value === "prompt" ||
    value === "prompt-with-rationale"
  ) {
    return value;
  }

  return "unavailable";
}

function PermissionRow({
  title,
  description,
  value,
  Icon,
  actionLabel,
  disabled,
  onAction,
}: {
  title: string;
  description: string;
  value: PermissionValue;
  Icon: LucideIcon;
  actionLabel?: string;
  disabled?: boolean;
  onAction?: () => void;
}) {
  const allowed = value === "granted" || value === "limited";

  return (
    <section className="privacy-security-v2-boundary">
      <span className="inline-flex items-center gap-2">
        <Icon aria-hidden="true" size={15} />
        {title}
      </span>
      <strong>{PERMISSION_LABELS[value]}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={disabled || allowed}
          className="privacy-security-v2-secondary mt-3"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export function NativeAppPermissionsCard() {
  const [platform] = useState(() => getNativePlatform());
  const [permissions, setPermissions] =
    useState<PermissionState>(INITIAL_PERMISSIONS);
  const [working, setWorking] = useState<PermissionKind | "refresh" | null>(
    null
  );
  const [message, setMessage] = useState("");

  const loadPermissions = useCallback(async () => {
    if (platform !== "ios" && platform !== "android") {
      return;
    }

    const [locationResult, cameraResult, pushResult, biometricResult] =
      await Promise.allSettled([
        import("@capacitor/geolocation").then(({ Geolocation }) =>
          Geolocation.checkPermissions()
        ),
        import("@capacitor/camera").then(({ Camera }) =>
          Camera.checkPermissions()
        ),
        import("@capacitor/push-notifications").then(({ PushNotifications }) =>
          PushNotifications.checkPermissions()
        ),
        getNativeBiometricAvailability(),
      ]);

    const location =
      locationResult.status === "fulfilled"
        ? normalizePermission(
            locationResult.value.coarseLocation === "granted"
              ? "granted"
              : locationResult.value.coarseLocation
          )
        : "unavailable";
    const camera =
      cameraResult.status === "fulfilled"
        ? normalizePermission(cameraResult.value.camera)
        : "unavailable";
    const photos =
      platform === "android"
        ? "selected-only"
        : cameraResult.status === "fulfilled"
          ? normalizePermission(cameraResult.value.photos)
          : "unavailable";
    const notifications =
      pushResult.status === "fulfilled"
        ? normalizePermission(pushResult.value.receive)
        : "unavailable";
    const biometrics =
      biometricResult.status === "fulfilled" &&
      biometricResult.value.isAvailable
        ? "granted"
        : "unavailable";

    setPermissions({
      location,
      camera,
      photos,
      notifications,
      biometrics,
      tracking: "not-used",
    });
  }, [platform]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPermissions(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPermissions]);

  async function requestPermission(kind: PermissionKind) {
    if (working) return;

    setWorking(kind);
    setMessage("");

    try {
      if (kind === "location") {
        const { Geolocation } = await import("@capacitor/geolocation");
        await Geolocation.requestPermissions({
          permissions: ["coarseLocation"],
        });
      } else if (kind === "notifications") {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );
        await PushNotifications.requestPermissions();
      } else {
        const { Camera } = await import("@capacitor/camera");
        await Camera.requestPermissions({ permissions: [kind] });
      }

      await loadPermissions();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The device permission could not be updated."
      );
    } finally {
      setWorking(null);
    }
  }

  async function refreshPermissions() {
    if (working) return;
    setWorking("refresh");
    setMessage("");
    await loadPermissions();
    setWorking(null);
  }

  if (platform !== "ios" && platform !== "android") {
    return null;
  }

  return (
    <article className="privacy-security-v2-card">
      <header className="privacy-security-v2-card-header">
        <div className="privacy-security-v2-card-header-copy">
          <span className="privacy-security-v2-icon">
            <Smartphone aria-hidden="true" />
          </span>
          <div>
            <h2>Mobile app permissions</h2>
            <p>
              Review what Loombus can access on this {platform === "ios" ? "iPhone or iPad" : "Android device"}. Permissions are requested only when you choose the related feature.
            </p>
          </div>
        </div>
        <span className="privacy-security-v2-badge is-good">
          <Smartphone aria-hidden="true" size={14} />
          {platform === "ios" ? "iOS app" : "Android app"}
        </span>
      </header>

      <div className="privacy-security-v2-boundary-grid">
        <PermissionRow
          title="Approximate location"
          description="Used only after you choose a nearby or Local feature. Loombus does not continuously track your location."
          value={permissions.location}
          Icon={MapPin}
          actionLabel={working === "location" ? "Requesting…" : "Allow location"}
          disabled={Boolean(working)}
          onAction={() => void requestPermission("location")}
        />
        <PermissionRow
          title="Camera"
          description="Used only when you choose to capture a profile image or an attachment."
          value={permissions.camera}
          Icon={Camera}
          actionLabel={working === "camera" ? "Requesting…" : "Allow camera"}
          disabled={Boolean(working)}
          onAction={() => void requestPermission("camera")}
        />
        <PermissionRow
          title="Photos and videos"
          description={
            platform === "android"
              ? "Android provides the system Photo Picker so you can share only the media you select."
              : "You can grant limited access to selected media or allow the full photo library."
          }
          value={permissions.photos}
          Icon={Images}
          actionLabel={
            platform === "ios"
              ? working === "photos"
                ? "Requesting…"
                : "Allow photos"
              : undefined
          }
          disabled={Boolean(working)}
          onAction={
            platform === "ios"
              ? () => void requestPermission("photos")
              : undefined
          }
        />
        <PermissionRow
          title="Notifications"
          description="Used for replies, messages, Room activity, reminders, and other signals you enable."
          value={permissions.notifications}
          Icon={Bell}
          actionLabel={
            working === "notifications" ? "Requesting…" : "Allow notifications"
          }
          disabled={Boolean(working)}
          onAction={() => void requestPermission("notifications")}
        />
        <PermissionRow
          title="Face ID or device biometrics"
          description="Used locally to protect a remembered Loombus session. Biometric templates never go to Loombus."
          value={permissions.biometrics}
          Icon={ScanFace}
        />
        <PermissionRow
          title="Cross-app tracking"
          description="Loombus does not currently use cross-app advertising tracking, so no tracking permission is requested."
          value={permissions.tracking}
          Icon={ShieldBan}
        />
      </div>

      <div className="privacy-security-v2-inline-actions">
        <button
          type="button"
          onClick={() => void refreshPermissions()}
          disabled={Boolean(working)}
          className="privacy-security-v2-secondary"
        >
          <RefreshCw aria-hidden="true" size={16} />
          {working === "refresh" ? "Checking…" : "Refresh permission status"}
        </button>
      </div>

      {message ? (
        <p className="privacy-security-v2-copy" role="status">
          {message}
        </p>
      ) : null}
    </article>
  );
}
