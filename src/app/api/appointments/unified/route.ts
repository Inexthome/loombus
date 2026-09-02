import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

type UnifiedScheduleItem = {
  id: string;
  source: "business" | "marketplace" | "room";
  title: string;
  context: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  location: string | null;
  href: string;
};

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function appointmentStatus(value: unknown, proposedStart: unknown) {
  const status = text(value);
  if (status === "accepted") return "confirmed";
  if (status === "reschedule_proposed") return "time proposed";
  if (status === "pending" && text(proposedStart)) return "reschedule requested";
  return status || "pending";
}

function roomStatus(value: unknown) {
  const status = text(value);
  if (status === "accepted") return "approved";
  return status || "pending";
}

export async function GET(request: NextRequest) {
  try {
    const account = await verifyRequestAccountAccess(
      createRequestSupabase(request)
    );
    if (!account.ok) {
      return json({ error: account.error, code: account.code }, account.status);
    }

    const service = createRoomServiceSupabase();
    const userId = account.user.id;
    const [appointmentsResult, roomReservationsResult] = await Promise.all([
      service
        .from("business_appointment_requests")
        .select(
          "id, service_id, business_id, requested_start, requested_end, proposed_start, proposed_end, timezone, status, source_type, source_id, source_label, source_href"
        )
        .eq("requester_id", userId)
        .order("requested_start", { ascending: true })
        .limit(500),
      service
        .from("room_resource_reservations")
        .select(
          "id, room_id, resource_id, requested_start, requested_end, timezone, attendee_count, status, resource:room_reservable_resources(id,name,location_text), room:rooms(id,name)"
        )
        .eq("requester_id", userId)
        .order("requested_start", { ascending: true })
        .limit(500),
    ]);

    if (appointmentsResult.error) {
      return json(
        { error: "Unable to load your appointments.", code: "appointments_unavailable" },
        503
      );
    }

    const appointmentRows = (appointmentsResult.data ?? []) as Row[];
    const serviceIds = [...new Set(appointmentRows.map((row) => text(row.service_id)).filter(Boolean))];
    const businessIds = [...new Set(appointmentRows.map((row) => text(row.business_id)).filter(Boolean))];
    const [servicesResult, businessesResult] = await Promise.all([
      serviceIds.length
        ? service.from("business_appointment_services").select("id,name").in("id", serviceIds)
        : Promise.resolve({ data: [], error: null }),
      businessIds.length
        ? service.from("businesses").select("id,name,slug").in("id", businessIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const services = new Map(
      (((servicesResult.data ?? []) as Row[]).map((row) => [text(row.id), row]))
    );
    const businesses = new Map(
      (((businessesResult.data ?? []) as Row[]).map((row) => [text(row.id), row]))
    );

    const appointments: UnifiedScheduleItem[] = appointmentRows.map((row) => {
      const appointmentService = services.get(text(row.service_id));
      const business = businesses.get(text(row.business_id));
      const sourceType = text(row.source_type);
      const marketplace = sourceType === "marketplace_listing";
      const startsAt =
        text(row.status) === "reschedule_proposed" && text(row.proposed_start)
          ? text(row.proposed_start)
          : text(row.requested_start);
      const endsAt =
        text(row.status) === "reschedule_proposed" && text(row.proposed_end)
          ? text(row.proposed_end)
          : text(row.requested_end);
      const sourceHref = text(row.source_href);
      const businessSlug = text(business?.slug);
      return {
        id: `appointment:${text(row.id)}`,
        source: marketplace ? "marketplace" : "business",
        title:
          text(row.source_label) ||
          text(appointmentService?.name) ||
          (marketplace ? "Marketplace pickup" : "Appointment"),
        context: marketplace
          ? "Marketplace pickup"
          : text(business?.name) || "Business appointment",
        startsAt,
        endsAt: endsAt || null,
        timezone: text(row.timezone) || "UTC",
        status: appointmentStatus(row.status, row.proposed_start),
        location: null,
        href:
          sourceHref ||
          (businessSlug ? `/businesses/${encodeURIComponent(businessSlug)}` : "/appointments"),
      };
    });

    const roomReservations: UnifiedScheduleItem[] = roomReservationsResult.error
      ? []
      : (((roomReservationsResult.data ?? []) as Row[]).map((row) => {
          const resource = (row.resource ?? null) as Row | null;
          const room = (row.room ?? null) as Row | null;
          const roomId = text(row.room_id);
          return {
            id: `room:${text(row.id)}`,
            source: "room",
            title: text(resource?.name) || "Room facility",
            context: text(room?.name) || "Room reservation",
            startsAt: text(row.requested_start),
            endsAt: text(row.requested_end) || null,
            timezone: text(row.timezone) || "UTC",
            status: roomStatus(row.status),
            location: text(resource?.location_text) || null,
            href: roomId
              ? `/rooms/${encodeURIComponent(roomId)}/reservations`
              : "/appointments",
          };
        }) as UnifiedScheduleItem[]);

    const items = [...appointments, ...roomReservations].sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
    );

    return json({ items, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Unified appointments failure:", error);
    return json(
      {
        error: "Your Loombus schedule could not be loaded.",
        code: "unified_schedule_unavailable",
      },
      503
    );
  }
}
