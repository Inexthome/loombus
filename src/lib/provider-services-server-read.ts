import "server-only";

import type { NextRequest } from "next/server";
import type {
  ProviderServicesDirectoryResponse,
  ProviderServicesManageResponse,
} from "@/lib/provider-services";
import {
  hydrateProviderServiceInquiries,
  hydrateProviderServices,
} from "@/lib/provider-services-server-hydration";
import {
  ProviderServicesError,
  cleanText,
  resolveViewer,
  type Row,
} from "@/lib/provider-services-server-core";

export async function listPublicProviderServices(
  request: NextRequest,
): Promise<ProviderServicesDirectoryResponse> {
  const viewer = await resolveViewer(request, false);
  const params = request.nextUrl.searchParams;
  const page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(params.get("pageSize") ?? 24) || 24, 1),
    48,
  );
  const start = (page - 1) * pageSize;
  const q = cleanText(params.get("q"), 200).replace(/[,%()]/g, " ");
  const category = cleanText(params.get("category"), 120);
  const mode = cleanText(params.get("mode"), 40);
  const priceType = cleanText(params.get("priceType"), 30);
  const location = cleanText(params.get("location"), 100).replace(
    /[,%()]/g,
    " ",
  );
  const businessSlug = cleanText(params.get("businessSlug"), 120);
  const providerUsername = cleanText(params.get("providerUsername"), 100);
  let businessId: string | null = null;
  let providerId: string | null = null;

  if (businessSlug) {
    const { data } = await viewer.service
      .from("businesses")
      .select("id")
      .eq("slug", businessSlug)
      .eq("status", "published")
      .maybeSingle();
    businessId = data?.id ? String(data.id) : null;
    if (!businessId) {
      return {
        services: [],
        total: 0,
        page,
        pageSize,
        authenticated: Boolean(viewer.user),
        isAdmin: viewer.isAdmin,
      };
    }
  }

  if (providerUsername) {
    const { data } = await viewer.service
      .from("profiles")
      .select("id")
      .eq("username", providerUsername)
      .maybeSingle();
    providerId = data?.id ? String(data.id) : null;
    if (!providerId) {
      return {
        services: [],
        total: 0,
        page,
        pageSize,
        authenticated: Boolean(viewer.user),
        isAdmin: viewer.isAdmin,
      };
    }
  }

  let query = viewer.service
    .from("provider_services")
    .select("*", { count: "exact" })
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .range(start, start + pageSize - 1);
  if (category) query = query.eq("category", category);
  if (mode) query = query.eq("service_mode", mode);
  if (priceType) query = query.eq("price_type", priceType);
  if (businessId) query = query.eq("business_id", businessId);
  if (providerId) query = query.eq("provider_id", providerId);
  if (q) {
    query = query.or(
      `title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`,
    );
  }
  if (location) {
    query = query.or(
      `city.ilike.%${location}%,region.ilike.%${location}%,postal_code.ilike.%${location}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) {
    if (/provider_services|schema cache/i.test(error.message ?? "")) {
      return {
        services: [],
        total: 0,
        page,
        pageSize,
        authenticated: Boolean(viewer.user),
        isAdmin: viewer.isAdmin,
      };
    }
    throw new ProviderServicesError(
      "Unable to load public Services.",
      503,
      "services_unavailable",
    );
  }

  const hydrated = await hydrateProviderServices(
    viewer.service,
    (data ?? []) as Row[],
    viewer.user?.id ?? null,
    viewer.isAdmin,
  );
  return {
    services: hydrated,
    total: count ?? hydrated.length,
    page,
    pageSize,
    authenticated: Boolean(viewer.user),
    isAdmin: viewer.isAdmin,
  };
}

export async function getPublicProviderService(
  request: NextRequest,
  slug: string,
) {
  const viewer = await resolveViewer(request, false);
  const { data, error } = await viewer.service
    .from("provider_services")
    .select("*")
    .eq("slug", cleanText(slug, 120))
    .eq("status", "published")
    .maybeSingle();
  if (error) {
    throw new ProviderServicesError(
      "Unable to load the Service.",
      503,
      "service_unavailable",
    );
  }
  if (!data) {
    throw new ProviderServicesError(
      "Service not found.",
      404,
      "service_not_found",
    );
  }
  const [item] = await hydrateProviderServices(
    viewer.service,
    [data as Row],
    viewer.user?.id ?? null,
    viewer.isAdmin,
  );
  if (!item) {
    throw new ProviderServicesError(
      "Service not found.",
      404,
      "service_not_found",
    );
  }

  let ownRequests: Array<{ id: string; title: string; slug: string }> = [];
  if (viewer.user && viewer.user.id !== item.providerId) {
    const { data: requests } = await viewer.service
      .from("service_requests")
      .select("id, title, slug")
      .eq("requester_id", viewer.user.id)
      .in("status", ["open", "reviewing"])
      .is("selected_response_id", null)
      .order("updated_at", { ascending: false })
      .limit(100);
    ownRequests = ((requests ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      slug: String(row.slug),
    }));
  }

  return {
    service: item,
    authenticated: Boolean(viewer.user),
    isAdmin: viewer.isAdmin,
    ownRequests,
  };
}

export async function getSavedProviderServices(request: NextRequest) {
  const viewer = await resolveViewer(request, true);
  const { data: saves, error } = await viewer.service
    .from("provider_service_saves")
    .select("service_id, created_at")
    .eq("user_id", viewer.user!.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    throw new ProviderServicesError(
      "Unable to load saved Services.",
      503,
      "saved_services_unavailable",
    );
  }
  const ids = ((saves ?? []) as Row[]).map((row) => String(row.service_id));
  if (!ids.length) return { services: [] };
  const { data, error: serviceError } = await viewer.service
    .from("provider_services")
    .select("*")
    .in("id", ids);
  if (serviceError) {
    throw new ProviderServicesError(
      "Unable to load saved Services.",
      503,
      "saved_services_unavailable",
    );
  }
  const map = new Map(
    ((data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const ordered = ids
    .map((id) => map.get(id))
    .filter((row): row is Row => Boolean(row));
  return {
    services: await hydrateProviderServices(
      viewer.service,
      ordered,
      viewer.user!.id,
      viewer.isAdmin,
      true,
    ),
  };
}

export async function getProviderServicesManageData(
  request: NextRequest,
): Promise<ProviderServicesManageResponse> {
  const viewer = await resolveViewer(request, true);
  const userId = viewer.user!.id;
  let serviceQuery = viewer.service
    .from("provider_services")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(300);
  if (!viewer.isAdmin) serviceQuery = serviceQuery.eq("provider_id", userId);
  const { data: serviceRows, error: serviceError } = await serviceQuery;
  if (serviceError) {
    if (/provider_services|schema cache/i.test(serviceError.message ?? "")) {
      throw new ProviderServicesError(
        "The Services migrations have not been applied.",
        503,
        "services_schema_unavailable",
      );
    }
    throw new ProviderServicesError(
      "Unable to load Service management.",
      503,
      "services_manage_unavailable",
    );
  }

  const ownIds = ((serviceRows ?? []) as Row[])
    .filter((row) => row.provider_id === userId)
    .map((row) => String(row.id));
  const [businessResult, appointmentResult, sentResult, receivedResult] =
    await Promise.all([
      viewer.service
        .from("businesses")
        .select("id, name, slug")
        .eq("owner_id", userId)
        .eq("status", "published")
        .order("name"),
      viewer.service
        .from("business_appointment_services")
        .select("id, business_id, name, duration_minutes, status")
        .eq("owner_id", userId)
        .neq("status", "archived")
        .order("name"),
      viewer.service
        .from("provider_service_inquiries")
        .select("*")
        .eq("requester_id", userId)
        .order("updated_at", { ascending: false })
        .limit(300),
      ownIds.length
        ? viewer.service
            .from("provider_service_inquiries")
            .select("*")
            .in("service_id", ownIds)
            .order("updated_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (
    businessResult.error ||
    appointmentResult.error ||
    sentResult.error ||
    receivedResult.error
  ) {
    throw new ProviderServicesError(
      "Unable to load the Service workspace.",
      503,
      "service_workspace_unavailable",
    );
  }

  const publishedOwnServices = ((serviceRows ?? []) as Row[]).filter(
    (row) => row.provider_id === userId && row.status === "published",
  );
  const publishedCategories = [
    ...new Set(
      publishedOwnServices
        .map((row) => cleanText(row.category, 120))
        .filter(Boolean),
    ),
  ];
  let matchingRequests: ProviderServicesManageResponse["matchingRequests"] = [];
  if (!viewer.isAdmin && publishedCategories.length) {
    const { data: activeResponses } = await viewer.service
      .from("service_request_responses")
      .select("request_id")
      .eq("responder_id", userId)
      .neq("status", "withdrawn");
    const respondedIds = new Set(
      ((activeResponses ?? []) as Row[]).map((row) => String(row.request_id)),
    );
    const { data: requestRows, error: requestError } = await viewer.service
      .from("service_requests")
      .select(
        "id, slug, title, description, category, urgency, service_mode, city, region, budget_min, budget_max, currency, budget_type",
      )
      .eq("status", "open")
      .in("category", publishedCategories)
      .order("urgency_rank", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(100);
    if (requestError) {
      throw new ProviderServicesError(
        "Unable to load matching Requests.",
        503,
        "matching_requests_unavailable",
      );
    }
    matchingRequests = ((requestRows ?? []) as Row[])
      .filter((row) => !respondedIds.has(String(row.id)))
      .map((row) => ({
        id: String(row.id),
        slug: String(row.slug),
        title: String(row.title),
        description: String(row.description),
        category: String(row.category),
        urgency: String(row.urgency),
        serviceMode: String(row.service_mode),
        city: cleanText(row.city, 100) || null,
        region: cleanText(row.region, 100) || null,
        budgetMin: row.budget_min === null ? null : Number(row.budget_min),
        budgetMax: row.budget_max === null ? null : Number(row.budget_max),
        currency: cleanText(row.currency, 3) || "USD",
        budgetType: cleanText(row.budget_type, 30) || "flexible",
      }));
  }

  let reports: ProviderServicesManageResponse["reports"] = [];
  if (viewer.isAdmin) {
    const { data: reportRows, error } = await viewer.service
      .from("provider_service_reports")
      .select("id, service_id, reason, details, status, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      throw new ProviderServicesError(
        "Unable to load Service reports.",
        503,
        "service_reports_unavailable",
      );
    }
    const titles = new Map(
      ((serviceRows ?? []) as Row[]).map((row) => [
        String(row.id),
        String(row.title),
      ]),
    );
    reports = ((reportRows ?? []) as Row[]).map((row) => ({
      id: String(row.id),
      serviceId: String(row.service_id),
      serviceTitle: titles.get(String(row.service_id)) ?? "Service",
      reason: String(row.reason),
      details: String(row.details),
      status: String(row.status),
      createdAt: String(row.created_at),
    }));
  }

  const businessRows = (businessResult.data ?? []) as Row[];
  const businessNames = new Map(
    businessRows.map((row) => [String(row.id), String(row.name)]),
  );
  const services = await hydrateProviderServices(
    viewer.service,
    (serviceRows ?? []) as Row[],
    userId,
    viewer.isAdmin,
    true,
  );
  const receivedInquiries = await hydrateProviderServiceInquiries(
    viewer.service,
    (receivedResult.data ?? []) as Row[],
  );
  const sentInquiries = await hydrateProviderServiceInquiries(
    viewer.service,
    (sentResult.data ?? []) as Row[],
  );

  return {
    businesses: businessRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
    })),
    appointmentServices: ((appointmentResult.data ?? []) as Row[]).map(
      (row) => ({
        id: String(row.id),
        businessId: String(row.business_id),
        businessName:
          businessNames.get(String(row.business_id)) ?? "Business",
        name: String(row.name),
        durationMinutes: Number(row.duration_minutes ?? 30),
        status: String(row.status),
      }),
    ),
    services,
    receivedInquiries,
    sentInquiries,
    matchingRequests,
    reports,
    metrics: {
      pending: services.filter((row) => row.status === "pending").length,
      published: services.filter((row) => row.status === "published").length,
      paused: services.filter((row) => row.status === "paused").length,
      inquiries: receivedInquiries.filter((row) => row.status === "submitted")
        .length,
      accepted: receivedInquiries.filter((row) => row.status === "accepted")
        .length,
      openReports: reports.length,
    },
    isAdmin: viewer.isAdmin,
  };
}
