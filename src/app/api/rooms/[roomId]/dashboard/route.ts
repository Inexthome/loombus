import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { asString, createRequestSupabase, createRoomServiceSupabase, getRoomAccess } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };
type Row = Record<string, unknown>;

const json = (payload: unknown, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const validUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const timestamp = (value: unknown) => { const parsed = new Date(asString(value)).getTime(); return Number.isFinite(parsed) ? parsed : 0; };
const unavailable = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "42703";

async function load(service: ReturnType<typeof createRoomServiceSupabase>, table: string, roomId: string, limit = 200) {
  const result = await service.from(table).select("*").eq("room_id", roomId).limit(limit);
  if (unavailable(result.error) || result.error) return [] as Row[];
  return (result.data ?? []) as Row[];
}

export async function GET(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);
  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) return json({ error: account.error }, account.status);
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
  if (!access) return json({ error: "Room not found." }, 404);
  if (!access.allowed) return json({ error: "Room membership is required." }, 403);

  const [reservations, maintenance, documents, polls, guests, invoices, events] = await Promise.all([
    load(service, "room_resource_reservations", roomId),
    load(service, "room_maintenance_requests", roomId),
    load(service, "room_documents", roomId),
    load(service, "room_polls", roomId),
    load(service, "room_guest_passes", roomId),
    load(service, "room_finance_invoices", roomId),
    load(service, "room_events", roomId),
  ]);

  const now = Date.now();
  const dayEnd = now + 24 * 60 * 60 * 1000;
  const visibleMaintenance = access.canManage ? maintenance : maintenance.filter((row) => asString(row.requester_id ?? row.created_by) === account.user.id);
  const visibleGuests = access.canManage ? guests : guests.filter((row) => asString(row.resident_id) === account.user.id);
  const visibleInvoices = access.canManage ? invoices : invoices.filter((row) => asString(row.member_id) === account.user.id);
  const activeStatuses = new Set(["pending", "open", "assigned", "in_progress", "approved", "active", "checked_in"]);

  return json({
    room: { id: access.room.id, name: access.room.name },
    access: { role: access.role, canManage: access.canManage },
    cards: {
      reservationsToday: reservations.filter((row) => { const start = timestamp(row.starts_at ?? row.start_at); return start >= now && start < dayEnd && !["cancelled", "denied"].includes(asString(row.status).toLowerCase()); }).length,
      upcomingEvents: events.filter((row) => timestamp(row.starts_at ?? row.start_at) >= now).length,
      openMaintenance: visibleMaintenance.filter((row) => activeStatuses.has(asString(row.status).toLowerCase())).length,
      activePolls: polls.filter((row) => asString(row.status).toLowerCase() === "open" && (!row.closes_at || timestamp(row.closes_at) >= now)).length,
      recentDocuments: documents.sort((a, b) => timestamp(b.created_at ?? b.published_at) - timestamp(a.created_at ?? a.published_at)).slice(0, 5),
      guestsToday: visibleGuests.filter((row) => { const start = timestamp(row.starts_at); return start >= now && start < dayEnd && !["cancelled", "denied", "expired"].includes(asString(row.status).toLowerCase()); }).length,
      outstandingCents: access.canManage ? visibleInvoices.filter((row) => !["paid", "waived", "cancelled"].includes(asString(row.status).toLowerCase())).reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0) : null,
    },
  });
}
