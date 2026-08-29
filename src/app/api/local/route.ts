import { NextRequest, NextResponse } from "next/server";
import type {
  LocalDiscoveryEntityType,
  LocalDiscoveryResponse,
  LocalDiscoveryResult,
} from "@/lib/local-discovery";
import {
  LocalDiscoveryError,
  clearLocalDiscoveryLocation,
  getLocalManageData,
  searchLocalDiscovery,
  setLocalDiscoveryLocation,
} from "@/lib/local-discovery-server";
import {
  enforceAdultOnlyAction,
  filterLocalDiscoveryForTeen,
} from "@/lib/teen-safety-server";

const LOCAL_ENTITY_TYPES = new Set<LocalDiscoveryEntityType>([
  "business",
  "service",
  "event",
  "job",
  "marketplace",
  "request",
]);

type LocalRow = Record<string, unknown>;

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown) {
  return nullableText(value) ?? "";
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  return false;
}

function normalizeLocalResult(value: unknown): LocalDiscoveryResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as LocalRow;
  const entityType = requiredText(row.entityType ?? row.entity_type) as LocalDiscoveryEntityType;
  const id = requiredText(row.id);
  const sourceTable = requiredText(row.sourceTable ?? row.source_table);
  const title = requiredText(row.title);
  const href = requiredText(row.href);

  if (!id || !sourceTable || !title || !href || !LOCAL_ENTITY_TYPES.has(entityType)) {
    return null;
  }

  return {
    id,
    entityType,
    sourceTable,
    title,
    summary: requiredText(row.summary),
    href,
    category: nullableText(row.category),
    city: nullableText(row.city),
    region: nullableText(row.region),
    postalCode: nullableText(row.postalCode ?? row.postal_code),
    countryCode: nullableText(row.countryCode ?? row.country_code),
    locationMode: nullableText(row.locationMode ?? row.location_mode),
    remoteAvailable: booleanValue(row.remoteAvailable ?? row.remote_available),
    distanceMiles: finiteNumber(row.distanceMiles ?? row.distance_miles),
    startsAt: nullableText(row.startsAt ?? row.starts_at),
    endsAt: nullableText(row.endsAt ?? row.ends_at),
    priceText: nullableText(row.priceText ?? row.price_text),
    attribution: nullableText(row.attribution),
    imageUrl: nullableText(row.imageUrl ?? row.image_url),
    locationPrecision: nullableText(row.locationPrecision ?? row.location_precision),
    updatedAt: nullableText(row.updatedAt ?? row.updated_at),
  };
}

function normalizeLocalResponse(value: LocalDiscoveryResponse): LocalDiscoveryResponse {
  const raw = value as unknown as LocalRow;
  const rawResults = Array.isArray(raw.results) ? raw.results : [];
  const results = rawResults
    .map(normalizeLocalResult)
    .filter((item): item is LocalDiscoveryResult => item !== null);

  const rawCounts = raw.counts && typeof raw.counts === "object" && !Array.isArray(raw.counts)
    ? (raw.counts as LocalRow)
    : {};
  const counts: LocalDiscoveryResponse["counts"] = {};
  for (const entityType of LOCAL_ENTITY_TYPES) {
    const count = finiteNumber(rawCounts[entityType]);
    if (count !== null) counts[entityType] = Math.max(0, Math.floor(count));
  }

  return {
    results,
    total: Math.max(0, Math.floor(finiteNumber(raw.total) ?? results.length)),
    page: Math.max(1, Math.floor(finiteNumber(raw.page) ?? 1)),
    pageSize: Math.max(1, Math.floor(finiteNumber(raw.pageSize ?? raw.page_size) ?? 24)),
    counts,
    anchoredTotal: Math.max(
      0,
      Math.floor(
        finiteNumber(raw.anchoredTotal ?? raw.anchored_total) ??
          results.filter((item) => item.distanceMiles !== null).length
      )
    ),
  };
}

function errorResponse(error: unknown) {
  if (error instanceof LocalDiscoveryError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Local Discovery request failed:", error);
  return response(
    {
      error: "Local Discovery could not complete this action.",
      code: "local_discovery_failed",
    },
    500,
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    if (params.get("manage") === "1") {
      return response(await getLocalManageData(request));
    }
    const result = normalizeLocalResponse(
      await searchLocalDiscovery({
        query: params.get("q"),
        entityTypes: params.getAll("type"),
        location: params.get("location"),
        includeRemote: params.get("includeRemote") !== "0",
        dateFrom: params.get("dateFrom"),
        dateTo: params.get("dateTo"),
        page: params.get("page"),
        pageSize: params.get("pageSize"),
      })
    );
    return response(await filterLocalDiscoveryForTeen(request, result));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new LocalDiscoveryError(
        "Invalid Local Discovery action.",
        400,
        "invalid_local_payload",
      );
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();
    if (action === "search") {
      const result = normalizeLocalResponse(await searchLocalDiscovery(input));
      return response(await filterLocalDiscoveryForTeen(request, result));
    }
    if (action === "set_location") {
      const restriction = await enforceAdultOnlyAction(
        request,
        "Publishing a Local Discovery location"
      );
      if (restriction) return restriction;
      return response(await setLocalDiscoveryLocation(request, input));
    }
    if (action === "clear_location") {
      return response(await clearLocalDiscoveryLocation(request, input));
    }
    throw new LocalDiscoveryError(
      "Unsupported Local Discovery action.",
      400,
      "unsupported_local_action",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
