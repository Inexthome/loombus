import "server-only";

import { randomUUID } from "node:crypto";
import { ExpansionError, asObject, cleanStringArray, cleanText, ensureRoomModule, safeIsoDate, validUuid } from "@/lib/room-expansion-service";
import { asNumber, asString } from "@/lib/room-operations";
import { activeRoom, getRecord, requireManage } from "@/lib/room-expansion-actions-shared";

const RESULT_VISIBILITY = new Set(["always", "after_vote", "after_close", "managers"]);
const FIELD_TYPES = new Set(["text", "textarea", "email", "number", "date", "select", "checkbox"]);

function normalizePollOptions(value) {
  return cleanStringArray(value, 20, 160).map((label) => ({ id: randomUUID(), label }));
}

export async function createPoll(service, access, userId, body) {
  ensureRoomModule(access, "polls");
  requireManage(access);
  activeRoom(access);
  const title = cleanText(body.title, 200);
  const options = normalizePollOptions(body.options);
  if (!title) throw new ExpansionError("Enter a poll question.", 400);
  if (options.length < 2) throw new ExpansionError("Add at least two poll options.", 400);
  const inserted = await service.from("room_module_records").insert({
    room_id: access.room.id,
    module_key: "poll",
    title,
    body: cleanText(body.description, 12000),
    status: "open",
    metadata: {
      options,
      allowMultiple: body.allowMultiple === true,
      closesAt: safeIsoDate(body.closesAt),
      anonymous: body.anonymous === true,
      quorum: Math.max(0, Math.min(100000, Math.floor(asNumber(body.quorum)))),
      resultVisibility: RESULT_VISIBILITY.has(asString(body.resultVisibility))
        ? asString(body.resultVisibility)
        : "after_vote",
    },
    created_by: userId,
  });
  if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
  return { ok: true };
}

export async function votePoll(service, access, userId, body) {
  ensureRoomModule(access, "polls");
  activeRoom(access);
  const record = await getRecord(service, access.room.id, body.recordId, "poll");
  const metadata = asObject(record.metadata);
  const closesAt = safeIsoDate(metadata.closesAt);
  if (
    asString(record.status) === "closed" ||
    (closesAt && new Date(closesAt).getTime() <= Date.now())
  ) throw new ExpansionError("This poll is closed.", 409);
  const allowedIds = new Set(
    (Array.isArray(metadata.options) ? metadata.options : [])
      .map((option) => asString(asObject(option).id))
      .filter(Boolean)
  );
  const selected = cleanStringArray(body.optionIds, 20, 36).filter((id) => allowedIds.has(id));
  if (!metadata.allowMultiple && selected.length > 1) throw new ExpansionError("Choose one poll option.", 400);
  if (selected.length < 1) throw new ExpansionError("Choose a poll option.", 400);
  const saved = await service.from("room_module_responses").upsert(
    {
      room_id: access.room.id,
      record_id: record.id,
      response_type: "poll_vote",
      responder_id: userId,
      payload: { optionIds: selected },
    },
    { onConflict: "record_id,responder_id,response_type" }
  );
  if (saved.error) throw new ExpansionError(saved.error.message, 503);
  return { ok: true };
}

export async function closePoll(service, access, body) {
  ensureRoomModule(access, "polls");
  requireManage(access);
  activeRoom(access);
  const record = await getRecord(service, access.room.id, body.recordId, "poll");
  const closed = await service
    .from("room_module_records")
    .update({ status: "closed" })
    .eq("id", record.id)
    .eq("room_id", access.room.id);
  if (closed.error) throw new ExpansionError(closed.error.message, 503);
  return { ok: true };
}

function normalizeFormFields(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const source = asObject(entry);
      const label = cleanText(source.label, 160);
      if (!label) return null;
      const type = FIELD_TYPES.has(asString(source.type)) ? asString(source.type) : "text";
      return {
        id: validUuid(source.id) ? source.id : randomUUID(),
        label,
        type,
        required: source.required === true,
        options: type === "select" ? cleanStringArray(source.options, 50, 120) : [],
      };
    })
    .filter(Boolean)
    .slice(0, 50);
}

export async function createForm(service, access, userId, body) {
  ensureRoomModule(access, "forms");
  requireManage(access);
  activeRoom(access);
  const title = cleanText(body.title, 200);
  const fields = normalizeFormFields(body.fields);
  if (!title) throw new ExpansionError("Enter a form title.", 400);
  if (!fields.length) throw new ExpansionError("Add at least one form field.", 400);
  const inserted = await service.from("room_module_records").insert({
    room_id: access.room.id,
    module_key: "form",
    title,
    body: cleanText(body.description, 12000),
    status: "active",
    metadata: {
      fields,
      oneResponsePerMember: true,
      confirmationMessage: cleanText(body.confirmationMessage, 500) || "Your response was submitted.",
    },
    created_by: userId,
  });
  if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
  return { ok: true };
}

function validateFormValues(fields, rawValues) {
  const values = asObject(rawValues);
  const cleaned = {};
  for (const field of fields) {
    const source = asObject(field);
    const id = asString(source.id);
    const type = asString(source.type) || "text";
    const raw = values[id];
    if (type === "checkbox") {
      cleaned[id] = raw === true;
      if (source.required === true && cleaned[id] !== true) {
        throw new ExpansionError(`${asString(source.label)} is required.`, 400);
      }
      continue;
    }
    const text = cleanText(raw, type === "textarea" ? 5000 : 1000);
    if (source.required === true && !text) throw new ExpansionError(`${asString(source.label)} is required.`, 400);
    if (type === "email" && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      throw new ExpansionError(`Enter a valid email for ${asString(source.label)}.`, 400);
    }
    if (type === "number" && text && !Number.isFinite(Number(text))) {
      throw new ExpansionError(`Enter a valid number for ${asString(source.label)}.`, 400);
    }
    if (type === "select" && text) {
      const allowed = new Set(cleanStringArray(source.options, 50, 120));
      if (!allowed.has(text)) throw new ExpansionError(`Choose a valid option for ${asString(source.label)}.`, 400);
    }
    cleaned[id] = text;
  }
  return cleaned;
}

export async function submitForm(service, access, userId, body) {
  ensureRoomModule(access, "forms");
  activeRoom(access);
  const record = await getRecord(service, access.room.id, body.recordId, "form");
  const metadata = asObject(record.metadata);
  const fields = normalizeFormFields(metadata.fields);
  const values = validateFormValues(fields, body.values);
  const saved = await service.from("room_module_responses").upsert(
    {
      room_id: access.room.id,
      record_id: record.id,
      response_type: "form_submission",
      responder_id: userId,
      payload: { values },
    },
    { onConflict: "record_id,responder_id,response_type" }
  );
  if (saved.error) throw new ExpansionError(saved.error.message, 503);
  return {
    ok: true,
    confirmationMessage: cleanText(metadata.confirmationMessage, 500) || "Your response was submitted.",
  };
}
