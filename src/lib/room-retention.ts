import "server-only";

import { logAuditEvent } from "@/lib/audit-log";
import {
  asNumber,
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { isCustomerSupportRoomType } from "@/lib/room-required-behaviors";

type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type JsonObject = Record<string, unknown>;

type RetentionTargetType =
  | "room_post"
  | "room_post_reply"
  | "room_module_record"
  | "room_event"
  | "room_announcement"
  | "room_attachment";

type Candidate = {
  targetType: RetentionTargetType;
  targetId: string;
  recordCreatedAt: string | null;
  stageStatus: "eligible" | "staged" | "excluded";
  exclusionReason: string | null;
  metadata: JsonObject;
};

const MAX_ROWS_PER_TYPE = 1000;

export class RoomRetentionError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "room_retention_error") {
    super(message);
    this.name = "RoomRetentionError";
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

function isoDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function requireOwner(service: ServiceClient, roomId: string, userId: string) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    throw new RoomRetentionError("Room not found.", 404, "room_not_found");
  }
  if (!access.isOwner) {
    throw new RoomRetentionError(
      "Only the Room owner can manage retention.",
      403,
      "room_retention_owner_required"
    );
  }
  return access;
}

async function retentionDays(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_governance_settings")
    .select("retention_days")
    .eq("room_id", roomId)
    .maybeSingle();
  if (result.error) {
    throw new RoomRetentionError(result.error.message, 503, "room_retention_storage_unavailable");
  }
  const days = asNumber((result.data as RoomRow | null)?.retention_days);
  if (days < 30 || days > 3650) {
    throw new RoomRetentionError(
      "Set a retention period between 30 and 3,650 days before previewing cleanup.",
      409,
      "room_retention_not_configured"
    );
  }
  return Math.floor(days);
}

async function oldRows(
  service: ServiceClient,
  table: string,
  roomId: string,
  cutoff: string,
  hasDeletedAt = false
) {
  let query = service
    .from(table)
    .select("*")
    .eq("room_id", roomId)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(MAX_ROWS_PER_TYPE);
  if (hasDeletedAt) query = query.is("deleted_at", null);
  const result = await query;
  if (result.error) {
    throw new RoomRetentionError(result.error.message, 503, "room_retention_storage_unavailable");
  }
  return (result.data ?? []) as RoomRow[];
}

async function activeHolds(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_retention_holds")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "active")
    .limit(5000);
  if (result.error) {
    throw new RoomRetentionError(result.error.message, 503, "room_retention_storage_unavailable");
  }
  return (result.data ?? []) as RoomRow[];
}

async function openModeration(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_moderation_queue")
    .select("target_type, target_id, status")
    .eq("room_id", roomId)
    .in("status", ["open", "reviewing"])
    .limit(5000);
  if (result.error) {
    throw new RoomRetentionError(result.error.message, 503, "room_retention_storage_unavailable");
  }
  return (result.data ?? []) as RoomRow[];
}

function candidateFor(
  row: RoomRow,
  targetType: RetentionTargetType,
  heldTargets: Set<string>,
  roomHeld: boolean,
  moderatedTargets: Set<string>,
  openSupportPostIds: Set<string>,
  mode: "preview" | "stage"
): Candidate | null {
  const targetId = asString(row.id);
  if (!validUuid(targetId)) return null;

  let exclusionReason: string | null = null;
  const targetKey = `${targetType}:${targetId}`;
  if (roomHeld) exclusionReason = "Room-wide legal hold";
  else if (heldTargets.has(targetKey)) exclusionReason = "Target legal hold";
  else if (moderatedTargets.has(targetKey)) exclusionReason = "Open moderation review";
  else if (targetType === "room_post" && openSupportPostIds.has(targetId)) {
    exclusionReason = "Active Customer Support case";
  } else if (targetType === "room_post_reply") {
    const postId = asString(row.post_id);
    if (postId && openSupportPostIds.has(postId)) {
      exclusionReason = "Reply belongs to an active Customer Support case";
    }
  } else if (targetType === "room_attachment") {
    const postId =
      asString(row.post_id) || asString(row.room_post_id) || asString(row.parent_post_id);
    if (postId && openSupportPostIds.has(postId)) {
      exclusionReason = "Attachment belongs to an active Customer Support case";
    }
  }

  return {
    targetType,
    targetId,
    recordCreatedAt: isoDate(row.created_at),
    stageStatus: exclusionReason ? "excluded" : mode === "stage" ? "staged" : "eligible",
    exclusionReason,
    metadata: {
      title: asString(row.title) || null,
      status: asString(row.status) || null,
      post_id:
        asString(row.post_id) || asString(row.room_post_id) || asString(row.parent_post_id) || null,
      storage_path:
        asString(row.storage_path) || asString(row.object_path) || asString(row.path) || null,
    },
  };
}

async function buildCandidates(
  service: ServiceClient,
  roomId: string,
  roomType: string,
  cutoff: string,
  mode: "preview" | "stage"
) {
  const holds = await activeHolds(service, roomId);
  const roomHeld = holds.some((row) => asString(row.target_type) === "room");
  const heldTargets = new Set(
    holds
      .map((row) => {
        const type = asString(row.target_type);
        const id = asString(row.target_id);
        return type && id ? `${type}:${id}` : "";
      })
      .filter(Boolean)
  );

  const moderation = await openModeration(service, roomId);
  const moderatedTargets = new Set(
    moderation
      .map((row) => {
        const type = asString(row.target_type);
        const id = asString(row.target_id);
        return type && id ? `${type}:${id}` : "";
      })
      .filter(Boolean)
  );

  const posts = await oldRows(service, "room_posts", roomId, cutoff, true);
  const replies = await oldRows(service, "room_post_replies", roomId, cutoff, true);
  const records = await oldRows(service, "room_module_records", roomId, cutoff);
  const events = await oldRows(service, "room_events", roomId, cutoff);
  const announcements = await oldRows(service, "room_announcements", roomId, cutoff);
  const attachments = await oldRows(service, "room_resource_attachments", roomId, cutoff);

  const openSupportPostIds = new Set<string>();
  if (isCustomerSupportRoomType(roomType)) {
    for (const row of posts) {
      const status = asString(row.status).toLowerCase();
      if (!["resolved", "closed", "cancelled"].includes(status)) {
        const id = asString(row.id);
        if (id) openSupportPostIds.add(id);
      }
    }
  }

  const candidates: Candidate[] = [];
  const append = (rows: RoomRow[], type: RetentionTargetType) => {
    for (const row of rows) {
      const candidate = candidateFor(
        row,
        type,
        heldTargets,
        roomHeld,
        moderatedTargets,
        openSupportPostIds,
        mode
      );
      if (candidate) candidates.push(candidate);
    }
  };

  append(posts, "room_post");
  append(replies, "room_post_reply");
  append(records, "room_module_record");
  append(events, "room_event");
  append(announcements, "room_announcement");
  append(attachments, "room_attachment");
  return candidates;
}

function summarize(candidates: Candidate[]) {
  const byType: Record<string, { eligible: number; staged: number; excluded: number }> = {};
  for (const candidate of candidates) {
    byType[candidate.targetType] ??= { eligible: 0, staged: 0, excluded: 0 };
    byType[candidate.targetType][candidate.stageStatus] += 1;
  }
  return byType;
}

export async function getRoomRetentionOverview(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const access = await requireOwner(service, roomId, userId);
  const settings = await service
    .from("room_governance_settings")
    .select("retention_days, retain_audit_logs")
    .eq("room_id", roomId)
    .maybeSingle();
  const holds = await service
    .from("room_retention_holds")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);
  const runs = await service
    .from("room_retention_runs")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (settings.error || holds.error || runs.error) {
    throw new RoomRetentionError("Retention records could not be loaded.", 503);
  }
  return {
    room: { id: access.room.id, name: access.room.name, roomType: access.room.roomType },
    settings: settings.data ?? { retention_days: null, retain_audit_logs: true },
    holds: holds.data ?? [],
    runs: runs.data ?? [],
    permanentDeletionEnabled: false,
  };
}

export async function runRoomRetention(
  roomId: string,
  userId: string,
  mode: "preview" | "stage"
) {
  const service = createRoomServiceSupabase();
  const access = await requireOwner(service, roomId, userId);
  const days = await retentionDays(service, roomId);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const runResult = await service
    .from("room_retention_runs")
    .insert({
      room_id: roomId,
      mode,
      cutoff_at: cutoff,
      retention_days: days,
      started_by: userId,
    })
    .select("id")
    .single();
  if (runResult.error) throw new RoomRetentionError(runResult.error.message, 503);
  const runId = asString((runResult.data as RoomRow).id);

  try {
    const candidates = await buildCandidates(
      service,
      roomId,
      access.room.roomType,
      cutoff,
      mode
    );
    if (candidates.length > 0) {
      const insert = await service.from("room_retention_candidates").insert(
        candidates.map((candidate) => ({
          run_id: runId,
          room_id: roomId,
          target_type: candidate.targetType,
          target_id: candidate.targetId,
          record_created_at: candidate.recordCreatedAt,
          stage_status: candidate.stageStatus,
          exclusion_reason: candidate.exclusionReason,
          metadata: candidate.metadata,
          staged_at: candidate.stageStatus === "staged" ? new Date().toISOString() : null,
        }))
      );
      if (insert.error) throw new RoomRetentionError(insert.error.message, 503);
    }

    const excludedCount = candidates.filter((candidate) => candidate.stageStatus === "excluded").length;
    const stagedCount = candidates.filter((candidate) => candidate.stageStatus === "staged").length;
    const candidateCount = candidates.length - excludedCount;
    const summary = summarize(candidates);
    const completed = await service
      .from("room_retention_runs")
      .update({
        status: "completed",
        candidate_count: candidateCount,
        staged_count: stagedCount,
        excluded_count: excludedCount,
        summary,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("room_id", roomId);
    if (completed.error) throw new RoomRetentionError(completed.error.message, 503);

    await logAuditEvent({
      actor_id: userId,
      action: `room.retention_${mode}`,
      target_type: "room",
      target_id: roomId,
      metadata: {
        room_id: roomId,
        run_id: runId,
        retention_days: days,
        cutoff_at: cutoff,
        candidate_count: candidateCount,
        staged_count: stagedCount,
        excluded_count: excludedCount,
      },
    });

    return {
      ok: true,
      runId,
      mode,
      cutoffAt: cutoff,
      retentionDays: days,
      candidateCount,
      stagedCount,
      excludedCount,
      summary,
      permanentDeletionEnabled: false,
    };
  } catch (error) {
    await service
      .from("room_retention_runs")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message.slice(0, 1000) : "Retention failed.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("room_id", roomId);
    throw error;
  }
}

export async function createRoomRetentionHold(
  roomId: string,
  userId: string,
  input: JsonObject
) {
  const service = createRoomServiceSupabase();
  await requireOwner(service, roomId, userId);
  const targetType = asString(input.targetType) || "room";
  const allowed = [
    "room",
    "room_post",
    "room_post_reply",
    "room_module_record",
    "room_event",
    "room_announcement",
    "room_attachment",
  ];
  if (!allowed.includes(targetType)) throw new RoomRetentionError("Choose a valid hold type.");
  const targetId = targetType === "room" ? null : input.targetId;
  if (targetType !== "room" && !validUuid(targetId)) {
    throw new RoomRetentionError("Choose a valid record for the hold.");
  }
  const reason = asString(input.reason).slice(0, 1000);
  if (!reason) throw new RoomRetentionError("A hold reason is required.");
  const result = await service
    .from("room_retention_holds")
    .insert({
      room_id: roomId,
      target_type: targetType,
      target_id: targetId,
      reason,
      created_by: userId,
    })
    .select("id")
    .single();
  if (result.error) throw new RoomRetentionError(result.error.message, 409);
  return { ok: true, id: asString((result.data as RoomRow).id) };
}

export async function releaseRoomRetentionHold(
  roomId: string,
  userId: string,
  holdId: unknown
) {
  const service = createRoomServiceSupabase();
  await requireOwner(service, roomId, userId);
  if (!validUuid(holdId)) throw new RoomRetentionError("Choose a valid hold.");
  const result = await service
    .from("room_retention_holds")
    .update({
      status: "released",
      released_by: userId,
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", holdId)
    .eq("room_id", roomId)
    .eq("status", "active")
    .select("id");
  if (result.error) throw new RoomRetentionError(result.error.message, 503);
  if (!result.data?.length) throw new RoomRetentionError("Active hold not found.", 404);
  return { ok: true };
}
