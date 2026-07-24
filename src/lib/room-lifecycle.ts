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

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function isoDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function activeMember(row: RoomRow) {
  const status = asString(row.status).toLowerCase();
  if (["blocked", "removed", "inactive"].includes(status)) return false;
  const suspendedUntil = isoDate(row.suspended_until);
  return !suspendedUntil || new Date(suspendedUntil).getTime() <= Date.now();
}

function profileName(profile: ReturnType<typeof profileFor>) {
  return profile?.full_name || profile?.username || "Room member";
}

function textMatches(query: string, ...values: unknown[]) {
  if (!query) return true;
  return values
    .map((value) => asString(value).toLowerCase())
    .join(" ")
    .includes(query.toLowerCase());
}

function dateMatches(value: string | null, from: string, to: string) {
  if (!value) return !from && !to;
  const time = new Date(value).getTime();
  if (from && time < new Date(`${from}T00:00:00.000Z`).getTime()) return false;
  if (to && time > new Date(`${to}T23:59:59.999Z`).getTime()) return false;
  return true;
}

async function ownedRoom(service: ServiceClient, roomId: string, userId: string) {
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

async function searchableAccess(service: ServiceClient, roomId: string, userId: string) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) throw new RoomLifecycleError("Room not found.", 404, "room_not_found");
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

async function rows(
  service: ServiceClient,
  table: string,
  roomId: string,
  limit: number
) {
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

async function accessiblePosts(
  service: ServiceClient,
  access: RoomAccess,
  userId: string
) {
  const privateCases = isCustomerSupportRoomType(access.room.roomType);
  let participantPostIds: string[] = [];
  if (privateCases && !access.canModerate) {
    const participantResult = await service
      .from("room_post_participants")
      .select("post_id")
      .eq("room_id", access.room.id)
      .eq("user_id", userId)
      .limit(SEARCH_LIMIT);
    if (participantResult.error) {
      throw new RoomLifecycleError(
        "Room discussion permissions could not be verified.",
        503,
        "room_search_storage_unavailable"
      );
    }
    participantPostIds = ((participantResult.data ?? []) as RoomRow[])
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
    if (participantPostIds.length > 0) {
      clauses.push(`id.in.(${participantPostIds.join(",")})`);
    }
    query = query.or(clauses.join(","));
  }
  const result = await query.limit(SEARCH_LIMIT);
  if (result.error) {
    throw new RoomLifecycleError(
      "Room discussions could not be searched.",
      503,
      "room_search_storage_unavailable"
    );
  }
  return (result.data ?? []) as RoomRow[];
}

async function replyRows(service: ServiceClient, postIds: string[]) {
  if (postIds.length === 0) return [] as RoomRow[];
  const result = await service
    .from("room_post_replies")
    .select("*")
    .in("post_id", postIds)
    .is("deleted_at", null)
    .limit(SEARCH_LIMIT * 5);
  if (result.error) {
    throw new RoomLifecycleError(
      "Room replies could not be searched.",
      503,
      "room_search_storage_unavailable"
    );
  }
  return (result.data ?? []) as RoomRow[];
}

async function settings(service: ServiceClient, roomId: string) {
  const result = await service
    .from("room_module_settings")
    .select("settings")
    .eq("room_id", roomId)
    .maybeSingle();
  return result.error ? {} : objectValue((result.data as RoomRow | null)?.settings);
}

export async function searchRoomContent(
  roomId: string,
  userId: string,
  filters: RoomSearchFilters
) {
  const service = createRoomServiceSupabase();
  const access = await searchableAccess(service, roomId, userId);
  const posts = await accessiblePosts(service, access, userId);
  const postIds = posts.map((row) => asString(row.id)).filter(Boolean);
  const roomSettings = await settings(service, roomId);
  const directoryVisible =
    access.canManage || access.isOwner || roomSettings.memberDirectoryVisible !== false;

  const plan = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  const dataModules: string[] = [];
  for (const moduleKey of plan.modules) {
    if (!moduleCanOpen(access, moduleKey)) continue;
    const dataModule = ROOM_MODULE_DEFINITIONS[moduleKey].dataModule;
    if (dataModule && !dataModules.includes(dataModule)) dataModules.push(dataModule);
  }

  const replies = await replyRows(service, postIds);
  let attachments = await rows(
    service,
    "room_resource_attachments",
    roomId,
    SEARCH_LIMIT
  );
  const members = directoryVisible
    ? (await rows(service, "room_members", roomId, SEARCH_LIMIT)).filter(activeMember)
    : [];
  const allRecords = await rows(
    service,
    "room_module_records",
    roomId,
    SEARCH_LIMIT * 5
  );
  const records = allRecords.filter((row) =>
    dataModules.includes(asString(row.module_key))
  );
  const events = await rows(service, "room_events", roomId, SEARCH_LIMIT);
  const announcements = await rows(
    service,
    "room_announcements",
    roomId,
    SEARCH_LIMIT
  );

  if (isCustomerSupportRoomType(access.room.roomType) && !access.canModerate) {
    const allowed = new Set(postIds);
    attachments = attachments.filter((row) => {
      const postId =
        asString(row.post_id) ||
        asString(row.room_post_id) ||
        asString(row.parent_post_id);
      return Boolean(postId && allowed.has(postId));
    });
  }

  const profiles = await loadProfiles(service, [
    ...posts.map((row) => asString(row.author_id)),
    ...replies.map((row) => asString(row.author_id)),
    ...members.map((row) => asString(row.user_id)),
    ...records.map((row) => asString(row.created_by)),
    ...events.map((row) => asString(row.created_by)),
    ...announcements.map((row) => asString(row.created_by)),
  ]);

  const results: SearchResult[] = [];
  const add = (item: SearchResult) => {
    const typeFilter = filters.type.toLowerCase();
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
  };

  const addAuthored = (
    row: RoomRow,
    type: string,
    title: string,
    excerpt: string,
    status: string,
    href: string,
    authorField = "created_by"
  ) => {
    const authorId = asString(row[authorField]);
    add({
      id: asString(row.id),
      type,
      title,
      excerpt,
      status,
      authorId: authorId || null,
      authorName: profileName(profileFor(profiles, authorId)),
      fileType: null,
      createdAt: isoDate(row.created_at),
      updatedAt: isoDate(row.updated_at) ?? isoDate(row.created_at),
      href,
    });
  };

  for (const row of posts) {
    addAuthored(
      row,
      "discussion",
      asString(row.title) || "Room discussion",
      asString(row.body).slice(0, 360),
      asString(row.status) || "open",
      `/rooms/${encodeURIComponent(roomId)}?discussion=${encodeURIComponent(asString(row.id))}`,
      "author_id"
    );
  }
  for (const row of replies) {
    addAuthored(
      row,
      "reply",
      "Discussion reply",
      asString(row.body).slice(0, 360),
      "active",
      `/rooms/${encodeURIComponent(roomId)}?discussion=${encodeURIComponent(asString(row.post_id))}`,
      "author_id"
    );
  }
  for (const row of records) {
    const moduleKey = asString(row.module_key) || "record";
    addAuthored(
      row,
      moduleKey,
      asString(row.title) || "Room record",
      asString(row.body).slice(0, 360),
      asString(row.status) || "active",
      `/rooms/${encodeURIComponent(roomId)}?module=${encodeURIComponent(moduleKey)}`
    );
  }
  for (const row of events) {
    addAuthored(
      row,
      "event",
      asString(row.title) || "Room event",
      [asString(row.description), asString(row.location)].filter(Boolean).join(" · "),
      asString(row.status) || "scheduled",
      `/rooms/${encodeURIComponent(roomId)}?module=calendar`
    );
  }
  for (const row of announcements) {
    addAuthored(
      row,
      "announcement",
      asString(row.title) || "Announcement",
      asString(row.body).slice(0, 360),
      asString(row.priority) || "normal",
      `/rooms/${encodeURIComponent(roomId)}?module=announcements`
    );
  }
  for (const row of attachments) {
    const fileName = asString(row.file_name) || asString(row.filename) || "Room attachment";
    const mimeType = asString(row.mime_type) || asString(row.content_type);
    add({
      id: asString(row.id),
      type: "file",
      title: fileName,
      excerpt: mimeType || "Private Room attachment",
      status: asString(row.status) || "active",
      authorId: asString(row.uploaded_by) || asString(row.created_by) || null,
      authorName: null,
      fileType: mimeType || fileName.split(".").pop() || null,
      createdAt: isoDate(row.created_at),
      updatedAt: isoDate(row.updated_at) ?? isoDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=files`,
    });
  }
  for (const row of members) {
    const memberId = asString(row.user_id);
    const profile = profileFor(profiles, memberId);
    add({
      id: asString(row.id) || memberId,
      type: "member",
      title: profileName(profile),
      excerpt: `Room ${normalizeRole(row.role)} member`,
      status: asString(row.status) || "active",
      authorId: memberId,
      authorName: profileName(profile),
      fileType: null,
      createdAt: isoDate(row.joined_at) ?? isoDate(row.created_at),
      updatedAt: isoDate(row.updated_at) ?? isoDate(row.created_at),
      href: `/rooms/${encodeURIComponent(roomId)}?module=members`,
    });
  }

  results.sort((left, right) =>
    new Date(right.updatedAt ?? right.createdAt ?? 0).getTime() -
    new Date(left.updatedAt ?? left.createdAt ?? 0).getTime()
  );
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
  const row = await ownedRoom(service, roomId, userId);
  const room = normalizeRoom(row);
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
    counts: {
      members: await countRows(service, "room_members", roomId),
      discussions: await countRows(service, "room_posts", roomId),
      records: await countRows(service, "room_module_records", roomId),
      attachments: await countRows(service, "room_resource_attachments", roomId),
    },
    confirmations: { deletePhrase: `${room.name} DELETE` },
  };
}

async function exportTable(service: ServiceClient, table: string, roomId: string) {
  const result = await service
    .from(table)
    .select("*")
    .eq("room_id", roomId)
    .limit(EXPORT_LIMIT);
  return result.error
    ? { rows: [] as RoomRow[], unavailable: result.error.message }
    : { rows: (result.data ?? []) as RoomRow[], unavailable: null };
}

export async function exportRoomData(roomId: string, userId: string) {
  const service = createRoomServiceSupabase();
  const roomRow = await ownedRoom(service, roomId, userId);
  const room = normalizeRoom(roomRow);
  const tableNames = [
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
  const data: Record<string, Awaited<ReturnType<typeof exportTable>>> = {};
  for (const table of tableNames) data[table] = await exportTable(service, table, roomId);

  const attachmentExport = await exportTable(
    service,
    "room_resource_attachments",
    roomId
  );
  const attachmentRows: RoomRow[] = [];
  for (const row of attachmentExport.rows) {
    const bucket =
      asString(row.bucket_name) || asString(row.storage_bucket) || asString(row.bucket);
    const path =
      asString(row.storage_path) || asString(row.object_path) || asString(row.path);
    let downloadUrl: string | null = null;
    if (bucket && path) {
      const signed = await service.storage.from(bucket).createSignedUrl(path, 3600);
      downloadUrl = signed.data?.signedUrl ?? null;
    }
    attachmentRows.push({ ...row, export_download_url: downloadUrl });
  }

  await logAuditEvent({
    actor_id: userId,
    action: "room.lifecycle.exported",
    target_type: "room",
    target_id: roomId,
    metadata: {
      room_status: room.status,
      attachment_count: attachmentRows.length,
    },
  });

  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    signedAttachmentLinksExpireAt: new Date(Date.now() + 3_600_000).toISOString(),
    room: roomRow,
    data,
    attachments: { rows: attachmentRows, unavailable: attachmentExport.unavailable },
  };
}

async function activeSubscription(room: RoomRow) {
  const subscriptionId = asString(room.stripe_subscription_id);
  if (!subscriptionId) return false;
  if (!STRIPE_SECRET_KEY) {
    throw new RoomLifecycleError(
      "Room deletion is blocked until billing can verify that the paid subscription has ended.",
      503,
      "room_deletion_billing_verification_required"
    );
  }
  const subscription = await new Stripe(STRIPE_SECRET_KEY).subscriptions.retrieve(
    subscriptionId
  );
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
  const row = await ownedRoom(service, roomId, userId);
  const room = normalizeRoom(row);
  const status = room.status.toLowerCase();

  if (action === "archive" || action === "restore") {
    const nextStatus = action === "archive" ? "archived" : "active";
    if (action === "archive" && status === "archived") {
      return { ok: true, status: nextStatus };
    }
    if (action === "restore" && status !== "archived") {
      throw new RoomLifecycleError(
        "Only an archived Room can be restored.",
        409,
        "room_restore_not_archived"
      );
    }
    const result = await service
      .from("rooms")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", roomId)
      .or(`owner_id.eq.${userId},created_by.eq.${userId}`);
    if (result.error) {
      throw new RoomLifecycleError(
        `The Room could not be ${action === "archive" ? "archived" : "restored"}.`,
        503,
        action === "archive" ? "room_archive_failed" : "room_restore_failed"
      );
    }
    await logAuditEvent({
      actor_id: userId,
      action: `room.lifecycle.${action === "archive" ? "archived" : "restored"}`,
      target_type: "room",
      target_id: roomId,
      metadata: { previous_status: room.status },
    });
    return { ok: true, status: nextStatus };
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
  if (await activeSubscription(row)) {
    throw new RoomLifecycleError(
      "This paid Room cannot be deleted while its Stripe subscription is active. Cancel it, wait for the paid period to end, then delete the archived Room.",
      409,
      "room_delete_active_subscription"
    );
  }

  const now = new Date().toISOString();
  const roomUpdate = await service
    .from("rooms")
    .update({ status: "deleted", visibility: "private", invite_only: true, updated_at: now })
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
