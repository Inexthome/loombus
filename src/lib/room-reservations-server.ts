import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoomAccess } from "@/lib/room-operations";

export class RoomReservationError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "room_reservation_error"
  ) {
    super(message);
  }
}

type Input = Record<string, unknown>;
type Row = Record<string, unknown>;

function text(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function isoDate(value: unknown, field: string) {
  const date = new Date(text(value, 100));
  if (!Number.isFinite(date.getTime())) {
    throw new RoomReservationError(`${field} is invalid.`, 400, "invalid_reservation_time");
  }
  return date;
}

function assertActiveRoom(access: RoomAccess) {
  if (!access.allowed && !access.isOwner) {
    throw new RoomReservationError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
  if (access.room.status !== "active") {
    throw new RoomReservationError(
      "Reservations are unavailable while this Room is not active.",
      409,
      "room_not_active"
    );
  }
}

function assertManager(access: RoomAccess) {
  assertActiveRoom(access);
  if (!access.canManage) {
    throw new RoomReservationError(
      "Room management access is required.",
      403,
      "room_management_required"
    );
  }
}

function normalizeResource(row: Row) {
  return {
    id: String(row.id ?? ""),
    roomId: String(row.room_id ?? ""),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : null,
    locationText: row.location_text ? String(row.location_text) : null,
    capacity: row.capacity == null ? null : Number(row.capacity),
    durationMinutes: Number(row.duration_minutes ?? 60),
    bufferMinutes: Number(row.buffer_minutes ?? 0),
    minimumNoticeMinutes: Number(row.minimum_notice_minutes ?? 60),
    maximumAdvanceDays: Number(row.maximum_advance_days ?? 90),
    approvalRequired: Boolean(row.approval_required),
    rules: row.rules ? String(row.rules) : null,
    status: String(row.status ?? "active"),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeReservation(row: Row) {
  return {
    id: String(row.id ?? ""),
    roomId: String(row.room_id ?? ""),
    resourceId: String(row.resource_id ?? ""),
    requesterId: String(row.requester_id ?? ""),
    requestedStart: String(row.requested_start ?? ""),
    requestedEnd: String(row.requested_end ?? ""),
    timezone: String(row.timezone ?? "UTC"),
    attendeeCount: row.attendee_count == null ? null : Number(row.attendee_count),
    note: row.note ? String(row.note) : null,
    managerNote: row.manager_note ? String(row.manager_note) : null,
    status: String(row.status ?? "pending"),
    actedBy: row.acted_by ? String(row.acted_by) : null,
    actedAt: row.acted_at ? String(row.acted_at) : null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    resource: row.resource ?? null,
    requester: row.requester ?? null,
  };
}

export async function loadRoomReservations(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string
) {
  assertActiveRoom(access);
  const resourcesResult = await service
    .from("room_reservable_resources")
    .select("*")
    .eq("room_id", access.room.id)
    .order("name", { ascending: true });
  if (resourcesResult.error) {
    if (resourcesResult.error.code === "42P01") {
      throw new RoomReservationError(
        "Room reservations require the pending database migration.",
        503,
        "room_reservations_migration_required"
      );
    }
    throw new RoomReservationError(resourcesResult.error.message, 500, "resources_load_failed");
  }

  let reservationQuery = service
    .from("room_resource_reservations")
    .select("*, resource:room_reservable_resources(id,name,location_text,duration_minutes), requester:profiles!room_resource_reservations_requester_id_fkey(id,username,full_name,avatar_url)")
    .eq("room_id", access.room.id)
    .order("requested_start", { ascending: true });
  if (!access.canManage) reservationQuery = reservationQuery.eq("requester_id", userId);
  const reservationsResult = await reservationQuery;
  if (reservationsResult.error) {
    throw new RoomReservationError(
      reservationsResult.error.message,
      500,
      "reservations_load_failed"
    );
  }

  return {
    room: {
      id: access.room.id,
      name: access.room.name,
      roomType: access.room.roomType,
    },
    access: {
      role: access.role,
      canManage: access.canManage,
      isOwner: access.isOwner,
    },
    resources: (resourcesResult.data ?? []).map((row) => normalizeResource(row as Row)),
    reservations: (reservationsResult.data ?? []).map((row) => normalizeReservation(row as Row)),
  };
}

export async function createRoomResource(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  assertManager(access);
  const name = text(input.name, 160);
  if (name.length < 2) {
    throw new RoomReservationError("Resource name is required.", 400, "resource_name_required");
  }
  const payload = {
    room_id: access.room.id,
    created_by: userId,
    name,
    description: text(input.description, 4000) || null,
    location_text: text(input.locationText, 500) || null,
    capacity: input.capacity === null || input.capacity === "" ? null : integer(input.capacity, 1, 1, 100000),
    duration_minutes: integer(input.durationMinutes, 60, 15, 1440),
    buffer_minutes: integer(input.bufferMinutes, 0, 0, 1440),
    minimum_notice_minutes: integer(input.minimumNoticeMinutes, 60, 0, 525600),
    maximum_advance_days: integer(input.maximumAdvanceDays, 90, 1, 730),
    approval_required: booleanValue(input.approvalRequired, true),
    rules: text(input.rules, 8000) || null,
    status: "active",
  };
  const result = await service
    .from("room_reservable_resources")
    .insert(payload)
    .select("*")
    .single();
  if (result.error) throw new RoomReservationError(result.error.message, 400, "resource_create_failed");
  return { resource: normalizeResource(result.data as Row) };
}

export async function setRoomResourceStatus(
  service: SupabaseClient,
  access: RoomAccess,
  input: Input
) {
  assertManager(access);
  const resourceId = text(input.resourceId, 100);
  const status = text(input.status, 20);
  if (!resourceId || !["active", "paused", "archived"].includes(status)) {
    throw new RoomReservationError("Choose a valid resource status.", 400, "invalid_resource_status");
  }
  const result = await service
    .from("room_reservable_resources")
    .update({ status })
    .eq("id", resourceId)
    .eq("room_id", access.room.id)
    .select("*")
    .maybeSingle();
  if (result.error || !result.data) {
    throw new RoomReservationError(result.error?.message || "Resource not found.", 404, "resource_not_found");
  }
  return { resource: normalizeResource(result.data as Row) };
}

export async function requestRoomReservation(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  assertActiveRoom(access);
  const resourceId = text(input.resourceId, 100);
  const resourceResult = await service
    .from("room_reservable_resources")
    .select("*")
    .eq("id", resourceId)
    .eq("room_id", access.room.id)
    .eq("status", "active")
    .maybeSingle();
  if (resourceResult.error || !resourceResult.data) {
    throw new RoomReservationError("This resource is not available.", 404, "resource_unavailable");
  }
  const resource = normalizeResource(resourceResult.data as Row);
  const start = isoDate(input.requestedStart, "Requested start");
  const now = Date.now();
  if (start.getTime() < now + resource.minimumNoticeMinutes * 60000) {
    throw new RoomReservationError("This reservation does not meet the minimum notice requirement.", 400, "minimum_notice_required");
  }
  if (start.getTime() > now + resource.maximumAdvanceDays * 86400000) {
    throw new RoomReservationError("This reservation is too far in advance.", 400, "advance_window_exceeded");
  }
  const end = new Date(start.getTime() + resource.durationMinutes * 60000);
  const attendeeCount = input.attendeeCount === null || input.attendeeCount === "" ? null : integer(input.attendeeCount, 1, 1, 100000);
  if (resource.capacity && attendeeCount && attendeeCount > resource.capacity) {
    throw new RoomReservationError("Attendee count exceeds this resource's capacity.", 400, "resource_capacity_exceeded");
  }
  const result = await service
    .from("room_resource_reservations")
    .insert({
      room_id: access.room.id,
      resource_id: resource.id,
      requester_id: userId,
      requested_start: start.toISOString(),
      requested_end: end.toISOString(),
      timezone: text(input.timezone, 100) || "UTC",
      attendee_count: attendeeCount,
      note: text(input.note, 4000) || null,
      status: resource.approvalRequired ? "pending" : "accepted",
      acted_by: resource.approvalRequired ? null : userId,
      acted_at: resource.approvalRequired ? null : new Date().toISOString(),
    })
    .select("*")
    .single();
  if (result.error) {
    if (result.error.code === "23P01") {
      throw new RoomReservationError("That time is already reserved.", 409, "room_resource_time_conflict");
    }
    throw new RoomReservationError(result.error.message, 400, "reservation_create_failed");
  }
  return { reservation: normalizeReservation(result.data as Row) };
}

export async function managerReservationAction(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  assertManager(access);
  const reservationId = text(input.reservationId, 100);
  const decision = text(input.decision, 30);
  const statusMap: Record<string, string> = {
    accept: "accepted",
    decline: "declined",
    cancel: "cancelled",
    complete: "completed",
  };
  const status = statusMap[decision];
  if (!reservationId || !status) {
    throw new RoomReservationError("Choose a valid reservation action.", 400, "invalid_reservation_action");
  }
  const result = await service
    .from("room_resource_reservations")
    .update({
      status,
      manager_note: text(input.managerNote, 4000) || null,
      acted_by: userId,
      acted_at: new Date().toISOString(),
    })
    .eq("id", reservationId)
    .eq("room_id", access.room.id)
    .select("*")
    .maybeSingle();
  if (result.error) {
    if (result.error.code === "23P01") {
      throw new RoomReservationError("That time is already reserved.", 409, "room_resource_time_conflict");
    }
    throw new RoomReservationError(result.error.message, 400, "reservation_update_failed");
  }
  if (!result.data) throw new RoomReservationError("Reservation not found.", 404, "reservation_not_found");
  return { reservation: normalizeReservation(result.data as Row) };
}

export async function cancelOwnRoomReservation(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  assertActiveRoom(access);
  const reservationId = text(input.reservationId, 100);
  const result = await service
    .from("room_resource_reservations")
    .update({ status: "cancelled", acted_by: userId, acted_at: new Date().toISOString() })
    .eq("id", reservationId)
    .eq("room_id", access.room.id)
    .eq("requester_id", userId)
    .in("status", ["pending", "accepted"])
    .select("*")
    .maybeSingle();
  if (result.error || !result.data) {
    throw new RoomReservationError(result.error?.message || "Reservation cannot be cancelled.", 409, "reservation_cancel_failed");
  }
  return { reservation: normalizeReservation(result.data as Row) };
}
