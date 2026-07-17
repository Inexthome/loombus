import Stripe from "stripe";
import { logAuditEvent } from "@/lib/audit-log";
import { asString } from "@/lib/room-operations";
import {
  REASONS,
  TARGETS,
  error,
  reply,
  snapshot,
  text,
  uuid,
  visibleModules,
} from "@/lib/room-operations-service";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export async function handleCoreAction(ctx, request, body, action) {
  const { service, roomId, access, plan, userId } = ctx;

  if (action === "report_content") {
    const targetType = asString(body.targetType);
    const targetId = asString(body.targetId);
    const reason = asString(body.reason);
    const details = text(body.details);
    if (!TARGETS.has(targetType) || !uuid(targetId) || !REASONS.has(reason)) {
      return error("Choose a valid Room item and report reason.", 400);
    }
    const modules = await visibleModules(service, roomId, access, plan);
    const item = await snapshot(service, roomId, targetType, targetId, modules);
    if (!item) return error("The reported Room item was not found.", 404);
    if (item.userId === userId) {
      return error("You cannot report your own Room membership.", 400);
    }
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    const rate = await service
      .from("room_moderation_reports")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("reporter_id", userId)
      .gte("created_at", hourAgo);
    if (rate.error) return error(rate.error.message, 503);
    if ((rate.count ?? 0) >= 20) {
      return error(
        "Too many Room reports were submitted recently.",
        429,
        "room_report_rate_limited"
      );
    }
    const result = await service.from("room_moderation_reports").insert({
      room_id: roomId,
      reporter_id: userId,
      target_type: targetType,
      target_id: targetId,
      target_label: item.label,
      target_snapshot: item.snapshot,
      reason,
      details,
    });
    if (result.error) {
      const duplicate = result.error.code === "23505";
      return error(
        duplicate
          ? "You already have a pending report for this item."
          : result.error.message,
        duplicate ? 409 : 400
      );
    }
    await logAuditEvent({
      actor_id: userId,
      action: "room.moderation_report_created",
      target_type: targetType,
      target_id: targetId,
      metadata: { room_id: roomId, reason },
    });
    return reply({ ok: true });
  }

  if (action === "leave_room") {
    if (access.isOwner) {
      return error("Transfer ownership before leaving this Room.", 400);
    }
    if (!access.membershipId) return error("Room membership was not found.", 404);
    const result = await service
      .from("room_members")
      .update({ status: "removed", updated_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("id", access.membershipId);
    if (result.error) return error(result.error.message);
    return reply({ ok: true, left: true });
  }

  if (action === "open_billing_portal") {
    if (!access.isOwner) {
      return error("Only the Room owner can manage Room billing.", 403);
    }
    const customer = asString(access.rawRoom.stripe_customer_id);
    if (!customer) {
      return error("This Room does not have a Stripe billing customer.", 404);
    }
    if (!STRIPE_SECRET_KEY) return error("Stripe billing is not configured.", 503);
    try {
      const origin = new URL(
        process.env.NEXT_PUBLIC_SITE_URL ||
          request.nextUrl.origin ||
          "https://loombus.com"
      ).origin;
      const session = await new Stripe(STRIPE_SECRET_KEY).billingPortal.sessions.create({
        customer,
        return_url: `${origin}/rooms/${encodeURIComponent(roomId)}?billing=returned`,
      });
      return reply({ ok: true, url: session.url });
    } catch {
      return error("The secure Room billing portal could not be opened.", 503);
    }
  }

  return null;
}
