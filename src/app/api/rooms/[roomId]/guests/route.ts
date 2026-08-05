import { NextResponse, type NextRequest } from "next/server";
import { createNotification, createNotifications } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import { asString, createRequestSupabase, createRoomServiceSupabase, getRoomAccess } from "@/lib/room-operations";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ roomId: string }> };

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "private, no-store" } });
}
function missingSchema(error: { code?: string } | null) {
  return error?.code === "42P01" || error?.code === "42703";
}
function validUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);
}
function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function validDate(value: unknown) {
  const date = new Date(typeof value === "string" ? value : "");
  return Number.isFinite(date.getTime()) ? date : null;
}

async function authorize(request: NextRequest, roomId: string) {
  const requestSupabase = createRequestSupabase(request);
  const account = await verifyRequestAccountAccess(requestSupabase);
  if (!account.ok) return { error: response({ error: account.error }, account.status) };
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, account.user.id).catch(() => null);
  if (!access) return { error: response({ error: "Room not found." }, 404) };
  if (!access.allowed) return { error: response({ error: "Room membership is required." }, 403) };
  return { service, access, userId: account.user.id };
}

async function managerIds(service: ReturnType<typeof createRoomServiceSupabase>, roomId: string, ownerId: string) {
  const result = await service.from("room_members").select("user_id, role, status").eq("room_id", roomId);
  const ids = (result.data ?? [])
    .filter((row) => ["owner", "admin", "administrator"].includes(asString(row.role).toLowerCase()) && !["blocked", "removed", "inactive"].includes(asString(row.status).toLowerCase()))
    .map((row) => asString(row.user_id));
  return [...new Set([ownerId, ...ids].filter(Boolean))];
}

export async function GET(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return response({ error: "Invalid Room id." }, 400);
  const auth = await authorize(request, roomId);
  if ("error" in auth) return auth.error;
  const { service, access, userId } = auth;

  const settingsResult = await service.from("room_guest_settings").select("*").eq("room_id", roomId).maybeSingle();
  if (missingSchema(settingsResult.error)) return response({ error: "Room Guests require the pending database migration.", code: "room_guests_migration_required" }, 503);

  let query = service.from("room_guest_passes").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }).limit(500);
  if (!access.canManage) query = query.eq("resident_id", userId);
  const passesResult = await query;
  if (missingSchema(passesResult.error)) return response({ error: "Room Guests require the pending database migration.", code: "room_guests_migration_required" }, 503);
  if (passesResult.error) return response({ error: "Guest passes could not be loaded." }, 503);

  const now = Date.now();
  const passes = (passesResult.data ?? []).map((row) => {
    const stored = asString(row.status) || "pending";
    const end = new Date(asString(row.ends_at)).getTime();
    const start = new Date(asString(row.starts_at)).getTime();
    const status = ["cancelled", "denied", "checked_out"].includes(stored)
      ? stored
      : Number.isFinite(end) && end < now
        ? "expired"
        : stored === "approved" && start <= now && end >= now
          ? "active"
          : stored;
    return { ...row, status };
  });

  return response({
    room: { id: access.room.id, name: access.room.name },
    access: { role: access.role, canManage: access.canManage },
    settings: settingsResult.data ?? { room_id: roomId, require_approval: true, vehicle_required: false, notes_required: false, maximum_active_guests: 10, maximum_duration_hours: 168, allow_recurring_guests: false },
    passes,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return response({ error: "Invalid Room id." }, 400);
  const auth = await authorize(request, roomId);
  if ("error" in auth) return auth.error;
  const { service, access, userId } = auth;
  const body = await request.json().catch(() => ({}));
  const action = clean(body.action, 40);

  const settingsResult = await service.from("room_guest_settings").select("*").eq("room_id", roomId).maybeSingle();
  if (missingSchema(settingsResult.error)) return response({ error: "Room Guests require the pending database migration.", code: "room_guests_migration_required" }, 503);
  const settings = settingsResult.data ?? { require_approval: true, vehicle_required: false, notes_required: false, maximum_active_guests: 10, maximum_duration_hours: 168 };

  if (action === "create") {
    const guestName = clean(body.guestName, 160);
    const startsAt = validDate(body.startsAt);
    const endsAt = validDate(body.endsAt);
    const vehicleMake = clean(body.vehicleMake, 80);
    const vehicleModel = clean(body.vehicleModel, 80);
    const licensePlate = clean(body.licensePlate, 40).toUpperCase();
    const notes = clean(body.notes, 2000);
    if (guestName.length < 2 || !startsAt || !endsAt || endsAt <= startsAt) return response({ error: "Enter a guest name and valid visit window." }, 400);
    const durationHours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
    if (durationHours > Number(settings.maximum_duration_hours ?? 168)) return response({ error: "This visit exceeds the Room maximum duration." }, 400);
    if (settings.vehicle_required && !licensePlate) return response({ error: "A license plate is required for this Room." }, 400);
    if (settings.notes_required && !notes) return response({ error: "Visit notes are required for this Room." }, 400);
    const status = settings.require_approval ? "pending" : "approved";
    const inserted = await service.from("room_guest_passes").insert({
      room_id: roomId, resident_id: userId, guest_name: guestName, visit_type: clean(body.visitType, 40) || "guest",
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), vehicle_make: vehicleMake || null,
      vehicle_model: vehicleModel || null, license_plate: licensePlate || null, notes: notes || null, status,
    }).select("*").single();
    if (inserted.error) return response({ error: "The guest registration could not be saved." }, 503);
    const managers = await managerIds(service, roomId, access.room.ownerId || access.room.createdBy);
    if (status === "pending") await createNotifications(managers.filter((id) => id !== userId).map((id) => ({ user_id: id, actor_id: userId, type: "room_guest_requested", target_type: "room_guest_pass", target_id: asString(inserted.data.id), room_id: roomId, message: `${guestName} was registered for ${access.room.name}.` }))).catch(() => null);
    else await createNotification({ user_id: userId, actor_id: userId, type: "room_guest_approved", target_type: "room_guest_pass", target_id: asString(inserted.data.id), room_id: roomId, message: `${guestName}'s guest pass is approved.` }).catch(() => null);
    return response({ ok: true, pass: inserted.data }, 201);
  }

  if (action === "settings") {
    if (!access.canManage) return response({ error: "Room management is required." }, 403);
    const maximumActiveGuests = Math.max(1, Math.min(100, Number(body.maximumActiveGuests ?? 10)));
    const maximumDurationHours = Math.max(1, Math.min(2160, Number(body.maximumDurationHours ?? 168)));
    const updated = await service.from("room_guest_settings").upsert({ room_id: roomId, require_approval: body.requireApproval !== false, vehicle_required: body.vehicleRequired === true, notes_required: body.notesRequired === true, allow_recurring_guests: body.allowRecurringGuests === true, maximum_active_guests: maximumActiveGuests, maximum_duration_hours: maximumDurationHours, updated_at: new Date().toISOString() }, { onConflict: "room_id" }).select("*").single();
    if (updated.error) return response({ error: "Guest settings could not be saved." }, 503);
    return response({ ok: true, settings: updated.data });
  }

  const passId = clean(body.passId, 60);
  if (!validUuid(passId)) return response({ error: "Invalid guest pass." }, 400);
  const current = await service.from("room_guest_passes").select("*").eq("id", passId).eq("room_id", roomId).maybeSingle();
  if (current.error || !current.data) return response({ error: "Guest pass not found." }, 404);
  const isResident = asString(current.data.resident_id) === userId;

  let changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let notificationType = "room_guest_updated";
  let message = `Guest pass for ${asString(current.data.guest_name)} was updated.`;
  if (action === "cancel") {
    if (!isResident && !access.canManage) return response({ error: "You cannot cancel this guest pass." }, 403);
    changes = { ...changes, status: "cancelled", cancelled_at: new Date().toISOString() };
    notificationType = "room_guest_cancelled";
    message = `Guest pass for ${asString(current.data.guest_name)} was cancelled.`;
  } else {
    if (!access.canManage) return response({ error: "Room management is required." }, 403);
    if (action === "approve") { changes = { ...changes, status: "approved", reviewed_by: userId, reviewed_at: new Date().toISOString(), review_note: clean(body.reviewNote, 1000) || null }; notificationType = "room_guest_approved"; message = `Guest pass for ${asString(current.data.guest_name)} was approved.`; }
    else if (action === "deny") { changes = { ...changes, status: "denied", reviewed_by: userId, reviewed_at: new Date().toISOString(), review_note: clean(body.reviewNote, 1000) || null }; notificationType = "room_guest_denied"; message = `Guest pass for ${asString(current.data.guest_name)} was denied.`; }
    else if (action === "check_in") { changes = { ...changes, status: "checked_in", checked_in_at: new Date().toISOString() }; notificationType = "room_guest_checked_in"; message = `${asString(current.data.guest_name)} checked in.`; }
    else if (action === "check_out") { changes = { ...changes, status: "checked_out", checked_out_at: new Date().toISOString() }; notificationType = "room_guest_checked_out"; message = `${asString(current.data.guest_name)} checked out.`; }
    else return response({ error: "Unsupported guest action." }, 400);
  }
  const updated = await service.from("room_guest_passes").update(changes).eq("id", passId).select("*").single();
  if (updated.error) return response({ error: "Guest pass could not be updated." }, 503);
  const residentId = asString(current.data.resident_id);
  if (residentId && residentId !== userId) await createNotification({ user_id: residentId, actor_id: userId, type: notificationType, target_type: "room_guest_pass", target_id: passId, room_id: roomId, message }).catch(() => null);
  return response({ ok: true, pass: updated.data });
}