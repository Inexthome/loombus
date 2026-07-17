import "server-only";

import { ExpansionError, cleanStringArray, cleanText, ensureRoomModule, safeIsoDate, serializePlan, validUuid } from "@/lib/room-expansion-service";
import { asNumber, asString } from "@/lib/room-operations";
import { activeRoom, getRecord, requireManage } from "@/lib/room-expansion-actions-shared";

const RECURRENCES = new Set(["none", "daily", "weekly", "monthly"]);
const RSVP_STATUSES = new Set(["going", "maybe", "declined"]);

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
    const record = await getRecord(service, access.room.id, body.recordId, "knowledge");
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
  const record = await getRecord(service, access.room.id, body.recordId, "knowledge");
  if (!validUuid(body.versionId)) throw new ExpansionError("Invalid knowledge version.", 400);
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

function recurrenceRule(value) {
  const recurrence = RECURRENCES.has(asString(value)) ? asString(value) : "none";
  if (recurrence === "daily") return "FREQ=DAILY;INTERVAL=1";
  if (recurrence === "weekly") return "FREQ=WEEKLY;INTERVAL=1";
  if (recurrence === "monthly") return "FREQ=MONTHLY;INTERVAL=1";
  return null;
}

export async function createCalendarEvent(service, access, userId, body) {
  ensureRoomModule(access, "calendar");
  if (!["pro", "organization", "organization-plus", "enterprise"].includes(serializePlan(access).id)) {
    throw new ExpansionError("Expanded calendar operations begin with Room Pro.", 403);
  }
  requireManage(access);
  activeRoom(access);
  const title = cleanText(body.title, 180);
  const startsAt = safeIsoDate(body.startsAt);
  const endsAt = safeIsoDate(body.endsAt);
  if (!title || !startsAt) {
    throw new ExpansionError("Enter an event title and start time.", 400);
  }
  if (endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) {
    throw new ExpansionError("The event end must follow its start.", 400);
  }
  const capacity = Math.max(0, Math.min(100000, Math.floor(asNumber(body.capacity))));
  const inserted = await service.from("room_events").insert({
    room_id: access.room.id,
    title,
    description: cleanText(body.description, 3000),
    location: cleanText(body.location, 300),
    starts_at: startsAt,
    ends_at: endsAt,
    recurrence_rule: recurrenceRule(body.recurrence),
    recurrence_until: safeIsoDate(body.recurrenceUntil),
    timezone: cleanText(body.timezone, 100) || "UTC",
    capacity: capacity || null,
    registration_required: body.registrationRequired === true,
    created_by: userId,
  });
  if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
  return { ok: true };
}

export async function rsvpEvent(service, access, userId, body) {
  ensureRoomModule(access, "calendar");
  if (!["pro", "organization", "organization-plus", "enterprise"].includes(serializePlan(access).id)) {
    throw new ExpansionError("Expanded calendar operations begin with Room Pro.", 403);
  }
  activeRoom(access);
  if (!validUuid(body.eventId)) throw new ExpansionError("Invalid event.", 400);
  const event = await service
    .from("room_events")
    .select("id, capacity")
    .eq("id", body.eventId)
    .eq("room_id", access.room.id)
    .maybeSingle();
  if (event.error || !event.data) throw new ExpansionError("Event not found.", 404);
  let status = RSVP_STATUSES.has(asString(body.status)) ? asString(body.status) : "going";
  if (status === "going" && Number(event.data.capacity ?? 0) > 0) {
    const going = await service
      .from("room_event_rsvps")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", body.eventId)
      .eq("status", "going")
      .neq("user_id", userId);
    if (going.error) throw new ExpansionError(going.error.message, 503);
    if ((going.count ?? 0) >= Number(event.data.capacity)) status = "waitlist";
  }
  const saved = await service.from("room_event_rsvps").upsert(
    {
      room_id: access.room.id,
      event_id: body.eventId,
      user_id: userId,
      status,
      note: cleanText(body.note, 500),
    },
    { onConflict: "event_id,user_id" }
  );
  if (saved.error) throw new ExpansionError(saved.error.message, 503);
  return { ok: true, status };
}
