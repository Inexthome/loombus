import { asString } from "@/lib/room-operations";
import { error, iso, reply, text, uuid } from "@/lib/room-operations-service";

function paidAndActive(access) {
  return (
    access.room.subscriptionPlan !== "free" &&
    ["active", "trialing"].includes(access.room.subscriptionStatus.toLowerCase())
  );
}

function permanentDeletionEnabled() {
  return (
    process.env.ROOM_PERMANENT_DELETION_ENABLED?.trim().toLowerCase() === "true"
  );
}

async function organizationPolicy(service, access) {
  const organizationId = asString(access.rawRoom.organization_id);
  if (!organizationId) return { legalHold: false, retentionDays: 0 };
  const result = await service
    .from("room_organizations")
    .select("security")
    .eq("id", organizationId)
    .maybeSingle();
  if (result.error) return { error: result.error.message };
  const security =
    result.data?.security && typeof result.data.security === "object"
      ? result.data.security
      : {};
  return {
    legalHold: security.legalHold === true,
    retentionDays: Math.max(
      0,
      Math.min(3650, Math.floor(Number(security.retentionDays ?? 0) || 0))
    ),
  };
}

async function activeRoomRetentionHold(service, roomId) {
  const result = await service
    .from("room_retention_holds")
    .select("id, reason")
    .eq("room_id", roomId)
    .eq("target_type", "room")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (result.error) return { error: result.error.message };
  return {
    active: Boolean(result.data?.id),
    reason: text(result.data?.reason, 1000),
  };
}

function activeOrganizationRetention(policy, access) {
  if (policy.retentionDays <= 0) return { active: false };
  const createdAt = iso(access.rawRoom.created_at);
  if (!createdAt) {
    return {
      error: "Room creation time could not be verified for retention enforcement.",
    };
  }
  const retainedUntil =
    new Date(createdAt).getTime() + policy.retentionDays * 86_400_000;
  return {
    active: retainedUntil > Date.now(),
    retainedUntil: new Date(retainedUntil).toISOString(),
  };
}

export async function handleLifecycleAction(ctx, body, action) {
  const { service, roomId, access, userId } = ctx;

  if (action === "transfer_ownership") {
    if (!access.isOwner) {
      return error("Only the Room owner can transfer ownership.", 403);
    }
    const nextOwnerId = asString(body.nextOwnerId);
    if (!uuid(nextOwnerId)) return error("Choose a valid next owner.", 400);
    if (paidAndActive(access)) {
      return error(
        "Cancel active Room billing before transferring ownership.",
        409,
        "active_room_subscription"
      );
    }
    const result = await service.rpc("transfer_room_ownership", {
      target_room_id: roomId,
      acting_owner_id: userId,
      next_owner_id: nextOwnerId,
    });
    if (result.error) return error(result.error.message);
    return reply({ ok: true, transferred: true });
  }

  if (["archive_room", "unarchive_room"].includes(action)) {
    if (!access.isOwner) {
      return error("Only the Room owner can change Room lifecycle status.", 403);
    }
    const archive = action === "archive_room";
    const result = await service
      .from("rooms")
      .update({
        status: archive ? "archived" : "active",
        archived_at: archive ? new Date().toISOString() : null,
        archived_by: archive ? userId : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);
    if (result.error) return error(result.error.message);
    return reply({ ok: true });
  }

  if (action === "schedule_deletion") {
    if (!access.isOwner) return error("Only the Room owner can schedule deletion.", 403);
    if (text(body.confirmName, 240) !== access.room.name) {
      return error("Enter the exact Room name to schedule deletion.", 400);
    }
    const policy = await organizationPolicy(service, access);
    if (policy.error) return error(policy.error, 503);
    if (policy.legalHold) {
      return error(
        "This Room is protected by an organization legal hold.",
        409,
        "organization_legal_hold"
      );
    }
    const roomHold = await activeRoomRetentionHold(service, roomId);
    if (roomHold.error) return error(roomHold.error, 503);
    if (roomHold.active) {
      return error(
        roomHold.reason
          ? `This Room is protected by an active retention hold: ${roomHold.reason}`
          : "This Room is protected by an active retention hold.",
        409,
        "room_retention_hold_active"
      );
    }
    const retention = activeOrganizationRetention(policy, access);
    if (retention.error) {
      return error(retention.error, 503, "organization_retention_unverifiable");
    }
    if (retention.active) {
      return error(
        `Organization retention protects this Room until ${new Date(
          retention.retainedUntil
        ).toLocaleDateString()}.`,
        409,
        "organization_retention_active"
      );
    }
    const now = new Date();
    const scheduled = new Date(now.getTime() + 30 * 86_400_000);
    const result = await service
      .from("rooms")
      .update({
        status: "pending_deletion",
        deletion_requested_at: now.toISOString(),
        deletion_scheduled_for: scheduled.toISOString(),
        deletion_requested_by: userId,
        deletion_reason: text(body.reason),
        updated_at: now.toISOString(),
      })
      .eq("id", roomId);
    if (result.error) return error(result.error.message);
    return reply({ ok: true, scheduledFor: scheduled.toISOString() });
  }

  if (action === "restore_deletion") {
    if (!access.isOwner) return error("Only the Room owner can restore this Room.", 403);
    const result = await service
      .from("rooms")
      .update({
        status: "active",
        deletion_requested_at: null,
        deletion_scheduled_for: null,
        deletion_requested_by: null,
        deletion_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", roomId);
    if (result.error) return error(result.error.message);
    return reply({ ok: true });
  }

  if (action === "delete_now") {
    if (!access.isOwner) {
      return error("Only the Room owner can permanently delete this Room.", 403);
    }
    if (!permanentDeletionEnabled()) {
      return error(
        "Permanent Room deletion is temporarily paused for safety hardening.",
        503,
        "room_permanent_deletion_paused"
      );
    }
    const policy = await organizationPolicy(service, access);
    if (policy.error) return error(policy.error, 503);
    if (policy.legalHold) {
      return error(
        "This Room is protected by an organization legal hold.",
        409,
        "organization_legal_hold"
      );
    }
    const roomHold = await activeRoomRetentionHold(service, roomId);
    if (roomHold.error) return error(roomHold.error, 503);
    if (roomHold.active) {
      return error(
        roomHold.reason
          ? `This Room is protected by an active retention hold: ${roomHold.reason}`
          : "This Room is protected by an active retention hold.",
        409,
        "room_retention_hold_active"
      );
    }
    const retention = activeOrganizationRetention(policy, access);
    if (retention.error) {
      return error(retention.error, 503, "organization_retention_unverifiable");
    }
    if (retention.active) {
      return error(
        `Organization retention protects this Room until ${new Date(
          retention.retainedUntil
        ).toLocaleDateString()}.`,
        409,
        "organization_retention_active"
      );
    }
    const scheduled = iso(access.rawRoom.deletion_scheduled_for);
    if (!scheduled || new Date(scheduled).getTime() > Date.now()) {
      return error("The 30-day Room recovery period has not ended.", 409);
    }
    if (paidAndActive(access)) {
      return error("Cancel the active Room subscription before permanent deletion.", 409);
    }
    return error(
      "Permanent Room deletion remains paused until the idempotent deletion state machine is deployed.",
      503,
      "room_permanent_deletion_state_machine_required"
    );
  }

  return null;
}
