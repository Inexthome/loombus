import "server-only";

import { logAuditEvent } from "@/lib/audit-log";
import {
  asNumber,
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  normalizeRole,
  profileFor,
  type RoomAccess,
  type RoomRow,
  type RoomRole,
} from "@/lib/room-operations";

type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type JsonObject = Record<string, unknown>;

export class RoomGovernanceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "room_governance_error") {
    super(message);
    this.name = "RoomGovernanceError";
    this.status = status;
    this.code = code;
  }
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function requireAccess(
  service: ServiceClient,
  roomId: string,
  userId: string
): Promise<RoomAccess> {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    throw new RoomGovernanceError("Room not found.", 404, "room_not_found");
  }
  if (!access.allowed && !access.isOwner) {
    throw new RoomGovernanceError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
  return access;
}

function requireManager(access: RoomAccess) {
  if (!access.canManage) {
    throw new RoomGovernanceError(
      "Room administrator access is required.",
      403,
      "room_governance_manager_required"
    );
  }
}

function requireOwner(access: RoomAccess) {
  if (!access.isOwner) {
    throw new RoomGovernanceError(
      "Only the Room owner can perform this action.",
      403,
      "room_owner_required"
    );
  }
}

async function loadMembers(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_members")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (result.error) throw new RoomGovernanceError(result.error.message, 503);
  const rows = (result.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(
    service,
    rows.map((row) => asString(row.user_id))
  );
  return rows.map((row) => {
    const memberUserId = asString(row.user_id);
    return {
      id: asString(row.id),
      userId: memberUserId,
      role: normalizeRole(row.role),
      status: asString(row.status) || "active",
      suspendedUntil: asString(row.suspended_until) || null,
      joinedAt: asString(row.joined_at) || asString(row.created_at) || null,
      profile: profileFor(profiles, memberUserId),
    };
  });
}

async function loadPolicies(service: ServiceClient, roomId: string, userId: string) {
  const result = await service
    .from("room_policies")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (result.error) throw new RoomGovernanceError(result.error.message, 503);
  const policies = (result.data ?? []) as RoomRow[];
  const ackResult = await service
    .from("room_policy_acknowledgments")
    .select("policy_id, user_id, acknowledged_at")
    .eq("room_id", roomId)
    .limit(5000);
  if (ackResult.error) throw new RoomGovernanceError(ackResult.error.message, 503);
  const acknowledgments = (ackResult.data ?? []) as RoomRow[];
  return policies.map((policy) => {
    const policyId = asString(policy.id);
    const matching = acknowledgments.filter(
      (row) => asString(row.policy_id) === policyId
    );
    return {
      id: policyId,
      title: asString(policy.title),
      body: asString(policy.body),
      version: asNumber(policy.version),
      status: asString(policy.status),
      publishedAt: asString(policy.published_at) || null,
      acknowledgmentCount: matching.length,
      acknowledgedByCurrentUser: matching.some(
        (row) => asString(row.user_id) === userId
      ),
    };
  });
}

async function loadAudit(service: ServiceClient, roomId: string) {
  const result = await service
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, created_at")
    .contains("metadata", { room_id: roomId })
    .order("created_at", { ascending: false })
    .limit(200);
  if (result.error) return [];
  return ((result.data ?? []) as RoomRow[]).map((row) => ({
    id: asString(row.id),
    actorId: asString(row.actor_id) || null,
    action: asString(row.action),
    targetType: asString(row.target_type),
    targetId: asString(row.target_id) || null,
    metadata: asObject(row.metadata),
    createdAt: asString(row.created_at) || null,
  }));
}

export async function getRoomGovernanceOverview(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const access = await requireAccess(service, roomId, userId);
  const policies = await loadPolicies(service, roomId, userId);
  const recipientTransfer = await service
    .from("room_ownership_transfers")
    .select("*")
    .eq("room_id", roomId)
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (recipientTransfer.error) {
    throw new RoomGovernanceError(recipientTransfer.error.message, 503);
  }

  if (!access.canManage) {
    return {
      room: { id: access.room.id, name: access.room.name },
      access: { role: access.role, canManage: false, isOwner: access.isOwner },
      pendingTransfer: recipientTransfer.data,
      policies: policies.filter((policy) => policy.status === "published"),
    };
  }

  const members = await loadMembers(service, roomId);
  const settingsResult = await service
    .from("room_governance_settings")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();
  const transferResult = await service
    .from("room_ownership_transfers")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "pending")
    .maybeSingle();
  const moderationResult = await service
    .from("room_moderation_queue")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (settingsResult.error) throw new RoomGovernanceError(settingsResult.error.message, 503);
  if (transferResult.error) throw new RoomGovernanceError(transferResult.error.message, 503);
  if (moderationResult.error) throw new RoomGovernanceError(moderationResult.error.message, 503);

  return {
    room: {
      id: access.room.id,
      name: access.room.name,
      ownerId: access.room.ownerId,
      subscriptionPlan: access.room.subscriptionPlan,
    },
    access: {
      role: access.role,
      canManage: access.canManage,
      canModerate: access.canModerate,
      isOwner: access.isOwner,
    },
    members,
    settings: settingsResult.data ?? {
      retention_days: null,
      retain_audit_logs: true,
      require_policy_acknowledgment: false,
    },
    pendingTransfer: transferResult.data,
    moderation: moderationResult.data ?? [],
    policies,
    audit: await loadAudit(service, roomId),
  };
}

export async function performRoomGovernanceAction(
  roomId: string,
  userId: string,
  action: string,
  input: JsonObject
) {
  const service = createRoomServiceSupabase();
  const access = await requireAccess(service, roomId, userId);
  const now = new Date().toISOString();

  if (action === "acknowledge_policy") {
    const policyId = input.policyId;
    if (!validUuid(policyId)) throw new RoomGovernanceError("Choose a valid Room policy.");
    const policy = await service
      .from("room_policies")
      .select("id")
      .eq("id", policyId)
      .eq("room_id", roomId)
      .eq("status", "published")
      .maybeSingle();
    if (policy.error || !policy.data) {
      throw new RoomGovernanceError("Published Room policy not found.", 404);
    }
    const result = await service.from("room_policy_acknowledgments").upsert(
      {
        policy_id: policyId,
        room_id: roomId,
        user_id: userId,
        acknowledged_at: now,
      },
      { onConflict: "policy_id,user_id" }
    );
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    await logAuditEvent({
      actor_id: userId,
      action: "room.policy_acknowledged",
      target_type: "room_policy",
      target_id: policyId,
      metadata: { room_id: roomId },
    });
    return { ok: true };
  }

  if (action === "accept_transfer") {
    const transferId = input.transferId;
    if (!validUuid(transferId)) {
      throw new RoomGovernanceError("Choose a valid ownership transfer.");
    }
    const result = await service.rpc("accept_room_ownership_transfer", {
      transfer_id: transferId,
      accepting_user_id: userId,
    });
    if (result.error) throw new RoomGovernanceError(result.error.message, 409);
    await logAuditEvent({
      actor_id: userId,
      action: "room.ownership_transfer_accepted",
      target_type: "room",
      target_id: roomId,
      metadata: { room_id: roomId, transfer_id: transferId },
    });
    return { ok: true };
  }

  requireManager(access);

  if (action === "update_settings") {
    const retentionDays =
      input.retentionDays === null || input.retentionDays === ""
        ? null
        : Math.floor(asNumber(input.retentionDays));
    if (retentionDays !== null && (retentionDays < 30 || retentionDays > 3650)) {
      throw new RoomGovernanceError("Retention must be between 30 and 3,650 days.");
    }
    const result = await service.from("room_governance_settings").upsert(
      {
        room_id: roomId,
        retention_days: retentionDays,
        retain_audit_logs: input.retainAuditLogs !== false,
        require_policy_acknowledgment: input.requirePolicyAcknowledgment === true,
        updated_by: userId,
        updated_at: now,
      },
      { onConflict: "room_id" }
    );
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    await logAuditEvent({
      actor_id: userId,
      action: "room.governance_settings_updated",
      target_type: "room",
      target_id: roomId,
      metadata: { room_id: roomId, retention_days: retentionDays },
    });
    return { ok: true };
  }

  if (action === "publish_policy") {
    const title = asString(input.title).slice(0, 160);
    const body = asString(input.body).slice(0, 12000);
    if (!title || !body) {
      throw new RoomGovernanceError("Policy title and text are required.");
    }
    const existing = await service
      .from("room_policies")
      .select("version")
      .eq("room_id", roomId)
      .eq("title", title)
      .order("version", { ascending: false })
      .limit(1);
    if (existing.error) throw new RoomGovernanceError(existing.error.message, 503);
    const previous = (existing.data?.[0] ?? null) as RoomRow | null;
    const version = (previous ? asNumber(previous.version) : 0) + 1;
    const result = await service
      .from("room_policies")
      .insert({
        room_id: roomId,
        title,
        body,
        version,
        status: "published",
        published_by: userId,
        published_at: now,
      })
      .select("id")
      .single();
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    const policyId = asString((result.data as RoomRow).id);
    await logAuditEvent({
      actor_id: userId,
      action: "room.policy_published",
      target_type: "room_policy",
      target_id: policyId,
      metadata: { room_id: roomId, version },
    });
    return { ok: true, id: policyId };
  }

  if (action === "create_transfer") {
    requireOwner(access);
    const toUserId = input.toUserId;
    if (!validUuid(toUserId) || toUserId === userId) {
      throw new RoomGovernanceError("Choose a different active Room member.");
    }
    const member = await service
      .from("room_members")
      .select("user_id, status")
      .eq("room_id", roomId)
      .eq("user_id", toUserId)
      .maybeSingle();
    if (
      member.error ||
      !member.data ||
      ["blocked", "removed", "inactive"].includes(
        asString((member.data as RoomRow).status).toLowerCase()
      )
    ) {
      throw new RoomGovernanceError(
        "Ownership can only be transferred to an active Room member."
      );
    }
    await service
      .from("room_ownership_transfers")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("room_id", roomId)
      .eq("status", "pending");
    const result = await service
      .from("room_ownership_transfers")
      .insert({
        room_id: roomId,
        from_user_id: userId,
        to_user_id: toUserId,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select("id")
      .single();
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    const transferId = asString((result.data as RoomRow).id);
    await logAuditEvent({
      actor_id: userId,
      action: "room.ownership_transfer_created",
      target_type: "room",
      target_id: roomId,
      metadata: { room_id: roomId, transfer_id: transferId, to_user_id: toUserId },
    });
    return { ok: true, id: transferId };
  }

  if (action === "cancel_transfer") {
    requireOwner(access);
    const transferId = input.transferId;
    if (!validUuid(transferId)) {
      throw new RoomGovernanceError("Choose a valid ownership transfer.");
    }
    const result = await service
      .from("room_ownership_transfers")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("id", transferId)
      .eq("room_id", roomId)
      .eq("from_user_id", userId)
      .eq("status", "pending");
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    return { ok: true };
  }

  if (action === "bulk_members") {
    const memberIds = Array.isArray(input.memberIds)
      ? input.memberIds.filter(validUuid).slice(0, 200)
      : [];
    if (!memberIds.length) {
      throw new RoomGovernanceError("Select at least one Room member.");
    }
    const operation = asString(input.operation);
    const role = asString(input.role) as RoomRole;
    const rowsResult = await service
      .from("room_members")
      .select("id, user_id, role")
      .eq("room_id", roomId)
      .in("id", memberIds);
    if (rowsResult.error) throw new RoomGovernanceError(rowsResult.error.message, 503);
    const rows = (rowsResult.data ?? []) as RoomRow[];
    if (rows.some((row) => asString(row.user_id) === access.room.ownerId)) {
      throw new RoomGovernanceError("The current Room owner cannot be modified.");
    }
    if (!access.isOwner && rows.some((row) => normalizeRole(row.role) === "administrator")) {
      throw new RoomGovernanceError("Only the Room owner can modify administrators.", 403);
    }

    let update: JsonObject;
    if (operation === "set_role") {
      if (!["administrator", "moderator", "member"].includes(role)) {
        throw new RoomGovernanceError("Choose a valid Room role.");
      }
      if (role === "administrator" && !access.isOwner) {
        throw new RoomGovernanceError("Only the Room owner can appoint administrators.", 403);
      }
      update = { role, status: "active", updated_at: now };
    } else if (operation === "suspend") {
      const days = Math.min(365, Math.max(1, Math.floor(asNumber(input.days) || 7)));
      update = {
        suspended_until: new Date(Date.now() + days * 86400000).toISOString(),
        updated_at: now,
      };
    } else if (operation === "reinstate") {
      update = { status: "active", suspended_until: null, updated_at: now };
    } else if (operation === "remove") {
      update = { status: "removed", suspended_until: null, updated_at: now };
    } else {
      throw new RoomGovernanceError("Choose a valid member action.");
    }

    const result = await service
      .from("room_members")
      .update(update)
      .eq("room_id", roomId)
      .in("id", memberIds);
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    await logAuditEvent({
      actor_id: userId,
      action: `room.members_${operation}`,
      target_type: "room",
      target_id: roomId,
      metadata: { room_id: roomId, member_ids: memberIds, role: role || null },
    });
    return { ok: true, count: memberIds.length };
  }

  if (action === "create_moderation_item") {
    if (!access.canModerate) {
      throw new RoomGovernanceError("Room moderation access is required.", 403);
    }
    const reason = asString(input.reason).slice(0, 1000);
    if (!reason) throw new RoomGovernanceError("A moderation reason is required.");
    const requestedType = asString(input.targetType);
    const targetType = ["room_post", "room_post_reply", "room_member", "other"].includes(
      requestedType
    )
      ? requestedType
      : "other";
    const result = await service
      .from("room_moderation_queue")
      .insert({
        room_id: roomId,
        target_type: targetType,
        target_id: validUuid(input.targetId) ? input.targetId : null,
        reason,
        reported_by: userId,
      })
      .select("id")
      .single();
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    return { ok: true, id: asString((result.data as RoomRow).id) };
  }

  if (action === "resolve_moderation_item") {
    if (!access.canModerate) {
      throw new RoomGovernanceError("Room moderation access is required.", 403);
    }
    const itemId = input.itemId;
    if (!validUuid(itemId)) throw new RoomGovernanceError("Choose a valid moderation item.");
    const status = asString(input.status);
    if (!["resolved", "dismissed"].includes(status)) {
      throw new RoomGovernanceError("Choose resolved or dismissed.");
    }
    const result = await service
      .from("room_moderation_queue")
      .update({
        status,
        resolution_note: asString(input.note).slice(0, 1000) || null,
        resolved_by: userId,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", itemId)
      .eq("room_id", roomId);
    if (result.error) throw new RoomGovernanceError(result.error.message, 503);
    await logAuditEvent({
      actor_id: userId,
      action: `room.moderation_${status}`,
      target_type: "room_moderation_item",
      target_id: itemId,
      metadata: { room_id: roomId },
    });
    return { ok: true };
  }

  throw new RoomGovernanceError("Unsupported Room governance action.");
}
