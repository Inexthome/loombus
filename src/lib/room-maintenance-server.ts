import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification, createNotifications } from "@/lib/notifications";
import type { RoomAccess } from "@/lib/room-operations";

type Input = Record<string, unknown>;
type Row = Record<string, any>;

export class RoomMaintenanceError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "room_maintenance_error"
  ) {
    super(message);
  }
}

const CATEGORIES = new Set([
  "general", "gate", "lighting", "landscaping", "pool", "road", "water",
  "building", "parking", "safety", "other",
]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set([
  "submitted", "acknowledged", "assigned", "in_progress", "waiting",
  "resolved", "closed", "cancelled",
]);

function text(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function requireRoom(access: RoomAccess) {
  if ((!access.allowed && !access.isOwner) || access.room.status !== "active") {
    throw new RoomMaintenanceError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
}

function requireManager(access: RoomAccess) {
  requireRoom(access);
  if (!access.canManage) {
    throw new RoomMaintenanceError(
      "Room management access is required.",
      403,
      "room_management_required"
    );
  }
}

function normalizeRequest(row: Row) {
  return {
    id: String(row.id),
    roomId: String(row.room_id),
    requesterId: String(row.requester_id),
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    title: String(row.title),
    description: String(row.description),
    category: String(row.category),
    priority: String(row.priority),
    locationText: row.location_text ? String(row.location_text) : null,
    status: String(row.status),
    managerNote: row.manager_note ? String(row.manager_note) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    requester: row.requester ?? null,
    assignee: row.assignee ?? null,
  };
}

function normalizeUpdate(row: Row) {
  return {
    id: String(row.id),
    requestId: String(row.request_id),
    authorId: String(row.author_id),
    updateType: String(row.update_type),
    body: String(row.body),
    createdAt: String(row.created_at),
    author: row.author ?? null,
  };
}

async function managerIds(service: SupabaseClient, roomId: string) {
  const [room, members] = await Promise.all([
    service.from("rooms").select("owner_id").eq("id", roomId).maybeSingle(),
    service
      .from("room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .eq("status", "active")
      .in("role", ["owner", "administrator"]),
  ]);
  const ids = new Set<string>();
  if (room.data?.owner_id) ids.add(String(room.data.owner_id));
  for (const member of members.data ?? []) {
    if (member.user_id) ids.add(String(member.user_id));
  }
  return [...ids];
}

async function notifyManagers(
  service: SupabaseClient,
  access: RoomAccess,
  actorId: string,
  requestId: string,
  message: string,
  type: string
) {
  const recipients = (await managerIds(service, access.room.id)).filter(
    (id) => id !== actorId
  );
  await createNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      actor_id: actorId,
      type,
      target_type: "room_maintenance_request",
      target_id: requestId,
      room_id: access.room.id,
      message,
    }))
  ).catch(() => null);
}

async function notifyRequester(
  access: RoomAccess,
  actorId: string,
  requesterId: string,
  requestId: string,
  message: string,
  type: string
) {
  if (!requesterId || requesterId === actorId) return;
  await createNotification({
    user_id: requesterId,
    actor_id: actorId,
    type,
    target_type: "room_maintenance_request",
    target_id: requestId,
    room_id: access.room.id,
    message,
  }).catch(() => null);
}

export async function loadRoomMaintenance(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string
) {
  requireRoom(access);
  let query = service
    .from("room_maintenance_requests")
    .select("*, requester:profiles!room_maintenance_requests_requester_id_fkey(id,username,full_name,avatar_url), assignee:profiles!room_maintenance_requests_assigned_to_fkey(id,username,full_name,avatar_url)")
    .eq("room_id", access.room.id)
    .order("updated_at", { ascending: false })
    .limit(250);
  if (!access.canManage) query = query.eq("requester_id", userId);
  const requests = await query;
  if (requests.error) {
    if (requests.error.code === "42P01" || /schema cache/i.test(requests.error.message ?? "")) {
      throw new RoomMaintenanceError(
        "Maintenance Requests require the pending database migration.",
        503,
        "room_maintenance_migration_required"
      );
    }
    throw new RoomMaintenanceError("Maintenance Requests could not be loaded.", 503, "maintenance_load_failed");
  }
  const ids = (requests.data ?? []).map((row) => row.id);
  const updates = ids.length
    ? await service
        .from("room_maintenance_updates")
        .select("*, author:profiles!room_maintenance_updates_author_id_fkey(id,username,full_name,avatar_url)")
        .in("request_id", ids)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (updates.error) {
    throw new RoomMaintenanceError("Maintenance updates could not be loaded.", 503, "maintenance_updates_failed");
  }
  return {
    room: { id: access.room.id, name: access.room.name, roomType: access.room.roomType },
    access: { role: access.role, canManage: access.canManage, isOwner: access.isOwner },
    requests: (requests.data ?? []).map((row) => normalizeRequest(row as Row)),
    updates: (updates.data ?? []).map((row) => normalizeUpdate(row as Row)),
  };
}

export async function createMaintenanceRequest(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  requireRoom(access);
  const title = text(input.title, 160);
  const description = text(input.description, 8000);
  const category = text(input.category, 30) || "general";
  const priority = text(input.priority, 20) || "normal";
  if (title.length < 3) throw new RoomMaintenanceError("Add a clear request title.");
  if (description.length < 10) throw new RoomMaintenanceError("Describe the issue in at least 10 characters.");
  if (!CATEGORIES.has(category)) throw new RoomMaintenanceError("Choose a valid maintenance category.");
  if (!PRIORITIES.has(priority)) throw new RoomMaintenanceError("Choose a valid priority.");
  const result = await service
    .from("room_maintenance_requests")
    .insert({
      room_id: access.room.id,
      requester_id: userId,
      title,
      description,
      category,
      priority,
      location_text: text(input.locationText, 500) || null,
      status: "submitted",
    })
    .select("*")
    .single();
  if (result.error || !result.data) {
    throw new RoomMaintenanceError("Maintenance request could not be submitted.", 503, "maintenance_create_failed");
  }
  await service.from("room_maintenance_updates").insert({
    request_id: result.data.id,
    room_id: access.room.id,
    author_id: userId,
    update_type: "comment",
    body: "Maintenance request submitted.",
  });
  await notifyManagers(
    service,
    access,
    userId,
    String(result.data.id),
    `New maintenance request in ${access.room.name}: ${title}.`,
    "room_maintenance_requested"
  );
  return { request: normalizeRequest(result.data as Row) };
}

export async function updateMaintenanceRequest(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  requireManager(access);
  const requestId = text(input.requestId, 60);
  const status = text(input.status, 30);
  const assignedTo = text(input.assignedTo, 60) || null;
  const managerNote = text(input.managerNote, 4000) || null;
  const updateBody = text(input.updateBody, 4000);
  if (!requestId) throw new RoomMaintenanceError("Maintenance request is required.");
  if (status && !STATUSES.has(status)) throw new RoomMaintenanceError("Choose a valid maintenance status.");
  const current = await service
    .from("room_maintenance_requests")
    .select("*")
    .eq("id", requestId)
    .eq("room_id", access.room.id)
    .maybeSingle();
  if (current.error || !current.data) {
    throw new RoomMaintenanceError("Maintenance request not found.", 404, "maintenance_not_found");
  }
  const values: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (status) {
    values.status = status;
    values.resolved_at = status === "resolved" ? new Date().toISOString() : current.data.resolved_at;
    values.closed_at = status === "closed" ? new Date().toISOString() : current.data.closed_at;
  }
  if (Object.prototype.hasOwnProperty.call(input, "assignedTo")) values.assigned_to = assignedTo;
  if (Object.prototype.hasOwnProperty.call(input, "managerNote")) values.manager_note = managerNote;
  const updated = await service
    .from("room_maintenance_requests")
    .update(values)
    .eq("id", requestId)
    .eq("room_id", access.room.id)
    .select("*")
    .single();
  if (updated.error || !updated.data) {
    throw new RoomMaintenanceError("Maintenance request could not be updated.", 503, "maintenance_update_failed");
  }
  const timelineBody = updateBody || (status ? `Status changed to ${status.replaceAll("_", " ")}.` : assignedTo ? "Maintenance request assigned." : "Maintenance request updated.");
  await service.from("room_maintenance_updates").insert({
    request_id: requestId,
    room_id: access.room.id,
    author_id: userId,
    update_type: status ? (status === "resolved" || status === "closed" ? "resolution" : "status") : assignedTo ? "assignment" : "comment",
    body: timelineBody,
  });
  await notifyRequester(
    access,
    userId,
    String(updated.data.requester_id),
    requestId,
    `Your maintenance request “${updated.data.title}” is now ${String(updated.data.status).replaceAll("_", " ")}.`,
    "room_maintenance_updated"
  );
  return { request: normalizeRequest(updated.data as Row) };
}

export async function cancelOwnMaintenanceRequest(
  service: SupabaseClient,
  access: RoomAccess,
  userId: string,
  input: Input
) {
  requireRoom(access);
  const requestId = text(input.requestId, 60);
  const result = await service
    .from("room_maintenance_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("room_id", access.room.id)
    .eq("requester_id", userId)
    .in("status", ["submitted", "acknowledged", "assigned", "waiting"])
    .select("*")
    .maybeSingle();
  if (result.error || !result.data) {
    throw new RoomMaintenanceError("This maintenance request cannot be cancelled.", 409, "maintenance_cancel_failed");
  }
  await service.from("room_maintenance_updates").insert({
    request_id: requestId,
    room_id: access.room.id,
    author_id: userId,
    update_type: "status",
    body: "Request cancelled by the resident.",
  });
  await notifyManagers(
    service,
    access,
    userId,
    requestId,
    `Maintenance request cancelled in ${access.room.name}: ${result.data.title}.`,
    "room_maintenance_cancelled"
  );
  return { request: normalizeRequest(result.data as Row) };
}
