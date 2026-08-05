import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { asString, createRequestSupabase, createRoomServiceSupabase, getRoomAccess } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };
type Row = Record<string, unknown>;

const json = (payload: unknown, status = 200) => NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const validUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const missingSchema = (error: { code?: string } | null) => error?.code === "42P01" || error?.code === "42703";
const cents = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const timestamp = (value: unknown) => { const parsed = new Date(asString(value)).getTime(); return Number.isFinite(parsed) ? parsed : 0; };

async function load(service: ReturnType<typeof createRoomServiceSupabase>, table: string, roomId: string) {
  const result = await service.from(table).select("*").eq("room_id", roomId).limit(2000);
  if (missingSchema(result.error) || result.error) return { available: false, rows: [] as Row[] };
  return { available: true, rows: (result.data ?? []) as Row[] };
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
  if (!access.canManage) return json({ error: "Room management is required to view operational insights." }, 403);

  const [reservations, maintenance, documents, polls, ballots, guests, invoices, payments] = await Promise.all([
    load(service, "room_resource_reservations", roomId), load(service, "room_maintenance_requests", roomId),
    load(service, "room_documents", roomId), load(service, "room_polls", roomId),
    load(service, "room_poll_ballots", roomId), load(service, "room_guest_passes", roomId),
    load(service, "room_finance_invoices", roomId), load(service, "room_finance_payments", roomId),
  ]);

  const now = Date.now();
  const since = now - 30 * 86_400_000;
  const openMaintenance = maintenance.rows.filter((row) => !["completed", "resolved", "cancelled", "closed"].includes(asString(row.status).toLowerCase())).length;
  const upcomingReservations = reservations.rows.filter((row) => timestamp(row.ends_at ?? row.end_at) >= now && !["cancelled", "denied"].includes(asString(row.status).toLowerCase())).length;
  const activeGuests = guests.rows.filter((row) => ["approved", "active", "checked_in"].includes(asString(row.status).toLowerCase()) && timestamp(row.ends_at) >= now).length;
  const billed = invoices.rows.filter((row) => asString(row.status) !== "waived").reduce((sum, row) => sum + cents(row.amount_cents), 0);
  const paid = payments.rows.reduce((sum, row) => sum + cents(row.amount_cents), 0);
  const recent = (rows: Row[]) => rows.filter((row) => timestamp(row.created_at ?? row.updated_at ?? row.paid_at ?? row.published_at ?? row.submitted_at) >= since).length;

  return json({
    generatedAt: new Date().toISOString(),
    modules: {
      reservations: { available: reservations.available, total: reservations.rows.length, upcoming: upcomingReservations, recent: recent(reservations.rows) },
      maintenance: { available: maintenance.available, total: maintenance.rows.length, open: openMaintenance, completed: Math.max(0, maintenance.rows.length - openMaintenance), recent: recent(maintenance.rows) },
      documents: { available: documents.available, total: documents.rows.length, pinned: documents.rows.filter((row) => row.is_pinned === true).length, downloads: documents.rows.reduce((sum, row) => sum + Number(row.download_count ?? row.downloads ?? 0), 0), recent: recent(documents.rows) },
      polls: { available: polls.available, total: polls.rows.length, open: polls.rows.filter((row) => asString(row.status).toLowerCase() === "open").length, ballots: ballots.rows.length, recent: recent(polls.rows) },
      guests: { available: guests.available, total: guests.rows.length, active: activeGuests, pending: guests.rows.filter((row) => asString(row.status).toLowerCase() === "pending").length, recent: recent(guests.rows) },
      finance: { available: invoices.available && payments.available, billedCents: billed, paidCents: paid, outstandingCents: Math.max(0, billed - paid), collectionRate: billed > 0 ? Math.round((paid / billed) * 100) : 0, recent: recent(invoices.rows) + recent(payments.rows) },
    },
  });
}
