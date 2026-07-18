import "server-only";
import type { NextRequest } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminNotifications, createNotification, createNotifications } from "@/lib/notifications";
import {
  ServiceRequestsError, cleanText, cleanUuid, normalizeRequestInput, optionalUuid,
  requireEligibility, requireOwnedPublishedBusiness, requireRequestControl, resolveViewer, uniqueSlug,
  type Row, type Service, type ServiceRequestInput,
} from "@/lib/service-requests-server-core";

export async function createServiceRequest(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  const userId = viewer.user!.id;
  await requireEligibility(viewer.service, userId, "create a public Request");
  const businessId = optionalUuid(input.businessId, "business id");
  if (businessId) await requireOwnedPublishedBusiness(viewer.service, businessId, userId);
  const values = await normalizeRequestInput(viewer.service, userId, input);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service.from("service_requests").select("id", { count: "exact", head: true }).eq("requester_id", userId).gte("created_at", since);
  if ((count ?? 0) >= 10) throw new ServiceRequestsError("You have reached the public Request limit for this hour.", 429, "request_rate_limited");
  const slug = await uniqueSlug(viewer.service, values.title);
  const { data, error } = await viewer.service.from("service_requests")
    .insert({ ...values, slug, requester_id: userId, business_id: businessId, status: "pending" }).select("id").single();
  if (error || !data) throw new ServiceRequestsError("Unable to create the Request.", 503, "request_create_failed");
  await createAdminNotifications({ actor_id: userId, type: "service_request_review_requested", target_type: "service_request", target_id: data.id, message: `A public Request is ready for review: ${values.title}` });
  await logAuditEvent({ actor_id: userId, action: "service_request.created", target_type: "service_request", target_id: data.id, metadata: { business_id: businessId } });
  return { id: data.id, slug, status: "pending" };
}

export async function updateServiceRequest(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = cleanUuid(input.requestId, "Request id");
  const existing = await requireRequestControl(viewer, requestId);
  if (existing.requester_id !== viewer.user!.id) throw new ServiceRequestsError("Only the requester may edit this Request.", 403, "request_edit_forbidden");
  if (["in_progress", "resolved", "closed", "removed"].includes(String(existing.status))) throw new ServiceRequestsError("This Request must be reopened before it can be edited.", 409, "request_edit_closed");
  const businessId = optionalUuid(input.businessId, "business id");
  if (businessId) await requireOwnedPublishedBusiness(viewer.service, businessId, String(existing.requester_id));
  const values = await normalizeRequestInput(viewer.service, String(existing.requester_id), input);
  const slug = await uniqueSlug(viewer.service, values.title, requestId);
  const { error } = await viewer.service.from("service_requests")
    .update({ ...values, slug, business_id: businessId, status: "pending", moderation_reason: null, published_at: null }).eq("id", requestId);
  if (error) throw new ServiceRequestsError("Unable to update the Request.", 503, "request_update_failed");
  await createAdminNotifications({ actor_id: viewer.user!.id, type: "service_request_review_requested", target_type: "service_request", target_id: requestId, message: `An updated public Request is ready for review: ${values.title}` });
  return { id: requestId, slug, status: "pending" };
}

async function notifyFollowers(service: Service, requestId: string, actorId: string, message: string) {
  const { data } = await service.from("service_request_saves").select("user_id").eq("request_id", requestId).neq("user_id", actorId).limit(1000);
  if ((data ?? []).length) await createNotifications(((data ?? []) as Row[]).map((row) => ({ user_id: row.user_id, actor_id: actorId, type: "service_request_status", target_type: "service_request", target_id: requestId, message })));
}

export async function setServiceRequestLifecycle(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = cleanUuid(input.requestId, "Request id");
  const action = cleanText(input.action, 40);
  const row = await requireRequestControl(viewer, requestId);
  const current = String(row.status);
  const updates: Row = {};
  const now = new Date().toISOString();
  if (action === "reviewing" && current === "open") updates.status = "reviewing";
  else if (action === "in_progress" && row.selected_response_id) updates.status = "in_progress";
  else if (action === "resolved" && ["reviewing", "in_progress"].includes(current)) { updates.status = "resolved"; updates.resolved_at = now; }
  else if (action === "closed" && !["closed", "removed"].includes(current)) { updates.status = "closed"; updates.closed_at = now; }
  else if (action === "reopen" && ["resolved", "closed", "rejected"].includes(current)) {
    if (row.deadline && new Date(row.deadline).getTime() <= Date.now()) throw new ServiceRequestsError("Move the deadline into the future before reopening.", 409, "request_future_deadline_required");
    Object.assign(updates, { status: "pending", resolved_at: null, closed_at: null, moderation_reason: null });
    await createAdminNotifications({ actor_id: viewer.user!.id, type: "service_request_review_requested", target_type: "service_request", target_id: requestId, message: `A reopened Request is ready for review: ${row.title}` });
  } else if (action === "remove" && viewer.isAdmin) updates.status = "removed";
  else throw new ServiceRequestsError("This Request cannot make that lifecycle change.", 409, "invalid_request_action");
  const { error } = await viewer.service.from("service_requests").update(updates).eq("id", requestId);
  if (error) throw new ServiceRequestsError("Unable to update the Request status.", 503, "request_lifecycle_failed");
  await notifyFollowers(viewer.service, requestId, viewer.user!.id, `Request status changed: ${row.title}`);
  return { updated: true, status: updates.status };
}

export async function moderateServiceRequest(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) throw new ServiceRequestsError("Administrator access is required.", 403, "admin_required");
  const requestId = cleanUuid(input.requestId, "Request id");
  const decision = cleanText(input.decision, 30);
  const row = await requireRequestControl(viewer, requestId);
  const updates: Row = { moderation_reason: cleanText(input.note, 2000) || null };
  if (decision === "approve") {
    await requireEligibility(viewer.service, String(row.requester_id), "publish a public Request");
    if (row.business_id) await requireOwnedPublishedBusiness(viewer.service, String(row.business_id), String(row.requester_id));
    if (row.deadline && new Date(row.deadline).getTime() <= Date.now()) throw new ServiceRequestsError("Move the deadline into the future before approval.", 409, "request_future_deadline_required");
    Object.assign(updates, { status: "open", published_at: row.published_at || new Date().toISOString() });
  } else if (["reject", "suspend", "remove"].includes(decision)) updates.status = decision === "reject" ? "rejected" : decision === "suspend" ? "suspended" : "removed";
  else throw new ServiceRequestsError("Choose a valid moderation decision.", 400, "invalid_request_decision");
  const { error } = await viewer.service.from("service_requests").update(updates).eq("id", requestId);
  if (error) throw new ServiceRequestsError("Unable to moderate the Request.", 503, "request_moderation_failed");
  await createNotification({ user_id: row.requester_id, actor_id: viewer.user!.id, type: "service_request_status", target_type: "service_request", target_id: requestId, message: decision === "approve" ? `Your Request is now public: ${row.title}` : decision === "reject" ? `Your Request needs changes: ${row.title}` : `Your Request is no longer public: ${row.title}` });
  return { updated: true, status: updates.status };
}

export async function saveServiceRequest(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = cleanUuid(input.requestId, "Request id");
  const { data } = await viewer.service.from("service_requests").select("id").eq("id", requestId).eq("status", "open").maybeSingle();
  if (!data) throw new ServiceRequestsError("Only a public open Request can be saved.", 404, "request_not_found");
  const { error } = await viewer.service.from("service_request_saves").upsert({ request_id: requestId, user_id: viewer.user!.id }, { onConflict: "request_id,user_id" });
  if (error) throw new ServiceRequestsError("Unable to save the Request.", 503, "request_save_failed");
  return { saved: true };
}

export async function unsaveServiceRequest(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = cleanUuid(input.requestId, "Request id");
  const { error } = await viewer.service.from("service_request_saves").delete().eq("request_id", requestId).eq("user_id", viewer.user!.id);
  if (error) throw new ServiceRequestsError("Unable to remove the saved Request.", 503, "request_unsave_failed");
  return { saved: false };
}
