export type RoomPlanKey =
  | "free"
  | "starter"
  | "pro"
  | "organization"
  | "organization-plus"
  | "enterprise";

export type RoomPlanEntitlements = {
  id: RoomPlanKey;
  label: string;
  roomLimit: number | null;
  memberLimit: number | null;
  fileUploads: boolean;
  inlineVideo: boolean;
  maxFileBytes: number;
  storageBytes: number;
  features: string[];
};

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

export const ROOM_PLAN_ENTITLEMENTS: Record<
  RoomPlanKey,
  RoomPlanEntitlements
> = {
  free: {
    id: "free",
    label: "Free Room",
    roomLimit: 1,
    memberLimit: 10,
    fileUploads: false,
    inlineVideo: false,
    maxFileBytes: 0,
    storageBytes: 0,
    features: [
      "One private Room",
      "Discussions, announcements, and calendar",
      "Owner, administrator, moderator, and member roles",
      "Links in the Resources area",
    ],
  },
  starter: {
    id: "starter",
    label: "Room Starter",
    roomLimit: 1,
    memberLimit: 50,
    fileUploads: true,
    inlineVideo: false,
    maxFileBytes: 25 * MIB,
    storageBytes: 2 * GIB,
    features: [
      "Everything in Free",
      "Private files and image resources",
      "25 MB maximum per upload",
      "2 GB Room resource storage",
    ],
  },
  pro: {
    id: "pro",
    label: "Room Pro",
    roomLimit: 1,
    memberLimit: 250,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 100 * MIB,
    storageBytes: 10 * GIB,
    features: [
      "Everything in Starter",
      "Inline video resources",
      "100 MB maximum per upload",
      "10 GB Room resource storage",
      "Priority and pinned announcements",
    ],
  },
  organization: {
    id: "organization",
    label: "Organization",
    roomLimit: 3,
    memberLimit: 500,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 250 * MIB,
    storageBytes: 50 * GIB,
    features: [
      "Everything in Pro",
      "Up to 3 Rooms",
      "250 MB maximum per upload",
      "50 GB resource storage per Room",
      "Organization controls and setup support",
    ],
  },
  "organization-plus": {
    id: "organization-plus",
    label: "Organization Plus",
    roomLimit: 10,
    memberLimit: 2000,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 500 * MIB,
    storageBytes: 250 * GIB,
    features: [
      "Everything in Organization",
      "Up to 10 Rooms",
      "500 MB maximum per upload",
      "250 GB resource storage per Room",
      "Advanced setup and priority support",
    ],
  },
  enterprise: {
    id: "enterprise",
    label: "Organization Enterprise",
    roomLimit: null,
    memberLimit: null,
    fileUploads: true,
    inlineVideo: true,
    maxFileBytes: 1024 * MIB,
    storageBytes: 1024 * GIB,
    features: [
      "Everything in Organization Plus",
      "Custom Room and membership limits",
      "1 GB maximum per upload",
      "1 TB resource storage per Room",
      "Dedicated support and custom onboarding",
    ],
  },
};

export function isRoomPlanKey(value: unknown): value is RoomPlanKey {
  return typeof value === "string" && value in ROOM_PLAN_ENTITLEMENTS;
}

export function normalizeRoomPlanKey(value: unknown): RoomPlanKey {
  return isRoomPlanKey(value) ? value : "free";
}

export function roomSubscriptionIsActive(status: unknown) {
  const normalized = typeof status === "string" ? status.toLowerCase() : "active";
  return ["active", "trialing"].includes(normalized);
}

export function getRoomPlanEntitlements(
  plan: unknown,
  subscriptionStatus: unknown = "active"
) {
  const normalizedPlan = normalizeRoomPlanKey(plan);
  if (
    normalizedPlan !== "free" &&
    !roomSubscriptionIsActive(subscriptionStatus)
  ) {
    return ROOM_PLAN_ENTITLEMENTS.free;
  }
  return ROOM_PLAN_ENTITLEMENTS[normalizedPlan];
}

export function formatRoomBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";
  if (bytes >= GIB) {
    const value = bytes / GIB;
    return `${Number.isInteger(value) ? value : value.toFixed(1)} GB`;
  }
  const value = bytes / MIB;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} MB`;
}
