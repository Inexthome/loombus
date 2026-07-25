import "server-only";

import {
  ExpansionError,
  cleanStringArray,
  cleanText,
  ensureRoomModule,
  validUuid,
} from "@/lib/room-expansion-service";
import {
  cancelRoomCalendarEvent,
  createRoomCalendarEvent,
  setRoomCalendarRsvp,
  updateRoomCalendarEvent,
} from "@/lib/room-calendar";
import { asString } from "@/lib/room-operations";
import {
  activeRoom,
  getRecord,
  requireManage,
} from "@/lib/room-expansion-actions-shared";

export async function saveKnowledge(service, access, userId, body) {
  ensureRoomModule(access, "knowledge");
  requireManage(access);
  activeRoom(access);
  const title = cleanText(body.title, 200);
  if (!title) throw new ExpansionError("Enter a knowledge title.", 400);
  const status = body.publish === true ? "published" : "draft";
  const payload = {
    title,
    body: cleanText(body.content, 12000),
    status,
    metadata: {
      category: cleanText(body.category, 100) || "General",
      tags: cleanStringArray(body.tags, 30, 80),
      publishedAt: status === "published" ? new Date().toISOString() : null,
    },
    created_by: userId,
  };
  if (validUuid(body.recordId)) {
    const record = await getRecord(
      service,
      access.room.id,
      body.recordId,
      "knowledge"
    );
    const updated = await service
      .from("room_module_records")
      .update(payload)
      .eq("id", record.id)
      .eq("room_id", access.room.id);
    if (updated.error) throw new ExpansionError(updated.error.message, 503);
    return { ok: true, recordId: record.id };
  }
  const inserted = await service
    .from("room_module_records")
    .insert({
      room_id: access.room.id,
      module_key: "knowledge",
      ...payload,
    })
    .select("id")
    .single();
  if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
  return { ok: true, recordId: inserted.data.id };
}

export async function restoreKnowledge(service, access, userId, body) {
  ensureRoomModule(access, "knowledge");
  requireManage(access);
  activeRoom(access);
  const record = await getRecord(
    service,
    access.room.id,
    body.recordId,
    "knowledge"
  );
  if (!validUuid(body.versionId)) {
    throw new ExpansionError("Invalid knowledge version.", 400);
  }
  const version = await service
    .from("room_knowledge_versions")
    .select("*")
    .eq("id", body.versionId)
    .eq("room_id", access.room.id)
    .eq("record_id", record.id)
    .maybeSingle();
  if (version.error || !version.data) {
    throw new ExpansionError("Knowledge version not found.", 404);
  }
  const restored = await service
    .from("room_module_records")
    .update({
      title: version.data.title,
      body: version.data.body,
      metadata: version.data.metadata,
      created_by: userId,
    })
    .eq("id", record.id)
    .eq("room_id", access.room.id);
  if (restored.error) throw new ExpansionError(restored.error.message, 503);
  return { ok: true };
}

export async function createCalendarEvent(service, access, userId, body) {
  return createRoomCalendarEvent(service, access, userId, body, {
    advanced: true,
  });
}

export async function updateCalendarEvent(service, access, userId, body) {
  return updateRoomCalendarEvent(service, access, userId, body, {
    advanced: true,
  });
}

export async function cancelCalendarEvent(service, access, userId, body) {
  return cancelRoomCalendarEvent(service, access, userId, body);
}

export async function rsvpEvent(service, access, userId, body) {
  return setRoomCalendarRsvp(service, access, userId, body);
}
