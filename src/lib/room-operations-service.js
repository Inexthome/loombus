import { NextResponse } from "next/server";
import {
  ROOM_MODULE_DEFINITIONS,
  getRoomPlanEntitlements,
} from "@/lib/room-plan-entitlements";
import {
  asNumber,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  normalizeRole,
  profileFor,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

export const REASONS = new Set(["spam", "harassment", "safety", "privacy", "misinformation", "inappropriate", "other"]);
export const TARGETS = new Set(["room_post", "room_member", "room_module_record", "room_resource", "room_announcement", "room_event"]);
export const MEMBER_ACTIONS = new Set(["activate", "mute", "suspend", "block", "remove"]);
export const MEMBER_ROLES = new Set(["administrator", "moderator", "member"]);
const DATA_MODULES = { resource: "resources", task: "tasks", poll: "polls", directory: "directory", knowledge: "knowledge", form: "forms", service: "services", workflow: "member-workflows" };

export function reply(body, status = 200, headers = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
}
export function error(message, status = 400, code) { return reply(code ? { error: message, code } : { error: message }, status); }
export function uuid(value) { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function text(value, max = 2000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function iso(value) { const raw = asString(value); if (!raw) return null; const date = new Date(raw); return Number.isFinite(date.getTime()) ? date.toISOString() : null; }
export function active(row) { const status = asString(row.status).toLowerCase(); const suspended = iso(row.suspended_until); return !["blocked", "removed", "inactive"].includes(status) && (!suspended || new Date(suspended).getTime() <= Date.now()); }
export function display(profile) { return profile?.full_name?.trim() || profile?.username?.trim() || "Room member"; }

async function auth(request) {
  try {
    const account = await verifyRequestAccountAccess(createRequestSupabase(request));
    if (!account.ok) return { response: error(account.error, account.status, account.code) };
    return { userId: account.user.id, service: createRoomServiceSupabase() };
  } catch { return { response: error("Rooms service is not configured.", 500) }; }
}
export async function context(request, routeContext) {
  const authorized = await auth(request);
  if (authorized.response) return authorized;
  const { roomId } = await routeContext.params;
  if (!uuid(roomId)) return { response: error("Invalid Room ID.", 400) };
  const access = await getRoomAccess(authorized.service, roomId, authorized.userId).catch(() => null);
  if (!access) return { response: error("Room not found.", 404) };
  if (!access.allowed) return { response: error("Room membership is required.", 403) };
  return { ...authorized, roomId, access, plan: getRoomPlanEntitlements(access.room.subscriptionPlan, access.room.subscriptionStatus) };
}
function roleCanOpen(access, key) {
  const required = ROOM_MODULE_DEFINITIONS[key].minimumRole;
  return required === "member" ? access.allowed : required === "manager" ? access.canManage : access.isOwner;
}
export async function visibleModules(service, roomId, access, plan) {
  const modules = new Set(plan.modules.filter((key) => roleCanOpen(access, key)));
  if (modules.has("directory") && !access.canManage) {
    const result = await service.from("room_module_settings").select("settings").eq("room_id", roomId).maybeSingle();
    const settings = result.data?.settings && typeof result.data.settings === "object" ? result.data.settings : {};
    if (settings.memberDirectoryVisible === false) modules.delete("directory");
  }
  return modules;
}
export function roomPayload(access, plan) {
  const row = access.rawRoom;
  return {
    id: access.room.id, name: access.room.name, status: access.room.status,
    subscriptionPlan: access.room.subscriptionPlan, subscriptionStatus: access.room.subscriptionStatus,
    planLabel: plan.label, ownerId: access.room.ownerId, memberLimit: access.room.memberLimit,
    archivedAt: iso(row.archived_at), deletionScheduledFor: iso(row.deletion_scheduled_for),
    deletionReason: access.isOwner ? asString(row.deletion_reason) : "",
    currentPeriodEnd: access.isOwner ? iso(row.stripe_current_period_end) : null,
    hasBillingPortal: access.isOwner && Boolean(asString(row.stripe_customer_id)),
    ownershipTransferredAt: access.canManage ? iso(row.ownership_transferred_at) : null,
  };
}
export async function usage(service, roomId, access, plan) {
  const [members, files, requests, posts] = await Promise.all([
    service.from("room_members").select("user_id,status,suspended_until").eq("room_id", roomId).limit(10000),
    service.from("room_resources").select("id,file_size_bytes").eq("room_id", roomId).limit(10000),
    service.from("room_applications").select("id", { count: "exact", head: true }).eq("room_id", roomId).eq("state", "pending"),
    service.from("room_posts").select("id", { count: "exact", head: true }).eq("room_id", roomId).is("deleted_at", null),
  ]);
  for (const result of [members, files, requests, posts]) if (result.error) throw new Error(result.error.message);
  const rows = members.data ?? [];
  const memberCount = rows.filter(active).length + (rows.some((row) => asString(row.user_id) === access.room.ownerId) ? 0 : 1);
  const fileRows = files.data ?? [];
  let includedRooms = 1;
  const subscriptionId = asString(access.rawRoom.stripe_subscription_id);
  if (subscriptionId) {
    const rooms = await service.from("rooms").select("id", { count: "exact", head: true }).eq("stripe_subscription_id", subscriptionId).in("status", ["active", "archived", "pending_deletion"]);
    if (!rooms.error) includedRooms = rooms.count ?? 1;
  }
  return {
    membersUsed: memberCount, memberLimit: plan.memberLimit,
    storageUsedBytes: fileRows.reduce((sum, row) => sum + Math.max(0, asNumber(row.file_size_bytes)), 0),
    storageLimitBytes: plan.storageBytes, fileCount: fileRows.length, maxFileBytes: plan.maxFileBytes,
    pendingRequests: requests.count ?? 0, discussionCount: posts.count ?? 0,
    includedRoomsUsed: includedRooms, includedRoomLimit: plan.roomLimit,
  };
}
export async function profileMap(service, rows) {
  return loadProfiles(service, [...new Set(rows.filter(Boolean))]);
}
export function serializeMember(row, profiles, privateFields) {
  const userId = asString(row.user_id); const profile = profileFor(profiles, userId);
  return { id: asString(row.id), userId, role: normalizeRole(row.role), status: asString(row.status) || "active",
    joinedAt: iso(row.joined_at) ?? iso(row.created_at), mutedUntil: iso(row.muted_until), suspendedUntil: iso(row.suspended_until),
    moderationNote: privateFields ? asString(row.moderation_note) : "", profile, displayName: display(profile) };
}
export function serializeReport(row, profiles) {
  const reporterId = asString(row.reporter_id), resolverId = asString(row.resolved_by);
  return { id: asString(row.id), reporterId, reporter: profileFor(profiles, reporterId), targetType: asString(row.target_type),
    targetId: asString(row.target_id), targetLabel: asString(row.target_label), targetSnapshot: asString(row.target_snapshot),
    reason: asString(row.reason), details: asString(row.details), state: asString(row.state) || "pending",
    resolutionNote: asString(row.resolution_note), resolver: resolverId ? profileFor(profiles, resolverId) : null,
    resolvedAt: iso(row.resolved_at), createdAt: iso(row.created_at) };
}
export async function reportables(service, roomId, modules) {
  const [posts, members, records, files, announcements, events] = await Promise.all([
    service.from("room_posts").select("id,title,body,created_at").eq("room_id", roomId).is("deleted_at", null).order("created_at", { ascending: false }).limit(60),
    service.from("room_members").select("id,user_id,role,status,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(60),
    service.from("room_module_records").select("id,title,module_key,created_at").eq("room_id", roomId).is("archived_at", null).order("created_at", { ascending: false }).limit(60),
    service.from("room_resources").select("id,file_name,mime_type,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(60),
    service.from("room_announcements").select("id,title,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(60),
    service.from("room_events").select("id,title,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(60),
  ]);
  const profiles = await profileMap(service, (members.data ?? []).map((row) => asString(row.user_id)));
  const items = [];
  if (modules.has("discussions")) items.push(...(posts.data ?? []).map((row) => ({ targetType: "room_post", targetId: row.id, label: row.title || "Room discussion", context: text(row.body, 180) })));
  if (modules.has("members")) items.push(...(members.data ?? []).filter(active).map((row) => ({ targetType: "room_member", targetId: row.id, label: display(profileFor(profiles, row.user_id)), context: `Member · ${normalizeRole(row.role)}` })));
  items.push(...(records.data ?? []).filter((row) => modules.has(DATA_MODULES[row.module_key])).map((row) => ({ targetType: "room_module_record", targetId: row.id, label: row.title || "Room item", context: DATA_MODULES[row.module_key] })));
  if (modules.has("files")) items.push(...(files.data ?? []).map((row) => ({ targetType: "room_resource", targetId: row.id, label: row.file_name, context: row.mime_type })));
  if (modules.has("announcements")) items.push(...(announcements.data ?? []).map((row) => ({ targetType: "room_announcement", targetId: row.id, label: row.title, context: "Announcement" })));
  if (modules.has("calendar")) items.push(...(events.data ?? []).map((row) => ({ targetType: "room_event", targetId: row.id, label: row.title, context: "Calendar event" })));
  return items.filter((item) => item.targetId);
}
export async function snapshot(service, roomId, targetType, targetId, modules) {
  const config = {
    room_post: ["room_posts", "id,title,body,author_id", "discussions"],
    room_member: ["room_members", "id,user_id,role,status", "members"],
    room_resource: ["room_resources", "id,file_name,mime_type,storage_path", "files"],
    room_announcement: ["room_announcements", "id,title,body", "announcements"],
    room_event: ["room_events", "id,title,description,location", "calendar"],
  }[targetType];
  if (targetType === "room_module_record") {
    const result = await service.from("room_module_records").select("id,title,body,module_key,archived_at").eq("room_id", roomId).eq("id", targetId).maybeSingle();
    if (result.error || !result.data || result.data.archived_at || !modules.has(DATA_MODULES[result.data.module_key])) return null;
    return { label: result.data.title || "Room item", snapshot: text(result.data.body) };
  }
  if (!config || !modules.has(config[2])) return null;
  const result = await service.from(config[0]).select(config[1]).eq("room_id", roomId).eq("id", targetId).maybeSingle();
  if (result.error || !result.data || (targetType === "room_member" && !active(result.data))) return null;
  const row = result.data;
  if (targetType === "room_post") return { label: row.title || "Room discussion", snapshot: text(row.body), userId: row.author_id };
  if (targetType === "room_member") { const profiles = await profileMap(service, [row.user_id]); return { label: display(profileFor(profiles, row.user_id)), snapshot: `Role: ${normalizeRole(row.role)}. Status: ${row.status}.`, userId: row.user_id }; }
  if (targetType === "room_resource") return { label: row.file_name || "Room file", snapshot: row.mime_type || "", storagePath: row.storage_path };
  return { label: row.title || "Room item", snapshot: text([row.body, row.description, row.location].filter(Boolean).join(" · ")) };
}
