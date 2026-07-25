import "server-only";

import { ExpansionError } from "@/lib/room-expansion-service";
import { asString } from "@/lib/room-operations";
import {
  cancelRoomCalendarEvent,
  createRoomCalendarEvent,
  loadRoomCalendar as loadRoomCalendarBase,
  roomCalendarIsAdvanced,
  setRoomCalendarRsvp,
  updateRoomCalendarEvent,
} from "@/lib/room-calendar-service";

const RSVP_STATUSES = new Set(["going", "maybe", "declined", "waitlist"]);
const MAX_RSVPS = 5000;
export const ROOM_EVENT_TITLE_MAX = 160;

export {
  cancelRoomCalendarEvent,
  createRoomCalendarEvent,
  roomCalendarIsAdvanced,
  setRoomCalendarRsvp,
  updateRoomCalendarEvent,
};

export function validateRoomCalendarInput(body) {
  if (
    typeof body?.title === "string" &&
    body.title.trim().length > ROOM_EVENT_TITLE_MAX
  ) {
    throw new ExpansionError(
      `Room event titles are limited to ${ROOM_EVENT_TITLE_MAX} characters.`,
      400,
      "room_calendar_title_too_long"
    );
  }
  return body;
}

export function normalizeRoomCalendarError(error) {
  const message = error instanceof Error ? error.message : asString(error);
  if (message.includes("ROOM_EVENT_RSVPS_EXIST")) {
    return new ExpansionError(
      "This event already has responses. Keep its schedule unchanged, or cancel it and create a replacement event.",
      409,
      "room_calendar_schedule_has_rsvps"
    );
  }
  if (message.includes("ROOM_EVENT_CAPACITY_BELOW_RSVPS")) {
    return new ExpansionError(
      "Capacity cannot be reduced below the number of members already going.",
      409,
      "room_calendar_capacity_below_rsvps"
    );
  }
  return error;
}

function occurrenceKey(eventId, occurrenceStart) {
  const timestamp = new Date(occurrenceStart).toISOString();
  return `${eventId}:${timestamp}`;
}

export async function loadRoomCalendar(
  service,
  roomId,
  access,
  userId,
  options = {}
) {
  const calendar = await loadRoomCalendarBase(
    service,
    roomId,
    access,
    userId,
    options
  );
  if (options.advanced !== true || !calendar.events.length) return calendar;

  const eventIds = calendar.series.map((event) => event.id).filter(Boolean);
  if (!eventIds.length) return calendar;

  const responseResult = await service
    .from("room_event_rsvps")
    .select("*")
    .eq("room_id", roomId)
    .in("event_id", eventIds)
    .limit(MAX_RSVPS);
  if (responseResult.error) {
    throw new ExpansionError(
      responseResult.error.message || "Room event responses could not be loaded.",
      503,
      "room_calendar_rsvps_unavailable"
    );
  }

  const seriesStarts = new Map(
    calendar.series.map((event) => [event.id, event.startsAt])
  );
  const occurrences = new Map(
    calendar.events.map((event) => [
      occurrenceKey(event.seriesId || event.id, event.occurrenceStart || event.startsAt),
      event,
    ])
  );

  for (const event of calendar.events) {
    event.rsvpCounts = { going: 0, maybe: 0, declined: 0, waitlist: 0 };
    event.ownRsvp = null;
  }

  for (const response of responseResult.data ?? []) {
    const eventId = asString(response.event_id);
    const occurrenceStart =
      asString(response.occurrence_start) || seriesStarts.get(eventId);
    if (!eventId || !occurrenceStart) continue;
    const event = occurrences.get(occurrenceKey(eventId, occurrenceStart));
    if (!event) continue;
    const status = asString(response.status);
    if (RSVP_STATUSES.has(status)) event.rsvpCounts[status] += 1;
    if (asString(response.user_id) === userId) {
      event.ownRsvp = {
        status,
        note: asString(response.note),
        updatedAt: asString(response.updated_at) || null,
      };
    }
  }

  calendar.limits.rsvpsTruncated =
    (responseResult.data ?? []).length >= MAX_RSVPS;
  return calendar;
}
