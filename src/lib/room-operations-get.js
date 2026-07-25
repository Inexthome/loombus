import {
  corePagingFromSearchParams,
  loadCorePage,
} from "@/lib/room-core-pagination";
import {
  active,
  context,
  error,
  profileMap,
  reply,
  reportables,
  roomPayload,
  serializeMember,
  serializeReport,
  usage,
  visibleModules,
} from "@/lib/room-operations-service";

const REPORTABLE_LIMIT = 120;
const RECOVERY_LIMIT = 25;
const LIFECYCLE_MEMBER_LIMIT = 500;

async function pendingReportCount(service, roomId, canModerate) {
  if (!canModerate) return 0;
  const result = await service
    .from("room_moderation_reports")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("state", "pending");
  if (result.error) throw new Error(result.error.message);
  return result.count ?? 0;
}

function basePayload(access, plan, pendingCount) {
  return {
    access: {
      role: access.role,
      isOwner: access.isOwner,
      canManage: access.canManage,
      canModerate: access.canModerate,
    },
    room: roomPayload(access, plan),
    pendingReportCount: pendingCount,
  };
}

async function exportRoom(service, roomId, access) {
  if (!access.isOwner) {
    return error("Only the Room owner can export the complete Room.", 403);
  }
  const queries = {
    members: service.from("room_members").select("*").eq("room_id", roomId).limit(5000),
    posts: service.from("room_posts").select("*").eq("room_id", roomId).limit(5000),
    events: service.from("room_events").select("*").eq("room_id", roomId).limit(5000),
    announcements: service.from("room_announcements").select("*").eq("room_id", roomId).limit(5000),
    applications: service.from("room_applications").select("*").eq("room_id", roomId).limit(5000),
    resources: service
      .from("room_resources")
      .select("id,room_id,uploaded_by,file_name,mime_type,media_kind,file_size_bytes,storage_path,created_at,updated_at")
      .eq("room_id", roomId)
      .limit(5000),
    moduleRecords: service.from("room_module_records").select("*").eq("room_id", roomId).limit(5000),
    moduleResponses: service.from("room_module_responses").select("*").eq("room_id", roomId).limit(5000),
    invites: service
      .from("room_invites")
      .select("id,room_id,label,role,max_uses,use_count,expires_at,revoked_at,created_by,created_at,updated_at")
      .eq("room_id", roomId)
      .limit(5000),
    moderationReports: service.from("room_moderation_reports").select("*").eq("room_id", roomId).limit(5000),
    activityEvents: service.from("room_activity_events").select("*").eq("room_id", roomId).limit(5000),
    auditLogs: service
      .from("audit_logs")
      .select("id,actor_id,action,target_type,target_id,metadata,created_at")
      .contains("metadata", { room_id: roomId })
      .limit(5000),
    settings: service.from("room_module_settings").select("*").eq("room_id", roomId).limit(1),
  };
  const entries = await Promise.all(
    Object.entries(queries).map(async ([key, query]) => {
      const result = await query;
      if (result.error) throw new Error(result.error.message);
      return [key, result.data ?? []];
    })
  );
  const room = {
    ...access.rawRoom,
    stripe_customer_id: undefined,
    stripe_subscription_id: undefined,
    stripe_price_id: undefined,
    stripe_checkout_session_id: undefined,
  };
  const name =
    access.room.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "room";
  return reply(
    {
      exportedAt: new Date().toISOString(),
      format: "loombus-room-export-v1",
      room,
      data: Object.fromEntries(entries),
    },
    200,
    { "Content-Disposition": `attachment; filename="${name}-export.json"` }
  );
}

export async function GET(request, routeContext) {
  const ctx = await context(request, routeContext);
  if (ctx.response) return ctx.response;
  const { service, roomId, access, plan, userId } = ctx;
  const requestedView = request.nextUrl.searchParams.get("view") || "summary";

  if (requestedView === "export") {
    try {
      return await exportRoom(service, roomId, access);
    } catch (cause) {
      return error(
        cause instanceof Error ? cause.message : "Room export could not load.",
        503
      );
    }
  }

  try {
    const modules = await visibleModules(service, roomId, access, plan);
    const pendingCount = await pendingReportCount(
      service,
      roomId,
      access.canModerate
    );
    const base = basePayload(access, plan, pendingCount);
    const paging = corePagingFromSearchParams(request.nextUrl.searchParams);
    const view =
      requestedView === "operations"
        ? access.canModerate
          ? "moderation"
          : "report"
        : requestedView;

    if (view === "summary") return reply(base);

    if (view === "overview") {
      if (!access.canManage) return error("Room management access is required.", 403);
      return reply({ ...base, usage: await usage(service, roomId, access, plan) });
    }

    if (view === "report") {
      const page = await loadCorePage(
        ({ from, to }) =>
          service
            .from("room_moderation_reports")
            .select("*", { count: "exact" })
            .eq("room_id", roomId)
            .eq("reporter_id", userId)
            .order("created_at", { ascending: false })
            .range(from, to),
        paging
      );
      if (page.result.error) throw new Error(page.result.error.message);
      const rows = page.result.data ?? [];
      const profiles = await profileMap(
        service,
        rows.flatMap((row) => [row.reporter_id, row.resolved_by])
      );
      const availableReportables = await reportables(
        service,
        roomId,
        modules
      );
      return reply({
        ...base,
        reportables: availableReportables.slice(0, REPORTABLE_LIMIT),
        reportablesCapped: availableReportables.length > REPORTABLE_LIMIT,
        ownReports: rows.map((row) => serializeReport(row, profiles)),
        pageInfo: page.pageInfo,
      });
    }

    if (view === "members") {
      if (!access.canManage) return error("Room management access is required.", 403);
      const page = await loadCorePage(
        ({ from, to }) =>
          service
            .from("room_members")
            .select("*", { count: "exact" })
            .eq("room_id", roomId)
            .order("created_at", { ascending: true })
            .range(from, to),
        paging
      );
      if (page.result.error) throw new Error(page.result.error.message);
      const rows = page.result.data ?? [];
      const profiles = await profileMap(
        service,
        rows.map((row) => row.user_id)
      );
      return reply({
        ...base,
        members: rows.map((row) =>
          serializeMember(row, profiles, access.canManage)
        ),
        pageInfo: page.pageInfo,
      });
    }

    if (view === "moderation") {
      if (!access.canModerate) return error("Room moderation access is required.", 403);
      const [page, removedPosts, removedRecords] = await Promise.all([
        loadCorePage(
          ({ from, to }) =>
            service
              .from("room_moderation_reports")
              .select("*", { count: "exact" })
              .eq("room_id", roomId)
              .eq("state", "pending")
              .order("created_at", { ascending: false })
              .range(from, to),
          paging
        ),
        access.canManage
          ? service
              .from("room_posts")
              .select("id,title,deletion_reason,deleted_at")
              .eq("room_id", roomId)
              .not("deleted_at", "is", null)
              .order("deleted_at", { ascending: false })
              .limit(RECOVERY_LIMIT)
          : Promise.resolve({ data: [], error: null }),
        access.canManage
          ? service
              .from("room_module_records")
              .select("id,title,module_key,archived_at")
              .eq("room_id", roomId)
              .not("archived_at", "is", null)
              .order("archived_at", { ascending: false })
              .limit(RECOVERY_LIMIT)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (page.result.error) throw new Error(page.result.error.message);
      if (removedPosts.error) throw new Error(removedPosts.error.message);
      if (removedRecords.error) throw new Error(removedRecords.error.message);
      const reports = page.result.data ?? [];
      const profiles = await profileMap(
        service,
        reports.flatMap((row) => [row.reporter_id, row.resolved_by])
      );
      const removedTargets = access.canManage
        ? [
            ...(removedPosts.data ?? []).map((row) => ({
              targetType: "room_post",
              targetId: row.id,
              label: row.title || "Removed discussion",
              reason: row.deletion_reason,
              removedAt: row.deleted_at,
            })),
            ...(removedRecords.data ?? []).map((row) => ({
              targetType: "room_module_record",
              targetId: row.id,
              label: row.title || "Archived item",
              reason: row.module_key,
              removedAt: row.archived_at,
            })),
          ]
        : [];
      return reply({
        ...base,
        reports: reports.map((row) => serializeReport(row, profiles)),
        removedTargets,
        recoveryCapped:
          (removedPosts.data ?? []).length >= RECOVERY_LIMIT ||
          (removedRecords.data ?? []).length >= RECOVERY_LIMIT,
        pageInfo: page.pageInfo,
      });
    }

    if (view === "lifecycle") {
      if (!access.isOwner) return error("Only the Room owner can manage lifecycle controls.", 403);
      const result = await service
        .from("room_members")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true })
        .limit(LIFECYCLE_MEMBER_LIMIT);
      if (result.error) throw new Error(result.error.message);
      const rows = (result.data ?? []).filter(
        (row) => active(row) && row.user_id !== access.room.ownerId
      );
      const profiles = await profileMap(
        service,
        rows.map((row) => row.user_id)
      );
      return reply({
        ...base,
        candidates: rows.map((row) => serializeMember(row, profiles, false)),
        candidatesCapped: (result.data ?? []).length >= LIFECYCLE_MEMBER_LIMIT,
      });
    }

    return error("Unknown Room operations view.", 400);
  } catch (cause) {
    return error(
      cause instanceof Error
        ? cause.message
        : "Room operations could not load.",
      503
    );
  }
}
