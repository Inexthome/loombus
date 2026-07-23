export type RoomRequiredBehavior = "private_support_threads";

export type RoomThreadVisibilityScope = "room" | "author_and_staff";

const CUSTOMER_SUPPORT_ROOM_TYPES = new Set([
  "customer_support",
  "customer-support",
]);

function normalizeRoomType(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/\s+/g, "_")
    : "";
}

export function isCustomerSupportRoomType(value: unknown) {
  return CUSTOMER_SUPPORT_ROOM_TYPES.has(normalizeRoomType(value));
}

export function getRoomRequiredBehaviors(
  roomType: unknown
): readonly RoomRequiredBehavior[] {
  return isCustomerSupportRoomType(roomType)
    ? (["private_support_threads"] as const)
    : [];
}

export function hasRoomRequiredBehavior(
  roomType: unknown,
  behavior: RoomRequiredBehavior
) {
  return getRoomRequiredBehaviors(roomType).includes(behavior);
}

export function getRequiredRoomThreadVisibility(
  roomType: unknown
): RoomThreadVisibilityScope {
  return isCustomerSupportRoomType(roomType) ? "author_and_staff" : "room";
}
