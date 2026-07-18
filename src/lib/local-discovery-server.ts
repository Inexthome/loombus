import "server-only";

import type { NextRequest } from "next/server";
import type {
  LocalDiscoveryEntityType,
  LocalDiscoveryResponse,
  LocalManageResponse,
} from "@/lib/local-discovery";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, any>;
type LocalSearchInput = {
  query?: unknown;
  entityTypes?: unknown;
  location?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  radiusMiles?: unknown;
  includeRemote?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  page?: unknown;
  pageSize?: unknown;
};
type LocalLocationInput = {
  sourceTable?: unknown;
  entityId?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  city?: unknown;
  region?: unknown;
  postalCode?: unknown;
  countryCode?: unknown;
};

const ENTITY_TYPES = new Set<LocalDiscoveryEntityType>([
  "business",
  "service",
  "event",
  "job",
  "marketplace",
  "request",
]);
const DIRECT_LOCATION_SOURCES = new Set([
  "businesses",
  "job_postings",
  "marketplace_listings",
  "public_events",
  "service_requests",
  "provider_services",
]);
const LOCAL_SOURCE_TABLES = [
  "businesses",
  "business_services",
  "job_postings",
  "marketplace_listings",
  "public_events",
  "service_requests",
  "provider_services",
];

export class LocalDiscoveryError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "local_discovery_error",
  ) {
    super(message);
  }
}

function text(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function positiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Math.floor(finiteNumber(value) ?? fallback);
  return Math.min(Math.max(parsed, 1), maximum);
}

function optionalIso(value: unknown) {
  const raw = text(value, 100);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sourceEntityType(sourceTable: string): LocalDiscoveryEntityType {
  if (sourceTable === "businesses") return "business";
  if (sourceTable === "business_services" || sourceTable === "provider_services") {
    return "service";
  }
  if (sourceTable === "public_events") return "event";
  if (sourceTable === "job_postings") return "job";
  if (sourceTable === "marketplace_listings") return "marketplace";
  return "request";
}

function areaLabel(row: Row | undefined, fallback: Row) {
  const city = text(row?.city ?? fallback.local_city, 100);
  const region = text(row?.region ?? fallback.local_region, 100);
  const postalCode = text(row?.postal_code ?? fallback.local_postal_code, 30);
  const place = [city, region, postalCode].filter(Boolean).join(", ");
  if (place) return place;
  return fallback.local_remote_available === true
    ? "Remote or online"
    : "Location stated on source";
}

async function requireAccount(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!access.ok) {
    throw new LocalDiscoveryError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }
  const service = createRoomServiceSupabase();
  const { data: sensitive, error } = await service
    .from("profile_sensitive")
    .select("age_band, guardian_required")
    .eq("id", access.user.id)
    .maybeSingle();
  const ageBand = String(sensitive?.age_band ?? "unknown");
  if (
    ageBand === "under_13" ||
    sensitive?.guardian_required === true
  ) {
    throw new LocalDiscoveryError(
      "Loombus is not available to children under 13.",
      403,
      "under_13_not_allowed",
    );
  }
  if (error || ageBand === "unknown") {
    throw new LocalDiscoveryError(
      "Complete age safety before managing public Local Discovery locations.",
      403,
      "age_gate_required",
    );
  }
  return { access, service };
}

export async function searchLocalDiscovery(
  input: LocalSearchInput,
): Promise<LocalDiscoveryResponse> {
  const service = createRoomServiceSupabase();
  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);
  const validCenter =
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;
  const radius = finiteNumber(input.radiusMiles);
  const rawTypes = Array.isArray(input.entityTypes) ? input.entityTypes : [];
  const entityTypes = rawTypes
    .map((value) => text(value, 40) as LocalDiscoveryEntityType)
    .filter((value) => ENTITY_TYPES.has(value));
  const page = positiveInteger(input.page, 1, 10_000);
  const pageSize = positiveInteger(input.pageSize, 24, 48);

  const { data, error } = await service.rpc("search_loombus_local", {
    search_text: text(input.query, 240) || null,
    entity_filters: entityTypes.length ? entityTypes : null,
    location_filter: text(input.location, 160) || null,
    center_latitude: validCenter ? latitude : null,
    center_longitude: validCenter ? longitude : null,
    radius_miles:
      validCenter && radius !== null
        ? Math.min(Math.max(radius, 1), 250)
        : null,
    include_remote: input.includeRemote !== false,
    date_from: optionalIso(input.dateFrom),
    date_to: optionalIso(input.dateTo),
    page_number: page,
    page_size: pageSize,
  });
  if (error) {
    if (/search_loombus_local|schema cache|does not exist/i.test(error.message ?? "")) {
      throw new LocalDiscoveryError(
        "The Local Discovery migrations have not been applied.",
        503,
        "local_discovery_schema_unavailable",
      );
    }
    throw new LocalDiscoveryError(
      "Unable to search Loombus Local.",
      503,
      "local_discovery_unavailable",
    );
  }
  const payload = (data ?? {}) as Partial<LocalDiscoveryResponse>;
  return {
    results: Array.isArray(payload.results) ? payload.results : [],
    total: Number(payload.total ?? 0),
    page: Number(payload.page ?? page),
    pageSize: Number(payload.pageSize ?? pageSize),
    counts:
      payload.counts && typeof payload.counts === "object"
        ? payload.counts
        : {},
    anchoredTotal: Number(payload.anchoredTotal ?? 0),
  };
}

export async function getLocalManageData(
  request: NextRequest,
): Promise<LocalManageResponse> {
  const { access, service } = await requireAccount(request);
  const { data: documents, error } = await service
    .from("loombus_search_documents")
    .select(
      "source_table, entity_id, title, href, owner_id, local_city, local_region, local_postal_code, local_country_code, local_mode, local_remote_available, local_business_id, source_updated_at",
    )
    .eq("visibility", "public")
    .eq("status", "active")
    .eq("owner_id", access.user.id)
    .in("source_table", LOCAL_SOURCE_TABLES)
    .order("source_updated_at", { ascending: false })
    .limit(500);
  if (error) {
    if (/local_city|schema cache|does not exist/i.test(error.message ?? "")) {
      throw new LocalDiscoveryError(
        "The Local Discovery migrations have not been applied.",
        503,
        "local_discovery_schema_unavailable",
      );
    }
    throw new LocalDiscoveryError(
      "Unable to load Local Discovery locations.",
      503,
      "local_manage_unavailable",
    );
  }

  const { data: locations, error: locationError } = await service
    .from("loombus_local_locations")
    .select(
      "source_table, entity_id, owner_id, location_precision, city, region, postal_code, country_code",
    )
    .eq("owner_id", access.user.id)
    .limit(1000);
  if (locationError) {
    throw new LocalDiscoveryError(
      "Unable to load saved Local Discovery areas.",
      503,
      "local_locations_unavailable",
    );
  }
  const locationMap = new Map<string, Row>(
    ((locations ?? []) as Row[]).map((row) => [
      `${row.source_table}:${row.entity_id}`,
      row,
    ]),
  );

  return {
    items: ((documents ?? []) as Row[]).map((row) => {
      const sourceTable = String(row.source_table);
      const id = String(row.entity_id);
      const direct = locationMap.get(`${sourceTable}:${id}`);
      const business = row.local_business_id
        ? locationMap.get(`businesses:${row.local_business_id}`)
        : undefined;
      const inherited = direct ? undefined : business;
      const activeLocation = direct ?? inherited;
      return {
        id,
        sourceTable,
        entityType: sourceEntityType(sourceTable),
        title: String(row.title),
        href: String(row.href),
        city: text(row.local_city, 100) || null,
        region: text(row.local_region, 100) || null,
        postalCode: text(row.local_postal_code, 30) || null,
        countryCode: text(row.local_country_code, 2) || null,
        locationMode: text(row.local_mode, 60) || null,
        directLocation: Boolean(direct),
        inheritedLocation: Boolean(inherited),
        locationPrecision: text(activeLocation?.location_precision, 30) || null,
        locationLabel: areaLabel(activeLocation, row),
        canSetDirect: DIRECT_LOCATION_SOURCES.has(sourceTable),
      };
    }),
    isAdmin: access.profile.is_admin === true,
  };
}

async function enforceLocationWriteRate(service: ReturnType<typeof createRoomServiceSupabase>, userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await service
    .from("action_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action_key", "local_location_update")
    .gte("created_at", since);
  if (error) {
    throw new LocalDiscoveryError(
      "Unable to verify the Local Discovery update limit.",
      503,
      "local_location_rate_unavailable",
    );
  }
  if ((count ?? 0) >= 30) {
    throw new LocalDiscoveryError(
      "You have reached the Local Discovery location update limit for this hour.",
      429,
      "local_location_rate_limited",
    );
  }
  const { error: insertError } = await service.from("action_rate_events").insert({
    user_id: userId,
    action_key: "local_location_update",
    target_id: null,
  });
  if (insertError) {
    throw new LocalDiscoveryError(
      "Unable to reserve the Local Discovery update.",
      503,
      "local_location_rate_unavailable",
    );
  }
}

export async function setLocalDiscoveryLocation(
  request: NextRequest,
  input: LocalLocationInput,
) {
  const { access, service } = await requireAccount(request);
  const sourceTable = text(input.sourceTable, 80);
  const entityId = text(input.entityId, 60);
  const latitude = finiteNumber(input.latitude);
  const longitude = finiteNumber(input.longitude);
  if (!DIRECT_LOCATION_SOURCES.has(sourceTable)) {
    throw new LocalDiscoveryError(
      "This Local Discovery item inherits its location from another source.",
      400,
      "local_location_source_invalid",
    );
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entityId)
  ) {
    throw new LocalDiscoveryError(
      "Choose a valid Local Discovery item.",
      400,
      "local_location_item_invalid",
    );
  }
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new LocalDiscoveryError(
      "Use a valid current location.",
      400,
      "local_coordinates_invalid",
    );
  }
  await enforceLocationWriteRate(service, access.user.id);
  const { data, error } = await service.rpc("set_loombus_local_location", {
    target_source_table: sourceTable,
    target_entity_id: entityId,
    target_user_id: access.user.id,
    target_latitude: latitude,
    target_longitude: longitude,
    target_precision: "approximate",
    target_city: text(input.city, 100) || null,
    target_region: text(input.region, 100) || null,
    target_postal_code: text(input.postalCode, 30) || null,
    target_country_code: (text(input.countryCode, 2) || "US").toUpperCase(),
  });
  if (error) {
    const message = error.message ?? "";
    if (/LOCAL_LOCATION_FORBIDDEN/.test(message)) {
      throw new LocalDiscoveryError(
        "Only the accountable owner may set this Local Discovery location.",
        403,
        "local_location_forbidden",
      );
    }
    if (/LOCAL_LOCATION_NOT_FOUND/.test(message)) {
      throw new LocalDiscoveryError(
        "This Local Discovery item no longer exists.",
        404,
        "local_location_not_found",
      );
    }
    throw new LocalDiscoveryError(
      "Unable to save the Local Discovery location.",
      503,
      "local_location_update_failed",
    );
  }
  return { saved: true, location: data ?? null };
}

export async function clearLocalDiscoveryLocation(
  request: NextRequest,
  input: LocalLocationInput,
) {
  const { access, service } = await requireAccount(request);
  const sourceTable = text(input.sourceTable, 80);
  const entityId = text(input.entityId, 60);
  if (!DIRECT_LOCATION_SOURCES.has(sourceTable)) {
    throw new LocalDiscoveryError(
      "This Local Discovery item inherits its location from another source.",
      400,
      "local_location_source_invalid",
    );
  }
  await enforceLocationWriteRate(service, access.user.id);
  const { error } = await service.rpc("clear_loombus_local_location", {
    target_source_table: sourceTable,
    target_entity_id: entityId,
    target_user_id: access.user.id,
  });
  if (error) {
    if (/LOCAL_LOCATION_FORBIDDEN/.test(error.message ?? "")) {
      throw new LocalDiscoveryError(
        "Only the accountable owner may clear this Local Discovery location.",
        403,
        "local_location_forbidden",
      );
    }
    throw new LocalDiscoveryError(
      "Unable to clear the Local Discovery location.",
      503,
      "local_location_clear_failed",
    );
  }
  return { cleared: true };
}
