import "server-only";

import { Buffer } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";

const FEED_PAST_DAYS = 30;
const FEED_FUTURE_DAYS = 365;
const MAX_SOURCE_ITEMS = 500;

export type CalendarFeedItem = {
  id: string;
  source: "public_event" | "room_event" | "appointment";
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  status: string;
};

function value(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function withinWindow(
  startsAt: string,
  endsAt: string | null,
  windowStart: number,
  windowEnd: number
) {
  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt ?? startsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return end >= windowStart && start <= windowEnd;
}

export async function loadCalendarFeedItems(
  service: SupabaseClient,
  userId: string,
  now = new Date()
): Promise<CalendarFeedItem[]> {
  const windowStartMs = now.getTime() - FEED_PAST_DAYS * 24 * 60 * 60 * 1000;
  const windowEndMs = now.getTime() + FEED_FUTURE_DAYS * 24 * 60 * 60 * 1000;
  const windowStart = new Date(windowStartMs).toISOString();
  const windowEnd = new Date(windowEndMs).toISOString();

  const [rsvpResult, membershipsResult, ownedRoomsResult, appointmentsResult] =
    await Promise.all([
      service
        .from("public_event_rsvps")
        .select("event_id")
        .eq("user_id", userId)
        .limit(MAX_SOURCE_ITEMS),
      service
        .from("room_members")
        .select("room_id")
        .eq("user_id", userId)
        .not("status", "in", "(blocked,removed,inactive)")
        .limit(MAX_SOURCE_ITEMS),
      service
        .from("rooms")
        .select("id")
        .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
        .limit(MAX_SOURCE_ITEMS),
      service
        .from("business_appointment_requests")
        .select(
          "id, service_id, requested_start, requested_end, proposed_start, proposed_end, status"
        )
        .or(`provider_id.eq.${userId},requester_id.eq.${userId}`)
        .in("status", ["pending", "accepted", "reschedule_proposed"])
        .limit(MAX_SOURCE_ITEMS),
    ]);

  const initialError =
    rsvpResult.error ||
    membershipsResult.error ||
    ownedRoomsResult.error ||
    appointmentsResult.error;
  if (initialError) throw initialError;

  const eventIds = [
    ...new Set(
      (rsvpResult.data ?? [])
        .map((row: any) => value(row.event_id))
        .filter(Boolean)
    ),
  ];
  const roomIds = [
    ...new Set([
      ...(membershipsResult.data ?? []).map((row: any) => value(row.room_id)),
      ...(ownedRoomsResult.data ?? []).map((row: any) => value(row.id)),
    ]),
  ].filter(Boolean);
  const serviceIds = [
    ...new Set(
      (appointmentsResult.data ?? [])
        .map((row: any) => value(row.service_id))
        .filter(Boolean)
    ),
  ];

  const [eventsResult, roomEventsResult, servicesResult] = await Promise.all([
    eventIds.length
      ? service
          .from("public_events")
          .select(
            "id, title, starts_at, ends_at, venue_name, city, region, event_format, status"
          )
          .in("id", eventIds)
          .in("status", ["published", "cancelled"])
          .gte("starts_at", windowStart)
          .lte("starts_at", windowEnd)
          .order("starts_at", { ascending: true })
          .limit(MAX_SOURCE_ITEMS)
      : Promise.resolve({ data: [], error: null }),
    roomIds.length
      ? service
          .from("room_events")
          .select("id, room_id, title, starts_at, ends_at, location")
          .in("room_id", roomIds)
          .gte("starts_at", windowStart)
          .lte("starts_at", windowEnd)
          .order("starts_at", { ascending: true })
          .limit(MAX_SOURCE_ITEMS)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? service
          .from("business_appointment_services")
          .select("id, name, location_text")
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const detailError =
    eventsResult.error || roomEventsResult.error || servicesResult.error;
  if (detailError) throw detailError;

  const serviceMap = new Map<string, any>(
    (servicesResult.data ?? []).map((row: any) => [value(row.id), row])
  );
  const items: CalendarFeedItem[] = [];

  for (const row of eventsResult.data ?? []) {
    const startsAt = String(row.starts_at);
    const endsAt = row.ends_at ? String(row.ends_at) : null;
    if (!withinWindow(startsAt, endsAt, windowStartMs, windowEndMs)) continue;

    const location =
      row.event_format === "online"
        ? "Online"
        : [row.venue_name, row.city, row.region].filter(Boolean).join(", ") ||
          null;
    items.push({
      id: value(row.id),
      source: "public_event",
      title: value(row.title) || "Loombus event",
      startsAt,
      endsAt,
      location,
      status: value(row.status),
    });
  }

  for (const row of roomEventsResult.data ?? []) {
    const startsAt = String(row.starts_at);
    const endsAt = row.ends_at ? String(row.ends_at) : null;
    if (!withinWindow(startsAt, endsAt, windowStartMs, windowEndMs)) continue;

    items.push({
      id: value(row.id),
      source: "room_event",
      title: value(row.title) || "Loombus Room event",
      startsAt,
      endsAt,
      location: value(row.location) || null,
      status: "scheduled",
    });
  }

  for (const row of appointmentsResult.data ?? []) {
    const appointmentService = serviceMap.get(value(row.service_id));
    const startsAt =
      row.status === "reschedule_proposed" && row.proposed_start
        ? String(row.proposed_start)
        : String(row.requested_start);
    const endsAt =
      row.status === "reschedule_proposed" && row.proposed_end
        ? String(row.proposed_end)
        : String(row.requested_end);
    if (!withinWindow(startsAt, endsAt, windowStartMs, windowEndMs)) continue;

    items.push({
      id: value(row.id),
      source: "appointment",
      title: value(appointmentService?.name) || "Loombus appointment",
      startsAt,
      endsAt,
      location: value(appointmentService?.location_text) || null,
      status: value(row.status),
    });
  }

  return items.sort(
    (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)
  );
}

function escapeIcsText(input: string) {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatUtc(input: string | Date) {
  const date = input instanceof Date ? input : new Date(input);
  if (!Number.isFinite(date.getTime())) return null;
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let remaining = Buffer.from(line, "utf8");
  let first = true;

  while (remaining.length > (first ? 75 : 74)) {
    let cut = first ? 75 : 74;
    while (cut > 0 && (remaining[cut] & 0xc0) === 0x80) cut -= 1;
    if (cut === 0) cut = first ? 75 : 74;

    chunks.push(
      `${first ? "" : " "}${remaining.subarray(0, cut).toString("utf8")}`
    );
    remaining = remaining.subarray(cut);
    first = false;
  }

  chunks.push(`${first ? "" : " "}${remaining.toString("utf8")}`);
  return chunks.join("\r\n");
}

function externalStatus(item: CalendarFeedItem) {
  if (item.status === "cancelled") return "CANCELLED";
  if (item.status === "pending" || item.status === "reschedule_proposed") {
    return "TENTATIVE";
  }
  return "CONFIRMED";
}

function eventClass(item: CalendarFeedItem) {
  return item.source === "public_event" ? "PUBLIC" : "PRIVATE";
}

export function serializeCalendarFeed(
  items: CalendarFeedItem[],
  generatedAt = new Date()
) {
  const dtstamp = formatUtc(generatedAt);
  if (!dtstamp) throw new Error("Unable to generate calendar timestamp.");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loombus//Private Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Loombus",
    "X-PUBLISHED-TTL:PT15M",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
  ];

  for (const item of items) {
    const startsAt = formatUtc(item.startsAt);
    if (!startsAt) continue;
    const endsAt = item.endsAt ? formatUtc(item.endsAt) : null;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${item.source}-${item.id}@loombus.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${startsAt}`
    );
    if (endsAt) lines.push(`DTEND:${endsAt}`);
    lines.push(
      `SUMMARY:${escapeIcsText(item.title)}`,
      `STATUS:${externalStatus(item)}`,
      `CLASS:${eventClass(item)}`,
      "TRANSP:OPAQUE"
    );
    if (item.location) {
      lines.push(`LOCATION:${escapeIcsText(item.location)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
