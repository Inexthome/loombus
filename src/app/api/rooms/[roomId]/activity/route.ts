import { NextResponse, type NextRequest } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
} from "@/lib/room-operations";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };
type Row = Record<string, unknown>;
type ModuleKey = "discussions" | "calendar" | "reservations" | "maintenance" | "documents" | "polls" | "guests" | "finance";
type ActivityItem = {
  id: string;
  module: ModuleKey;
  title: string;
  detail: string | null;
  occurredAt: string;
  actorName: string | null;
  href: string;
};

const json = (payload: unknown, status = 200) =>
  NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
const validUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
const missingSchema = (error: { code?: string } | null) =>
  error?.code === "42P01" || error?.code === "42703";
const dateValue = (row: Row) =>
  asString(row.occurred_at ?? row.created_at ?? row.updated_at ?? row.paid_at ?? row.published_at ?? row.submitted_at);
const identity = (row: Row) =>
  asString(row.user_id ?? row.member_id ?? row.resident_id ?? row.requester_id ?? row.reported_by ?? row.created_by ?? row.author_id ?? row.actor_id);
const label = (row: Row, fallback: string) =>
  asString(row.title ?? row.name ?? row.subject ?? row.file_name ?? row.guest_name ?? row.description) || fallback;

async function load(service: ReturnType<typeof createRoomServiceSupabase>, table: string, roomId: string, limit = 250) {
  const result = await service.from(table).select("*").eq("room_id", roomId).limit(limit);
  if (missingSchema(result.error)) return [] as Row[];
  if (result.error) throw result.error;
  return (result.data ?? []) as Row[];
}

function visibleToMember(row: Row, userId: string) {
  return identity(row) === userId;
}

function item(module: ModuleKey, row: Row, title: string, detail: string | null, roomId: string): ActivityItem | null {
  const occurredAt = dateValue(row);
  if (!occurredAt) return null;
  return {
    id: `${module}:${asString(row.id) || occurredAt}`,
    module,
    title,
    detail,
    occurredAt,
    actorName: null,
    href: `/rooms/${encodeURIComponent(roomId)}/${module === "discussions" ? "" : module}`,
  };
}

export async function GET(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return json({ error: "Invalid Room id." }, 400);

  const account = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!account.ok) return json({ error: account.error }, account.status);

  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
  if (!access) return json({ error: "Room not found." }, 404);
  if (!access.allowed && !access.isOwner) return json({ error: "Room membership is required." }, 403);

  const [events, posts, replies, calendar, reservations, maintenance, documents, polls, guests, invoices, payments] = await Promise.all([
    load(service, "room_activity_events", roomId, 400),
    load(service, "room_posts", roomId),
    load(service, "room_post_replies", roomId),
    load(service, "room_events", roomId),
    load(service, "room_resource_reservations", roomId),
    load(service, "room_maintenance_requests", roomId),
    load(service, "room_documents", roomId),
    load(service, "room_polls", roomId),
    load(service, "room_guest_passes", roomId),
    load(service, "room_finance_invoices", roomId),
    load(service, "room_finance_payments", roomId),
  ]);

  const items: ActivityItem[] = [];
  const moduleMap: Record<string, ModuleKey> = {
    discussion: "discussions", discussions: "discussions", replies: "discussions",
    calendar: "calendar", events: "calendar", reservations: "reservations",
    maintenance: "maintenance", documents: "documents", polls: "polls",
    guests: "guests", finance: "finance",
  };

  for (const row of events) {
    const audience = asString(row.audience).toLowerCase();
    if (!access.canManage && audience && !["all", "members", "member", "public"].includes(audience) && identity(row) !== account.user.id) continue;
    const module = moduleMap[asString(row.module_key).toLowerCase()] ?? "discussions";
    const occurredAt = dateValue(row);
    if (!occurredAt) continue;
    items.push({
      id: `event:${asString(row.id) || occurredAt}`,
      module,
      title: asString(row.title ?? row.event_type).replaceAll("_", " ") || "Room activity",
      detail: asString(row.detail ?? row.summary) || null,
      occurredAt,
      actorName: null,
      href: `/rooms/${encodeURIComponent(roomId)}/${module === "discussions" ? "" : module}`,
    });
  }

  const add = (value: ActivityItem | null) => { if (value) items.push(value); };
  posts.forEach((row) => add(item("discussions", row, `Discussion posted: ${label(row, "Room discussion")}`, null, roomId)));
  replies.forEach((row) => add(item("discussions", row, "New discussion reply", null, roomId)));
  calendar.forEach((row) => add(item("calendar", row, `Calendar event: ${label(row, "Room event")}`, asString(row.status) || null, roomId)));
  documents.forEach((row) => add(item("documents", row, `Document published: ${label(row, "Room document")}`, asString(row.category) || null, roomId)));
  polls.forEach((row) => add(item("polls", row, `Poll opened: ${label(row, "Room poll")}`, asString(row.status) || null, roomId)));

  reservations.filter((row) => access.canManage || visibleToMember(row, account.user.id)).forEach((row) =>
    add(item("reservations", row, `Reservation ${asString(row.status) || "updated"}`, label(row, "Room resource"), roomId))
  );
  maintenance.filter((row) => access.canManage || visibleToMember(row, account.user.id)).forEach((row) =>
    add(item("maintenance", row, `Maintenance request ${asString(row.status) || "updated"}`, label(row, "Maintenance request"), roomId))
  );
  guests.filter((row) => access.canManage || visibleToMember(row, account.user.id)).forEach((row) =>
    add(item("guests", row, `Guest pass ${asString(row.status) || "updated"}`, access.canManage ? label(row, "Guest registration") : "Your guest registration", roomId))
  );
  invoices.filter((row) => access.canManage || visibleToMember(row, account.user.id)).forEach((row) =>
    add(item("finance", row, `Invoice ${asString(row.status) || "created"}`, label(row, "Room invoice"), roomId))
  );
  payments.filter((row) => access.canManage || visibleToMember(row, account.user.id)).forEach((row) =>
    add(item("finance", row, "Payment recorded", access.canManage ? label(row, "Room payment") : "Your Room payment", roomId))
  );

  const deduped = Array.from(new Map(items.map((entry) => [`${entry.module}:${entry.title}:${entry.occurredAt}`, entry])).values())
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 300);

  return json({ room: { id: access.room.id, name: access.room.name }, access: { canManage: access.canManage }, items: deduped });
}
