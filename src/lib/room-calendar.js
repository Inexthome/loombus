import "server-only";

import {
  ExpansionError,
  cleanText,
  ensureRoomModule,
  safeIsoDate,
  serializePlan,
  validUuid,
} from "@/lib/room-expansion-service";
import { asNumber, asString } from "@/lib/room-operations";
import {
  activeRoom,
  requireManage,
} from "@/lib/room-expansion-actions-shared";

const ADVANCED_CALENDAR_PLANS = new Set([
  "pro",
  "organization",
  "organization-plus",
  "enterprise",
]);
const RECURRENCES = new Set(["none", "daily", "weekly", "monthly"]);
const RSVP_STATUSES = new Set(["going", "maybe", "declined", "none"]);
const MAX_SERIES = 500;
const MAX_OCCURRENCES = 1000;
const MAX_RSVPS = 5000;

function schemaCompatibilityError(error) {
  const code = asString(error?.code);
  const message = asString(error?.message).toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST202" ||
    code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("could not find the function") ||
    message.includes("column") && message.includes("does not exist")
  );
}

function requireAdvancedCalendar(access) {
  const plan = serializePlan(access);
  if (!ADVANCED_CALENDAR_PLANS.has(plan.id)) {
    throw new ExpansionError(
      "Recurring events, RSVP capacity, and waitlists begin with Room Pro.",
      403,
      "room_calendar_advanced_plan_required"
    );
  }
  return plan;
}

function validTimezone(value) {
  const timezone = cleanText(value, 100) || "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    throw new ExpansionError(
      "Choose a valid IANA time zone.",
      400,
      "room_calendar_invalid_timezone"
    );
  }
}

function dateParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function localPartsTimestamp(parts) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0
  );
}

function localPartsToUtc(parts, timezone) {
  const desired = localPartsTimestamp(parts);
  let guess = desired;
  for (let index = 0; index < 6; index += 1) {
    const observed = dateParts(new Date(guess), timezone);
    const delta = desired - localPartsTimestamp(observed);
    guess += delta;
    if (Math.abs(delta) < 1000) break;
  }
  const result = new Date(guess);
  const verified = dateParts(result, timezone);
  if (
    verified.year !== parts.year ||
    verified.month !== parts.month ||
    verified.day !== parts.day ||
    verified.hour !== parts.hour ||
    verified.minute !== parts.minute
  ) {
    throw new ExpansionError(
      "That local time does not exist in the selected time zone because of a daylight-saving transition.",
      400,
      "room_calendar_invalid_local_time"
    );
  }
  return result.toISOString();
}

function parseLocalDateTime(value, timezone, allDay, label) {
  const raw = cleanText(value, 40);
  if (!raw) return null;
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) {
    throw new ExpansionError(`Choose a valid ${label}.`, 400, "room_calendar_invalid_time");
  }
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: allDay ? 0 : Number(match[4] ?? 0),
    minute: allDay ? 0 : Number(match[5] ?? 0),
    second: allDay ? 0 : Number(match[6] ?? 0),
  };
  const probe = new Date(localPartsTimestamp(parts));
  if (
    probe.getUTCFullYear() !== parts.year ||
    probe.getUTCMonth() + 1 !== parts.month ||
    probe.getUTCDate() !== parts.day ||
    parts.hour > 23 ||
    parts.minute > 59 ||
    parts.second > 59
  ) {
    throw new ExpansionError(`Choose a valid ${label}.`, 400, "room_calendar_invalid_time");
  }
  return localPartsToUtc(parts, timezone);
}

function inputDate(body, field, timezone, allDay, label) {
  const localValue = body?.[`${field}Local`];
  if (typeof localValue === "string" && localValue.trim()) {
    return parseLocalDateTime(localValue, timezone, allDay, label);
  }
  const iso = safeIsoDate(body?.[field]);
  if (body?.[field] && !iso) {
    throw new ExpansionError(`Choose a valid ${label}.`, 400, "room_calendar_invalid_time");
  }
  return iso;
}

function httpsUrl(value) {
  const raw = cleanText(value, 1000);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw new ExpansionError(
      "Use a valid HTTPS online meeting link.",
      400,
      "room_calendar_invalid_online_url"
    );
  }
}

function recurrenceRule(value) {
  const recurrence = RECURRENCES.has(asString(value)) ? asString(value) : "none";
  if (recurrence === "daily") return "FREQ=DAILY;INTERVAL=1";
  if (recurrence === "weekly") return "FREQ=WEEKLY;INTERVAL=1";
  if (recurrence === "monthly") return "FREQ=MONTHLY;INTERVAL=1";
  return null;
}

function recurrenceName(rule) {
  const normalized = asString(rule).toUpperCase();
  if (normalized.includes("FREQ=DAILY")) return "daily";
  if (normalized.includes("FREQ=WEEKLY")) return "weekly";
  if (normalized.includes("FREQ=MONTHLY")) return "monthly";
  return "none";
}

function normalizeEventInput(access, body, advanced) {
  ensureRoomModule(access, "calendar");
  if (advanced) requireAdvancedCalendar(access);
  requireManage(access);
  activeRoom(access);

  const title = cleanText(body?.title, 180);
  if (!title) {
    throw new ExpansionError("Enter an event title.", 400, "room_calendar_title_required");
  }

  const timezone = validTimezone(body?.timezone);
  const allDay = body?.allDay === true;
  const startsAt = inputDate(body, "startsAt", timezone, allDay, "event start time");
  const endsAt = inputDate(body, "endsAt", timezone, allDay, "event end time");
  if (!startsAt) {
    throw new ExpansionError(
      "Choose an event start time.",
      400,
      "room_calendar_start_required"
    );
  }
  if (endsAt && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new ExpansionError(
      "The event end must follow its start.",
      400,
      "room_calendar_end_before_start"
    );
  }

  const rule = advanced ? recurrenceRule(body?.recurrence) : null;
  const recurrenceUntil = rule
    ? inputDate(
        body,
        "recurrenceUntil",
        timezone,
        allDay,
        "recurrence end time"
      )
    : null;
  if (
    recurrenceUntil &&
    new Date(recurrenceUntil).getTime() < new Date(startsAt).getTime()
  ) {
    throw new ExpansionError(
      "The recurrence end must be on or after the first event.",
      400,
      "room_calendar_recurrence_before_start"
    );
  }

  const rawCapacity = Math.floor(asNumber(body?.capacity));
  const capacity = advanced && rawCapacity > 0 ? Math.min(rawCapacity, 100000) : null;

  return {
    title,
    description: cleanText(body?.description, 3000) || null,
    location: cleanText(body?.location, 300) || null,
    starts_at: startsAt,
    ends_at: endsAt,
    recurrence_rule: rule,
    recurrence_until: recurrenceUntil,
    timezone,
    capacity,
    registration_required: advanced && body?.registrationRequired === true,
    all_day: allDay,
    online_url: httpsUrl(body?.onlineUrl),
  };
}

async function eventForControl(service, access, eventId) {
  if (!validUuid(eventId)) {
    throw new ExpansionError("Invalid Room event.", 400, "room_calendar_invalid_event");
  }
  const result = await service
    .from("room_events")
    .select("*")
    .eq("id", eventId)
    .eq("room_id", access.room.id)
    .maybeSingle();
  if (result.error) throw new ExpansionError(result.error.message, 503);
  if (!result.data) {
    throw new ExpansionError("Room event not found.", 404, "room_calendar_event_not_found");
  }
  return result.data;
}

export async function createRoomCalendarEvent(
  service,
  access,
  userId,
  body,
  { advanced = false } = {}
) {
  const values = normalizeEventInput(access, body, advanced);
  const completePayload = {
    room_id: access.room.id,
    ...values,
    status: "scheduled",
    created_by: userId,
    updated_by: userId,
  };
  let result = await service
    .from("room_events")
    .insert(completePayload)
    .select("id")
    .single();

  if (result.error && schemaCompatibilityError(result.error)) {
    const {
      status: _status,
      updated_by: _updatedBy,
      all_day: _allDay,
      online_url: _onlineUrl,
      ...legacyPayload
    } = completePayload;
    result = await service
      .from("room_events")
      .insert(legacyPayload)
      .select("id")
      .single();
  }

  if (result.error || !result.data) {
    throw new ExpansionError(
      result.error?.message || "Unable to create the Room event.",
      503,
      "room_calendar_create_failed"
    );
  }
  return { ok: true, id: asString(result.data.id) };
}

export async function updateRoomCalendarEvent(
  service,
  access,
  userId,
  body,
  { advanced = false } = {}
) {
  ensureRoomModule(access, "calendar");
  if (advanced) requireAdvancedCalendar(access);
  requireManage(access);
  activeRoom(access);
  const existing = await eventForControl(service, access, body?.eventId);
  if (asString(existing.status) === "cancelled") {
    throw new ExpansionError(
      "Cancelled events cannot be edited. Create a replacement event instead.",
      409,
      "room_calendar_event_cancelled"
    );
  }
  const values = normalizeEventInput(access, body, advanced);
  let update = await service
    .from("room_events")
    .update({ ...values, updated_by: userId })
    .eq("id", existing.id)
    .eq("room_id", access.room.id);

  if (update.error && schemaCompatibilityError(update.error)) {
    const {
      all_day: _allDay,
      online_url: _onlineUrl,
      ...legacyValues
    } = values;
    update = await service
      .from("room_events")
      .update(legacyValues)
      .eq("id", existing.id)
      .eq("room_id", access.room.id);
  }
  if (update.error) {
    throw new ExpansionError(
      update.error.message || "Unable to update the Room event.",
      503,
      "room_calendar_update_failed"
    );
  }
  return { ok: true, id: asString(existing.id) };
}

export async function cancelRoomCalendarEvent(service, access, userId, body) {
  ensureRoomModule(access, "calendar");
  requireManage(access);
  activeRoom(access);
  const existing = await eventForControl(service, access, body?.eventId);
  if (asString(existing.status) === "cancelled") return { ok: true, status: "cancelled" };
  const now = new Date().toISOString();
  const update = await service
    .from("room_events")
    .update({
      status: "cancelled",
      cancelled_at: now,
      cancelled_by: userId,
      updated_by: userId,
    })
    .eq("id", existing.id)
    .eq("room_id", access.room.id);
  if (update.error && schemaCompatibilityError(update.error)) {
    throw new ExpansionError(
      "Apply the Room calendar expansion migration before cancelling events.",
      409,
      "room_calendar_migration_required"
    );
  }
  if (update.error) {
    throw new ExpansionError(
      update.error.message || "Unable to cancel the Room event.",
      503,
      "room_calendar_cancel_failed"
    );
  }
  return { ok: true, status: "cancelled" };
}

async function legacyRsvp(service, access, userId, event, body) {
  let status = RSVP_STATUSES.has(asString(body?.status)) ? asString(body.status) : "going";
  if (status === "none") {
    const removed = await service
      .from("room_event_rsvps")
      .delete()
      .eq("event_id", event.id)
      .eq("user_id", userId);
    if (removed.error) throw new ExpansionError(removed.error.message, 503);
    return { ok: true, status: null };
  }
  if (status === "going" && Number(event.capacity ?? 0) > 0) {
    const going = await service
      .from("room_event_rsvps")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "going")
      .neq("user_id", userId);
    if (going.error) throw new ExpansionError(going.error.message, 503);
    if ((going.count ?? 0) >= Number(event.capacity)) status = "waitlist";
  }
  const saved = await service.from("room_event_rsvps").upsert(
    {
      room_id: access.room.id,
      event_id: event.id,
      user_id: userId,
      status,
      note: cleanText(body?.note, 500),
    },
    { onConflict: "event_id,user_id" }
  );
  if (saved.error) throw new ExpansionError(saved.error.message, 503);
  return { ok: true, status };
}

export async function setRoomCalendarRsvp(service, access, userId, body) {
  ensureRoomModule(access, "calendar");
  requireAdvancedCalendar(access);
  activeRoom(access);
  const event = await eventForControl(service, access, body?.eventId);
  const requestedStatus = RSVP_STATUSES.has(asString(body?.status))
    ? asString(body.status)
    : "going";
  const occurrenceStart =
    safeIsoDate(body?.occurrenceStart) || safeIsoDate(event.starts_at);
  if (!occurrenceStart) {
    throw new ExpansionError(
      "Choose a valid event occurrence.",
      400,
      "room_calendar_invalid_occurrence"
    );
  }

  const result = await service.rpc("set_room_event_rsvp", {
    target_event_id: event.id,
    target_user_id: userId,
    target_occurrence_start: occurrenceStart,
    target_status: requestedStatus,
    target_note: cleanText(body?.note, 500),
  });

  if (result.error && schemaCompatibilityError(result.error)) {
    return legacyRsvp(service, access, userId, event, body);
  }
  if (result.error) {
    const message = asString(result.error.message);
    if (message.includes("ROOM_EVENT_RSVP_CLOSED")) {
      throw new ExpansionError(
        "This event occurrence is no longer accepting responses.",
        409,
        "room_calendar_rsvp_closed"
      );
    }
    if (message.includes("ROOM_EVENT_INVALID_OCCURRENCE")) {
      throw new ExpansionError(
        "Choose a valid event occurrence.",
        400,
        "room_calendar_invalid_occurrence"
      );
    }
    if (message.includes("ROOM_MEMBERSHIP_REQUIRED")) {
      throw new ExpansionError(
        "Active Room membership is required.",
        403,
        "room_membership_required"
      );
    }
    throw new ExpansionError(
      result.error.message || "Unable to save the event response.",
      503,
      "room_calendar_rsvp_failed"
    );
  }
  return {
    ok: true,
    status: result.data === "none" ? null : asString(result.data),
  };
}

function addLocalInterval(parts, frequency, step) {
  const date = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  );
  if (frequency === "daily") date.setUTCDate(date.getUTCDate() + step);
  else if (frequency === "weekly") date.setUTCDate(date.getUTCDate() + step * 7);
  else if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + step);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
  };
}

function serializeSeries(row) {
  return {
    id: asString(row.id),
    roomId: asString(row.room_id),
    title: asString(row.title) || "Room event",
    description: asString(row.description) || null,
    location: asString(row.location) || null,
    onlineUrl: asString(row.online_url) || null,
    startsAt: asString(row.starts_at),
    endsAt: asString(row.ends_at) || null,
    timezone: asString(row.timezone) || "UTC",
    recurrenceRule: asString(row.recurrence_rule) || null,
    recurrence: recurrenceName(row.recurrence_rule),
    recurrenceUntil: asString(row.recurrence_until) || null,
    capacity:
      row.capacity === null || row.capacity === undefined
        ? null
        : Math.max(1, asNumber(row.capacity)),
    registrationRequired: row.registration_required === true,
    allDay: row.all_day === true,
    status: asString(row.status) || "scheduled",
    cancelledAt: asString(row.cancelled_at) || null,
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
    updatedAt: asString(row.updated_at) || null,
  };
}

function occurrenceStarts(series, rangeStart, rangeEnd) {
  const base = new Date(series.startsAt);
  if (!Number.isFinite(base.getTime())) return [];
  const frequency = series.recurrence;
  if (frequency === "none") {
    return base <= rangeEnd && base >= rangeStart ? [base.toISOString()] : [];
  }

  const timezone = validTimezone(series.timezone);
  const baseParts = dateParts(base, timezone);
  const until = series.recurrenceUntil
    ? new Date(series.recurrenceUntil).getTime()
    : rangeEnd.getTime();
  const starts = [];
  for (let step = 0; step < MAX_OCCURRENCES; step += 1) {
    let occurrence;
    try {
      occurrence = new Date(
        localPartsToUtc(addLocalInterval(baseParts, frequency, step), timezone)
      );
    } catch {
      continue;
    }
    const timestamp = occurrence.getTime();
    if (timestamp > until || timestamp > rangeEnd.getTime()) break;
    if (timestamp >= rangeStart.getTime()) starts.push(occurrence.toISOString());
  }
  return starts;
}

function rsvpOccurrenceKey(eventId, occurrenceStart) {
  return `${eventId}:${new Date(occurrenceStart).toISOString()}`;
}

export async function loadRoomCalendar(
  service,
  roomId,
  access,
  userId,
  {
    advanced = false,
    rangeStart = new Date(Date.now() - 30 * 86400000).toISOString(),
    rangeEnd = new Date(Date.now() + 365 * 86400000).toISOString(),
    includeCancelled = true,
  } = {}
) {
  ensureRoomModule(access, "calendar");
  if (advanced) requireAdvancedCalendar(access);
  const from = new Date(rangeStart);
  const to = new Date(rangeEnd);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from) {
    throw new ExpansionError(
      "Choose a valid calendar range.",
      400,
      "room_calendar_invalid_range"
    );
  }
  const eventsResult = await service
    .from("room_events")
    .select("*")
    .eq("room_id", roomId)
    .order("starts_at", { ascending: true })
    .limit(MAX_SERIES);
  if (eventsResult.error) throw new ExpansionError(eventsResult.error.message, 503);
  const series = (eventsResult.data ?? []).map(serializeSeries);
  const eventIds = series.map((event) => event.id).filter(Boolean);
  const rsvpResult = advanced && eventIds.length
    ? await service
        .from("room_event_rsvps")
        .select("*")
        .eq("room_id", roomId)
        .in("event_id", eventIds)
        .limit(MAX_RSVPS)
    : { data: [], error: null };
  if (rsvpResult.error) throw new ExpansionError(rsvpResult.error.message, 503);

  const rsvpsByOccurrence = new Map();
  for (const response of rsvpResult.data ?? []) {
    const eventId = asString(response.event_id);
    const parent = series.find((event) => event.id === eventId);
    if (!parent) continue;
    const occurrenceStart =
      asString(response.occurrence_start) || parent.startsAt;
    const key = rsvpOccurrenceKey(eventId, occurrenceStart);
    const list = rsvpsByOccurrence.get(key) ?? [];
    list.push(response);
    rsvpsByOccurrence.set(key, list);
  }

  const occurrences = [];
  for (const event of series) {
    if (!includeCancelled && event.status === "cancelled") continue;
    const starts = advanced
      ? occurrenceStarts(event, from, to)
      : [event.startsAt].filter((value) => {
          const timestamp = new Date(value).getTime();
          return timestamp >= from.getTime() && timestamp <= to.getTime();
        });
    const baseStart = new Date(event.startsAt).getTime();
    const baseEnd = event.endsAt ? new Date(event.endsAt).getTime() : null;
    const duration = baseEnd && baseEnd > baseStart ? baseEnd - baseStart : null;

    for (const occurrenceStart of starts) {
      const matching = rsvpsByOccurrence.get(
        rsvpOccurrenceKey(event.id, occurrenceStart)
      ) ?? [];
      const counts = { going: 0, maybe: 0, declined: 0, waitlist: 0 };
      for (const response of matching) {
        const status = asString(response.status);
        if (Object.hasOwn(counts, status)) counts[status] += 1;
      }
      const own = matching.find((response) => asString(response.user_id) === userId);
      const occurrenceEnd = duration
        ? new Date(new Date(occurrenceStart).getTime() + duration).toISOString()
        : null;
      occurrences.push({
        ...event,
        seriesId: event.id,
        occurrenceId: `${event.id}:${occurrenceStart}`,
        occurrenceStart,
        startsAt: occurrenceStart,
        endsAt: occurrenceEnd,
        isRecurring: event.recurrence !== "none",
        rsvpCounts: counts,
        ownRsvp: own
          ? {
              status: asString(own.status),
              note: asString(own.note),
              updatedAt: asString(own.updated_at) || null,
            }
          : null,
      });
      if (occurrences.length >= MAX_OCCURRENCES) break;
    }
    if (occurrences.length >= MAX_OCCURRENCES) break;
  }

  occurrences.sort(
    (left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
  );

  return {
    events: occurrences,
    series,
    range: { start: from.toISOString(), end: to.toISOString() },
    limits: {
      series: MAX_SERIES,
      occurrences: MAX_OCCURRENCES,
      rsvps: MAX_RSVPS,
      seriesTruncated: series.length >= MAX_SERIES,
      occurrencesTruncated: occurrences.length >= MAX_OCCURRENCES,
      rsvpsTruncated: (rsvpResult.data ?? []).length >= MAX_RSVPS,
    },
  };
}

export function roomCalendarIsAdvanced(access) {
  return ADVANCED_CALENDAR_PLANS.has(serializePlan(access).id);
}
