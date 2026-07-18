import "server-only";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import type { PublicServiceRequest, ServiceRequestResponse } from "@/lib/service-requests";
import { ServiceRequestsError, cleanText, type Row, type Service } from "@/lib/service-requests-server-core";

function displayName(profile: Row | undefined) {
  return cleanText(profile?.full_name, 200) || cleanText(profile?.username, 100) || "Loombus member";
}

export async function hydrateRequests(
  service: Service,
  rows: Row[],
  viewerId: string | null,
  isAdmin: boolean,
): Promise<PublicServiceRequest[]> {
  if (!rows.length) return [];
  const requestIds = rows.map((row) => String(row.id));
  const requesterIds = [...new Set(rows.map((row) => String(row.requester_id)))];
  const businessIds = [...new Set(rows.map((row) => String(row.business_id ?? "")).filter(Boolean))];
  const [profilesResult, sensitiveResult, businessesResult, responseResult, saveResult, viewerSaveResult, viewerResponseResult] = await Promise.all([
    service.from("profiles").select("id, username, full_name, avatar_url, account_status, enforcement_reason, suspended_until").in("id", requesterIds),
    service.from("profile_sensitive").select("id, age_band, guardian_required").in("id", requesterIds),
    businessIds.length ? service.from("businesses").select("id, name, slug, owner_id, status").in("id", businessIds) : Promise.resolve({ data: [], error: null }),
    service.from("service_request_responses").select("request_id, status").in("request_id", requestIds).neq("status", "withdrawn"),
    service.from("service_request_saves").select("request_id").in("request_id", requestIds),
    viewerId ? service.from("service_request_saves").select("request_id").eq("user_id", viewerId).in("request_id", requestIds) : Promise.resolve({ data: [], error: null }),
    viewerId ? service.from("service_request_responses").select("request_id").eq("responder_id", viewerId).in("request_id", requestIds).neq("status", "withdrawn") : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = profilesResult.error || sensitiveResult.error || businessesResult.error || responseResult.error || saveResult.error || viewerSaveResult.error || viewerResponseResult.error;
  if (firstError) throw new ServiceRequestsError("Unable to load Request details.", 503, "request_hydration_failed");
  const profiles = new Map<string, Row>(((profilesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const sensitive = new Map<string, Row>(((sensitiveResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const businesses = new Map<string, Row>(((businessesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const responseCounts = new Map<string, number>();
  for (const row of (responseResult.data ?? []) as Row[]) responseCounts.set(String(row.request_id), (responseCounts.get(String(row.request_id)) ?? 0) + 1);
  const saveCounts = new Map<string, number>();
  for (const row of (saveResult.data ?? []) as Row[]) saveCounts.set(String(row.request_id), (saveCounts.get(String(row.request_id)) ?? 0) + 1);
  const viewerSaves = new Set(((viewerSaveResult.data ?? []) as Row[]).map((row) => String(row.request_id)));
  const viewerResponses = new Set(((viewerResponseResult.data ?? []) as Row[]).map((row) => String(row.request_id)));

  return rows.flatMap((row) => {
    const id = String(row.id);
    const requesterId = String(row.requester_id);
    const profile = profiles.get(requesterId);
    const safety = sensitive.get(requesterId);
    const ageBand = String(safety?.age_band ?? "unknown");
    const businessId = row.business_id ? String(row.business_id) : null;
    const business = businessId ? businesses.get(businessId) : undefined;
    const eligible = Boolean(profile && getAccountEnforcementResult(profile).allowed)
      && ageBand !== "unknown" && ageBand !== "under_13" && safety?.guardian_required !== true
      && (!businessId || (business?.status === "published" && business?.owner_id === requesterId));
    if (!eligible) return [];
    return [{
      id,
      slug: cleanText(row.slug, 120),
      requesterId,
      requesterName: displayName(profile),
      requesterUsername: cleanText(profile?.username, 100) || null,
      requesterAvatarUrl: cleanText(profile?.avatar_url, 1000) || null,
      businessId,
      businessName: cleanText(business?.name, 200) || null,
      businessSlug: cleanText(business?.slug, 120) || null,
      title: cleanText(row.title, 200),
      description: cleanText(row.description, 16000),
      requestType: row.request_type,
      category: cleanText(row.category, 120),
      urgency: row.urgency,
      serviceMode: row.service_mode,
      city: cleanText(row.city, 100) || null,
      region: cleanText(row.region, 100) || null,
      postalCode: cleanText(row.postal_code, 30) || null,
      countryCode: cleanText(row.country_code, 2) || "US",
      budgetMin: row.budget_min === null ? null : Number(row.budget_min),
      budgetMax: row.budget_max === null ? null : Number(row.budget_max),
      currency: cleanText(row.currency, 3) || "USD",
      budgetType: row.budget_type,
      deadline: row.deadline ? String(row.deadline) : null,
      preferredStart: row.preferred_start ? String(row.preferred_start) : null,
      preferredEnd: row.preferred_end ? String(row.preferred_end) : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      attachmentUrls: Array.isArray(row.attachment_urls) ? row.attachment_urls.map(String) : [],
      attachmentPaths: Array.isArray(row.attachment_paths) ? row.attachment_paths.map(String) : [],
      attachmentTypes: Array.isArray(row.attachment_types) ? row.attachment_types.map(String) : [],
      attachmentNames: Array.isArray(row.attachment_names) ? row.attachment_names.map(String) : [],
      status: row.status,
      moderationReason: cleanText(row.moderation_reason, 2000) || null,
      selectedResponseId: row.selected_response_id ? String(row.selected_response_id) : null,
      responseCount: responseCounts.get(id) ?? 0,
      savedCount: saveCounts.get(id) ?? 0,
      viewerSaved: viewerSaves.has(id),
      viewerCanManage: Boolean(viewerId && (viewerId === requesterId || isAdmin)),
      viewerHasResponded: viewerResponses.has(id),
      publishedAt: row.published_at ? String(row.published_at) : null,
      resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      closedAt: row.closed_at ? String(row.closed_at) : null,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    } as PublicServiceRequest];
  });
}

export async function hydrateResponses(service: Service, rows: Row[]): Promise<ServiceRequestResponse[]> {
  if (!rows.length) return [];
  const requestIds = [...new Set(rows.map((row) => String(row.request_id)))];
  const responderIds = [...new Set(rows.map((row) => String(row.responder_id)))];
  const businessIds = [...new Set(rows.map((row) => String(row.business_id ?? "")).filter(Boolean))];
  const appointmentIds = [...new Set(rows.map((row) => String(row.appointment_service_id ?? "")).filter(Boolean))];
  const [requestsResult, profilesResult, businessesResult, appointmentsResult] = await Promise.all([
    service.from("service_requests").select("id, title, slug").in("id", requestIds),
    service.from("profiles").select("id, username, full_name, avatar_url").in("id", responderIds),
    businessIds.length ? service.from("businesses").select("id, name, slug").in("id", businessIds) : Promise.resolve({ data: [], error: null }),
    appointmentIds.length ? service.from("business_appointment_services").select("id, name").in("id", appointmentIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (requestsResult.error || profilesResult.error || businessesResult.error || appointmentsResult.error) {
    throw new ServiceRequestsError("Unable to load Request responses.", 503, "request_responses_unavailable");
  }
  const requests = new Map<string, Row>(((requestsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const profiles = new Map<string, Row>(((profilesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const businesses = new Map<string, Row>(((businessesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const appointments = new Map<string, Row>(((appointmentsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  return rows.map((row) => {
    const request = requests.get(String(row.request_id));
    const profile = profiles.get(String(row.responder_id));
    const business = row.business_id ? businesses.get(String(row.business_id)) : undefined;
    const appointment = row.appointment_service_id ? appointments.get(String(row.appointment_service_id)) : undefined;
    return {
      id: String(row.id), requestId: String(row.request_id), requestTitle: cleanText(request?.title, 200) || "Request",
      requestSlug: cleanText(request?.slug, 120) || null, responderId: String(row.responder_id),
      responderName: displayName(profile), responderUsername: cleanText(profile?.username, 100) || null,
      responderAvatarUrl: cleanText(profile?.avatar_url, 1000) || null, businessId: row.business_id ? String(row.business_id) : null,
      businessName: cleanText(business?.name, 200) || null, businessSlug: cleanText(business?.slug, 120) || null,
      message: cleanText(row.message, 8000), availabilityText: cleanText(row.availability_text, 1000) || null,
      estimateMin: row.estimate_min === null ? null : Number(row.estimate_min), estimateMax: row.estimate_max === null ? null : Number(row.estimate_max),
      currency: cleanText(row.currency, 3) || "USD", appointmentServiceId: row.appointment_service_id ? String(row.appointment_service_id) : null,
      appointmentServiceName: cleanText(appointment?.name, 200) || null, status: row.status,
      conversationId: row.conversation_id ? String(row.conversation_id) : null,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    } as ServiceRequestResponse;
  });
}
