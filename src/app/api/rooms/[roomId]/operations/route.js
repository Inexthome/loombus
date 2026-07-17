import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { asNumber, asString, normalizeRole } from "@/lib/room-operations";
import {
  MEMBER_ACTIONS, MEMBER_ROLES, REASONS, TARGETS,
  context, error, iso, profileMap, reply, reportables,
  roomPayload, serializeMember, serializeReport, snapshot,
  text, usage, uuid, visibleModules,
} from "@/lib/room-operations-service";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

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
    const ownProfiles = await profileMap(service, (own.data ?? []).flatMap((row) => [row.reporter_id, row.resolved_by]));
    const payload = { ...base, reportables: await reportables(service, roomId, modules), ownReports: (own.data ?? []).map((row) => serializeReport(row, ownProfiles)) };
    if (access.canModerate || access.canManage) {
      const [members, reports, removedPosts, removedRecords] = await Promise.all([
        service.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(500),
        service.from("room_moderation_reports").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(200),
        service.from("room_posts").select("id,title,deletion_reason,deleted_at").eq("room_id", roomId).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(50),
        service.from("room_module_records").select("id,title,module_key,archived_at").eq("room_id", roomId).not("archived_at", "is", null).order("archived_at", { ascending: false }).limit(50),
      ]);
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

export async function POST(request, routeContext) {
  const ctx = await context(request, routeContext); if (ctx.response) return ctx.response;
  const { service, roomId, access, plan, userId } = ctx;
  const body = await request.json().catch(() => ({})); const action = asString(body.action);
  if (action === "report_content") {
    const targetType = asString(body.targetType), targetId = asString(body.targetId), reason = asString(body.reason), details = text(body.details);
    if (!TARGETS.has(targetType) || !uuid(targetId) || !REASONS.has(reason)) return error("Choose a valid Room item and report reason.", 400);
    const item = await snapshot(service, roomId, targetType, targetId, await visibleModules(service, roomId, access, plan));
    if (!item) return error("The reported Room item was not found.", 404);
    if (item.userId === userId) return error("You cannot report your own Room membership.", 400);
    const hourAgo = new Date(Date.now() - 3600000).toISOString();
    const rate = await service.from("room_moderation_reports").select("id", { count: "exact", head: true }).eq("room_id", roomId).eq("reporter_id", userId).gte("created_at", hourAgo);
    if ((rate.count ?? 0) >= 20) return error("Too many Room reports were submitted recently.", 429, "room_report_rate_limited");
    const result = await service.from("room_moderation_reports").insert({ room_id: roomId, reporter_id: userId, target_type: targetType, target_id: targetId, target_label: item.label, target_snapshot: item.snapshot, reason, details });
    if (result.error) return error(result.error.code === "23505" ? "You already have a pending report for this item." : result.error.message, result.error.code === "23505" ? 409 : 400);
    await logAuditEvent({ actor_id: userId, action: "room.moderation_report_created", target_type: targetType, target_id: targetId, metadata: { room_id: roomId, reason } });
    return reply({ ok: true });
  }
  if (action === "leave_room") {
    if (access.isOwner) return error("Transfer ownership before leaving this Room.", 400);
    const result = await service.from("room_members").update({ status: "removed", updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", access.membershipId);
    if (result.error) return error(result.error.message); return reply({ ok: true, left: true });
  }
  if (action === "open_billing_portal") {
    if (!access.isOwner) return error("Only the Room owner can manage Room billing.", 403);
    const customer = asString(access.rawRoom.stripe_customer_id); if (!customer) return error("This Room does not have a Stripe billing customer.", 404);
    if (!STRIPE_SECRET_KEY) return error("Stripe billing is not configured.", 503);
    try { const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || "https://loombus.com").origin; const session = await new Stripe(STRIPE_SECRET_KEY).billingPortal.sessions.create({ customer, return_url: `${origin}/rooms/${encodeURIComponent(roomId)}?billing=returned` }); return reply({ ok: true, url: session.url }); }
    catch { return error("The secure Room billing portal could not be opened.", 503); }
  }
  if (action === "member_action") {
    if (!access.canManage) return error("Room management access is required.", 403);
    const memberId = asString(body.memberId), memberAction = asString(body.memberAction), role = asString(body.role), note = text(body.note), hours = Math.min(Math.max(Math.trunc(asNumber(body.durationHours) || 24), 1), 8760);
    if (!uuid(memberId) || (memberAction && !MEMBER_ACTIONS.has(memberAction)) || (role && !MEMBER_ROLES.has(role))) return error("Invalid member operation.", 400);
    const target = await service.from("room_members").select("*").eq("room_id", roomId).eq("id", memberId).maybeSingle(); if (!target.data) return error("Room member not found.", 404);
    const row = target.data, memberUserId = asString(row.user_id), currentRole = normalizeRole(row.role);
    if ([access.room.ownerId, access.room.createdBy].includes(memberUserId)) return error("The Room owner cannot be moderated here.", 400);
    if (access.role === "administrator" && (currentRole === "administrator" || role === "administrator")) return error("Only the Room owner can manage administrators.", 403);
    const now = new Date(), changes = { moderation_note: note || null, moderated_by: userId, moderated_at: now.toISOString(), updated_at: now.toISOString() };
    if (role) changes.role = role === "administrator" ? "admin" : role;
    if (memberAction === "activate") Object.assign(changes, { status: "active", muted_until: null, suspended_until: null });
    if (memberAction === "mute") Object.assign(changes, { status: "active", muted_until: new Date(now.getTime() + hours * 3600000).toISOString() });
    if (memberAction === "suspend") Object.assign(changes, { status: "active", suspended_until: new Date(now.getTime() + hours * 3600000).toISOString() });
    if (memberAction === "block" || memberAction === "remove") Object.assign(changes, { status: memberAction === "block" ? "blocked" : "removed", muted_until: null, suspended_until: null });
    const result = await service.from("room_members").update(changes).eq("room_id", roomId).eq("id", memberId); if (result.error) return error(result.error.message);
    await logAuditEvent({ actor_id: userId, action: "room.member_operations_updated", target_type: "room_member", target_id: memberId, metadata: { room_id: roomId, member_user_id: memberUserId, member_action: memberAction || null, role: role || null } });
    return reply({ ok: true });
  }
  if (action === "resolve_report") {
    if (!access.canModerate) return error("Room moderation access is required.", 403);
    const reportId = asString(body.reportId), state = asString(body.state), moderationAction = asString(body.moderationAction), resolutionNote = text(body.resolutionNote);
    if (!uuid(reportId) || !["resolved", "dismissed", "actioned"].includes(state)) return error("Invalid moderation decision.", 400);
    const found = await service.from("room_moderation_reports").select("*").eq("room_id", roomId).eq("id", reportId).maybeSingle(); if (!found.data) return error("Moderation report not found.", 404);
    const report = found.data, type = report.target_type, id = report.target_id;
    if (moderationAction === "remove_target") {
      if (type === "room_post") await service.from("room_posts").update({ deleted_at: new Date().toISOString(), deleted_by: userId, deletion_reason: `Moderation report ${reportId}`, updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", id).is("deleted_at", null);
      else if (type === "room_member") {
        const target = await service.from("room_members").select("user_id,role").eq("room_id", roomId).eq("id", id).maybeSingle(); if (!target.data) return error("Reported member not found.", 404);
        const targetRole = normalizeRole(target.data.role), targetUser = target.data.user_id;
        if ([access.room.ownerId, access.room.createdBy].includes(targetUser) || (access.role === "moderator" && targetRole !== "member") || (access.role === "administrator" && targetRole === "administrator")) return error("Your Room role cannot moderate this member.", 403);
        await service.from("room_members").update({ status: "blocked", muted_until: null, suspended_until: null, moderated_by: userId, moderated_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", id);
      } else {
        if (!access.canManage) return error("Room management access is required for this target.", 403);
        if (type === "room_module_record") await service.from("room_module_records").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", id);
        else if (type === "room_resource") { const file = await service.from("room_resources").select("storage_path").eq("room_id", roomId).eq("id", id).maybeSingle(); if (file.data?.storage_path) await service.storage.from("room-resources").remove([file.data.storage_path]); await service.from("room_resources").delete().eq("room_id", roomId).eq("id", id); }
        else if (type === "room_announcement") await service.from("room_announcements").delete().eq("room_id", roomId).eq("id", id);
        else if (type === "room_event") await service.from("room_events").delete().eq("room_id", roomId).eq("id", id);
      }
    }
    const finalState = moderationAction === "remove_target" ? "actioned" : state;
    const result = await service.from("room_moderation_reports").update({ state: finalState, resolution_note: resolutionNote, resolved_by: userId, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", reportId); if (result.error) return error(result.error.message);
    return reply({ ok: true });
  }
  if (action === "restore_target") {
    if (!access.canManage) return error("Room management access is required.", 403);
    const type = asString(body.targetType), id = asString(body.targetId); if (!uuid(id)) return error("Invalid Room item.", 400);
    const result = type === "room_post" ? await service.from("room_posts").update({ deleted_at: null, deleted_by: null, deletion_reason: null, updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", id) : type === "room_module_record" ? await service.from("room_module_records").update({ archived_at: null, updated_at: new Date().toISOString() }).eq("room_id", roomId).eq("id", id) : null;
    if (!result) return error("This Room item cannot be restored.", 400); if (result.error) return error(result.error.message); return reply({ ok: true });
  }
  if (action === "transfer_ownership") {
    if (!access.isOwner) return error("Only the Room owner can transfer ownership.", 403);
    const nextOwnerId = asString(body.nextOwnerId); if (!uuid(nextOwnerId)) return error("Choose a valid next owner.", 400);
    if (access.room.subscriptionPlan !== "free" && ["active", "trialing"].includes(access.room.subscriptionStatus.toLowerCase())) return error("Cancel active Room billing before transferring ownership.", 409, "active_room_subscription");
    const result = await service.rpc("transfer_room_ownership", { target_room_id: roomId, acting_owner_id: userId, next_owner_id: nextOwnerId }); if (result.error) return error(result.error.message); return reply({ ok: true, transferred: true });
  }
  if (["archive_room", "unarchive_room"].includes(action)) {
    if (!access.isOwner) return error("Only the Room owner can change Room lifecycle status.", 403);
    const archive = action === "archive_room"; const result = await service.from("rooms").update({ status: archive ? "archived" : "active", archived_at: archive ? new Date().toISOString() : null, archived_by: archive ? userId : null, updated_at: new Date().toISOString() }).eq("id", roomId); if (result.error) return error(result.error.message); return reply({ ok: true });
  }
  if (action === "schedule_deletion") {
    if (!access.isOwner) return error("Only the Room owner can schedule deletion.", 403);
    if (text(body.confirmName, 240) !== access.room.name) return error("Enter the exact Room name to schedule deletion.", 400);
    const now = new Date(), scheduled = new Date(now.getTime() + 30 * 86400000); const result = await service.from("rooms").update({ status: "pending_deletion", deletion_requested_at: now.toISOString(), deletion_scheduled_for: scheduled.toISOString(), deletion_requested_by: userId, deletion_reason: text(body.reason), updated_at: now.toISOString() }).eq("id", roomId); if (result.error) return error(result.error.message); return reply({ ok: true, scheduledFor: scheduled.toISOString() });
  }
  if (action === "restore_deletion") {
    if (!access.isOwner) return error("Only the Room owner can restore this Room.", 403);
    const result = await service.from("rooms").update({ status: "active", deletion_requested_at: null, deletion_scheduled_for: null, deletion_requested_by: null, deletion_reason: null, updated_at: new Date().toISOString() }).eq("id", roomId); if (result.error) return error(result.error.message); return reply({ ok: true });
  }
  if (action === "delete_now") {
    if (!access.isOwner) return error("Only the Room owner can permanently delete this Room.", 403);
    const scheduled = iso(access.rawRoom.deletion_scheduled_for); if (!scheduled || new Date(scheduled).getTime() > Date.now()) return error("The 30-day Room recovery period has not ended.", 409);
    if (access.room.subscriptionPlan !== "free" && ["active", "trialing"].includes(access.room.subscriptionStatus.toLowerCase())) return error("Cancel the active Room subscription before permanent deletion.", 409);
    const files = await service.from("room_resources").select("storage_path").eq("room_id", roomId).limit(10000); const paths = (files.data ?? []).map((row) => row.storage_path).filter(Boolean); if (paths.length) await service.storage.from("room-resources").remove(paths);
    const result = await service.from("rooms").delete().eq("id", roomId); if (result.error) return error(result.error.message); return reply({ ok: true, deleted: true });
  }
  return error("Unsupported Room operation.", 400);
}
