import "server-only";

import { randomUUID } from "node:crypto";
import {
  getRoomPlanEntitlements,
  roomSubscriptionIsActive,
} from "@/lib/room-plan-entitlements";
import {
  asNumber,
  asString,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  profileFor,
} from "@/lib/room-operations";

export const ROOM_RESOURCE_BUCKET = "room-resources";
export const SIGNED_RESOURCE_SECONDS = 60 * 60;
export const ORGANIZATION_PLANS = new Set([
  "organization",
  "organization-plus",
  "enterprise",
]);

export const ACCEPTED_ROOM_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function validUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function cleanText(value, maximum = 1000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function cleanStringArray(value, maximumItems = 50, maximumLength = 160) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((entry) => cleanText(entry, maximumLength))
        .filter(Boolean)
        .slice(0, maximumItems)
    ),
  ];
}

export function safeIsoDate(value) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function safeHttpUrl(value) {
  const raw = cleanText(value, 2000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function safeFileName(value) {
  const raw = cleanText(value, 240);
  const cleaned = raw
    .normalize("NFKC")
    .replace(/[\\/\0<>:"|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 180)
    .trim();
  return cleaned || "room-resource";
}

export function normalizeFolderPath(value) {
  const segments = cleanText(value, 500)
    .split("/")
    .map((segment) => segment.trim().replace(/[^a-z0-9 _.-]/gi, "-"))
    .filter(Boolean)
    .slice(0, 12);
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function normalizedMimeType(value) {
  if (typeof value !== "string") return "";
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function uploadMimeType(fileName, suppliedValue) {
  const supplied = normalizedMimeType(suppliedValue);
  if (supplied && supplied !== "application/octet-stream") return supplied;
  const lower = fileName.toLowerCase();
  const extension = Object.keys(MIME_BY_EXTENSION).find((candidate) =>
    lower.endsWith(candidate)
  );
  return extension ? MIME_BY_EXTENSION[extension] : supplied;
}

export function mediaKind(mimeType) {
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("image/")) return "image";
  return "file";
}

export function serializePlan(access) {
  const plan = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  return {
    id: plan.id,
    label: plan.label,
    roomLimit: plan.roomLimit,
    memberLimit: plan.memberLimit,
    fileUploads: plan.fileUploads,
    inlineVideo: plan.inlineVideo,
    maxFileBytes: plan.maxFileBytes,
    storageBytes: plan.storageBytes,
    modules: plan.modules,
    features: plan.features,
  };
}

export function ensureRoomModule(access, moduleKey) {
  const plan = serializePlan(access);
  if (!roomSubscriptionIsActive(access.room.subscriptionStatus) && plan.id !== "free") {
    throw new ExpansionError("This Room subscription is not active.", 403, "room_subscription_inactive");
  }
  if (!plan.modules.includes(moduleKey)) {
    throw new ExpansionError(
      "This feature is not included in the current Room plan.",
      403,
      "room_expansion_plan_locked"
    );
  }
  return plan;
}

export class ExpansionError extends Error {
  constructor(message, status = 400, code = "room_expansion_error") {
    super(message);
    this.name = "ExpansionError";
    this.status = status;
    this.code = code;
  }
}

export async function loadExpansionAccess(roomId, userId) {
  const service = createRoomServiceSupabase();
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) throw new ExpansionError("Room not found.", 404, "room_not_found");
  if (!access.allowed) {
    throw new ExpansionError("Active Room membership is required.", 403, "room_membership_required");
  }
  return { service, access };
}

export async function loadRoomMembers(service, roomId) {
  const result = await service
    .from("room_members")
    .select("id, user_id, role, status, joined_at, created_at")
    .eq("room_id", roomId)
    .not("status", "in", "(blocked,removed,inactive)")
    .order("created_at", { ascending: true })
    .limit(2500);
  if (result.error) throw new ExpansionError(result.error.message, 503);
  const rows = result.data ?? [];
  const profiles = await loadProfiles(
    service,
    rows.map((row) => asString(row.user_id))
  );
  return rows.map((row) => {
    const userId = asString(row.user_id);
    return {
      id: asString(row.id),
      userId,
      role: asString(row.role) || "member",
      status: asString(row.status) || "active",
      joinedAt: asString(row.joined_at) || asString(row.created_at) || null,
      profile: profileFor(profiles, userId),
    };
  });
}

export async function loadProfilesMap(service, userIds) {
  return loadProfiles(service, userIds);
}

export function serializeRecord(row) {
  return {
    id: asString(row.id),
    roomId: asString(row.room_id),
    moduleKey: asString(row.module_key),
    title: asString(row.title),
    body: asString(row.body),
    status: asString(row.status) || "active",
    metadata: asObject(row.metadata),
    createdBy: asString(row.created_by),
    archivedAt: asString(row.archived_at) || null,
    createdAt: asString(row.created_at) || null,
    updatedAt: asString(row.updated_at) || null,
  };
}

export function serializeEvent(row) {
  return {
    id: asString(row.id),
    title: asString(row.title),
    description: asString(row.description),
    location: asString(row.location),
    startsAt: asString(row.starts_at),
    endsAt: asString(row.ends_at) || null,
    recurrenceRule: asString(row.recurrence_rule) || null,
    recurrenceUntil: asString(row.recurrence_until) || null,
    timezone: asString(row.timezone) || "UTC",
    capacity:
      row.capacity === null || row.capacity === undefined ? null : asNumber(row.capacity),
    registrationRequired: row.registration_required === true,
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
  };
}

export function serializeResource(row, url = null, canDelete = false) {
  return {
    id: asString(row.id),
    fileName: asString(row.file_name) || "Room resource",
    storagePath: asString(row.storage_path),
    mimeType: asString(row.mime_type) || "application/octet-stream",
    mediaKind: asString(row.media_kind) || "file",
    fileSizeBytes: asNumber(row.file_size_bytes),
    uploadedBy: asString(row.uploaded_by),
    folderPath: asString(row.folder_path) || "/",
    versionGroupId: asString(row.version_group_id) || asString(row.id),
    versionNumber: Math.max(1, asNumber(row.version_number) || 1),
    replacesResourceId: asString(row.replaces_resource_id) || null,
    isCurrent: row.is_current !== false,
    createdAt: asString(row.created_at) || null,
    url,
    canDelete,
  };
}

export async function resourceUsage(service, roomId) {
  const result = await service
    .from("room_resources")
    .select("file_size_bytes")
    .eq("room_id", roomId);
  if (result.error) throw new ExpansionError(result.error.message, 503);
  return (result.data ?? []).reduce(
    (total, row) => total + Number(row.file_size_bytes ?? 0),
    0
  );
}

export async function storedObjectInfo(service, storagePath) {
  const slash = storagePath.lastIndexOf("/");
  if (slash < 1) return null;
  const folder = storagePath.slice(0, slash);
  const name = storagePath.slice(slash + 1);
  const result = await service.storage
    .from(ROOM_RESOURCE_BUCKET)
    .list(folder, { limit: 20, search: name });
  if (result.error) return null;
  const item = result.data?.find((candidate) => candidate.name === name);
  if (!item) return null;
  const metadata = asObject(item.metadata);
  const size = Number(
    metadata.size ?? metadata.contentLength ?? metadata.content_length ?? item.size ?? 0
  );
  return {
    sizeBytes: Number.isSafeInteger(size) && size > 0 ? size : 0,
    mimeType:
      normalizedMimeType(
        metadata.mimetype ??
          metadata.mime_type ??
          metadata.contentType ??
          metadata.content_type
      ) || null,
  };
}

export async function ensureOrganization(service, access, userId) {
  const planKey = access.room.subscriptionPlan;
  if (!ORGANIZATION_PLANS.has(planKey)) {
    throw new ExpansionError(
      "The Organization Console begins with an Organization Room plan.",
      403,
      "room_organization_plan_locked"
    );
  }
  if (!access.isOwner && !access.canManage) {
    const membership = await service
      .from("room_organization_members")
      .select("role")
      .eq("organization_id", access.rawRoom.organization_id ?? "00000000-0000-0000-0000-000000000000")
      .eq("user_id", userId)
      .maybeSingle();
    if (membership.error || !membership.data) {
      throw new ExpansionError(
        "Organization administration access is required.",
        403,
        "room_organization_role_locked"
      );
    }
  }

  let organizationId = asString(access.rawRoom.organization_id);
  let organization = null;
  if (organizationId) {
    const existing = await service
      .from("room_organizations")
      .select("*")
      .eq("id", organizationId)
      .maybeSingle();
    if (existing.error) throw new ExpansionError(existing.error.message, 503);
    organization = existing.data;
  }

  if (!organization) {
    if (!access.isOwner) {
      throw new ExpansionError(
        "The Room owner must initialize this Organization Console.",
        403,
        "room_organization_owner_required"
      );
    }
    const subscriptionId = asString(access.rawRoom.stripe_subscription_id) || null;
    if (subscriptionId) {
      const existing = await service
        .from("room_organizations")
        .select("*")
        .eq("subscription_id", subscriptionId)
        .maybeSingle();
      if (existing.error) throw new ExpansionError(existing.error.message, 503);
      organization = existing.data;
    }
    if (!organization) {
      const inserted = await service
        .from("room_organizations")
        .insert({
          owner_id: userId,
          name: `${access.room.name} Organization`.slice(0, 160),
          subscription_id: subscriptionId,
          plan_key: planKey,
        })
        .select("*")
        .single();
      if (inserted.error) throw new ExpansionError(inserted.error.message, 503);
      organization = inserted.data;
    }
    organizationId = asString(organization.id);
    let roomsQuery = service
      .from("rooms")
      .update({ organization_id: organizationId })
      .or(`owner_id.eq.${userId},created_by.eq.${userId}`)
      .in("subscription_plan", ["organization", "organization-plus", "enterprise"]);
    if (subscriptionId) roomsQuery = roomsQuery.eq("stripe_subscription_id", subscriptionId);
    else roomsQuery = roomsQuery.is("stripe_subscription_id", null);
    const linked = await roomsQuery.select("id");
    if (linked.error) throw new ExpansionError(linked.error.message, 503);
    const member = await service.from("room_organization_members").upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        role: "owner",
      },
      { onConflict: "organization_id,user_id" }
    );
    if (member.error) throw new ExpansionError(member.error.message, 503);
  }

  const roleResult = await service
    .from("room_organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (roleResult.error) throw new ExpansionError(roleResult.error.message, 503);
  const role = roleResult.data?.role ?? (access.isOwner ? "owner" : null);
  if (!role) {
    throw new ExpansionError(
      "Organization Console access is required.",
      403,
      "room_organization_role_locked"
    );
  }

  return { organization, organizationId, role };
}

export function randomStoragePath(roomId, fileName) {
  return `${roomId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${fileName}`;
}
