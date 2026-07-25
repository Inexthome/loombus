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

const CALENDAR_VIEWS = new Set(["upcoming", "past", "cancelled"]);
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

function boundedInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function eventMatchesView(event, view, now) {
  const startsAt = new Date(event.startsAt).getTime();
  if (!Number.isFinite(startsAt)) return false;
  if (view === "cancelled") return event.status === "cancelled";
  if (event.status === "cancelled") return false;
  const endsAt = event.endsAt
    ? new Date(event.endsAt).getTime()
    : startsAt;
  const effectiveEnd = Number.isFinite(endsAt) ? endsAt : startsAt;
  if (view === "past") return effectiveEnd < now;
  return effectiveEnd >= now;
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

  const requestedPageSize = boundedInteger(options.pageSize, 0, 50, 0);
  if (!requestedPageSize) {
    return {
      ...calendar,
      view: "all",
      pageInfo: null,
    };
  }

  const requestedView = asString(options.view);
  const view = CALENDAR_VIEWS.has(requestedView)
    ? requestedView
    : "upcoming";
  const now = Date.now();
  const filteredEvents = calendar.events
    .filter((event) => eventMatchesView(event, view, now))
    .sort((left, right) => {
      const difference =
        new Date(left.startsAt).getTime() -
        new Date(right.startsAt).getTime();
      return view === "past" ? -difference : difference;
    });

  const totalItems = filteredEvents.length;
  const totalPages = totalItems
    ? Math.ceil(totalItems / requestedPageSize)
    : 0;
  const requestedPage = boundedInteger(options.page, 0, 1000, 0);
  const page = totalPages
    ? Math.min(requestedPage, totalPages - 1)
    : 0;
  const offset = page * requestedPageSize;
  const events = filteredEvents.slice(offset, offset + requestedPageSize);
  const visibleSeriesIds = new Set(
    events.map((event) => event.seriesId || event.id).filter(Boolean)
  );
  const series = calendar.series.filter((event) =>
    visibleSeriesIds.has(event.id)
  );

  return {
    ...calendar,
    events,
    series,
    view,
    pageInfo: {
      page,
      pageSize: requestedPageSize,
      totalItems,
      totalPages,
      hasPrevious: page > 0,
      hasNext: page + 1 < totalPages,
      from: totalItems ? offset + 1 : 0,
      to: Math.min(offset + requestedPageSize, totalItems),
    },
    limits: {
      ...calendar.limits,
      filteredOccurrences: totalItems,
    },
  };
}
