import { registerPlugin } from "@capacitor/core";
import { getNativePlatform } from "@/lib/native-app";

export type LiveAppointmentItem = {
  id: string;
  title: string;
  context: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
};

type LiveUpdateStatus = {
  supported: boolean;
  reason?: string;
  promotionEnabled?: boolean;
  activeAppointmentIds: string[];
};

type AppointmentInput = {
  appointmentId: string;
  title: string;
  context: string;
  status: string;
  startsAt: number;
  endsAt: number;
  href: string;
};

type LoombusLiveUpdatesPlugin = {
  getStatus(): Promise<LiveUpdateStatus>;
  startAppointment(input: AppointmentInput): Promise<{
    activityId: string;
    promotionEnabled?: boolean;
  }>;
  updateAppointment(input: AppointmentInput): Promise<{ updated?: number }>;
  endAppointment(input: { appointmentId: string }): Promise<{ ended?: number }>;
  endAllAppointments(): Promise<{ ended?: number }>;
  openSettings(): Promise<void>;
  setNotificationBadgeCount(input: { count: number }): Promise<{
    count?: number;
    applied?: boolean;
  }>;
};

const LiveUpdates = registerPlugin<LoombusLiveUpdatesPlugin>(
  "LoombusLiveUpdates"
);

const TERMINAL_STATUSES = new Set(["cancelled", "completed", "declined"]);
const ELIGIBLE_STATUSES = new Set(["accepted", "approved", "confirmed"]);
const START_WINDOW_MS = 60 * 60 * 1000;

export async function setNativeNotificationBadgeCount(count: number) {
  const platform = getNativePlatform();
  const normalizedCount = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));

  if (platform !== "ios" && platform !== "android") {
    return { count: normalizedCount, applied: false };
  }

  return LiveUpdates.setNotificationBadgeCount({ count: normalizedCount });
}

export async function getAppointmentLiveUpdateStatus() {
  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") {
    return {
      supported: false,
      reason: "Live appointment updates are available in the mobile app.",
      activeAppointmentIds: [],
    } satisfies LiveUpdateStatus;
  }

  return LiveUpdates.getStatus();
}

function timestamps(item: LiveAppointmentItem) {
  return {
    startsAt: Date.parse(item.startsAt),
    endsAt: item.endsAt ? Date.parse(item.endsAt) : Number.NaN,
  };
}

export function isEligibleForLiveUpdate(
  item: LiveAppointmentItem,
  now = Date.now()
) {
  if (!ELIGIBLE_STATUSES.has(item.status)) return false;
  const { startsAt, endsAt } = timestamps(item);
  return (
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    startsAt <= now + START_WINDOW_MS &&
    endsAt > now
  );
}

function nativeInput(item: LiveAppointmentItem): AppointmentInput {
  const { startsAt, endsAt } = timestamps(item);
  return {
    appointmentId: item.id,
    title: item.title,
    context: item.context,
    status: "Appointment live",
    startsAt,
    endsAt,
    href: "loombus://appointments",
  };
}

export async function startAppointmentLiveUpdate(item: LiveAppointmentItem) {
  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") {
    throw new Error("Live appointment updates are available in the mobile app.");
  }
  if (!isEligibleForLiveUpdate(item)) {
    throw new Error(
      "Live updates become available one hour before an accepted appointment."
    );
  }

  const status = await getAppointmentLiveUpdateStatus();
  if (!status.supported) {
    throw new Error(
      status.reason || "Live appointment updates are disabled in device settings."
    );
  }

  return LiveUpdates.startAppointment(nativeInput(item));
}

export async function reconcileAppointmentLiveUpdates(
  items: LiveAppointmentItem[]
) {
  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") return [];

  const status = await LiveUpdates.getStatus();
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const remainingActiveIds: string[] = [];

  await Promise.all(
    status.activeAppointmentIds.map(async (appointmentId) => {
      const item = itemsById.get(appointmentId);
      if (
        !item ||
        TERMINAL_STATUSES.has(item.status) ||
        !isEligibleForLiveUpdate(item)
      ) {
        await LiveUpdates.endAppointment({ appointmentId });
        return;
      }

      await LiveUpdates.updateAppointment(nativeInput(item));
      remainingActiveIds.push(appointmentId);
    })
  );

  return remainingActiveIds;
}

export async function endAllAppointmentLiveUpdates() {
  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") return { ended: 0 };
  return LiveUpdates.endAllAppointments();
}

export async function openAppointmentLiveUpdateSettings() {
  const platform = getNativePlatform();
  if (platform !== "ios" && platform !== "android") return;
  await LiveUpdates.openSettings();
}
