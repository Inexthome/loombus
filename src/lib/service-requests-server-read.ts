import "server-only";
import type { NextRequest } from "next/server";
import type { ServiceRequestManageResponse, ServiceRequestsDirectoryResponse } from "@/lib/service-requests";
import { hydrateRequests, hydrateResponses } from "@/lib/service-requests-server-hydration";
import { ServiceRequestsError, cleanText, resolveViewer, type Row } from "@/lib/service-requests-server-core";

export async function listPublicServiceRequests(request: NextRequest): Promise<ServiceRequestsDirectoryResponse> {
  const viewer = await resolveViewer(request, false);
  await viewer.service.rpc("expire_service_requests");
  const params = request.nextUrl.searchParams;
  const page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(params.get("pageSize") ?? 24) || 24, 1), 48);
  const start = (page - 1) * pageSize;
  const q = cleanText(params.get("q"), 200).replace(/[,%()]/g, " ");
  const type = cleanText(params.get("type"), 40);
  const category = cleanText(params.get("category"), 120);
  const urgency = cleanText(params.get("urgency"), 30);
  const mode = cleanText(params.get("mode"), 40);
  const location = cleanText(params.get("location"), 100).replace(/[,%()]/g, " ");
  const businessSlug = cleanText(params.get("businessSlug"), 120);
  const requesterUsername = cleanText(params.get("requesterUsername"), 100);
  let businessId: string | null = null;
  let requesterId: string | null = null;
  if (businessSlug) {
    const { data } = await viewer.service.from("businesses").select("id").eq("slug", businessSlug).eq("status", "published").maybeSingle();
    businessId = data?.id ? String(data.id) : null;
    if (!businessId) return { requests: [], total: 0, page, pageSize, authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
  }
  if (requesterUsername) {
    const { data } = await viewer.service.from("profiles").select("id").eq("username", requesterUsername).maybeSingle();
    requesterId = data?.id ? String(data.id) : null;
    if (!requesterId) return { requests: [], total: 0, page, pageSize, authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
  }
  let query = viewer.service.from("service_requests").select("*", { count: "exact" }).eq("status", "open")
    .order("urgency_rank", { ascending: false }).order("published_at", { ascending: false }).range(start, start + pageSize - 1);
  if (type) query = query.eq("request_type", type);
  if (category) query = query.eq("category", category);
  if (urgency) query = query.eq("urgency", urgency);
  if (mode) query = query.eq("service_mode", mode);
  if (businessId) query = query.eq("business_id", businessId);
  if (requesterId) query = query.eq("requester_id", requesterId);
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
  if (location) query = query.or(`city.ilike.%${location}%,region.ilike.%${location}%,postal_code.ilike.%${location}%`);
  const { data, error, count } = await query;
  if (error) {
    if (/service_requests|schema cache/i.test(error.message ?? "")) return { requests: [], total: 0, page, pageSize, authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
    throw new ServiceRequestsError("Unable to load public Requests.", 503, "requests_unavailable");
  }
  const hydrated = await hydrateRequests(viewer.service, (data ?? []) as Row[], viewer.user?.id ?? null, viewer.isAdmin);
  return { requests: hydrated, total: count ?? hydrated.length, page, pageSize, authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin };
}

export async function getPublicServiceRequest(request: NextRequest, slug: string) {
  const viewer = await resolveViewer(request, false);
  await viewer.service.rpc("expire_service_requests");
  const { data, error } = await viewer.service.from("service_requests").select("*").eq("slug", cleanText(slug, 120)).eq("status", "open").maybeSingle();
  if (error) throw new ServiceRequestsError("Unable to load the Request.", 503, "request_unavailable");
  if (!data) throw new ServiceRequestsError("Request not found.", 404, "request_not_found");
  const [item] = await hydrateRequests(viewer.service, [data as Row], viewer.user?.id ?? null, viewer.isAdmin);
  if (!item) throw new ServiceRequestsError("Request not found.", 404, "request_not_found");
  let responderBusinesses: Array<{ id: string; name: string; slug: string }> = [];
  let appointmentServices: Array<{ id: string; businessId: string; businessName: string; name: string; durationMinutes: number }> = [];
  if (viewer.user && viewer.user.id !== item.requesterId) {
    const { data: businesses } = await viewer.service.from("businesses").select("id, name, slug").eq("owner_id", viewer.user.id).eq("status", "published").order("name");
    responderBusinesses = ((businesses ?? []) as Row[]).map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug) }));
    const ids = responderBusinesses.map((row) => row.id);
    if (ids.length) {
      const { data: services } = await viewer.service.from("business_appointment_services").select("id, business_id, name, duration_minutes")
        .eq("owner_id", viewer.user.id).eq("status", "active").in("business_id", ids).order("name");
      const names = new Map(responderBusinesses.map((row) => [row.id, row.name]));
      appointmentServices = ((services ?? []) as Row[]).map((row) => ({ id: String(row.id), businessId: String(row.business_id), businessName: names.get(String(row.business_id)) ?? "Business", name: String(row.name), durationMinutes: Number(row.duration_minutes ?? 30) }));
    }
  }
  return { request: item, authenticated: Boolean(viewer.user), isAdmin: viewer.isAdmin, responderBusinesses, appointmentServices };
}

export async function getSavedServiceRequests(request: NextRequest) {
  const viewer = await resolveViewer(request, true);
  const { data: saves, error } = await viewer.service.from("service_request_saves").select("request_id, created_at").eq("user_id", viewer.user!.id).order("created_at", { ascending: false }).limit(500);
  if (error) throw new ServiceRequestsError("Unable to load saved Requests.", 503, "saved_requests_unavailable");
  const ids = ((saves ?? []) as Row[]).map((row) => String(row.request_id));
  if (!ids.length) return { requests: [] };
  const { data, error: requestError } = await viewer.service.from("service_requests").select("*").in("id", ids);
  if (requestError) throw new ServiceRequestsError("Unable to load saved Requests.", 503, "saved_requests_unavailable");
  const map = new Map(((data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const ordered = ids.map((id) => map.get(id)).filter((row): row is Row => Boolean(row));
  return { requests: await hydrateRequests(viewer.service, ordered, viewer.user!.id, viewer.isAdmin) };
}

export async function getServiceRequestManageData(request: NextRequest): Promise<ServiceRequestManageResponse> {
  const viewer = await resolveViewer(request, true);
  const userId = viewer.user!.id;
  let requestQuery = viewer.service.from("service_requests").select("*").order("updated_at", { ascending: false }).limit(300);
  if (!viewer.isAdmin) requestQuery = requestQuery.eq("requester_id", userId);
  const { data: requestRows, error: requestError } = await requestQuery;
  if (requestError) {
    if (/service_requests|schema cache/i.test(requestError.message ?? "")) throw new ServiceRequestsError("The Requests migrations have not been applied.", 503, "requests_schema_unavailable");
    throw new ServiceRequestsError("Unable to load Request management.", 503, "requests_manage_unavailable");
  }
  const ownIds = ((requestRows ?? []) as Row[]).filter((row) => row.requester_id === userId).map((row) => String(row.id));
  const [businessResult, sentResult, receivedResult, appointmentResult] = await Promise.all([
    viewer.service.from("businesses").select("id, name, slug").eq("owner_id", userId).eq("status", "published").order("name"),
    viewer.service.from("service_request_responses").select("*").eq("responder_id", userId).order("updated_at", { ascending: false }).limit(300),
    ownIds.length ? viewer.service.from("service_request_responses").select("*").in("request_id", ownIds).order("updated_at", { ascending: false }).limit(500) : Promise.resolve({ data: [], error: null }),
    viewer.service.from("business_appointment_services").select("id, business_id, name, duration_minutes, status").eq("owner_id", userId).neq("status", "archived").order("name"),
  ]);
  if (businessResult.error || sentResult.error || receivedResult.error || appointmentResult.error) throw new ServiceRequestsError("Unable to load Request workspace details.", 503, "request_workspace_unavailable");
  let reports: ServiceRequestManageResponse["reports"] = [];
  if (viewer.isAdmin) {
    const { data: reportRows, error } = await viewer.service.from("service_request_reports").select("id, request_id, reason, details, status, created_at").eq("status", "open").order("created_at", { ascending: false }).limit(300);
    if (error) throw new ServiceRequestsError("Unable to load Request reports.", 503, "request_reports_unavailable");
    const titles = new Map(((requestRows ?? []) as Row[]).map((row) => [String(row.id), String(row.title)]));
    reports = ((reportRows ?? []) as Row[]).map((row) => ({ id: String(row.id), requestId: String(row.request_id), requestTitle: titles.get(String(row.request_id)) ?? "Request", reason: String(row.reason), details: String(row.details), status: String(row.status), createdAt: String(row.created_at) }));
  }
  const businessRows = (businessResult.data ?? []) as Row[];
  const businessNames = new Map(businessRows.map((row) => [String(row.id), String(row.name)]));
  const requests = await hydrateRequests(viewer.service, (requestRows ?? []) as Row[], userId, viewer.isAdmin);
  return {
    businesses: businessRows.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug) })),
    appointmentServices: ((appointmentResult.data ?? []) as Row[]).map((row) => ({ id: String(row.id), businessId: String(row.business_id), businessName: businessNames.get(String(row.business_id)) ?? "Business", name: String(row.name), durationMinutes: Number(row.duration_minutes ?? 30), status: String(row.status) })),
    requests,
    receivedResponses: await hydrateResponses(viewer.service, (receivedResult.data ?? []) as Row[]),
    sentResponses: await hydrateResponses(viewer.service, (sentResult.data ?? []) as Row[]),
    reports,
    metrics: {
      pending: requests.filter((row) => row.status === "pending").length,
      open: requests.filter((row) => row.status === "open").length,
      reviewing: requests.filter((row) => row.status === "reviewing").length,
      inProgress: requests.filter((row) => row.status === "in_progress").length,
      resolved: requests.filter((row) => row.status === "resolved").length,
      openReports: reports.length,
    },
    isAdmin: viewer.isAdmin,
  };
}
