import "server-only";

import { randomUUID } from "node:crypto";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getRoomPlanEntitlements,
  type RoomPlanKey,
} from "@/lib/room-plan-entitlements";
import {
  asString,
  createRoomServiceSupabase,
  type RoomRow,
} from "@/lib/room-operations";

type IncludedRoomInput = {
  userId: string;
  roomName: string;
  description: string;
  modelId: string;
  planKey: RoomPlanKey;
};

type SubscriptionGroup = {
  subscriptionId: string;
  rooms: RoomRow[];
};

export type IncludedPlanAvailability = {
  available: boolean;
  usedRooms: number;
  roomLimit: number | null;
};

function getNormalizedRoomType(modelId: string) {
  if (modelId === "business-team") return "business";
  if (modelId === "residents") return "residents";
  if (modelId === "classroom") return "classroom";
  if (modelId === "customer-support") return "customer_support";
  return "community";
}

function activeSubscriptionGroups(rows: RoomRow[]) {
  const groups = new Map<string, RoomRow[]>();
  for (const row of rows) {
    const subscriptionId = asString(row.stripe_subscription_id);
    if (!subscriptionId) continue;
    const current = groups.get(subscriptionId) ?? [];
    current.push(row);
    groups.set(subscriptionId, current);
  }
  return Array.from(groups, ([subscriptionId, rooms]) => ({
    subscriptionId,
    rooms,
  }));
}

async function loadOwnedActivePlanRooms(userId: string, planKey: RoomPlanKey) {
  const serviceSupabase = createRoomServiceSupabase();
  const result = await serviceSupabase
    .from("rooms")
    .select("*")
    .eq("subscription_plan", planKey)
    .in("subscription_status", ["active", "trialing"])
    .eq("status", "active")
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new Error("Room subscription capacity could not be verified.");
  }
  return (result.data ?? []) as RoomRow[];
}

function groupWithCapacity(
  groups: SubscriptionGroup[],
  roomLimit: number | null
) {
  if (roomLimit === 1) return null;
  return (
    groups.find((group) => roomLimit === null || group.rooms.length < roomLimit) ??
    null
  );
}

export async function getIncludedRoomPlanAvailability(
  userId: string,
  planKey: RoomPlanKey
): Promise<IncludedPlanAvailability> {
  const entitlement = getRoomPlanEntitlements(planKey, "active");
  if (entitlement.roomLimit === 1) {
    return { available: false, usedRooms: 0, roomLimit: 1 };
  }

  const rows = await loadOwnedActivePlanRooms(userId, planKey);
  const groups = activeSubscriptionGroups(rows);
  const availableGroup = groupWithCapacity(groups, entitlement.roomLimit);
  const mostUsed = groups.reduce(
    (maximum, group) => Math.max(maximum, group.rooms.length),
    0
  );

  return {
    available: Boolean(availableGroup),
    usedRooms: availableGroup?.rooms.length ?? mostUsed,
    roomLimit: entitlement.roomLimit,
  };
}

export async function getIncludedRoomPlans(userId: string) {
  const planKeys: RoomPlanKey[] = [
    "organization",
    "organization-plus",
    "enterprise",
  ];
  const entries = await Promise.all(
    planKeys.map(async (planKey) => [
      planKey,
      await getIncludedRoomPlanAvailability(userId, planKey),
    ] as const)
  );
  return Object.fromEntries(entries) as Partial<
    Record<RoomPlanKey, IncludedPlanAvailability>
  >;
}

export async function freeRoomIsAvailable(userId: string) {
  const activeFreeRooms = await loadOwnedActivePlanRooms(userId, "free");
  return activeFreeRooms.length === 0;
}

async function ensureOwnerMembership(roomId: string, userId: string) {
  const serviceSupabase = createRoomServiceSupabase();
  const now = new Date().toISOString();
  const result = await serviceSupabase.from("room_members").upsert(
    {
      room_id: roomId,
      user_id: userId,
      role: "owner",
      status: "active",
      joined_at: now,
      updated_at: now,
    },
    { onConflict: "room_id,user_id" }
  );
  if (result.error) {
    throw new Error("The included Room owner membership could not be created.");
  }
}

export async function provisionIncludedRoom(input: IncludedRoomInput) {
  const entitlement = getRoomPlanEntitlements(input.planKey, "active");
  if (entitlement.roomLimit === 1) return null;

  const existingRows = await loadOwnedActivePlanRooms(
    input.userId,
    input.planKey
  );
  const group = groupWithCapacity(
    activeSubscriptionGroups(existingRows),
    entitlement.roomLimit
  );
  if (!group) return null;

  const anchor = group.rooms[0];
  if (!anchor) return null;

  const roomId = randomUUID();
  const now = new Date().toISOString();
  const serviceSupabase = createRoomServiceSupabase();
  const inserted = await serviceSupabase.from("rooms").insert({
    id: roomId,
    name: input.roomName,
    description: input.description,
    room_type: getNormalizedRoomType(input.modelId),
    visibility: "private",
    status: "active",
    owner_id: input.userId,
    created_by: input.userId,
    template_key: input.modelId,
    subscription_plan: input.planKey,
    subscription_status: asString(anchor.subscription_status) || "active",
    member_limit: entitlement.memberLimit,
    invite_only: true,
    stripe_customer_id: asString(anchor.stripe_customer_id) || null,
    stripe_subscription_id: group.subscriptionId,
    stripe_price_id: asString(anchor.stripe_price_id) || null,
    stripe_checkout_session_id:
      asString(anchor.stripe_checkout_session_id) || null,
    stripe_current_period_end:
      asString(anchor.stripe_current_period_end) || null,
    billing_updated_at: now,
  });

  if (inserted.error) {
    throw new Error("The included Room could not be provisioned.");
  }

  try {
    await ensureOwnerMembership(roomId, input.userId);
  } catch (error) {
    await serviceSupabase.from("rooms").delete().eq("id", roomId);
    throw error;
  }

  await logAuditEvent({
    actor_id: input.userId,
    action: "room.provisioned.included",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_plan: input.planKey,
      room_model: input.modelId,
      stripe_subscription_id: group.subscriptionId,
      included_room_number: group.rooms.length + 1,
      room_limit: entitlement.roomLimit ?? "custom",
    },
  });

  return {
    roomId,
    includedInSubscription: true,
    usedRooms: group.rooms.length + 1,
    roomLimit: entitlement.roomLimit,
  };
}
