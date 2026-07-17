import { asString } from "@/lib/room-operations";
import { error, iso, reply, text, uuid } from "@/lib/room-operations-service";

function paidAndActive(access) {
  return (
    access.room.subscriptionPlan !== "free" &&
    ["active", "trialing"].includes(access.room.subscriptionStatus.toLowerCase())
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
    if (policy.retentionDays > 0) {
      const createdAt = iso(access.rawRoom.created_at);
      if (createdAt) {
        const retainedUntil =
          new Date(createdAt).getTime() + policy.retentionDays * 86_400_000;
        if (retainedUntil > Date.now()) {
          return error(
            `Organization retention protects this Room until ${new Date(
              retainedUntil
            ).toLocaleDateString()}.`,
            409,
            "organization_retention_active"
          );
        }
      }
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
    const policy = await organizationPolicy(service, access);
    if (policy.error) return error(policy.error, 503);
    if (policy.legalHold) {
      return error(
        "This Room is protected by an organization legal hold.",
        409,
        "organization_legal_hold"
      );
    }
    const scheduled = iso(access.rawRoom.deletion_scheduled_for);
    if (!scheduled || new Date(scheduled).getTime() > Date.now()) {
      return error("The 30-day Room recovery period has not ended.", 409);
    }
    if (paidAndActive(access)) {
      return error("Cancel the active Room subscription before permanent deletion.", 409);
    }
    const files = await service
      .from("room_resources")
      .select("storage_path")
      .eq("room_id", roomId)
      .limit(10000);
    if (files.error) return error(files.error.message, 503);
    const paths = (files.data ?? []).map((row) => row.storage_path).filter(Boolean);
    if (paths.length) {
      const storage = await service.storage.from("room-resources").remove(paths);
      if (storage.error) return error(storage.error.message, 503);
    }
    const result = await service.from("rooms").delete().eq("id", roomId);
    if (result.error) return error(result.error.message);
    return reply({ ok: true, deleted: true });
  }

  return null;
}
