import "server-only";

import { logAuditEvent } from "@/lib/audit-log";
import { createNotifications } from "@/lib/notifications";
import {
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  normalizeRole,
  profileFor,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { isCustomerSupportRoomType } from "@/lib/room-required-behaviors";

type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type JsonObject = Record<string, unknown>;

const TARGET_TYPES = ["room_post", "room_post_reply", "room_file", "room_member", "other"] as const;
const CATEGORIES = ["harassment", "spam", "privacy", "safety", "misinformation", "conduct", "other"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const OPEN_STATUSES = ["open", "in_review", "escalated"];

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
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}

async function requireAccess(service: ServiceClient, roomId: string, userId: string) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) throw new RoomModerationError("Room not found.", 404, "room_not_found");
  if (!access.allowed && !access.isOwner) {
    throw new RoomModerationError("Active Room membership is required.", 403, "room_membership_required");
  }
  return access;
}

async function supportPostAllowed(
  service: ServiceClient,
  access: RoomAccess,
  userId: string,
  post: RoomRow
) {
  if (!isCustomerSupportRoomType(access.room.roomType) || access.canModerate) return true;
  if (asString(post.author_id) === userId) return true;
  const participant = await service
    .from("room_post_participants")
    .select("id")
    .eq("room_id", access.room.id)
    .eq("post_id", asString(post.id))
    .eq("user_id", userId)
    .maybeSingle();
  if (participant.error) throw new RoomModerationError(participant.error.message, 503);
  return Boolean(participant.data);
}

async function snapshotTarget(
  service: ServiceClient,
  access: RoomAccess,
  userId: string,
  targetType: string,
  targetId: string | null
) {
  if (targetType === "other") {
    return { snapshot: { room_id: access.room.id, captured_at: new Date().toISOString() }, affectedUserId: null };
  }
  if (!targetId) throw new RoomModerationError("Choose a valid Room report target.");

  if (targetType === "room_post") {
    const result = await service.from("room_posts").select("*").eq("room_id", access.room.id).eq("id", targetId).maybeSingle();
    const row = (result.data ?? null) as RoomRow | null;
    if (result.error || !row || !(await supportPostAllowed(service, access, userId, row))) {
      throw new RoomModerationError("The Room discussion could not be reported.", 404);
    }
    return {
      snapshot: {
        id: asString(row.id), title: asString(row.title), body: asString(row.body).slice(0, 4000),
        author_id: asString(row.author_id) || null, status: asString(row.status),
        visibility_scope: asString(row.visibility_scope), created_at: asString(row.created_at),
        captured_at: new Date().toISOString(),
      },
      affectedUserId: asString(row.author_id) || null,
    };
  }

  if (targetType === "room_post_reply") {
    const result = await service.from("room_post_replies").select("*").eq("room_id", access.room.id).eq("id", targetId).maybeSingle();
    const row = (result.data ?? null) as RoomRow | null;
    if (result.error || !row) throw new RoomModerationError("The Room reply could not be reported.", 404);
    const postResult = await service.from("room_posts").select("*").eq("room_id", access.room.id).eq("id", asString(row.post_id)).maybeSingle();
    const post = (postResult.data ?? null) as RoomRow | null;
    if (postResult.error || !post || !(await supportPostAllowed(service, access, userId, post))) {
      throw new RoomModerationError("The Room reply could not be reported.", 404);
    }
    return {
      snapshot: {
        id: asString(row.id), post_id: asString(row.post_id), body: asString(row.body).slice(0, 4000),
        author_id: asString(row.author_id) || null, created_at: asString(row.created_at),
        parent_title: asString(post.title), captured_at: new Date().toISOString(),
      },
      affectedUserId: asString(row.author_id) || null,
    };
  }

  if (targetType === "room_file") {
    const result = await service.from("room_resource_attachments").select("*").eq("room_id", access.room.id).eq("id", targetId).maybeSingle();
    const row = (result.data ?? null) as RoomRow | null;
    if (result.error || !row) throw new RoomModerationError("The Room file could not be reported.", 404);
    const postId = asString(row.post_id) || asString(row.room_post_id) || asString(row.parent_post_id);
    if (postId && isCustomerSupportRoomType(access.room.roomType) && !access.canModerate) {
      const postResult = await service.from("room_posts").select("*").eq("room_id", access.room.id).eq("id", postId).maybeSingle();
      const post = (postResult.data ?? null) as RoomRow | null;
      if (!post || !(await supportPostAllowed(service, access, userId, post))) {
        throw new RoomModerationError("The Room file could not be reported.", 404);
      }
    }
    return {
      snapshot: {
        id: asString(row.id), file_name: asString(row.file_name) || asString(row.filename),
        mime_type: asString(row.mime_type) || asString(row.content_type), post_id: postId || null,
        uploaded_by: asString(row.uploaded_by) || asString(row.created_by) || null,
        created_at: asString(row.created_at), captured_at: new Date().toISOString(),
      },
      affectedUserId: asString(row.uploaded_by) || asString(row.created_by) || null,
    };
  }

  if (targetType === "room_member") {
    const result = await service.from("room_members").select("*").eq("room_id", access.room.id).eq("user_id", targetId).maybeSingle();
    const row = (result.data ?? null) as RoomRow | null;
    if (result.error || !row) throw new RoomModerationError("The Room member could not be reported.", 404);
    return {
      snapshot: {
        membership_id: asString(row.id), user_id: asString(row.user_id), role: normalizeRole(row.role),
        status: asString(row.status), joined_at: asString(row.joined_at), captured_at: new Date().toISOString(),
      },
      affectedUserId: asString(row.user_id) || null,
    };
  }

  throw new RoomModerationError("Choose a supported Room report target.");
}

async function staffUserIds(service: ServiceClient, access: RoomAccess) {
  const result = await service
    .from("room_members")
    .select("user_id, role, status, suspended_until")
    .eq("room_id", access.room.id)
    .in("role", ["owner", "administrator", "admin", "moderator"])
    .limit(500);
  if (result.error) throw new RoomModerationError(result.error.message, 503);
  const ids = new Set<string>([access.room.ownerId].filter(Boolean));
  const now = Date.now();
  for (const row of (result.data ?? []) as RoomRow[]) {
    const status = asString(row.status).toLowerCase();
    const suspended = asString(row.suspended_until);
    if (["blocked", "removed", "inactive", "suspended"].includes(status)) continue;
    if (suspended && new Date(suspended).getTime() > now) continue;
    const id = asString(row.user_id);
    if (id) ids.add(id);
  }
  return [...ids];
}

async function notifyUsers(
  userIds: string[], actorId: string, type: string, targetId: string, message: string
) {
  await createNotifications(
    [...new Set(userIds.filter((id) => id && id !== actorId))].map((userId) => ({
      user_id: userId,
      actor_id: actorId,
      type,
      target_type: "room_moderation_item",
      target_id: targetId,
      message,
    }))
  );
}

export async function getRoomModerationOverview(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const access = await requireAccess(service, roomId, userId);
  const ownResult = await service
    .from("room_moderation_queue")
    .select("*")
    .eq("room_id", roomId)
    .eq("reported_by", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (ownResult.error) throw new RoomModerationError(ownResult.error.message, 503);

  if (!access.canModerate) {
    return {
      room: { id: access.room.id, name: access.room.name },
      access: { canModerate: false, canManage: false, role: access.role },
      reports: ownResult.data ?? [],
    };
  }

  const queueResult = await service
    .from("room_moderation_queue")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(500);
  const membersResult = await service
    .from("room_members")
    .select("user_id, role, status")
    .eq("room_id", roomId)
    .limit(1000);
  if (queueResult.error) throw new RoomModerationError(queueResult.error.message, 503);
  if (membersResult.error) throw new RoomModerationError(membersResult.error.message, 503);
  const queue = (queueResult.data ?? []) as RoomRow[];
  const members = (membersResult.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(service, [
    ...queue.flatMap((row) => [asString(row.reported_by), asString(row.assigned_to), asString(row.affected_user_id)]),
    ...members.map((row) => asString(row.user_id)),
  ]);

  return {
    room: { id: access.room.id, name: access.room.name },
    access: { canModerate: access.canModerate, canManage: access.canManage, isOwner: access.isOwner, role: access.role },
    reports: queue.map((row) => ({
      ...row,
      reporterProfile: profileFor(profiles, asString(row.reported_by)),
      assigneeProfile: profileFor(profiles, asString(row.assigned_to)),
      affectedProfile: profileFor(profiles, asString(row.affected_user_id)),
    })),
    staff: members
      .filter((row) => ["owner", "administrator", "moderator"].includes(normalizeRole(row.role)))
      .map((row) => ({ userId: asString(row.user_id), role: normalizeRole(row.role), status: asString(row.status), profile: profileFor(profiles, asString(row.user_id)) })),
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
  const now = new Date().toISOString();

  if (action === "report") {
    const targetType = asString(input.targetType);
    if (!(TARGET_TYPES as readonly string[]).includes(targetType)) {
      throw new RoomModerationError("Choose a supported Room report target.");
    }
    const targetId = targetType === "other" ? null : asString(input.targetId);
    if (targetId && !validUuid(targetId)) throw new RoomModerationError("Choose a valid Room report target.");
    const category = asString(input.category) || "other";
    if (!(CATEGORIES as readonly string[]).includes(category)) throw new RoomModerationError("Choose a valid report category.");
    const reason = asString(input.reason).slice(0, 1000);
    const reporterNote = asString(input.reporterNote).slice(0, 4000);
    if (!reason) throw new RoomModerationError("Explain why this should be reviewed.");

    const existing = targetId
      ? await service.from("room_moderation_queue").select("id").eq("room_id", roomId).eq("target_type", targetType).eq("target_id", targetId).eq("reported_by", userId).in("status", OPEN_STATUSES).maybeSingle()
      : { data: null, error: null };
    if (existing.error) throw new RoomModerationError(existing.error.message, 503);
    if (existing.data) throw new RoomModerationError("You already have an open report for this Room item.", 409, "duplicate_room_report");

    const evidence = await snapshotTarget(service, access, userId, targetType, targetId);
    const result = await service
      .from("room_moderation_queue")
      .insert({
        room_id: roomId,
        target_type: targetType,
        target_id: targetId,
        reason,
        reporter_note: reporterNote || null,
        category,
        priority: "normal",
        source: access.canModerate ? "staff_report" : "member_report",
        evidence_snapshot: evidence.snapshot,
        affected_user_id: evidence.affectedUserId,
        reported_by: userId,
        status: "open",
        last_action_at: now,
      })
      .select("id")
      .single();
    if (result.error) throw new RoomModerationError(result.error.message, 503);
    const itemId = asString((result.data as RoomRow).id);
    const staff = await staffUserIds(service, access);
    await notifyUsers(staff, userId, "room_moderation_report", itemId, `A new ${category} report was submitted in ${access.room.name}.`);
    await logAuditEvent({ actor_id: userId, action: "room.moderation_reported", target_type: "room_moderation_item", target_id: itemId, metadata: { room_id: roomId, target_type: targetType, target_id: targetId, category } });
    return { ok: true, id: itemId };
  }

  if (!access.canModerate) throw new RoomModerationError("Room moderation access is required.", 403);
  const itemId = asString(input.itemId);
  if (!validUuid(itemId)) throw new RoomModerationError("Choose a valid moderation item.");
  const itemResult = await service.from("room_moderation_queue").select("*").eq("room_id", roomId).eq("id", itemId).maybeSingle();
  const item = (itemResult.data ?? null) as RoomRow | null;
  if (itemResult.error || !item) throw new RoomModerationError("Moderation item not found.", 404);
  if (!OPEN_STATUSES.includes(asString(item.status))) throw new RoomModerationError("This moderation item is already closed.", 409);

  if (action === "assign") {
    const assigneeId = asString(input.assigneeId);
    if (!validUuid(assigneeId)) throw new RoomModerationError("Choose a valid Room moderator.");
    const member = await service.from("room_members").select("role, status, suspended_until").eq("room_id", roomId).eq("user_id", assigneeId).maybeSingle();
    const memberRow = (member.data ?? null) as RoomRow | null;
    if (member.error || !memberRow || !["owner", "administrator", "moderator"].includes(normalizeRole(memberRow.role)) || asString(memberRow.status).toLowerCase() !== "active") {
      throw new RoomModerationError("Assign this report to an active Room moderator.");
    }
    const result = await service.from("room_moderation_queue").update({ assigned_to: assigneeId, assigned_by: userId, assigned_at: now, status: "in_review", last_action_at: now, updated_at: now }).eq("id", itemId).eq("room_id", roomId).select("id").maybeSingle();
    if (result.error || !result.data) throw new RoomModerationError(result.error?.message || "Moderation assignment failed.", 503);
    await notifyUsers([assigneeId], userId, "room_moderation_assigned", itemId, `A Room moderation report was assigned to you in ${access.room.name}.`);
    await logAuditEvent({ actor_id: userId, action: "room.moderation_assigned", target_type: "room_moderation_item", target_id: itemId, metadata: { room_id: roomId, assigned_to: assigneeId } });
    return { ok: true };
  }

  if (action === "escalate") {
    const priority = asString(input.priority) || "high";
    if (!(PRIORITIES as readonly string[]).includes(priority)) throw new RoomModerationError("Choose a valid moderation priority.");
    const result = await service.from("room_moderation_queue").update({ status: "escalated", priority, escalated_by: userId, escalated_at: now, last_action_at: now, updated_at: now }).eq("id", itemId).eq("room_id", roomId).select("id").maybeSingle();
    if (result.error || !result.data) throw new RoomModerationError(result.error?.message || "Moderation escalation failed.", 503);
    const managers = (await staffUserIds(service, access)).filter((id) => id !== userId);
    await notifyUsers(managers, userId, "room_moderation_escalated", itemId, `A ${priority}-priority moderation report was escalated in ${access.room.name}.`);
    await logAuditEvent({ actor_id: userId, action: "room.moderation_escalated", target_type: "room_moderation_item", target_id: itemId, metadata: { room_id: roomId, priority } });
    return { ok: true };
  }

  if (action === "resolve") {
    const status = asString(input.status);
    if (!["resolved", "dismissed"].includes(status)) throw new RoomModerationError("Choose resolved or dismissed.");
    const note = asString(input.note).slice(0, 2000);
    if (!note) throw new RoomModerationError("Add a resolution note.");
    const result = await service.from("room_moderation_queue").update({ status, resolution_note: note, resolved_by: userId, resolved_at: now, last_action_at: now, updated_at: now }).eq("id", itemId).eq("room_id", roomId).select("id").maybeSingle();
    if (result.error || !result.data) throw new RoomModerationError(result.error?.message || "Moderation resolution failed.", 503);
    const recipients = [asString(item.reported_by), asString(item.assigned_to), asString(item.affected_user_id)].filter(Boolean);
    await notifyUsers(recipients, userId, `room_moderation_${status}`, itemId, `A Room moderation report in ${access.room.name} was ${status}.`);
    await logAuditEvent({ actor_id: userId, action: `room.moderation_${status}`, target_type: "room_moderation_item", target_id: itemId, metadata: { room_id: roomId, resolution_note: note } });
    return { ok: true };
  }

  throw new RoomModerationError("Unsupported Room moderation action.");
}
