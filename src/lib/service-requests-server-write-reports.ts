import "server-only";
import type { NextRequest } from "next/server";
import { createAdminNotifications } from "@/lib/notifications";
import { ServiceRequestsError, cleanText, cleanUuid, resolveViewer, type ServiceRequestInput } from "@/lib/service-requests-server-core";

export async function reportServiceRequest(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  const requestId = cleanUuid(input.requestId, "Request id");
  const reason = cleanText(input.reason, 120);
  const details = cleanText(input.details, 3000);
  if (!reason || details.length < 10) throw new ServiceRequestsError("Choose a reason and explain the concern.", 400, "request_report_details_required");
  const { data: row } = await viewer.service.from("service_requests").select("id, title").eq("id", requestId).maybeSingle();
  if (!row) throw new ServiceRequestsError("Request not found.", 404, "request_not_found");
  const { data: existing } = await viewer.service.from("service_request_reports").select("id").eq("request_id", requestId).eq("reporter_id", viewer.user!.id).eq("status", "open").maybeSingle();
  if (existing) throw new ServiceRequestsError("You already have an open report for this Request.", 409, "request_report_already_open");
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await viewer.service.from("service_request_reports").select("id", { count: "exact", head: true }).eq("reporter_id", viewer.user!.id).gte("created_at", since);
  if ((count ?? 0) >= 10) throw new ServiceRequestsError("You have reached the Request report limit for this hour.", 429, "request_report_rate_limited");
  const { data, error } = await viewer.service.from("service_request_reports").insert({ request_id: requestId, reporter_id: viewer.user!.id, reason, details, status: "open" }).select("id").single();
  if (error || !data) throw new ServiceRequestsError("Unable to submit the Request report.", 503, "request_report_failed");
  await createAdminNotifications({ actor_id: viewer.user!.id, type: "service_request_report_received", target_type: "service_request", target_id: requestId, message: `A public Request was reported: ${row.title}` });
  return { submitted: true };
}

export async function reviewServiceRequestReport(request: NextRequest, input: ServiceRequestInput) {
  const viewer = await resolveViewer(request, true);
  if (!viewer.isAdmin) throw new ServiceRequestsError("Administrator access is required.", 403, "admin_required");
  const reportId = cleanUuid(input.reportId, "report id");
  const decision = cleanText(input.decision, 30);
  if (!new Set(["resolve", "dismiss"]).has(decision)) throw new ServiceRequestsError("Choose a valid report decision.", 400, "invalid_report_decision");
  const { data, error } = await viewer.service.from("service_request_reports").update({ status: decision === "resolve" ? "resolved" : "dismissed", reviewed_by: viewer.user!.id, reviewed_at: new Date().toISOString(), decision_note: cleanText(input.note, 2000) || null })
    .eq("id", reportId).eq("status", "open").select("id").maybeSingle();
  if (error) throw new ServiceRequestsError("Unable to review the Request report.", 503, "request_report_review_failed");
  if (!data) throw new ServiceRequestsError("This report was already reviewed.", 409, "request_report_closed");
  return { updated: true };
}
