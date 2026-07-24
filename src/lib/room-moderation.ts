import "server-only";

import { logAuditEvent } from "@/lib/audit-log";
import { createNotifications } from "@/lib/notifications";
import {
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  profileFor,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";

const TARGET_TYPES = new Set(["room_post", "room_post_reply"]);
const CATEGORIES = new Set([
  "harassment",
  "hate",
  "threat",
  "spam",
  "privacy",
  "misinformation",
  "unsafe_content",
  "impersonation",
  "other",
]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const RESOLUTION_ACTIONS = new Set([
  "none",
  "warning",
  "content_removed",
  "member_suspended",
  "member_removed",
  "escalated_to_loombus",
]);

type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type JsonObject = Record<string, unknown>;

export class RoomModerationError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "room_moderation_error") {
    super(message);
    this.name = "RoomModerationError";
    this.status = status;
    this.code = code;
  }
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

async function requireAccess(service: ServiceClient, roomId: string, userId: string) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) throw new RoomModerationError("Room not found.", 404, "room_not_found");
  if (!access.allowed && !access.isOwner) {
    throw new RoomModerationError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
  return access;
}

function requireModerator(access: RoomAccess) {
  if (!access.canModerate) {
    throw new RoomModerationError(
      "Room moderation access is required.",
      403,
      "room_moderation_required"
    );
  }
}

async function activeStaffIds(service: ServiceClient, access: RoomAccess) {
  const result = await service
    .from("room_members")
    .select("user_id, role, status, suspended_until")
    .eq("room_id", access.room.id)
    .in("role", ["owner", "admin", "administrator", "moderator"])
    .not("status", "in", "(blocked,removed,inactive)")
    .limit(500);
  if (result.error) throw new RoomModerationError(result.error.message, 503);
  const now = Date.now();
  const ids = ((result.data ?? []) as RoomRow[])
    .filter((row) => {
      const until = asString(row.suspended_until);
      return !until || new Date(until).getTime() <= now;
    })
    .map((row) => asString(row.user_id))
    .filter(Boolean);
  return [...new Set([access.room.ownerId, access.room.createdBy, ...ids].filter(Boolean))];
}

async function canAccessPost(
  service: ServiceClient,
  access: RoomAccess,
  post: RoomRow,
  userId: string
) {
  const visibility = asString(post.visibility_scope) || "room";
  if (visibility === "room") return access.allowed || access.isOwner;
  if (asString(post.author_id) === userId || access.canModerate) return true;
  const participant = await service
    .from("room_post_participants")
    .select("post_id")
    .eq("room_id", access.room.id)
    .eq("post_id", asString(post.id))
    .eq("user_id", userId)
    .maybeSingle();
  if (participant.error) throw new RoomModerationError(participant.error.message, 503);
  return Boolean(participant.data);
}

async function captureEvidence(
  service: ServiceClient,
  access: RoomAccess,
  userId: string,
  targetType: string,
  targetId: string
) {
  if (targetType === "room_post") {
    const result = await service
      .from("room_posts")
      .select("id, room_id, author_id, title, body, discussion_type, status, visibility_scope, created_at, updated_at, deleted_at")
      .eq("room_id", access.room.id)
      .eq("id", targetId)
      .maybeSingle();
    if (result.error || !result.data) {
      throw new RoomModerationError("Room discussion not found.", 404);
    }
    const row = result.data as RoomRow;
    if (!(await canAccessPost(service, access, row, userId))) {
      throw new RoomModerationError("Room discussion not found.", 404);
    }
    return {
      targetType,
      targetId,
      parentPostId: targetId,
      authorId: asString(row.author_id) || null,
      title: asString(row.title) || "Room discussion",
      body: asString(row.body).slice(0, 5000),
      discussionType: asString(row.discussion_type) || null,
      contentStatus: asString(row.status) || null,
      visibilityScope: asString(row.visibility_scope) || "room",
      createdAt: asString(row.created_at) || null,
      updatedAt: asString(row.updated_at) || null,
      deletedAt: asString(row.deleted_at) || null,
      capturedAt: new Date().toISOString(),
    };
  }

  const replyResult = await service
    .from("room_post_replies")
    .select("id, room_id, post_id, author_id, body, created_at, updated_at, deleted_at")
    .eq("room_id", access.room.id)
    .eq("id", targetId)
    .maybeSingle();
  if (replyResult.error || !replyResult.data) {
    throw new RoomModerationError("Room reply not found.", 404);
  }
  const reply = replyResult.data as RoomRow;
  const postResult = await service
    .from("room_posts")
    .select("id, author_id, title, body, visibility_scope, deleted_at")
    .eq("room_id", access.room.id)
    .eq("id", asString(reply.post_id))
    .maybeSingle();
  if (postResult.error || !postResult.data) {
    throw new RoomModerationError("Room reply not found.", 404);
  }
  const post = postResult.data as RoomRow;
  if (!(await canAccessPost(service, access, post, userId))) {
    throw new RoomModerationError("Room reply not found.", 404);
  }
  return {
    targetType,
    targetId,
    parentPostId: asString(reply.post_id),
    authorId: asString(reply.author_id) || null,
    title: asString(post.title) || "Room discussion reply",
    body: asString(reply.body).slice(0, 3000),
    parentBody: asString(post.body).slice(0, 1200),
    visibilityScope: asString(post.visibility_scope) || "room",
    createdAt: asString(reply.created_at) || null,
    updatedAt: asString(reply.updated_at) || null,
    deletedAt: asString(reply.deleted_at) || null,
    capturedAt: new Date().toISOString(),
  };
}

export async function createRoomModerationReport(
  roomId: string,
  userId: string,
  input: JsonObject
) {
  const service = createRoomServiceSupabase();
  const access = await requireAccess(service, roomId, userId);
  const targetType = asString(input.targetType);
  const targetId = asString(input.targetId);
  const category = asString(input.category) || "other";
  const reason = asString(input.reason).slice(0, 1000);
  if (!TARGET_TYPES.has(targetType) || !validUuid(targetId)) {
    throw new RoomModerationError("Choose a valid Room discussion or reply.");
  }
  if (!CATEGORIES.has(category)) {
    throw new RoomModerationError("Choose a valid report category.");
  }
  if (reason.length < 10) {
    throw new RoomModerationError("Explain the concern in at least 10 characters.");
  }

  const evidence = await captureEvidence(service, access, userId, targetType, targetId);
  const existing = await service
    .from("room_moderation_queue")
    .select("id, report_count")
    .eq("room_id", roomId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .eq("reported_by", userId)
    .in("status", ["open", "reviewing"])
    .maybeSingle();
  if (existing.error) throw new RoomModerationError(existing.error.message, 503);

  let itemId: string;
  if (existing.data) {
    itemId = asString((existing.data as RoomRow).id);
    const count = Number((existing.data as RoomRow).report_count) || 1;
    const updated = await service
      .from("room_moderation_queue")
      .update({
        reason,
        category,
        evidence_snapshot: evidence,
        report_count: count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("room_id", roomId);
    if (updated.error) throw new RoomModerationError(updated.error.message, 503);
  } else {
    const inserted = await service
      .from("room_moderation_queue")
      .insert({
        room_id: roomId,
        target_type: targetType,
        target_id: targetId,
        reason,
        category,
        priority: category === "threat" ? "urgent" : "normal",
        evidence_snapshot: evidence,
        reported_by: userId,
      })
      .select("id")
      .single();
    if (inserted.error) throw new RoomModerationError(inserted.error.message, 503);
    itemId = asString((inserted.data as RoomRow).id);
  }

  const recipients = (await activeStaffIds(service, access)).filter((id) => id !== userId);
  if (recipients.length > 0) {
    await createNotifications(
      recipients.map((recipientId) => ({
        user_id: recipientId,
        actor_id: userId,
        type: "room_moderation_report",
        target_type: "room_moderation_item",
        target_id: itemId,
        message: `New Room report in ${access.room.name}: ${asString(evidence.title)}`,
      }))
    );
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.moderation_reported",
    target_type: "room_moderation_item",
    target_id: itemId,
    metadata: { room_id: roomId, target_type: targetType, target_id: targetId, category },
  });
  return { ok: true, id: itemId };
}

export async function getRoomModerationOverview(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const access = await requireAccess(service, roomId, userId);
  requireModerator(access);
  const [queueResult, staffResult] = await Promise.all([
    service
      .from("room_moderation_queue")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(500),
    service
      .from("room_members")
      .select("user_id, role, status, suspended_until")
      .eq("room_id", roomId)
      .in("role", ["owner", "admin", "administrator", "moderator"])
      .limit(500),
  ]);
  if (queueResult.error) throw new RoomModerationError(queueResult.error.message, 503);
  if (staffResult.error) throw new RoomModerationError(staffResult.error.message, 503);
  const queue = (queueResult.data ?? []) as RoomRow[];
  const staff = (staffResult.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(service, [
    ...queue.flatMap((row) => [asString(row.reported_by), asString(row.assigned_to), asString(row.resolved_by)]),
    ...staff.map((row) => asString(row.user_id)),
  ]);
  return {
    room: { id: access.room.id, name: access.room.name },
    access: { isOwner: access.isOwner, canManage: access.canManage, canModerate: access.canModerate },
    staff: staff.map((row) => ({
      userId: asString(row.user_id),
      role: asString(row.role),
      profile: profileFor(profiles, asString(row.user_id)),
    })),
    items: queue.map((row) => ({
      ...row,
      evidence_snapshot: objectValue(row.evidence_snapshot),
      reporter: profileFor(profiles, asString(row.reported_by)),
      assignee: profileFor(profiles, asString(row.assigned_to)),
      resolver: profileFor(profiles, asString(row.resolved_by)),
    })),
  };
}

export async function performRoomModerationAction(
  roomId: string,
  userId: string,
  action: string,
  input: JsonObject
) {
  const service = createRoomServiceSupabase();
  const access = await requireAccess(service, roomId, userId);
  requireModerator(access);
  const itemId = asString(input.itemId);
  if (!validUuid(itemId)) throw new RoomModerationError("Choose a valid moderation case.");
  const existing = await service
    .from("room_moderation_queue")
    .select("*")
    .eq("room_id", roomId)
    .eq("id", itemId)
    .maybeSingle();
  if (existing.error || !existing.data) throw new RoomModerationError("Moderation case not found.", 404);
  const item = existing.data as RoomRow;
  const now = new Date().toISOString();
  let update: JsonObject = { updated_at: now };

  if (action === "claim") {
    update = { ...update, assigned_to: userId, status: "reviewing" };
  } else if (action === "assign") {
    const assignedTo = asString(input.assignedTo);
    if (!validUuid(assignedTo)) throw new RoomModerationError("Choose a valid Room moderator.");
    const staffIds = await activeStaffIds(service, access);
    if (!staffIds.includes(assignedTo)) throw new RoomModerationError("Choose an active Room moderator.");
    update = { ...update, assigned_to: assignedTo, status: "reviewing" };
  } else if (action === "set_priority") {
    const priority = asString(input.priority);
    if (!PRIORITIES.has(priority)) throw new RoomModerationError("Choose a valid priority.");
    update = { ...update, priority };
  } else if (action === "escalate") {
    update = {
      ...update,
      priority: "urgent",
      escalated_at: now,
      escalated_by: userId,
      status: "reviewing",
    };
  } else if (action === "resolve" || action === "dismiss") {
    if (!["open", "reviewing"].includes(asString(item.status))) {
      throw new RoomModerationError("This moderation case is already closed.", 409);
    }
    const resolutionAction = asString(input.resolutionAction) || "none";
    if (!RESOLUTION_ACTIONS.has(resolutionAction)) {
      throw new RoomModerationError("Choose a valid resolution action.");
    }
    update = {
      ...update,
      status: action === "resolve" ? "resolved" : "dismissed",
      resolution_note: asString(input.note).slice(0, 1000) || null,
      resolution_action: resolutionAction,
      resolved_by: userId,
      resolved_at: now,
    };
  } else {
    throw new RoomModerationError("Unsupported Room moderation action.");
  }

  const updated = await service
    .from("room_moderation_queue")
    .update(update)
    .eq("room_id", roomId)
    .eq("id", itemId)
    .select("*")
    .maybeSingle();
  if (updated.error || !updated.data) throw new RoomModerationError("Moderation case could not be updated.", 503);

  if ((action === "resolve" || action === "dismiss") && validUuid(item.reported_by)) {
    const resolutionMessage =
      action === "resolve"
        ? `Your report in ${access.room.name} was reviewed and resolved.`
        : `Your report in ${access.room.name} was reviewed and dismissed.`;
    const notified = await createNotifications([
      {
        user_id: item.reported_by,
        actor_id: userId,
        type: "room_moderation_resolution",
        target_type: "room_moderation_item",
        target_id: itemId,
        message: resolutionMessage,
      },
    ]);
    if (!notified.error) {
      await service
        .from("room_moderation_queue")
        .update({ reporter_notified_at: now })
        .eq("id", itemId)
        .eq("room_id", roomId);
    }
  }

  await logAuditEvent({
    actor_id: userId,
    action: `room.moderation_${action}`,
    target_type: "room_moderation_item",
    target_id: itemId,
    metadata: { room_id: roomId, ...update },
  });
  return { ok: true };
}
