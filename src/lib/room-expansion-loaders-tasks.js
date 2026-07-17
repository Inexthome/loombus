import "server-only";

import { ensureRoomModule, loadProfilesMap, serializePlan, serializeRecord, ExpansionError } from "@/lib/room-expansion-service";
import { asString, profileFor } from "@/lib/room-operations";

async function recordsFor(service, roomId, moduleKey) {
  const result = await service
    .from("room_module_records")
    .select("*")
    .eq("room_id", roomId)
    .eq("module_key", moduleKey)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(300);
  if (result.error) throw new ExpansionError(result.error.message, 503);
  return (result.data ?? []).map(serializeRecord);
}

export async function loadExpansionManifest(access, userId) {
  const plan = serializePlan(access);
  return {
    room: access.room,
    access: {
      currentUserId: userId,
      role: access.role,
      isOwner: access.isOwner,
      canManage: access.canManage,
      canModerate: access.canModerate,
    },
    plan,
    capabilities: {
      studio: ["pro", "organization", "organization-plus", "enterprise"].includes(plan.id),
      organization: ["organization", "organization-plus", "enterprise"].includes(plan.id),
      enterprise: plan.id === "enterprise",
    },
  };
}

export async function loadTasks(service, roomId, access, userId) {
  ensureRoomModule(access, "tasks");
  const records = await recordsFor(service, roomId, "task");
  const ids = records.map((record) => record.id);
  const commentsResult = ids.length
    ? await service
        .from("room_task_comments")
        .select("*")
        .eq("room_id", roomId)
        .in("record_id", ids)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (commentsResult.error) throw new ExpansionError(commentsResult.error.message, 503);
  const comments = commentsResult.data ?? [];
  const profiles = await loadProfilesMap(service, [
    ...records.map((record) => record.createdBy),
    ...comments.map((comment) => asString(comment.author_id)),
  ]);
  return records.map((record) => ({
    ...record,
    creator: profileFor(profiles, record.createdBy),
    canUpdate: access.canManage || asString(record.metadata.assigneeId) === userId,
    comments: comments
      .filter((comment) => asString(comment.record_id) === record.id)
      .map((comment) => {
        const authorId = asString(comment.author_id);
        return {
          id: asString(comment.id),
          body: asString(comment.body),
          authorId,
          author: profileFor(profiles, authorId),
          createdAt: asString(comment.created_at) || null,
          updatedAt: asString(comment.updated_at) || null,
        };
      }),
  }));
}
