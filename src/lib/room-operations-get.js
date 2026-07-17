import {
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

export async function GET(request, routeContext) {
  const ctx = await context(request, routeContext); if (ctx.response) return ctx.response;
  const { service, roomId, access, plan, userId } = ctx;
  const view = request.nextUrl.searchParams.get("view") || "summary";
  if (view === "export") {
    if (!access.isOwner) return error("Only the Room owner can export the complete Room.", 403);
    const queries = {
      members: service.from("room_members").select("*").eq("room_id", roomId).limit(5000), posts: service.from("room_posts").select("*").eq("room_id", roomId).limit(5000),
      events: service.from("room_events").select("*").eq("room_id", roomId).limit(5000), announcements: service.from("room_announcements").select("*").eq("room_id", roomId).limit(5000),
      applications: service.from("room_applications").select("*").eq("room_id", roomId).limit(5000), resources: service.from("room_resources").select("id,room_id,uploaded_by,file_name,mime_type,media_kind,file_size_bytes,storage_path,created_at,updated_at").eq("room_id", roomId).limit(5000),
      moduleRecords: service.from("room_module_records").select("*").eq("room_id", roomId).limit(5000), moduleResponses: service.from("room_module_responses").select("*").eq("room_id", roomId).limit(5000),
      invites: service.from("room_invites").select("id,room_id,label,role,max_uses,use_count,expires_at,revoked_at,created_by,created_at,updated_at").eq("room_id", roomId).limit(5000),
      moderationReports: service.from("room_moderation_reports").select("*").eq("room_id", roomId).limit(5000), activityEvents: service.from("room_activity_events").select("*").eq("room_id", roomId).limit(5000),
      auditLogs: service.from("audit_logs").select("id,actor_id,action,target_type,target_id,metadata,created_at").contains("metadata", { room_id: roomId }).limit(5000), settings: service.from("room_module_settings").select("*").eq("room_id", roomId).limit(1),
    };
    const entries = await Promise.all(Object.entries(queries).map(async ([key, query]) => { const result = await query; if (result.error) throw new Error(result.error.message); return [key, result.data ?? []]; }));
    const room = { ...access.rawRoom, stripe_customer_id: undefined, stripe_subscription_id: undefined, stripe_price_id: undefined, stripe_checkout_session_id: undefined };
    const name = access.room.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "room";
    return reply({ exportedAt: new Date().toISOString(), format: "loombus-room-export-v1", room, data: Object.fromEntries(entries) }, 200, { "Content-Disposition": `attachment; filename="${name}-export.json"` });
  }
  try {
    const modules = await visibleModules(service, roomId, access, plan);
    const base = { access: { role: access.role, isOwner: access.isOwner, canManage: access.canManage, canModerate: access.canModerate }, room: roomPayload(access, plan) };
    if (view === "summary") {
      let pendingReportCount = 0;
      if (access.canModerate) { const result = await service.from("room_moderation_reports").select("id", { count: "exact", head: true }).eq("room_id", roomId).eq("state", "pending"); pendingReportCount = result.count ?? 0; }
      return reply({ ...base, pendingReportCount });
    }
    const own = await service.from("room_moderation_reports").select("*").eq("room_id", roomId).eq("reporter_id", userId).order("created_at", { ascending: false }).limit(30);
    if (own.error) throw new Error(own.error.message);
    const ownProfiles = await profileMap(service, (own.data ?? []).flatMap((row) => [row.reporter_id, row.resolved_by]));
    const payload = { ...base, reportables: await reportables(service, roomId, modules), ownReports: (own.data ?? []).map((row) => serializeReport(row, ownProfiles)) };
    if (access.canModerate || access.canManage) {
      const [members, reports, removedPosts, removedRecords] = await Promise.all([
        service.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(500),
        service.from("room_moderation_reports").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
        service.from("room_posts").select("id,title,deletion_reason,deleted_at").eq("room_id", roomId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(50),
        service.from("room_module_records").select("id,title,module_key,archived_at").eq("room_id", roomId).not("archived_at", "is", null).order("archived_at", { ascending: false }).limit(50),
      ]);
      for (const result of [members, reports, removedPosts, removedRecords]) if (result.error) throw new Error(result.error.message);
      const profiles = await profileMap(service, [...(members.data ?? []).map((row) => row.user_id), ...(reports.data ?? []).flatMap((row) => [row.reporter_id, row.resolved_by])]);
      payload.management = {
        members: (members.data ?? []).map((row) => serializeMember(row, profiles, access.canManage)), membersCapped: (members.data ?? []).length >= 500,
        reports: (reports.data ?? []).map((row) => serializeReport(row, profiles)), pendingReportCount: (reports.data ?? []).filter((row) => row.state === "pending").length,
        removedTargets: access.canManage ? [...(removedPosts.data ?? []).map((row) => ({ targetType: "room_post", targetId: row.id, label: row.title || "Removed discussion", reason: row.deletion_reason, removedAt: row.deleted_at })), ...(removedRecords.data ?? []).map((row) => ({ targetType: "room_module_record", targetId: row.id, label: row.title || "Archived item", reason: row.module_key, removedAt: row.archived_at }))] : [],
        usage: await usage(service, roomId, access, plan),
      };
    }
    return reply(payload);
  } catch (cause) { return error(cause instanceof Error ? cause.message : "Room operations could not load.", 503); }
}
