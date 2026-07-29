import "server-only";

import { randomUUID } from "node:crypto";
import { logAuditEvent } from "@/lib/audit-log";
import { createRoomServiceSupabase } from "@/lib/room-operations";
import {
  getRoomPlanEntitlements,
  isRoomPlanKey,
  normalizeRoomPlanKey,
} from "@/lib/room-plan-entitlements";

export type AdministratorRoomSetupInput = {
  userId: string;
  roomName: string;
  description: string;
  modelId: string;
  planKey: string;
};

function normalizedRoomType(modelId: string) {
  if (modelId === "business-team") return "business";
  if (modelId === "residents") return "residents";
  if (modelId === "classroom") return "classroom";
  if (modelId === "customer-support") return "customer_support";
  return "community";
}

async function ensureOwnerMembership(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const now = new Date().toISOString();
  const result = await service.from("room_members").upsert(
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
    throw new Error("The administrator Room owner membership could not be created.");
  }
}

export async function administratorRoomIsComped(
  roomId: string,
  userId: string
) {
  const service = createRoomServiceSupabase();
  const result = await service
    .from("rooms")
    .select("id, owner_id, created_by, admin_comped")
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .maybeSingle();

  if (result.error) {
    throw new Error("The administrator Room billing status could not be verified.");
  }

  return result.data?.admin_comped === true;
}

export async function changeAdministratorRoomPlan(
  roomId: string,
  userId: string,
  requestedPlanKey: string
) {
  if (!isRoomPlanKey(requestedPlanKey)) {
    throw new Error("Choose a valid Room plan.");
  }

  const service = createRoomServiceSupabase();
  const comped = await administratorRoomIsComped(roomId, userId);
  if (!comped) {
    throw new Error("This Room is not an administrator-included Room.");
  }

  const entitlement = getRoomPlanEntitlements(requestedPlanKey, "active");
  const updated = await service
    .from("rooms")
    .update({
      subscription_plan: requestedPlanKey,
      subscription_status: "active",
      member_limit: entitlement.memberLimit,
      admin_comped: true,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      stripe_checkout_session_id: null,
      stripe_current_period_end: null,
      billing_updated_at: new Date().toISOString(),
    })
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .eq("admin_comped", true);

  if (updated.error) {
    throw new Error(
      updated.error.message || "The administrator Room plan could not be changed."
    );
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.billing.admin_plan_changed",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_plan: requestedPlanKey,
      member_limit: entitlement.memberLimit ?? "custom",
      stripe_billing: false,
    },
  });

  return {
    roomId,
    adminComped: true,
    planKey: requestedPlanKey,
  };
}

export async function provisionAdministratorRoom(
  input: AdministratorRoomSetupInput
) {
  const service = createRoomServiceSupabase();
  const roomId = randomUUID();
  const planKey = normalizeRoomPlanKey(input.planKey);
  const entitlement = getRoomPlanEntitlements(planKey, "active");
  const now = new Date().toISOString();

  const inserted = await service.from("rooms").insert({
    id: roomId,
    name: input.roomName,
    description: input.description,
    room_type: normalizedRoomType(input.modelId),
    visibility: "private",
    status: "active",
    owner_id: input.userId,
    created_by: input.userId,
    template_key: input.modelId,
    subscription_plan: planKey,
    subscription_status: "active",
    member_limit: entitlement.memberLimit,
    invite_only: true,
    admin_comped: true,
    billing_updated_at: now,
  });

  if (inserted.error) {
    throw new Error(
      inserted.error.message || "The administrator Room could not be created."
    );
  }

  try {
    await ensureOwnerMembership(roomId, input.userId);
  } catch (error) {
    await service.from("rooms").delete().eq("id", roomId);
    throw error;
  }

  await logAuditEvent({
    actor_id: input.userId,
    action: "room.provisioned.admin_comped",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_plan: planKey,
      room_model: input.modelId,
      member_limit: entitlement.memberLimit ?? "custom",
      stripe_billing: false,
    },
  });

  return {
    roomId,
    adminComped: true,
    planKey,
  };
}
