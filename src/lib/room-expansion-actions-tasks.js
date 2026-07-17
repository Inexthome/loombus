import "server-only";

import { randomUUID } from "node:crypto";
import { ExpansionError, asObject, cleanStringArray, cleanText, ensureRoomModule, safeIsoDate, validUuid } from "@/lib/room-expansion-service";
import { asString } from "@/lib/room-operations";
import { activeRoom, getRecord, requireManage } from "@/lib/room-expansion-actions-shared";

const TASK_STATUSES = new Set(["backlog", "open", "in_progress", "blocked", "completed"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const RECURRENCES = new Set(["none", "daily", "weekly", "monthly"]);

function normalizeSubtasks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const source = asObject(entry);
      const label = cleanText(source.label ?? entry, 240);
      if (!label) return null;
      return {
        id: validUuid(source.id) ? source.id : randomUUID(),
        label,
        done: source.done === true,
      };
    })
    .filter(Boolean)
    .slice(0, 100);
}

function nextRecurringDate(value, recurrence) {
  const base = value ? new Date(value) : new Date();
  if (!Number.isFinite(base.getTime())) return null;
  if (recurrence === "daily") base.setUTCDate(base.getUTCDate() + 1);
  if (recurrence === "weekly") base.setUTCDate(base.getUTCDate() + 7);
  if (recurrence === "monthly") base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString();
}

export async function createTask(service, access, userId, body) {
  ensureRoomModule(access, "tasks");
  requireManage(access);
  activeRoom(access);
  const title = cleanText(body.title, 200);
  if (!title) throw new ExpansionError("Enter a task title.", 400);
  const assigneeId = validUuid(body.assigneeId) ? body.assigneeId : null;
  if (assigneeId) {
    const member = await service
      .from("room_members")
      .select("id")
      .eq("room_id", access.room.id)
      .eq("user_id", assigneeId)
      .not("status", "in", "(blocked,removed,inactive)")
      .maybeSingle();
    if (member.error || !member.data) throw new ExpansionError("Choose an active Room member.", 400);
  }
  const recurrence = RECURRENCES.has(asString(body.recurrence)) ? asString(body.recurrence) : "none";
  const inserted = await service
    .from("room_module_records")
    .insert({
      room_id: access.room.id,
      module_key: "task",
      title,
      body: cleanText(body.description, 12000),
      status: TASK_STATUSES.has(asString(body.status)) ? asString(body.status) : "open",
      metadata: {
        assigneeId,
        dueAt: safeIsoDate(body.dueAt),
        priority: PRIORITIES.has(asString(body.priority)) ? asString(body.priority) : "normal",
        recurrence,
        subtasks: normalizeSubtasks(body.subtasks),
        dependencyIds: cleanStringArray(body.dependencyIds, 25, 36).filter(validUuid),
      },
      created_by: userId,
    })
    .select("id")
    .single();
  if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
  return { ok: true, recordId: inserted.data.id };
}

export async function updateTask(service, access, userId, body) {
  ensureRoomModule(access, "tasks");
  activeRoom(access);
  const record = await getRecord(service, access.room.id, body.recordId, "task");
  const metadata = asObject(record.metadata);
  const assigneeId = asString(metadata.assigneeId);
  if (!access.canManage && assigneeId !== userId) {
    throw new ExpansionError("Only Room managers or the assignee can update this task.", 403);
  }
  const nextStatus = TASK_STATUSES.has(asString(body.status))
    ? asString(body.status)
    : asString(record.status) || "open";
  const nextMetadata = {
    ...metadata,
    priority:
      access.canManage && PRIORITIES.has(asString(body.priority))
        ? asString(body.priority)
        : asString(metadata.priority) || "normal",
    dueAt:
      access.canManage && body.dueAt !== undefined
        ? safeIsoDate(body.dueAt)
        : metadata.dueAt ?? null,
    assigneeId:
      access.canManage && body.assigneeId !== undefined
        ? validUuid(body.assigneeId)
          ? body.assigneeId
          : null
        : metadata.assigneeId ?? null,
    recurrence:
      access.canManage && RECURRENCES.has(asString(body.recurrence))
        ? asString(body.recurrence)
        : asString(metadata.recurrence) || "none",
    subtasks:
      body.subtasks !== undefined
        ? normalizeSubtasks(body.subtasks)
        : Array.isArray(metadata.subtasks)
          ? metadata.subtasks
          : [],
    dependencyIds:
      access.canManage && body.dependencyIds !== undefined
        ? cleanStringArray(body.dependencyIds, 25, 36).filter(validUuid)
        : Array.isArray(metadata.dependencyIds)
          ? metadata.dependencyIds
          : [],
  };
  const update = await service
    .from("room_module_records")
    .update({
      status: nextStatus,
      metadata: nextMetadata,
      ...(access.canManage && body.title !== undefined
        ? { title: cleanText(body.title, 200) || record.title }
        : {}),
      ...(access.canManage && body.description !== undefined
        ? { body: cleanText(body.description, 12000) }
        : {}),
    })
    .eq("id", record.id)
    .eq("room_id", access.room.id);
  if (update.error) throw new ExpansionError(update.error.message, 503);

  if (
    nextStatus === "completed" &&
    asString(record.status) !== "completed" &&
    RECURRENCES.has(asString(nextMetadata.recurrence)) &&
    asString(nextMetadata.recurrence) !== "none"
  ) {
    const nextDue = nextRecurringDate(nextMetadata.dueAt, nextMetadata.recurrence);
    const recurring = await service.from("room_module_records").insert({
      room_id: access.room.id,
      module_key: "task",
      title: record.title,
      body: record.body,
      status: "open",
      metadata: {
        ...nextMetadata,
        dueAt: nextDue,
        subtasks: normalizeSubtasks(nextMetadata.subtasks).map((subtask) => ({
          ...subtask,
          id: randomUUID(),
          done: false,
        })),
        recurringFromId: record.id,
      },
      created_by: userId,
    });
    if (recurring.error) throw new ExpansionError(recurring.error.message, 503);
  }
  return { ok: true };
}

export async function addTaskComment(service, access, userId, body) {
  ensureRoomModule(access, "tasks");
  activeRoom(access);
  const record = await getRecord(service, access.room.id, body.recordId, "task");
  const comment = cleanText(body.comment, 4000);
  if (!comment) throw new ExpansionError("Enter a task comment.", 400);
  const inserted = await service.from("room_task_comments").insert({
    room_id: access.room.id,
    record_id: record.id,
    author_id: userId,
    body: comment,
  });
  if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
  return { ok: true };
}
