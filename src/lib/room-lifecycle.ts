import "server-only";

import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import {
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  normalizeRoom,
  normalizeRole,
  profileFor,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import {
  ROOM_MODULE_DEFINITIONS,
  getRoomPlanEntitlements,
  type RoomModuleKey,
} from "@/lib/room-plan-entitlements";
import { getRoomModelModuleDefinition } from "@/lib/room-model-profiles";
import { isCustomerSupportRoomType } from "@/lib/room-required-behaviors";

const SEARCH_LIMIT = 100;
const EXPORT_LIMIT = 5000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type JsonObject = Record<string, unknown>;
type SearchResult = {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  status: string;
  authorId: string | null;
  authorName: string | null;
  fileType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  href: string;
};

export class RoomLifecycleError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "room_lifecycle_error") {
    super(message);
    this.name = "RoomLifecycleError";
    this.status = status;
    this.code = code;
  }
}

export type RoomSearchFilters = {
  query: string;
  type: string;
  author: string;
  status: string;
  fileType: string;
  dateFrom: string;
  dateTo: string;
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function normalizedDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function textMatches(query: string, ...values: unknown[]) {
  if (!query) return true;
  return values
    .map((value) => asString(value).toLowerCase())
    .join(" ")
    .includes(query.toLowerCase());
}

function dateMatches(value: unknown, from: string, to: string) {
  const timestamp = normalizedDate(value);
  if (!timestamp) return !from && !to;
  const time = new Date(timestamp).getTime();
  if (from) {
    const minimum = new Date(`${from}T00:00:00.000Z`).getTime();
    if (Number.isFinite(minimum) && time < minimum) return false;
  }
  if (to) {
    const maximum = new Date(`${to}T23:59:59.999Z`).getTime();
    if (Number.isFinite(maximum) && time > maximum) return false;
  }
  return true;
}

function profileName(profile: ReturnType<typeof profileFor>) {
  return profile?.full_name || profile?.username || "Room member";
}

function memberIsActive(row: RoomRow) {
  const status = asString(row.status).toLowerCase();
  if (["blocked", "removed", "inactive"].includes(status)) return false;
  const suspendedUntil = normalizedDate(row.suspended_until);
  return !suspendedUntil || new Date(suspendedUntil).getTime() <= Date.now();
}

async function loadOwnedRoom(service: ServiceClient, roomId: string, userId: string) {
  const result = await service
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
    .maybeSingle();

  if (result.error) {
    throw new RoomLifecycleError(
      "The Room lifecycle record could not be loaded.",
      503,
      "room_lifecycle_storage_unavailable"
    );
  }
  const row = (result.data ?? null) as RoomRow | null;
  if (!row || ["deleted", "deleting"].includes(asString(row.status).toLowerCase())) {
    throw new RoomLifecycleError(
      "Only the Room owner can manage this Room.",
      403,
      "room_lifecycle_owner_required"
    );
  }
  return row;
}

async function loadSearchAccess(service: ServiceClient, roomId: string, userId: string) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) {
    throw new RoomLifecycleError("Room not found.", 404, "room_not_found");
  }
  if (!access.allowed && !access.isOwner) {
    throw new RoomLifecycleError(
      "Active Room membership is required.",
      403,
      "room_membership_required"
    );
  }
  return access;
}

function moduleCanOpen(access: RoomAccess, moduleKey: RoomModuleKey) {
  const definition = getRoomModelModuleDefinition(
    access.room.roomType,
    moduleKey,
    ROOM_MODULE_DEFINITIONS[moduleKey]
  );
  if (definition.minimumRole === "member") return access.allowed || access.isOwner;
  if (definition.minimumRole === "manager") return access.canManage || access.isOwner;
  return access.isOwner;
}

async function accessibleDiscussionRows(
  service: ServiceClient,
  access: RoomAccess,
  userId: string,
  limit: number
) {
  const privateCases = isCustomerSupportRoomType(access.room.roomType);
  let participantIds: string[] = [];

  if (privateCases && !access.canModerate) {
    const participantResult = await service
      .from("room_post_participants")
      .select("post_id")
      .eq("room_id", access.room.id)
      .eq("user_id", userId)
      .limit(limit);
    if (participantResult.error) {
      throw new RoomLifecycleError(
        "Room discussion permissions could not be verified.",
        503,
        "room_search_storage_unavailable"
      );
    }
    participantIds = ((participantResult.data ?? []) as RoomRow[])
      .map((row) => asString(row.post_id))
      .filter(Boolean);
  }

  let query = service
    .from("room_posts")
    .select("*")
    .eq("room_id", access.room.id)
    .is("deleted_at", null);

  if (privateCases && !access.canModerate) {
    const clauses = [`author_id.eq.${userId}`];
    if (participantIds.length > 0) clauses.push(`id.in.(${participantIds.join(",")})`);
    query = query.or(clauses.join(","));
  }

  const result = await query
    .order("last_activity_at", { ascending: false })
    .limit(limit);
  if (result.error) {
    throw new RoomLifecycleError(
      "Room discussions could not be searched.",
      503,
      "room_search_storage_unavailable"
    );
  }
  return (result.data ?? []) as RoomRow[];
}

async function roomSettings(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_module_settings")
    .select("settings")
    .eq("room_id", roomId)
    .maybeSingle();
  if (result.error) return {};
  return asObject((result.data as RoomRow | null)?.settings);
}

async function loadRows(
  service: ServiceClient,
  table: string,
  roomId: string,
  limit: number
): Promise<RoomRow[]> {
  const result = await service
    .from(table)
    .select("*")
    .eq("room_id", roomId)
    .limit(limit);
  if (result.error) {
    throw new RoomLifecycleError(
      "Room search is temporarily unavailable.",
      503,
      "room_search_storage_unavailable"
    );
  }
  return (result.data ?? []) as RoomRow[];
}

async function loadReplies(service: ServiceClient, postIds: string[]) {
  if (postIds.length === 0) return [] as RoomRow[];
  const result = await service
    .from("room_post_replies")
    .select("*")
    .in("post_id", postIds)
    .is("deleted_at", null)
    .limit(SEARCH_LIMIT * 5);
  if (result.error) {
    throw new RoomLifecycleError(
      "Room search is temporarily unavailable.",
      503,
      "room_search_storage_unavailable"
    );
  }
  return (result.data ?? []) as RoomRow[];
}

async function loadRecords(
  service: ServiceClient,
  roomId: string,
  allowedDataModules: Set<string>
) {
  if (allowedDataModules.size === 0) return [] as RoomRow[];
  const result = await service
    .from("room_module_records")
    .select("*")
    .eq("room_id", roomId)
    .in("module_key", [...allowedDataModules])
    .limit(SEARCH_LIMIT * 5);
  if (result.error) {
    throw new RoomLifecycleError(
      "Room search is temporarily unavailable.",
      503,
      "room_search_storage_unavailable"
    );
  }
  return (result.data ?? []) as RoomRow[];
}

export async function searchRoomContent(
  roomId: string,
  userId: string,
  filters: RoomSearchFilters
) {
  const service = createRoomServiceSupabase();
  const access = await loadSearchAccess(service, roomId, userId);
  const posts = await accessibleDiscussionRows(service, access, userId, SEARCH_LIMIT);
  const postIds = posts.map((row) => asString(row.id)).filter(Boolean);
  const settings = await roomSettings(service, roomId);
  const directoryVisible =
    access.canManage || access.isOwner || settings.memberDirectoryVisible !== false;

  const plan = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  const allowedDataModules = new Set<string>(
    plan.modules
      .filter((moduleKey) => moduleCanOpen(access, moduleKey))
      .map((moduleKey) => ROOM_MODULE_DEFINITIONS[moduleKey].dataModule)
      .filter((value): value is string => typeof value === "string")
  );

  const replies = await loadReplies(service, postIds);
  let attachments = await loadRows(
    service,
    "room_resource_attachments",
    roomId,
    SEARCH_LIMIT
  );
  const members = directoryVisible
    ? (await loadRows(service, "room_members", roomId, SEARCH_LIMIT)).filter(
        memberIsActive
      )
    : [];
  const records = await loadRecords(service, roomId, allowedDataModules);
  const events = await loadRows(service, "room_events", roomId, SEARCH_LIMIT);
  const announcements = await loadRows(
    service,
    "room_announcements",
    roomId,
    SEARCH_LIMIT
  );

  if (isCustomerSupportRoomType(access.room.roomType) && !access.canModerate) {
    const accessible = new Set(postIds);
    attachments = attachments.filter((row) => {
      const linkedPostId =
        asString(row.post_id) ||
        asString(row.room_post_id) ||
        asString(row.parent_post_id);
      return linkedPostId ? accessible.has(linkedPostId) : false;
    });
  }

  const profileIds = [
    ...posts.map((row) => asString(row.author_id)),
    ...replies.map((row) => asString(row.author_id)),
    ...members.map((row) => asString(row.user_id)),
    ...records.map((row) => asString(row.created_by)),
    ...events.map((row) => asString(row.created_by)),
    ...announcements.map((row) => asString(row.created_by)),
  ];
  const profiles = await loadProfiles(service, profileIds);
  const results: SearchResult[] = [];
  const typeFilter = filters.type.toLowerCase();

  function push(item: SearchResult) {
    if (typeFilter && typeFilter !== "all" && item.type !== typeFilter) return;
    if (filters.author && item.authorId !== filters.author) return;
    if (filters.status && filters.status !== "all" && item.status !== filters.status) return;
    if (
      filters.fileType &&
      (!item.fileType ||
        !item.fileType.toLowerCase().includes(filters.fileType.toLowerCase()))
    ) {
      return;
    }
    if (!dateMatches(item.updatedAt ?? item.createdAt, filters.dateFrom, filters.dateTo)) return;
    if (!textMatches(filters.query, item.title, item.excerpt, item.authorName)) return;
    results.push(item);
  }

  for (const row of posts) {
    const authorId = asString(row.author_id);
    push({
      id: asString(row.id),
      type: "discussion",
      title: asString(row.title) || "Room discussion",
      excerpt: asString(row.body).slice(0, 360),
      status: asString(row.status) || "open",
      authorId: authorId || null,
      authorName: profileName(profileFor(profiles, authorId)),
      fileType: null,
      createdAt: normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?discussion=${encodeURIComponent(
        asString(row.id)
      )}`,
    });
  }

  for (const row of replies) {
    const authorId = asString(row.author_id);
    push({
      id: asString(row.id),
      type: "reply",
      title: "Discussion reply",
      excerpt: asString(row.body).slice(0, 360),
      status: "active",
      authorId: authorId || null,
      authorName: profileName(profileFor(profiles, authorId)),
      fileType: null,
      createdAt: normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?discussion=${encodeURIComponent(
        asString(row.post_id)
      )}`,
    });
  }

  for (const row of attachments) {
    const fileName =
      asString(row.file_name) || asString(row.filename) || "Room attachment";
    const mimeType = asString(row.mime_type) || asString(row.content_type);
    push({
      id: asString(row.id),
      type: "file",
      title: fileName,
      excerpt: mimeType || "Private Room attachment",
      status: asString(row.status) || "active",
      authorId: asString(row.uploaded_by) || asString(row.created_by) || null,
      authorName: null,
      fileType: mimeType || fileName.split(".").pop() || null,
      createdAt: normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=files`,
    });
  }

  for (const row of members) {
    const memberId = asString(row.user_id);
    const profile = profileFor(profiles, memberId);
    push({
      id: asString(row.id) || memberId,
      type: "member",
      title: profileName(profile),
      excerpt: `Room ${normalizeRole(row.role)} member`,
      status: asString(row.status) || "active",
      authorId: memberId,
      authorName: profileName(profile),
      fileType: null,
      createdAt:
        normalizedDate(row.joined_at) ?? normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=members`,
    });
  }

  for (const row of records) {
    const moduleKey = asString(row.module_key);
    const authorId = asString(row.created_by);
    push({
      id: asString(row.id),
      type: moduleKey || "record",
      title: asString(row.title) || "Room record",
      excerpt: asString(row.body).slice(0, 360),
      status: asString(row.status) || "active",
      authorId: authorId || null,
      authorName: profileName(profileFor(profiles, authorId)),
      fileType: null,
      createdAt: normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=${encodeURIComponent(
        moduleKey
      )}`,
    });
  }

  for (const row of events) {
    const authorId = asString(row.created_by);
    push({
      id: asString(row.id),
      type: "event",
      title: asString(row.title) || "Room event",
      excerpt: [asString(row.description), asString(row.location)]
        .filter(Boolean)
        .join(" · "),
      status: asString(row.status) || "scheduled",
      authorId: authorId || null,
      authorName: profileName(profileFor(profiles, authorId)),
      fileType: null,
      createdAt: normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.starts_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=calendar`,
    });
  }

  for (const row of announcements) {
    const authorId = asString(row.created_by);
    push({
      id: asString(row.id),
      type: "announcement",
      title: asString(row.title) || "Announcement",
      excerpt: asString(row.body).slice(0, 360),
      status: asString(row.priority) || "normal",
      authorId: authorId || null,
      authorName: profileName(profileFor(profiles, authorId)),
      fileType: null,
      createdAt: normalizedDate(row.created_at),
      updatedAt:
        normalizedDate(row.updated_at) ?? normalizedDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=announcements`,
    });
  }

  results.sort((left, right) => {
    const leftTime = new Date(left.updatedAt ?? left.createdAt ?? 0).getTime();
    const rightTime = new Date(right.updatedAt ?? right.createdAt ?? 0).getTime();
    return rightTime - leftTime;
  });

  return {
    generatedAt: new Date().toISOString(),
    room: {
      id: access.room.id,
      name: access.room.name,
      status: access.room.status,
      isOwner: access.isOwner,
    },
    filters,
    results: results.slice(0, 250),
    resultCount: Math.min(results.length, 250),
    truncated: results.length > 250,
  };
}

async function countRows(service: ServiceClient, table: string, roomId: string) {
  const result = await service
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  return result.error ? null : result.count ?? 0;
}

export async function getRoomLifecycleOverview(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const row = await loadOwnedRoom(service, roomId, userId);
  const room = normalizeRoom(row);
  const members = await countRows(service, "room_members", roomId);
  const discussions = await countRows(service, "room_posts", roomId);
  const records = await countRows(service, "room_module_records", roomId);
  const attachments = await countRows(
    service,
    "room_resource_attachments",
    roomId
  );

  return {
    room: {
      id: room.id,
      name: room.name,
      status: room.status,
      plan: room.subscriptionPlan,
      subscriptionStatus: room.subscriptionStatus,
      isArchived: room.status.toLowerCase() === "archived",
      hasStripeSubscription: Boolean(asString(row.stripe_subscription_id)),
    },
    counts: { members, discussions, records, attachments },
    confirmations: { deletePhrase: `${room.name} DELETE` },
  };
}

async function tableRows(
  service: ServiceClient,
  table: string,
  roomId: string,
  limit = EXPORT_LIMIT
) {
  const result = await service
    .from(table)
    .select("*")
    .eq("room_id", roomId)
    .limit(limit);
  if (result.error) {
    return { rows: [] as RoomRow[], unavailable: result.error.message };
  }
  return { rows: (result.data ?? []) as RoomRow[], unavailable: null };
}

async function attachmentExportRows(service: ServiceClient, roomId: string) {
  const result = await tableRows(service, "room_resource_attachments", roomId);
  const rows: RoomRow[] = [];
  for (const row of result.rows) {
    const bucket =
      asString(row.bucket_name) ||
      asString(row.storage_bucket) ||
      asString(row.bucket);
    const path =
      asString(row.storage_path) ||
      asString(row.object_path) ||
      asString(row.path);
    let downloadUrl: string | null = null;
    if (bucket && path) {
      const signed = await service.storage.from(bucket).createSignedUrl(path, 3600);
      downloadUrl = signed.error ? null : signed.data.signedUrl;
    }
    rows.push({ ...row, export_download_url: downloadUrl });
  }
  return { rows, unavailable: result.unavailable };
}

export async function exportRoomData(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const roomRow = await loadOwnedRoom(service, roomId, userId);
  const room = normalizeRoom(roomRow);
  const tables = [
    "room_members",
    "room_applications",
    "room_posts",
    "room_post_replies",
    "room_post_participants",
    "room_events",
    "room_announcements",
    "room_module_records",
    "room_module_settings",
  ];

  const data: Record<string, { rows: RoomRow[]; unavailable: string | null }> = {};
  for (const table of tables) {
    data[table] = await tableRows(service, table, roomId);
  }
  const attachments = await attachmentExportRows(service, roomId);

  await logAuditEvent({
    actor_id: userId,
    action: "room.lifecycle.exported",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_status: room.status,
      attachment_count: attachments.rows.length,
    },
  });

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    signedAttachmentLinksExpireAt: new Date(
      Date.now() + 3_600_000
    ).toISOString(),
    room: roomRow,
    data,
    attachments,
  };
}

async function subscriptionBlocksDeletion(room: RoomRow) {
  const subscriptionId = asString(room.stripe_subscription_id);
  if (!subscriptionId) return false;
  if (!STRIPE_SECRET_KEY) {
    throw new RoomLifecycleError(
      "Room deletion is blocked until billing can verify that the paid subscription has ended.",
      503,
      "room_deletion_billing_verification_required"
    );
  }
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return ["active", "trialing", "past_due", "unpaid", "paused"].includes(
    subscription.status
  );
}

export async function updateRoomLifecycle(
  roomId: string,
  userId: string,
  action: "archive" | "restore" | "delete",
  confirmation?: string
) {
  const service = createRoomServiceSupabase();
  const row = await loadOwnedRoom(service, roomId, userId);
  const room = normalizeRoom(row);
  const status = room.status.toLowerCase();

  if (action === "archive") {
    if (status === "archived") return { ok: true, status: "archived" };
    const result = await service
      .from("rooms")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .or(`owner_id.eq.${userId},created_by.eq.${userId}`);
    if (result.error) {
      throw new RoomLifecycleError(
        "The Room could not be archived.",
        503,
        "room_archive_failed"
      );
    }
    await logAuditEvent({
      actor_id: userId,
      action: "room.lifecycle.archived",
      target_type: "room",
      target_id: roomId,
      metadata: { previous_status: room.status },
    });
    return { ok: true, status: "archived" };
  }

  if (action === "restore") {
    if (status !== "archived") {
      throw new RoomLifecycleError(
        "Only an archived Room can be restored.",
        409,
        "room_restore_not_archived"
      );
    }
    const result = await service
      .from("rooms")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .or(`owner_id.eq.${userId},created_by.eq.${userId}`);
    if (result.error) {
      throw new RoomLifecycleError(
        "The Room could not be restored.",
        503,
        "room_restore_failed"
      );
    }
    await logAuditEvent({
      actor_id: userId,
      action: "room.lifecycle.restored",
      target_type: "room",
      target_id: roomId,
      metadata: { previous_status: room.status },
    });
    return { ok: true, status: "active" };
  }

  const required = `${room.name} DELETE`;
  if (confirmation !== required) {
    throw new RoomLifecycleError(
      `Type "${required}" exactly to delete this Room.`,
      400,
      "room_delete_confirmation_required"
    );
  }
  if (status !== "archived") {
    throw new RoomLifecycleError(
      "Archive the Room before deleting it.",
      409,
      "room_delete_archive_required"
    );
  }
  if (await subscriptionBlocksDeletion(row)) {
    throw new RoomLifecycleError(
      "This paid Room cannot be deleted while its Stripe subscription is active. Cancel it, wait for the paid period to end, then delete the archived Room.",
      409,
      "room_delete_active_subscription"
    );
  }

  const now = new Date().toISOString();
  const roomUpdate = await service
    .from("rooms")
    .update({
      status: "deleted",
      visibility: "private",
      invite_only: true,
      updated_at: now,
    })
    .eq("id", roomId)
    .or(`owner_id.eq.${userId},created_by.eq.${userId}`);
  if (roomUpdate.error) {
    throw new RoomLifecycleError(
      "The Room could not be deleted.",
      503,
      "room_delete_failed"
    );
  }

  await service
    .from("room_members")
    .update({ status: "removed", updated_at: now })
    .eq("room_id", roomId);

  for (const table of ["room_invites", "room_invitations"]) {
    await service
      .from(table)
      .update({ revoked_at: now, updated_at: now })
      .eq("room_id", roomId)
      .is("revoked_at", null);
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.lifecycle.deleted",
    target_type: "room",
    target_id: roomId,
    metadata: {
      previous_status: room.status,
      deletion_mode: "soft_delete",
      member_access_removed: true,
    },
  });

  return { ok: true, status: "deleted", redirect: "/rooms" };
}
