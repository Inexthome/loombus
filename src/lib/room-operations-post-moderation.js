import { logAuditEvent } from "@/lib/audit-log";
import { asNumber, asString, normalizeRole } from "@/lib/room-operations";
import {
  MEMBER_ACTIONS,
  MEMBER_ROLES,
  error,
  reply,
  text,
  uuid,
} from "@/lib/room-operations-service";

export async function handleModerationAction(ctx, body, action) {
  const { service, roomId, access, userId } = ctx;

  if (action === "member_action") {
    if (!access.canManage) return error("Room management access is required.", 403);
    const memberId = asString(body.memberId);
    const memberAction = asString(body.memberAction);
    const role = asString(body.role);
    const note = text(body.note);
    const hours = Math.min(
      Math.max(Math.trunc(asNumber(body.durationHours) || 24), 1),
      8760
    );
    if (
      !uuid(memberId) ||
      (memberAction && !MEMBER_ACTIONS.has(memberAction)) ||
      (role && !MEMBER_ROLES.has(role))
    ) {
      return error("Invalid member operation.", 400);
    }
    const target = await service
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("id", memberId)
      .maybeSingle();
    if (target.error) return error(target.error.message, 503);
    if (!target.data) return error("Room member not found.", 404);
    const memberUserId = asString(target.data.user_id);
    const currentRole = normalizeRole(target.data.role);
    if ([access.room.ownerId, access.room.createdBy].includes(memberUserId)) {
      return error("The Room owner cannot be moderated here.", 400);
    }
    if (
      access.role === "administrator" &&
      (currentRole === "administrator" || role === "administrator")
    ) {
      return error("Only the Room owner can manage administrators.", 403);
    }
    const now = new Date();
    const changes = {
      moderation_note: note || null,
      moderated_by: userId,
      moderated_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    if (role) changes.role = role === "administrator" ? "admin" : role;
    if (memberAction === "activate") {
      Object.assign(changes, {
        status: "active",
        muted_until: null,
        suspended_until: null,
      });
    }
    if (memberAction === "mute") {
      Object.assign(changes, {
        status: "active",
        muted_until: new Date(now.getTime() + hours * 3_600_000).toISOString(),
      });
    }
    if (memberAction === "suspend") {
      Object.assign(changes, {
        status: "active",
        suspended_until: new Date(now.getTime() + hours * 3_600_000).toISOString(),
      });
    }
    if (memberAction === "block" || memberAction === "remove") {
      Object.assign(changes, {
        status: memberAction === "block" ? "blocked" : "removed",
        muted_until: null,
        suspended_until: null,
      });
    }
    const result = await service
      .from("room_members")
      .update(changes)
      .eq("room_id", roomId)
      .eq("id", memberId);
    if (result.error) return error(result.error.message);
    await logAuditEvent({
      actor_id: userId,
      action: "room.member_operations_updated",
      target_type: "room_member",
      target_id: memberId,
      metadata: {
        room_id: roomId,
        member_user_id: memberUserId,
        member_action: memberAction || null,
        role: role || null,
      },
    });
    return reply({ ok: true });
  }

  if (action === "resolve_report") {
    if (!access.canModerate) return error("Room moderation access is required.", 403);
    const reportId = asString(body.reportId);
    const state = asString(body.state);
    const moderationAction = asString(body.moderationAction);
    const resolutionNote = text(body.resolutionNote);
    if (!uuid(reportId) || !["resolved", "dismissed", "actioned"].includes(state)) {
      return error("Invalid moderation decision.", 400);
    }
    const found = await service
      .from("room_moderation_reports")
      .select("*")
      .eq("room_id", roomId)
      .eq("id", reportId)
      .maybeSingle();
    if (found.error) return error(found.error.message, 503);
    if (!found.data) return error("Moderation report not found.", 404);
    const report = found.data;
    const type = asString(report.target_type);
    const id = asString(report.target_id);

    if (moderationAction === "remove_target") {
      if (type === "room_post") {
        const removed = await service
          .from("room_posts")
          .update({
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
            deletion_reason: `Moderation report ${reportId}`,
            updated_at: new Date().toISOString(),
          })
          .eq("room_id", roomId)
          .eq("id", id)
          .is("deleted_at", null);
        if (removed.error) return error(removed.error.message);
      } else if (type === "room_member") {
        const target = await service
          .from("room_members")
          .select("user_id,role")
          .eq("room_id", roomId)
          .eq("id", id)
          .maybeSingle();
        if (target.error) return error(target.error.message, 503);
        if (!target.data) return error("Reported member not found.", 404);
        const targetRole = normalizeRole(target.data.role);
        const targetUser = asString(target.data.user_id);
        if (
          [access.room.ownerId, access.room.createdBy].includes(targetUser) ||
          (access.role === "moderator" && targetRole !== "member") ||
          (access.role === "administrator" && targetRole === "administrator")
        ) {
          return error("Your Room role cannot moderate this member.", 403);
        }
        const blocked = await service
          .from("room_members")
          .update({
            status: "blocked",
            muted_until: null,
            suspended_until: null,
            moderated_by: userId,
            moderated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("room_id", roomId)
          .eq("id", id);
        if (blocked.error) return error(blocked.error.message);
      } else {
        if (!access.canManage) {
          return error("Room management access is required for this target.", 403);
        }
        if (type === "room_module_record") {
          const archived = await service
            .from("room_module_records")
            .update({
              archived_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("room_id", roomId)
            .eq("id", id);
          if (archived.error) return error(archived.error.message);
        } else if (type === "room_resource") {
          const file = await service
            .from("room_resources")
            .select("storage_path")
            .eq("room_id", roomId)
            .eq("id", id)
            .maybeSingle();
          if (file.error) return error(file.error.message, 503);
          if (file.data?.storage_path) {
            const storage = await service.storage
              .from("room-resources")
              .remove([file.data.storage_path]);
            if (storage.error) return error(storage.error.message, 503);
          }
          const removed = await service
            .from("room_resources")
            .delete()
            .eq("room_id", roomId)
            .eq("id", id);
          if (removed.error) return error(removed.error.message);
        } else if (type === "room_announcement") {
          const removed = await service
            .from("room_announcements")
            .delete()
            .eq("room_id", roomId)
            .eq("id", id);
          if (removed.error) return error(removed.error.message);
        } else if (type === "room_event") {
          const removed = await service
            .from("room_events")
            .delete()
            .eq("room_id", roomId)
            .eq("id", id);
          if (removed.error) return error(removed.error.message);
        }
      }
    }

    const finalState = moderationAction === "remove_target" ? "actioned" : state;
    const result = await service
      .from("room_moderation_reports")
      .update({
        state: finalState,
        resolution_note: resolutionNote,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("room_id", roomId)
      .eq("id", reportId);
    if (result.error) return error(result.error.message);
    return reply({ ok: true });
  }

  if (action === "restore_target") {
    if (!access.canManage) return error("Room management access is required.", 403);
    const type = asString(body.targetType);
    const id = asString(body.targetId);
    if (!uuid(id)) return error("Invalid Room item.", 400);
    const result =
      type === "room_post"
        ? await service
            .from("room_posts")
            .update({
              deleted_at: null,
              deleted_by: null,
              deletion_reason: null,
              updated_at: new Date().toISOString(),
            })
            .eq("room_id", roomId)
            .eq("id", id)
        : type === "room_module_record"
          ? await service
              .from("room_module_records")
              .update({ archived_at: null, updated_at: new Date().toISOString() })
              .eq("room_id", roomId)
              .eq("id", id)
          : null;
    if (!result) return error("This Room item cannot be restored.", 400);
    if (result.error) return error(result.error.message);
    return reply({ ok: true });
  }

  return null;
}
