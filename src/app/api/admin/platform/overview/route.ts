import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Service = ReturnType<typeof createRoomServiceSupabase>;
type Row = Record<string, unknown>;
type ModuleKey =
  | "marketplace"
  | "businesses"
  | "jobs"
  | "events"
  | "requests"
  | "services"
  | "rooms"
  | "appointments"
  | "local"
  | "matches"
  | "search";

type ModuleSummary = {
  key: ModuleKey;
  metric: number | null;
  metricLabel: string;
  status: "ready" | "unavailable";
  detail: string;
};

class PlatformOverviewError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "platform_overview_error",
  ) {
    super(message);
  }
}

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof PlatformOverviewError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Platform overview request failed:", error);
  return response(
    {
      error: "Platform Operations overview could not complete this request.",
      code: "platform_overview_failed",
    },
    500,
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new PlatformOverviewError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  if (access.profile.is_admin !== true) {
    throw new PlatformOverviewError(
      "Administrator access is required.",
      403,
      "administrator_required",
    );
  }

  return { service: createRoomServiceSupabase() };
}

function queryCount(
  result: { count: number | null; error: { message?: string } | null },
  label: string,
) {
  if (result.error) {
    throw new Error(result.error.message || `${label} count could not load.`);
  }
  return result.count ?? 0;
}

async function summary(
  key: ModuleKey,
  metricLabel: string,
  readyDetail: string,
  work: () => Promise<number>,
): Promise<ModuleSummary> {
  try {
    return {
      key,
      metric: await work(),
      metricLabel,
      status: "ready",
      detail: readyDetail,
    };
  } catch (error) {
    console.error(`Platform overview ${key} summary failed:`, error);
    return {
      key,
      metric: null,
      metricLabel,
      status: "unavailable",
      detail:
        error instanceof Error
          ? error.message
          : "This module summary is temporarily unavailable.",
    };
  }
}

async function marketplaceSummary(service: Service) {
  const [listings, reports] = await Promise.all([
    service
      .from("marketplace_listings")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "rejected", "suspended"]),
    service
      .from("marketplace_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);
  return queryCount(listings, "Marketplace listing") + queryCount(reports, "Marketplace report");
}

async function businessesSummary(service: Service) {
  const [businesses, claims, reports] = await Promise.all([
    service
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "rejected", "suspended"]),
    service
      .from("business_claims")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("business_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);
  return (
    queryCount(businesses, "Business listing") +
    queryCount(claims, "Business claim") +
    queryCount(reports, "Business report")
  );
}

async function jobsSummary(service: Service) {
  const [jobs, reports] = await Promise.all([
    service
      .from("job_postings")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "rejected", "suspended"]),
    service
      .from("job_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);
  return queryCount(jobs, "Job posting") + queryCount(reports, "Job report");
}

async function eventsSummary(service: Service) {
  const [events, reports] = await Promise.all([
    service
      .from("public_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("public_event_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);
  return queryCount(events, "Event") + queryCount(reports, "Event report");
}

async function requestsSummary(service: Service) {
  const [requests, reports] = await Promise.all([
    service
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("service_request_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);
  return queryCount(requests, "Request") + queryCount(reports, "Request report");
}

async function servicesSummary(service: Service) {
  const [services, reports] = await Promise.all([
    service
      .from("provider_services")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    service
      .from("provider_service_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "open"),
  ]);
  return queryCount(services, "Service") + queryCount(reports, "Service report");
}

async function roomsSummary(service: Service) {
  const [reports, billing] = await Promise.all([
    service
      .from("room_moderation_reports")
      .select("id", { count: "exact", head: true })
      .eq("state", "pending"),
    service
      .from("rooms")
      .select("id", { count: "exact", head: true })
      .in("subscription_status", [
        "past_due",
        "unpaid",
        "canceled",
        "cancelled",
        "incomplete",
        "incomplete_expired",
        "paused",
      ]),
  ]);

  return queryCount(reports, "Room report") + queryCount(billing, "Room billing");
}

async function appointmentsSummary(service: Service) {
  const result = await service
    .from("business_appointment_requests")
    .select("requested_end,status")
    .eq("status", "accepted")
    .limit(1000);

  if (result.error) {
    throw new Error(result.error.message || "Appointment summary could not load.");
  }

  const now = Date.now();
  return ((result.data ?? []) as Row[]).filter((row) => {
    const end = new Date(String(row.requested_end ?? "")).getTime();
    return Number.isFinite(end) && end < now;
  }).length;
}

async function localSummary(service: Service) {
  const [documents, locations] = await Promise.all([
    service
      .from("loombus_search_documents")
      .select(
        "source_table,entity_id,visibility,status,local_city,local_region,local_postal_code,local_remote_available,local_business_id,source_updated_at,updated_at",
      )
      .in("source_table", [
        "businesses",
        "business_services",
        "job_postings",
        "marketplace_listings",
        "public_events",
        "service_requests",
        "provider_services",
      ])
      .limit(1000),
    service
      .from("loombus_local_locations")
      .select("source_table,entity_id")
      .limit(2000),
  ]);

  if (documents.error || locations.error) {
    throw new Error(
      documents.error?.message ||
        locations.error?.message ||
        "Local summary could not load.",
    );
  }

  const locationKeys = new Set(
    ((locations.data ?? []) as Row[]).map(
      (row) => `${String(row.source_table ?? "")}:${String(row.entity_id ?? "")}`,
    ),
  );
  const staleThreshold = Date.now() - 30 * 86_400_000;

  return ((documents.data ?? []) as Row[]).filter((row) => {
    const activePublic = row.visibility === "public" && row.status === "active";
    if (!activePublic) return false;

    const sourceTable = String(row.source_table ?? "");
    const entityId = String(row.entity_id ?? "");
    const businessId = String(row.local_business_id ?? "");
    const direct = locationKeys.has(`${sourceTable}:${entityId}`);
    const inherited = Boolean(businessId && locationKeys.has(`businesses:${businessId}`));
    const hasPlace = Boolean(
      String(row.local_city ?? "").trim() ||
        String(row.local_region ?? "").trim() ||
        String(row.local_postal_code ?? "").trim(),
    );
    const remote = row.local_remote_available === true;
    const missingLocation = !direct && !inherited && !hasPlace && !remote;
    const updatedRaw = String(row.source_updated_at ?? row.updated_at ?? "");
    const updated = new Date(updatedRaw).getTime();
    const stale = !Number.isFinite(updated) || updated < staleThreshold;
    return missingLocation || stale;
  }).length;
}

async function matchesSummary(service: Service) {
  const staleThreshold = Date.now() - 7 * 86_400_000;
  const now = Date.now();
  const [feedback, deliveries, candidates] = await Promise.all([
    service
      .from("match_feedback")
      .select("id", { count: "exact", head: true })
      .in("feedback_type", ["unsafe", "incorrect"]),
    service
      .from("match_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed"),
    service
      .from("match_candidates")
      .select("refreshed_at,expires_at")
      .eq("eligibility_status", "eligible")
      .limit(1000),
  ]);

  if (candidates.error) {
    throw new Error(candidates.error.message || "Matching summary could not load.");
  }

  const staleEligible = ((candidates.data ?? []) as Row[]).filter((row) => {
    const refreshedAt = new Date(String(row.refreshed_at ?? "")).getTime();
    const expiresAt = new Date(String(row.expires_at ?? "")).getTime();
    return (
      !Number.isFinite(refreshedAt) ||
      refreshedAt < staleThreshold ||
      (Number.isFinite(expiresAt) && expiresAt <= now)
    );
  }).length;

  return (
    queryCount(feedback, "Matching feedback") +
    queryCount(deliveries, "Matching delivery") +
    staleEligible
  );
}

async function searchSummary(service: Service) {
  const result = await service
    .from("loombus_search_documents")
    .select("entity_id", { count: "exact", head: true });
  return queryCount(result, "Search document");
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);

    const modules = await Promise.all([
      summary(
        "marketplace",
        "queue items",
        "Pending, rejected, or suspended listings plus open Marketplace reports.",
        () => marketplaceSummary(service),
      ),
      summary(
        "businesses",
        "queue items",
        "Listing decisions, pending ownership claims, and open Business reports.",
        () => businessesSummary(service),
      ),
      summary(
        "jobs",
        "queue items",
        "Posting decisions and open Job reports.",
        () => jobsSummary(service),
      ),
      summary(
        "events",
        "queue items",
        "Pending public Events and open Event reports.",
        () => eventsSummary(service),
      ),
      summary(
        "requests",
        "queue items",
        "Pending Requests and open Request reports.",
        () => requestsSummary(service),
      ),
      summary(
        "services",
        "queue items",
        "Pending Services and open Service reports.",
        () => servicesSummary(service),
      ),
      summary(
        "rooms",
        "attention items",
        "Pending Room reports and Room billing-state exceptions. Private Room content is not read.",
        () => roomsSummary(service),
      ),
      summary(
        "appointments",
        "overdue accepted",
        "Accepted Appointment requests whose requested end time has passed.",
        () => appointmentsSummary(service),
      ),
      summary(
        "local",
        "attention records",
        "Active Local documents missing usable area context or exceeding the 30-day freshness threshold.",
        () => localSummary(service),
      ),
      summary(
        "matches",
        "attention signals",
        "Unsafe or incorrect feedback, failed deliveries, and stale eligible candidates.",
        () => matchesSummary(service),
      ),
      summary(
        "search",
        "indexed documents",
        "Total records in the unified Loombus search-document registry.",
        () => searchSummary(service),
      ),
    ]);

    const queueModules = modules.filter((module) => module.key !== "search");
    const activeQueue = queueModules.some((module) => module.metric === null)
      ? null
      : queueModules.reduce((total, module) => total + (module.metric ?? 0), 0);

    return response({
      isAdmin: true,
      generatedAt: new Date().toISOString(),
      activeQueue,
      modules,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
