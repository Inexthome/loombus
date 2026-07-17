import { NextRequest, NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { createRequestSupabase, createRoomServiceSupabase, getRoomAccess } from "@/lib/room-operations";
import type { CalendarItem } from "@/lib/events";

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function value(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const requestClient = createRequestSupabase(request);
    const access = await verifyRequestAccountAccess(requestClient);
    if (!access.ok) return json({ error: access.error, code: access.code }, access.status);

    const service = createRoomServiceSupabase();
    const userId = access.user.id;
    const now = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [rsvpResult, membershipsResult, ownedRoomsResult, appointmentsResult] =
      await Promise.all([
        service
          .from("public_event_rsvps")
          .select("event_id, response")
          .eq("user_id", userId),
        service
          .from("room_members")
          .select("room_id")
          .eq("user_id", userId)
          .not("status", "in", "(blocked,removed,inactive)"),
        service
          .from("rooms")
          .select("id")
          .or(`owner_id.eq.${userId},created_by.eq.${userId}`),
        service
          .from("business_appointment_requests")
          .select("*")
          .or(`provider_id.eq.${userId},requester_id.eq.${userId}`)
          .in("status", ["pending", "accepted", "reschedule_proposed"])
          .gte("requested_end", now)
          .order("requested_start", { ascending: true })
          .limit(300),
      ]);

    const schemaError =
      rsvpResult.error || membershipsResult.error || ownedRoomsResult.error || appointmentsResult.error;
    if (schemaError && /public_event|business_appointment|schema cache/i.test(schemaError.message ?? "")) {
      return json(
        {
          error: "The Events and Appointments migrations have not been applied.",
          code: "calendar_schema_unavailable",
        },
        503
      );
    }
    if (schemaError) throw schemaError;

    const eventIds = (rsvpResult.data ?? []).map((row: any) => value(row.event_id)).filter(Boolean);
    const roomIds = [
      ...new Set([
        ...(membershipsResult.data ?? []).map((row: any) => value(row.room_id)),
        ...(ownedRoomsResult.data ?? []).map((row: any) => value(row.id)),
      ]),
    ].filter(Boolean);

    const [
      eventsResult,
      roomEventsResult,
      roomRsvpsResult,
      roomsResult,
      servicesResult,
      businessesResult,
    ] = await Promise.all([
        eventIds.length
          ? service
              .from("public_events")
              .select("id, slug, title, starts_at, ends_at, timezone, venue_name, city, region, event_format, status")
              .in("id", eventIds)
              .in("status", ["published", "cancelled"])
              .gte("starts_at", now)
              .order("starts_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        roomIds.length
          ? service
              .from("room_events")
              .select("id, room_id, title, starts_at, ends_at, location")
              .in("room_id", roomIds)
              .gte("starts_at", now)
              .order("starts_at", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        roomIds.length
          ? service
              .from("room_event_rsvps")
              .select("event_id, response")
              .eq("user_id", userId)
              .in("room_id", roomIds)
          : Promise.resolve({ data: [], error: null }),
        roomIds.length
          ? service.from("rooms").select("id, name").in("id", roomIds)
          : Promise.resolve({ data: [], error: null }),
        (appointmentsResult.data ?? []).length
          ? service
              .from("business_appointment_services")
              .select("id, name, location_text")
              .in(
                "id",
                (appointmentsResult.data ?? []).map((row: any) => row.service_id)
              )
          : Promise.resolve({ data: [], error: null }),
        (appointmentsResult.data ?? []).length
          ? service
              .from("businesses")
              .select("id, name, slug")
              .in(
                "id",
                (appointmentsResult.data ?? []).map((row: any) => row.business_id)
              )
          : Promise.resolve({ data: [], error: null }),
      ]);

    const detailError =
      eventsResult.error ||
      roomEventsResult.error ||
      roomRsvpsResult.error ||
      roomsResult.error ||
      servicesResult.error ||
      businessesResult.error;
    if (detailError) throw detailError;

    const roomMap = new Map(
      (roomsResult.data ?? []).map((row: any) => [value(row.id), value(row.name)])
    );
    const serviceMap = new Map<string, any>(
      (servicesResult.data ?? []).map((row: any) => [value(row.id), row])
    );
    const businessMap = new Map<string, any>(
      (businessesResult.data ?? []).map((row: any) => [value(row.id), row])
    );
    const rsvpMap = new Map(
      (rsvpResult.data ?? []).map((row: any) => [value(row.event_id), value(row.response)])
    );
    const roomRsvpMap = new Map(
      (roomRsvpsResult.data ?? []).map((row: any) => [
        value(row.event_id),
        value(row.response),
      ])
    );

    const items: CalendarItem[] = [];
    for (const row of eventsResult.data ?? []) {
      const location =
        row.event_format === "online"
          ? "Online"
          : [row.venue_name, row.city, row.region].filter(Boolean).join(", ") || null;
      items.push({
        id: value(row.id),
        source: "public_event",
        title: value(row.title),
        startsAt: String(row.starts_at),
        endsAt: row.ends_at ? String(row.ends_at) : null,
        timezone: value(row.timezone) || "UTC",
        location,
        status: value(row.status),
        href: `/events/${encodeURIComponent(value(row.slug))}`,
        context: `Public event · ${rsvpMap.get(value(row.id)) ?? "saved"}`,
        response: (rsvpMap.get(value(row.id)) as "going" | "interested" | undefined) ?? null,
      });
    }
    for (const row of roomEventsResult.data ?? []) {
      items.push({
        id: value(row.id),
        source: "room_event",
        title: value(row.title),
        startsAt: String(row.starts_at),
        endsAt: row.ends_at ? String(row.ends_at) : null,
        timezone: "UTC",
        location: value(row.location) || null,
        status: "scheduled",
        href: `/rooms/${encodeURIComponent(value(row.room_id))}`,
        context: `Private Room · ${roomMap.get(value(row.room_id)) ?? "Room"}`,
        response:
          (roomRsvpMap.get(value(row.id)) as "going" | "interested" | undefined) ??
          null,
      });
    }
    for (const row of appointmentsResult.data ?? []) {
      const appointmentService = serviceMap.get(value(row.service_id));
      const business = businessMap.get(value(row.business_id));
      const startsAt = row.status === "reschedule_proposed" && row.proposed_start
        ? String(row.proposed_start)
        : String(row.requested_start);
      const endsAt = row.status === "reschedule_proposed" && row.proposed_end
        ? String(row.proposed_end)
        : String(row.requested_end);
      items.push({
        id: value(row.id),
        source: "appointment",
        title: value(appointmentService?.name) || "Appointment",
        startsAt,
        endsAt,
        timezone: value(row.timezone) || "UTC",
        location: value(appointmentService?.location_text) || null,
        status: value(row.status),
        href: "/appointments",
        context: `Appointment · ${value(business?.name) || "Business"}`,
      });
    }

    items.sort((left, right) =>
      new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
    );

    const reminderWindowEnd = Date.now() + 24 * 60 * 60 * 1000;
    const reminderItems = items
      .filter((item) => {
        const start = new Date(item.startsAt).getTime();
        return start > Date.now() && start <= reminderWindowEnd;
      })
      .slice(0, 20);

    for (const item of reminderItems) {
      const { data: delivery, error: deliveryError } = await service
        .from("schedule_reminder_deliveries")
        .upsert(
          {
            user_id: userId,
            source_type: item.source,
            source_id: item.id,
            reminder_key: `within_24_hours:${item.startsAt}`,
          },
          {
            onConflict: "user_id,source_type,source_id,reminder_key",
            ignoreDuplicates: true,
          }
        )
        .select("id")
        .maybeSingle();

      if (!deliveryError && delivery) {
        const roomId =
          item.source === "room_event" ? item.href.split("/").filter(Boolean).at(-1) : null;
        await createNotification({
          user_id: userId,
          type: "schedule_reminder",
          target_type:
            item.source === "public_event"
              ? "public_event"
              : item.source === "room_event"
                ? "room"
                : "appointment_request",
          target_id: roomId ?? item.id,
          message: `Reminder: ${item.title} starts within 24 hours.`,
        });
      }
    }

    return json({ items });
  } catch (error) {
    console.error("Calendar request failed:", error);
    return json({ error: "Unable to load your Loombus calendar." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestClient = createRequestSupabase(request);
    const access = await verifyRequestAccountAccess(requestClient);
    if (!access.ok) return json({ error: access.error, code: access.code }, access.status);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid calendar request." }, 400);
    }
    const input = body as Record<string, unknown>;
    if (value(input.action) !== "respond_room_event") {
      return json({ error: "Unsupported calendar action." }, 400);
    }
    const eventId = value(input.eventId);
    const response = value(input.response);
    if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
      return json({ error: "Invalid Room event id." }, 400);
    }
    if (!["going", "interested", "none"].includes(response)) {
      return json({ error: "Choose Going, Interested, or remove your response." }, 400);
    }

    const service = createRoomServiceSupabase();
    const { data: event, error } = await service
      .from("room_events")
      .select("id, room_id, title, starts_at, created_by")
      .eq("id", eventId)
      .maybeSingle();
    if (error || !event) return json({ error: "Room event not found." }, 404);

    const roomAccess = await getRoomAccess(service, event.room_id, access.user.id);
    if (!roomAccess?.allowed) {
      return json({ error: "Room membership is required." }, 403);
    }
    if (new Date(event.starts_at).getTime() <= Date.now()) {
      return json({ error: "This Room event is no longer accepting responses." }, 409);
    }

    if (response === "none") {
      const { error: deleteError } = await service
        .from("room_event_rsvps")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", access.user.id);
      if (deleteError) return json({ error: "Unable to remove your response." }, 503);
      return json({ response: null });
    }

    const { error: upsertError } = await service
      .from("room_event_rsvps")
      .upsert(
        {
          event_id: eventId,
          room_id: event.room_id,
          user_id: access.user.id,
          response,
        },
        { onConflict: "event_id,user_id" }
      );
    if (upsertError) return json({ error: "Unable to save your Room event response." }, 503);

    if (event.created_by && event.created_by !== access.user.id) {
      await createNotification({
        user_id: event.created_by,
        actor_id: access.user.id,
        type: "room_event_response",
        target_type: "room",
        target_id: event.room_id,
        message:
          response === "going"
            ? `A Room member is going to ${event.title}.`
            : `A Room member is interested in ${event.title}.`,
      });
    }

    return json({ response });
  } catch (error) {
    console.error("Calendar action failed:", error);
    return json({ error: "Unable to update the Room event response." }, 500);
  }
}
