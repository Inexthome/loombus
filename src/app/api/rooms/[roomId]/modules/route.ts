import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  ROOM_MODULE_DEFINITIONS,
  getRoomPlanEntitlements,
  isRoomModuleKey,
  type RoomModuleKey,
} from "@/lib/room-plan-entitlements";
import {
  asBoolean,
  asNumber,
  asString,
  createRequestSupabase,
  createRoomServiceSupabase,
  getRoomAccess,
  loadProfiles,
  profileFor,
  type RoomAccess,
  type RoomRow,
} from "@/lib/room-operations";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const RECORD_LIMIT = 200;
const AUDIT_LIMIT = 150;
const MEMBER_PAGE_SIZE = 50;
const DATA_MODULES = new Set([
  "resource",
  "task",
  "poll",
  "directory",
  "knowledge",
  "form",
  "service",
  "workflow",
]);

type RouteContext = {
  params: Promise<{ roomId: string }>;
};

type AuthorizedContext =
  | {
      ok: true;
      userId: string;
      email: string | null;
      serviceSupabase: ReturnType<typeof createRoomServiceSupabase>;
    }
  | { ok: false; response: NextResponse };

type JsonObject = Record<string, unknown>;

type RoomModuleSettings = {
  allowMemberPosts: boolean;
  memberDirectoryVisible: boolean;
  inviteRequiresApproval: boolean;
  allowedEmailDomains: string[];
  defaultInviteRole: "member" | "moderator";
};

const DEFAULT_SETTINGS: RoomModuleSettings = {
  allowMemberPosts: true,
  memberDirectoryVisible: true,
  inviteRequiresApproval: false,
  allowedEmailDomains: [],
  defaultInviteRole: "member",
};

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function safeUrl(value: unknown) {
  const raw = cleanText(value, 2000);
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function safeIsoDate(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function roleCanOpenModule(access: RoomAccess, moduleKey: RoomModuleKey) {
  const minimumRole = ROOM_MODULE_DEFINITIONS[moduleKey].minimumRole;
  if (minimumRole === "member") return access.allowed;
  if (minimumRole === "manager") return access.canManage;
  return access.isOwner;
}

function serializeModules(access: RoomAccess) {
  const entitlements = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  return entitlements.modules
    .filter((moduleKey) => roleCanOpenModule(access, moduleKey))
    .map((moduleKey) => ROOM_MODULE_DEFINITIONS[moduleKey]);
}

function normalizeSettings(value: unknown): RoomModuleSettings {
  const source = asObject(value);
  const domains = Array.isArray(source.allowedEmailDomains)
    ? source.allowedEmailDomains
        .map((item) => cleanText(item, 253).toLowerCase())
        .filter((item) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(item))
        .slice(0, 50)
    : [];
  return {
    allowMemberPosts:
      typeof source.allowMemberPosts === "boolean"
        ? source.allowMemberPosts
        : DEFAULT_SETTINGS.allowMemberPosts,
    memberDirectoryVisible:
      typeof source.memberDirectoryVisible === "boolean"
        ? source.memberDirectoryVisible
        : DEFAULT_SETTINGS.memberDirectoryVisible,
    inviteRequiresApproval:
      typeof source.inviteRequiresApproval === "boolean"
        ? source.inviteRequiresApproval
        : DEFAULT_SETTINGS.inviteRequiresApproval,
    allowedEmailDomains: [...new Set(domains)],
    defaultInviteRole:
      source.defaultInviteRole === "moderator" ? "moderator" : "member",
  };
}

async function authorize(request: NextRequest): Promise<AuthorizedContext> {
  try {
    const requestSupabase = createRequestSupabase(request);
    const accountAccess = await verifyRequestAccountAccess(requestSupabase);
    if (!accountAccess.ok) {
      return {
        ok: false,
        response: jsonError(
          accountAccess.error,
          accountAccess.status,
          accountAccess.code
        ),
      };
    }
    return {
      ok: true,
      userId: accountAccess.user.id,
      email: accountAccess.user.email ?? null,
      serviceSupabase: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false,
      response: jsonError("Rooms service is not configured.", 500),
    };
  }
}

async function loadAccess(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string,
  userId: string
) {
  return getRoomAccess(serviceSupabase, roomId, userId).catch(() => null);
}

async function getSettings(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const result = await serviceSupabase
    .from("room_module_settings")
    .select("settings")
    .eq("room_id", roomId)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return normalizeSettings((result.data as RoomRow | null)?.settings);
}

function serializeRecord(row: RoomRow) {
  return {
    id: asString(row.id),
    roomId: asString(row.room_id),
    moduleKey: asString(row.module_key),
    title: asString(row.title),
    body: asString(row.body),
    status: asString(row.status) || "active",
    metadata: asObject(row.metadata),
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
    updatedAt: asString(row.updated_at) || null,
  };
}

function dataModuleFor(moduleKey: RoomModuleKey) {
  return ROOM_MODULE_DEFINITIONS[moduleKey].dataModule ?? null;
}

async function loadRecords(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string,
  moduleKey: RoomModuleKey,
  userId: string,
  access: RoomAccess
) {
  const dataModule = dataModuleFor(moduleKey);
  if (!dataModule || !DATA_MODULES.has(dataModule)) return [];

  const result = await serviceSupabase
    .from("room_module_records")
    .select("*")
    .eq("room_id", roomId)
    .eq("module_key", dataModule)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(RECORD_LIMIT);
  if (result.error) throw new Error(result.error.message);

  const records = ((result.data ?? []) as RoomRow[]).map(serializeRecord);
  if (records.length === 0 || !["polls", "forms"].includes(moduleKey)) {
    return records;
  }

  const recordIds = records.map((record) => record.id).filter(Boolean);
  let responseQuery = serviceSupabase
    .from("room_module_responses")
    .select("*")
    .eq("room_id", roomId)
    .in("record_id", recordIds);
  if (moduleKey === "forms" && !access.canManage) {
    responseQuery = responseQuery.eq("responder_id", userId);
  }
  const responseResult = await responseQuery;
  if (responseResult.error) throw new Error(responseResult.error.message);
  const responses = (responseResult.data ?? []) as RoomRow[];

  return records.map((record) => {
    const matching = responses.filter(
      (response) => asString(response.record_id) === record.id
    );
    if (moduleKey === "polls") {
      const optionCounts: Record<string, number> = {};
      for (const response of matching) {
        const payload = asObject(response.payload);
        const optionIds = Array.isArray(payload.optionIds)
          ? payload.optionIds.map(asString).filter(Boolean)
          : [];
        for (const optionId of optionIds) {
          optionCounts[optionId] = (optionCounts[optionId] ?? 0) + 1;
        }
      }
      const own = matching.find(
        (response) => asString(response.responder_id) === userId
      );
      return {
        ...record,
        responseSummary: {
          totalResponses: matching.length,
          optionCounts,
          ownResponse: own ? asObject(own.payload) : null,
        },
      };
    }

    return {
      ...record,
      responseSummary: {
        totalResponses: matching.length,
        responses: access.canManage
          ? matching.map((response) => ({
              id: asString(response.id),
              responderId: asString(response.responder_id),
              payload: asObject(response.payload),
              createdAt: asString(response.created_at) || null,
              updatedAt: asString(response.updated_at) || null,
            }))
          : matching.map((response) => ({
              id: asString(response.id),
              payload: asObject(response.payload),
              createdAt: asString(response.created_at) || null,
              updatedAt: asString(response.updated_at) || null,
            })),
      },
    };
  });
}

async function loadRequests(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const result = await serviceSupabase
    .from("room_applications")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (result.error) throw new Error(result.error.message);
  const rows = (result.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(
    serviceSupabase,
    rows.map((row) => asString(row.applicant_id))
  );
  return rows.map((row) => {
    const applicantId = asString(row.applicant_id);
    return {
      id: asString(row.id),
      applicantId,
      state: asString(row.state) || "pending",
      note: asString(row.note) || null,
      createdAt: asString(row.created_at) || null,
      updatedAt: asString(row.updated_at) || null,
      applicant: profileFor(profiles, applicantId),
    };
  });
}

async function loadActivity(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const result = await serviceSupabase
    .from("audit_logs")
    .select("id, actor_id, action, target_type, target_id, metadata, created_at")
    .contains("metadata", { room_id: roomId })
    .order("created_at", { ascending: false })
    .limit(AUDIT_LIMIT);
  if (result.error) throw new Error(result.error.message);
  const rows = (result.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(
    serviceSupabase,
    rows.map((row) => asString(row.actor_id))
  );
  return rows.map((row) => {
    const actorId = asString(row.actor_id);
    return {
      id: asString(row.id),
      actorId: actorId || null,
      actor: actorId ? profileFor(profiles, actorId) : null,
      action: asString(row.action),
      targetType: asString(row.target_type),
      targetId: asString(row.target_id) || null,
      metadata: asObject(row.metadata),
      createdAt: asString(row.created_at) || null,
    };
  });
}

async function loadInvites(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const result = await serviceSupabase
    .from("room_invites")
    .select("id, label, role, max_uses, use_count, expires_at, revoked_at, created_by, created_at, updated_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as RoomRow[]).map((row) => ({
    id: asString(row.id),
    label: asString(row.label) || "Room invitation",
    role: asString(row.role) || "member",
    maxUses: row.max_uses === null ? null : asNumber(row.max_uses),
    useCount: asNumber(row.use_count),
    expiresAt: asString(row.expires_at) || null,
    revokedAt: asString(row.revoked_at) || null,
    createdBy: asString(row.created_by) || null,
    createdAt: asString(row.created_at) || null,
    updatedAt: asString(row.updated_at) || null,
  }));
}

async function countRows(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  table: string,
  roomId: string,
  extra?: (query: ReturnType<typeof serviceSupabase.from>) => unknown
) {
  let query = serviceSupabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);
  if (extra) query = extra(query) as typeof query;
  const result = await query;
  return result.error ? null : result.count ?? 0;
}

async function operationalSummary(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string
) {
  const [posts, events, announcements, members, requests, records, resources] =
    await Promise.all([
      countRows(serviceSupabase, "room_posts", roomId, (query) =>
        (query as typeof query).is("deleted_at", null)
      ),
      countRows(serviceSupabase, "room_events", roomId),
      countRows(serviceSupabase, "room_announcements", roomId),
      countRows(serviceSupabase, "room_members", roomId, (query) =>
        (query as typeof query).not("status", "in", "(blocked,removed,inactive)")
      ),
      countRows(serviceSupabase, "room_applications", roomId, (query) =>
        (query as typeof query).eq("state", "pending")
      ),
      countRows(serviceSupabase, "room_module_records", roomId, (query) =>
        (query as typeof query).is("archived_at", null)
      ),
      countRows(serviceSupabase, "room_resources", roomId),
    ]);
  return { posts, events, announcements, members, requests, records, resources };
}

async function loadHighCapacityMembers(
  serviceSupabase: ReturnType<typeof createRoomServiceSupabase>,
  roomId: string,
  request: NextRequest
) {
  const page = Math.max(1, Math.floor(asNumber(request.nextUrl.searchParams.get("page")) || 1));
  const search = cleanText(request.nextUrl.searchParams.get("search"), 100).toLowerCase();
  const from = (page - 1) * MEMBER_PAGE_SIZE;
  const to = from + MEMBER_PAGE_SIZE - 1;
  const memberResult = await serviceSupabase
    .from("room_members")
    .select("*", { count: "exact" })
    .eq("room_id", roomId)
    .not("status", "in", "(blocked,removed,inactive)")
    .order("created_at", { ascending: true })
    .range(from, to);
  if (memberResult.error) throw new Error(memberResult.error.message);
  const rows = (memberResult.data ?? []) as RoomRow[];
  const profiles = await loadProfiles(
    serviceSupabase,
    rows.map((row) => asString(row.user_id))
  );
  let members = rows.map((row) => {
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
  if (search) {
    members = members.filter((member) => {
      const profile = member.profile;
      return [profile?.full_name, profile?.username, member.userId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }
  return {
    members,
    page,
    pageSize: MEMBER_PAGE_SIZE,
    total: memberResult.count ?? members.length,
  };
}

async function enforceModule(
  access: RoomAccess,
  moduleKey: RoomModuleKey
): Promise<NextResponse | null> {
  const entitlements = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  if (!entitlements.modules.includes(moduleKey)) {
    return jsonError("This Room module is not included in the current plan.", 403, "room_module_plan_locked");
  }
  if (!roleCanOpenModule(access, moduleKey)) {
    return jsonError("Room management access is required for this module.", 403, "room_module_role_locked");
  }
  return null;
}

function buildMetadata(moduleKey: RoomModuleKey, raw: unknown) {
  const source = asObject(raw);
  if (moduleKey === "resources") {
    const url = safeUrl(source.url);
    if (!url) throw new Error("Enter a valid HTTP or HTTPS resource link.");
    return { url, category: cleanText(source.category, 80) || "Reference" };
  }
  if (moduleKey === "tasks") {
    const assigneeId = validUuid(source.assigneeId) ? source.assigneeId : null;
    return {
      priority: ["low", "normal", "high", "urgent"].includes(asString(source.priority))
        ? asString(source.priority)
        : "normal",
      dueAt: safeIsoDate(source.dueAt),
      assigneeId,
    };
  }
  if (moduleKey === "polls") {
    const rawOptions = Array.isArray(source.options) ? source.options : [];
    const labels = rawOptions
      .map((option) => cleanText(option, 160))
      .filter(Boolean)
      .slice(0, 12);
    if (labels.length < 2) throw new Error("A poll requires at least two options.");
    return {
      options: labels.map((label) => ({ id: randomUUID(), label })),
      allowMultiple: asBoolean(source.allowMultiple),
      closesAt: safeIsoDate(source.closesAt),
    };
  }
  if (moduleKey === "directory") {
    return {
      email: cleanText(source.email, 320),
      phone: cleanText(source.phone, 80),
      organization: cleanText(source.organization, 180),
      role: cleanText(source.role, 120),
    };
  }
  if (moduleKey === "knowledge") {
    return { category: cleanText(source.category, 100) || "General" };
  }
  if (moduleKey === "forms") {
    const rawFields = Array.isArray(source.fields) ? source.fields : [];
    const fields = rawFields
      .map((field) => cleanText(field, 120))
      .filter(Boolean)
      .slice(0, 30)
      .map((label) => ({ id: randomUUID(), label, required: true }));
    if (fields.length < 1) throw new Error("A form requires at least one field.");
    return { fields, oneResponsePerMember: true };
  }
  if (moduleKey === "services") {
    return {
      priceLabel: cleanText(source.priceLabel, 100),
      url: safeUrl(source.url),
      availability: cleanText(source.availability, 160),
    };
  }
  if (moduleKey === "member-workflows") {
    const memberId = validUuid(source.memberId) ? source.memberId : null;
    if (!memberId) throw new Error("Choose a valid Room member.");
    return {
      memberId,
      stage: cleanText(source.stage, 100) || "New",
      dueAt: safeIsoDate(source.dueAt),
    };
  }
  return {};
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const { userId, serviceSupabase } = authorized;
  const access = await loadAccess(serviceSupabase, roomId, userId);
  if (!access) return jsonError("Room not found.", 404);
  if (!access.allowed) return jsonError("Room membership is required.", 403);

  const requestedModule = request.nextUrl.searchParams.get("module") ?? "manifest";
  if (requestedModule === "manifest") {
    const entitlements = getRoomPlanEntitlements(
      access.room.subscriptionPlan,
      access.room.subscriptionStatus
    );
    return NextResponse.json(
      {
        room: access.room,
        access: {
          role: access.role,
          canManage: access.canManage,
          canModerate: access.canModerate,
          isOwner: access.isOwner,
          currentUserId: userId,
        },
        plan: {
          id: entitlements.id,
          label: entitlements.label,
          roomLimit: entitlements.roomLimit,
          memberLimit: entitlements.memberLimit,
          features: entitlements.features,
        },
        modules: serializeModules(access),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (!isRoomModuleKey(requestedModule)) {
    return jsonError("Unknown Room module.", 400);
  }
  const moduleError = await enforceModule(access, requestedModule);
  if (moduleError) return moduleError;

  try {
    let data: unknown = null;
    if (dataModuleFor(requestedModule)) {
      data = await loadRecords(
        serviceSupabase,
        roomId,
        requestedModule,
        userId,
        access
      );
    } else if (requestedModule === "requests") {
      data = await loadRequests(serviceSupabase, roomId);
    } else if (
      requestedModule === "settings" ||
      requestedModule === "advanced-controls" ||
      requestedModule === "enterprise-controls"
    ) {
      data = {
        room: access.room,
        settings: await getSettings(serviceSupabase, roomId),
      };
    } else if (requestedModule === "invites") {
      data = {
        invites: await loadInvites(serviceSupabase, roomId),
        settings: await getSettings(serviceSupabase, roomId),
      };
    } else if (requestedModule === "activity") {
      data = await loadActivity(serviceSupabase, roomId);
    } else if (requestedModule === "high-capacity") {
      data = await loadHighCapacityMembers(serviceSupabase, roomId, request);
    } else if (
      requestedModule === "admin-tools" ||
      requestedModule === "operations" ||
      requestedModule === "community-operations"
    ) {
      data = {
        summary: await operationalSummary(serviceSupabase, roomId),
        plan: getRoomPlanEntitlements(
          access.room.subscriptionPlan,
          access.room.subscriptionStatus
        ),
      };
    } else if (requestedModule === "files") {
      data = { connected: true };
    }

    return NextResponse.json(
      { module: requestedModule, data },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "The Room module could not be loaded.",
      503,
      "room_module_storage_unavailable"
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;
  const { roomId } = await context.params;
  if (!validUuid(roomId)) return jsonError("Invalid Room id.", 400);

  const { userId, serviceSupabase } = authorized;
  const access = await loadAccess(serviceSupabase, roomId, userId);
  if (!access) return jsonError("Room not found.", 404);
  if (!access.allowed) return jsonError("Room membership is required.", 403);

  const body = await request.json().catch(() => null);
  const moduleKey = body?.module;
  const action = asString(body?.action);
  if (!isRoomModuleKey(moduleKey)) return jsonError("Unknown Room module.", 400);
  const moduleError = await enforceModule(access, moduleKey);
  if (moduleError) return moduleError;

  try {
    if (action === "create_record") {
      if (!access.canManage) return jsonError("Room management access is required.", 403);
      const dataModule = dataModuleFor(moduleKey);
      if (!dataModule) return jsonError("This module does not accept records.", 400);
      const title = cleanText(body?.title, 200);
      const recordBody = cleanText(body?.body, 12000);
      if (!title) return jsonError("Enter a title.", 400);
      const metadata = buildMetadata(moduleKey, body?.metadata);
      const status =
        moduleKey === "tasks"
          ? "open"
          : moduleKey === "polls"
            ? "open"
            : "active";
      const inserted = await serviceSupabase
        .from("room_module_records")
        .insert({
          room_id: roomId,
          module_key: dataModule,
          title,
          body: recordBody,
          status,
          metadata,
          created_by: userId,
        })
        .select("*")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      const record = serializeRecord(inserted.data as RoomRow);
      await logAuditEvent({
        actor_id: userId,
        action: `room.module.${dataModule}.created`,
        target_type: "room_module_record",
        target_id: record.id,
        metadata: { room_id: roomId, module: moduleKey },
      });
      return NextResponse.json(
        { ok: true, record },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "update_record") {
      const recordId = body?.recordId;
      if (!validUuid(recordId)) return jsonError("Invalid Room record.", 400);
      const found = await serviceSupabase
        .from("room_module_records")
        .select("*")
        .eq("id", recordId)
        .eq("room_id", roomId)
        .is("archived_at", null)
        .maybeSingle();
      if (found.error || !found.data) return jsonError("Room record not found.", 404);
      const row = found.data as RoomRow;
      const dataModule = dataModuleFor(moduleKey);
      if (asString(row.module_key) !== dataModule) return jsonError("Room module mismatch.", 400);
      const existingMetadata = asObject(row.metadata);
      const assignedToUser =
        moduleKey === "tasks" && asString(existingMetadata.assigneeId) === userId;
      if (!access.canManage && !assignedToUser) {
        return jsonError("You cannot update this Room record.", 403);
      }
      const updates: JsonObject = {};
      const nextStatus = cleanText(body?.status, 40);
      if (nextStatus) updates.status = nextStatus;
      if (access.canManage) {
        const title = cleanText(body?.title, 200);
        const recordBody = cleanText(body?.body, 12000);
        if (title) updates.title = title;
        if (typeof body?.body === "string") updates.body = recordBody;
        if (body?.metadata !== undefined) {
          updates.metadata = buildMetadata(moduleKey, body.metadata);
        }
      }
      const updated = await serviceSupabase
        .from("room_module_records")
        .update(updates)
        .eq("id", recordId)
        .eq("room_id", roomId)
        .select("*")
        .single();
      if (updated.error) throw new Error(updated.error.message);
      await logAuditEvent({
        actor_id: userId,
        action: `room.module.${dataModule}.updated`,
        target_type: "room_module_record",
        target_id: recordId,
        metadata: { room_id: roomId, module: moduleKey },
      });
      return NextResponse.json(
        { ok: true, record: serializeRecord(updated.data as RoomRow) },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "archive_record") {
      if (!access.canManage) return jsonError("Room management access is required.", 403);
      const recordId = body?.recordId;
      if (!validUuid(recordId)) return jsonError("Invalid Room record.", 400);
      const updated = await serviceSupabase
        .from("room_module_records")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", recordId)
        .eq("room_id", roomId)
        .eq("module_key", dataModuleFor(moduleKey));
      if (updated.error) throw new Error(updated.error.message);
      await logAuditEvent({
        actor_id: userId,
        action: "room.module.record.archived",
        target_type: "room_module_record",
        target_id: recordId,
        metadata: { room_id: roomId, module: moduleKey },
      });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "submit_response") {
      if (!["polls", "forms"].includes(moduleKey)) {
        return jsonError("This module does not accept responses.", 400);
      }
      const recordId = body?.recordId;
      if (!validUuid(recordId)) return jsonError("Invalid Room record.", 400);
      const found = await serviceSupabase
        .from("room_module_records")
        .select("*")
        .eq("id", recordId)
        .eq("room_id", roomId)
        .eq("module_key", dataModuleFor(moduleKey))
        .is("archived_at", null)
        .maybeSingle();
      if (found.error || !found.data) return jsonError("Room record not found.", 404);
      const row = found.data as RoomRow;
      const metadata = asObject(row.metadata);
      let payload: JsonObject;
      let responseType: string;

      if (moduleKey === "polls") {
        if (asString(row.status) === "closed") return jsonError("This poll is closed.", 409);
        const closesAt = safeIsoDate(metadata.closesAt);
        if (closesAt && new Date(closesAt).getTime() < Date.now()) {
          return jsonError("This poll has closed.", 409);
        }
        const options = Array.isArray(metadata.options) ? metadata.options : [];
        const validIds = new Set(
          options.map((option) => asString(asObject(option).id)).filter(Boolean)
        );
        const optionIds = Array.isArray(body?.payload?.optionIds)
          ? body.payload.optionIds.map(asString).filter((id: string) => validIds.has(id))
          : [];
        const allowMultiple = asBoolean(metadata.allowMultiple);
        if (optionIds.length < 1 || (!allowMultiple && optionIds.length > 1)) {
          return jsonError("Choose a valid poll option.", 400);
        }
        payload = { optionIds: [...new Set(optionIds)] };
        responseType = "vote";
      } else {
        const fields = Array.isArray(metadata.fields) ? metadata.fields : [];
        const values = asObject(body?.payload?.values);
        const allowedIds = new Set(
          fields.map((field) => asString(asObject(field).id)).filter(Boolean)
        );
        const cleanedValues: Record<string, string> = {};
        for (const [fieldId, value] of Object.entries(values)) {
          if (allowedIds.has(fieldId)) cleanedValues[fieldId] = cleanText(value, 4000);
        }
        if (Object.keys(cleanedValues).length < 1) {
          return jsonError("Complete at least one form field.", 400);
        }
        payload = { values: cleanedValues };
        responseType = "submission";
      }

      const saved = await serviceSupabase
        .from("room_module_responses")
        .upsert(
          {
            room_id: roomId,
            record_id: recordId,
            response_type: responseType,
            responder_id: userId,
            payload,
          },
          { onConflict: "record_id,responder_id,response_type" }
        );
      if (saved.error) throw new Error(saved.error.message);
      await logAuditEvent({
        actor_id: userId,
        action:
          moduleKey === "polls"
            ? "room.poll.voted"
            : "room.form.submitted",
        target_type: "room_module_record",
        target_id: recordId,
        metadata: { room_id: roomId, module: moduleKey },
      });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "review_request") {
      if (!access.canManage) return jsonError("Room management access is required.", 403);
      const requestId = body?.requestId;
      const state = asString(body?.state);
      if (!validUuid(requestId) || !["approved", "declined"].includes(state)) {
        return jsonError("Invalid request review.", 400);
      }
      const requestResult = await serviceSupabase
        .from("room_applications")
        .select("*")
        .eq("id", requestId)
        .eq("room_id", roomId)
        .maybeSingle();
      if (requestResult.error || !requestResult.data) {
        return jsonError("Room request not found.", 404);
      }
      const application = requestResult.data as RoomRow;
      const applicantId = asString(application.applicant_id);
      if (state === "approved") {
        const entitlements = getRoomPlanEntitlements(
          access.room.subscriptionPlan,
          access.room.subscriptionStatus
        );
        if (entitlements.memberLimit !== null) {
          const countResult = await serviceSupabase
            .from("room_members")
            .select("id", { count: "exact", head: true })
            .eq("room_id", roomId)
            .not("status", "in", "(blocked,removed,inactive)");
          if (countResult.error) throw new Error(countResult.error.message);
          if ((countResult.count ?? 0) >= entitlements.memberLimit) {
            return jsonError("This Room has reached its member limit.", 409);
          }
        }
        const membership = await serviceSupabase.from("room_members").upsert(
          {
            room_id: roomId,
            user_id: applicantId,
            role: "member",
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "room_id,user_id" }
        );
        if (membership.error) throw new Error(membership.error.message);
      }
      const reviewed = await serviceSupabase
        .from("room_applications")
        .update({
          state,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("room_id", roomId);
      if (reviewed.error) throw new Error(reviewed.error.message);
      await logAuditEvent({
        actor_id: userId,
        action: "room.application_reviewed",
        target_type: "room_application",
        target_id: requestId,
        metadata: { room_id: roomId, applicant_id: applicantId, state },
      });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "update_settings") {
      if (!access.canManage) return jsonError("Room management access is required.", 403);
      if (moduleKey === "enterprise-controls" && !access.isOwner) {
        return jsonError("Only the Room owner can update enterprise controls.", 403);
      }
      const existing = await getSettings(serviceSupabase, roomId);
      const requested = normalizeSettings({ ...existing, ...asObject(body?.settings) });
      const settingsUpdate = await serviceSupabase
        .from("room_module_settings")
        .upsert(
          {
            room_id: roomId,
            settings: requested,
            updated_by: userId,
          },
          { onConflict: "room_id" }
        );
      if (settingsUpdate.error) throw new Error(settingsUpdate.error.message);

      if (moduleKey === "settings") {
        const name = cleanText(body?.room?.name, 80);
        const description = cleanText(body?.room?.description, 600);
        const inviteOnly =
          typeof body?.room?.inviteOnly === "boolean"
            ? body.room.inviteOnly
            : access.room.inviteOnly;
        if (name.length < 3) return jsonError("Room name must contain at least 3 characters.", 400);
        if (description.length < 10) {
          return jsonError("Room purpose must contain at least 10 characters.", 400);
        }
        const roomUpdate = await serviceSupabase
          .from("rooms")
          .update({ name, description, invite_only: inviteOnly })
          .eq("id", roomId);
        if (roomUpdate.error) throw new Error(roomUpdate.error.message);
      }

      await logAuditEvent({
        actor_id: userId,
        action: "room.settings.updated",
        target_type: "room",
        target_id: roomId,
        metadata: { room_id: roomId, module: moduleKey },
      });
      return NextResponse.json(
        { ok: true, settings: requested },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "create_invite") {
      if (!access.canManage) return jsonError("Room management access is required.", 403);
      const label = cleanText(body?.label, 120) || "Room invitation";
      const role = body?.role === "moderator" ? "moderator" : "member";
      const maxUsesValue = asNumber(body?.maxUses);
      const maxUses = maxUsesValue > 0 ? Math.min(10000, Math.floor(maxUsesValue)) : null;
      const expiresAt = safeIsoDate(body?.expiresAt);
      const rawToken = `${randomUUID()}${randomBytes(18).toString("base64url")}`;
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const inserted = await serviceSupabase
        .from("room_invites")
        .insert({
          room_id: roomId,
          token_hash: tokenHash,
          label,
          role,
          max_uses: maxUses,
          expires_at: expiresAt,
          created_by: userId,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      const inviteId = asString((inserted.data as RoomRow).id);
      const inviteUrl = `${request.nextUrl.origin}/rooms/join?token=${encodeURIComponent(rawToken)}`;
      await logAuditEvent({
        actor_id: userId,
        action: "room.invite.created",
        target_type: "room_invite",
        target_id: inviteId,
        metadata: { room_id: roomId, role, max_uses: maxUses },
      });
      return NextResponse.json(
        { ok: true, inviteId, inviteUrl },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    if (action === "revoke_invite") {
      if (!access.canManage) return jsonError("Room management access is required.", 403);
      const inviteId = body?.inviteId;
      if (!validUuid(inviteId)) return jsonError("Invalid Room invitation.", 400);
      const updated = await serviceSupabase
        .from("room_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", inviteId)
        .eq("room_id", roomId);
      if (updated.error) throw new Error(updated.error.message);
      await logAuditEvent({
        actor_id: userId,
        action: "room.invite.revoked",
        target_type: "room_invite",
        target_id: inviteId,
        metadata: { room_id: roomId },
      });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return jsonError("Unsupported Room module action.", 400);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "The Room module action failed.",
      503,
      "room_module_action_failed"
    );
  }
}
