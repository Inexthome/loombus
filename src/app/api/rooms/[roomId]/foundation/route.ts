import { NextResponse, type NextRequest } from "next/server";
import {
  ROOM_MODULE_DEFINITIONS,
  getRoomPlanEntitlements,
  isRoomModuleKey,
  type RoomModuleKey,
} from "@/lib/room-plan-entitlements";
import {
  asBoolean,
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

type RouteContext = { params: Promise<{ roomId: string }> };
type ServiceClient = ReturnType<typeof createRoomServiceSupabase>;
type Preference = {
  muted: boolean;
  importantOnly: boolean;
  lastReadAt: string;
};

const SEARCH_RESULT_LIMIT = 75;
const INBOX_LIMIT = 120;
const UNREAD_SCAN_LIMIT = 1000;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function error(message: string, status: number, code?: string) {
  return json(code ? { error: message, code } : { error: message }, status);
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function authorize(request: NextRequest) {
  try {
    const requestSupabase = createRequestSupabase(request);
    const accountAccess = await verifyRequestAccountAccess(requestSupabase);
    if (!accountAccess.ok) {
      return {
        ok: false as const,
        response: error(
          accountAccess.error,
          accountAccess.status,
          accountAccess.code
        ),
      };
    }
    return {
      ok: true as const,
      userId: accountAccess.user.id,
      service: createRoomServiceSupabase(),
    };
  } catch {
    return {
      ok: false as const,
      response: error("Rooms service is not configured.", 500),
    };
  }
}

async function roomAccess(
  service: ServiceClient,
  roomId: string,
  userId: string
) {
  const access = await getRoomAccess(service, roomId, userId).catch(() => null);
  if (!access) return { access: null, response: error("Room not found.", 404) };
  if (!access.allowed) {
    return {
      access: null,
      response: error("Active Room membership is required.", 403),
    };
  }
  return { access, response: null };
}

async function loadPreference(
  service: ServiceClient,
  roomId: string,
  userId: string
): Promise<Preference> {
  const existing = await service
    .from("room_notification_preferences")
    .select("muted, important_only, last_read_at")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);

  if (existing.data) {
    const row = existing.data as RoomRow;
    return {
      muted: row.muted === true,
      importantOnly: row.important_only === true,
      lastReadAt: asString(row.last_read_at) || new Date().toISOString(),
    };
  }

  const created = await service
    .from("room_notification_preferences")
    .insert({ room_id: roomId, user_id: userId })
    .select("muted, important_only, last_read_at")
    .single();

  if (created.error) throw new Error(created.error.message);
  const row = created.data as RoomRow;
  return {
    muted: row.muted === true,
    importantOnly: row.important_only === true,
    lastReadAt: asString(row.last_read_at) || new Date().toISOString(),
  };
}

function audienceVisible(row: RoomRow, access: RoomAccess, userId: string) {
  const audience = asString(row.audience) || "all";
  if (audience === "all") return true;
  if (audience === "managers") return access.canManage;
  if (audience === "owner") return access.isOwner;
  if (audience === "actor") return asString(row.actor_id) === userId;
  return false;
}

function moduleVisible(
  moduleKey: string,
  access: RoomAccess,
  directoryVisible: boolean
) {
  const plan = getRoomPlanEntitlements(
    access.room.subscriptionPlan,
    access.room.subscriptionStatus
  );
  if (!isRoomModuleKey(moduleKey)) return false;
  if (!plan.modules.includes(moduleKey)) return false;
  if (moduleKey === "directory" && !access.canManage && !directoryVisible) {
    return false;
  }
  const required = ROOM_MODULE_DEFINITIONS[moduleKey].minimumRole;
  if (required === "manager" && !access.canManage) return false;
  if (required === "owner" && !access.isOwner) return false;
  return true;
}

async function loadDirectoryVisibility(
  service: ServiceClient,
  roomId: string
) {
  const result = await service
    .from("room_module_settings")
    .select("settings")
    .eq("room_id", roomId)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  const settings = (result.data as RoomRow | null)?.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return true;
  }
  return (settings as Record<string, unknown>).memberDirectoryVisible !== false;
}

async function loadVisibleEvents(
  service: ServiceClient,
  roomId: string,
  userId: string,
  access: RoomAccess,
  preference: Preference,
  limit: number
) {
  const result = await service
    .from("room_activity_events")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as RoomRow[])
    .filter((row) => audienceVisible(row, access, userId))
    .filter(
      (row) =>
        !preference.importantOnly || asString(row.importance) === "high"
    );
}

function serializeEvent(
  row: RoomRow,
  profiles: Awaited<ReturnType<typeof loadProfiles>>
) {
  const actorId = asString(row.actor_id);
  const moduleKey = asString(row.module_key);
  return {
    id: asString(row.id),
    actorId: actorId || null,
    actor: actorId ? profileFor(profiles, actorId) : null,
    eventType: asString(row.event_type),
    moduleKey,
    moduleLabel:
      isRoomModuleKey(moduleKey) ? ROOM_MODULE_DEFINITIONS[moduleKey].label : "Room",
    targetType: asString(row.target_type),
    targetId: asString(row.target_id) || null,
    title: asString(row.title) || "Room activity",
    summary: asString(row.summary),
    importance: asString(row.importance) || "normal",
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt: asString(row.created_at) || null,
  };
}

async function buildActivityPayload(
  service: ServiceClient,
  roomId: string,
  userId: string,
  access: RoomAccess,
  preference: Preference,
  includeEvents: boolean
) {
  const [latest, unreadRows] = await Promise.all([
    loadVisibleEvents(
      service,
      roomId,
      userId,
      access,
      preference,
      includeEvents ? INBOX_LIMIT : 8
    ),
    service
      .from("room_activity_events")
      .select("id, actor_id, audience, importance, created_at")
      .eq("room_id", roomId)
      .gt("created_at", preference.lastReadAt)
      .order("created_at", { ascending: false })
      .limit(UNREAD_SCAN_LIMIT),
  ]);

  if (unreadRows.error) throw new Error(unreadRows.error.message);

  const unreadCount = preference.muted
    ? 0
    : ((unreadRows.data ?? []) as RoomRow[])
        .filter((row) => audienceVisible(row, access, userId))
        .filter(
          (row) =>
            !preference.importantOnly || asString(row.importance) === "high"
        ).length;

  const actorIds = latest.map((row) => asString(row.actor_id)).filter(Boolean);
  const profiles = await loadProfiles(service, actorIds);

  return {
    room: {
      id: access.room.id,
      name: access.room.name,
    },
    preferences: preference,
    unreadCount,
    unreadCapped: unreadCount >= UNREAD_SCAN_LIMIT,
    events: latest.map((row) => serializeEvent(row, profiles)),
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return error("Invalid Room id.", 400);

  const { access, response } = await roomAccess(
    authorized.service,
    roomId,
    authorized.userId
  );
  if (!access) return response ?? error("Room not found.", 404);

  try {
    const view = request.nextUrl.searchParams.get("view") ?? "summary";
    const preference = await loadPreference(
      authorized.service,
      roomId,
      authorized.userId
    );

    if (view === "preferences") {
      return json({ preferences: preference });
    }

    if (view === "search") {
      const query = (request.nextUrl.searchParams.get("q") ?? "")
        .trim()
        .slice(0, 160);
      if (query.length < 2) {
        return json({ query, results: [] });
      }

      const requestedModule = request.nextUrl.searchParams.get("module") ?? "";
      const moduleFilter =
        requestedModule && isRoomModuleKey(requestedModule)
          ? requestedModule
          : null;

      const directoryVisible = await loadDirectoryVisibility(
        authorized.service,
        roomId
      );
      const searchResult = await authorized.service.rpc("search_room_content", {
        target_room_id: roomId,
        search_text: query,
        module_filter: moduleFilter,
        result_limit: SEARCH_RESULT_LIMIT,
      });

      if (searchResult.error) throw new Error(searchResult.error.message);

      const results = ((searchResult.data ?? []) as RoomRow[])
        .filter((row) =>
          moduleVisible(
            asString(row.module_key),
            access,
            directoryVisible
          )
        )
        .map((row) => {
          const moduleKey = asString(row.module_key);
          return {
            moduleKey,
            moduleLabel: isRoomModuleKey(moduleKey)
              ? ROOM_MODULE_DEFINITIONS[moduleKey].label
              : "Room",
            targetType: asString(row.target_type),
            targetId: asString(row.target_id),
            title: asString(row.title) || "Room result",
            snippet: asString(row.snippet),
            createdAt: asString(row.created_at) || null,
            rank:
              typeof row.rank === "number"
                ? row.rank
                : Number(row.rank) || 0,
          };
        });

      return json({ query, module: moduleFilter, results });
    }

    if (view === "inbox") {
      return json(
        await buildActivityPayload(
          authorized.service,
          roomId,
          authorized.userId,
          access,
          preference,
          true
        )
      );
    }

    return json(
      await buildActivityPayload(
        authorized.service,
        roomId,
        authorized.userId,
        access,
        preference,
        false
      )
    );
  } catch (caught) {
    return error(
      caught instanceof Error
        ? caught.message
        : "Room activity could not be loaded.",
      500
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authorized = await authorize(request);
  if (!authorized.ok) return authorized.response;

  const { roomId } = await context.params;
  if (!validUuid(roomId)) return error("Invalid Room id.", 400);

  const { access, response } = await roomAccess(
    authorized.service,
    roomId,
    authorized.userId
  );
  if (!access) return response ?? error("Room not found.", 404);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("Invalid Room activity request.", 400);
  }

  const action = asString(body.action);

  try {
    if (action === "mark_read") {
      const readAt = new Date().toISOString();
      const result = await authorized.service
        .from("room_notification_preferences")
        .upsert(
          {
            room_id: roomId,
            user_id: authorized.userId,
            last_read_at: readAt,
          },
          { onConflict: "room_id,user_id" }
        )
        .select("muted, important_only, last_read_at")
        .single();

      if (result.error) throw new Error(result.error.message);
      return json({
        success: true,
        preferences: {
          muted: result.data.muted === true,
          importantOnly: result.data.important_only === true,
          lastReadAt: asString(result.data.last_read_at) || readAt,
        },
      });
    }

    if (action === "update_preferences") {
      const current = await loadPreference(
        authorized.service,
        roomId,
        authorized.userId
      );
      const muted =
        typeof body.muted === "boolean" ? body.muted : current.muted;
      const importantOnly =
        typeof body.importantOnly === "boolean"
          ? body.importantOnly
          : current.importantOnly;

      const result = await authorized.service
        .from("room_notification_preferences")
        .upsert(
          {
            room_id: roomId,
            user_id: authorized.userId,
            muted: asBoolean(muted),
            important_only: asBoolean(importantOnly),
          },
          { onConflict: "room_id,user_id" }
        )
        .select("muted, important_only, last_read_at")
        .single();

      if (result.error) throw new Error(result.error.message);
      return json({
        success: true,
        preferences: {
          muted: result.data.muted === true,
          importantOnly: result.data.important_only === true,
          lastReadAt:
            asString(result.data.last_read_at) || current.lastReadAt,
        },
      });
    }

    return error("Unsupported Room activity action.", 400);
  } catch (caught) {
    return error(
      caught instanceof Error
        ? caught.message
        : "Room activity could not be updated.",
      500
    );
  }
}
