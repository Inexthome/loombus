import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

const SOURCE_TABLES = [
  "businesses",
  "business_services",
  "job_postings",
  "marketplace_listings",
  "public_events",
  "service_requests",
  "provider_services",
] as const;

const DIRECT_LOCATION_TABLES = [
  "businesses",
  "job_postings",
  "marketplace_listings",
  "public_events",
  "service_requests",
  "provider_services",
] as const;

const SOURCE_LABELS: Record<string, string> = {
  businesses: "Businesses",
  business_services: "Business Services",
  job_postings: "Jobs",
  marketplace_listings: "Marketplace",
  public_events: "Events",
  service_requests: "Requests",
  provider_services: "Services",
};

class LocalAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "local_admin_error"
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
  if (error instanceof LocalAdminError) {
    return response(
      { error: error.message, code: error.code },
      error.status
    );
  }

  console.error("Local administrator request failed:", error);

  return response(
    {
      error: "Local administration could not complete this request.",
      code: "local_admin_failed",
    },
    500
  );
}

function text(value: unknown, maximum = 2000) {
  return typeof value === "string"
    ? value.trim().slice(0, maximum)
    : "";
}

function iso(value: unknown) {
  const raw = text(value, 100);
  if (!raw) return null;

  const date = new Date(raw);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function displayName(profile: Row | undefined) {
  return (
    text(profile?.full_name, 200) ||
    (text(profile?.username, 100)
      ? `@${text(profile?.username, 100)}`
      : "Loombus member")
  );
}

function locationLabel(
  direct: Row | undefined,
  inherited: Row | undefined,
  document: Row
) {
  const source = direct ?? inherited;
  const parts = [
    text(source?.city ?? document.local_city, 100),
    text(source?.region ?? document.local_region, 100),
    text(source?.postal_code ?? document.local_postal_code, 30),
    text(source?.country_code ?? document.local_country_code, 2),
  ].filter(Boolean);

  if (parts.length) return parts.join(", ");

  return document.local_remote_available === true
    ? "Remote or online"
    : "No Local area";
}

function ageInDays(value: string | null) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;

  return Math.max(
    0,
    Math.floor((Date.now() - timestamp) / 86_400_000)
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(
    createRequestSupabase(request)
  );

  if (!access.ok) {
    throw new LocalAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied"
    );
  }

  if (access.profile.is_admin !== true) {
    throw new LocalAdminError(
      "Administrator access is required.",
      403,
      "administrator_required"
    );
  }

  return { service: createRoomServiceSupabase() };
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);

    const [documentsResult, locationsResult] = await Promise.all([
      service
        .from("loombus_search_documents")
        .select(
          [
            "source_table",
            "entity_id",
            "title",
            "href",
            "owner_id",
            "visibility",
            "status",
            "local_city",
            "local_region",
            "local_postal_code",
            "local_country_code",
            "local_mode",
            "local_remote_available",
            "local_business_id",
            "local_starts_at",
            "local_ends_at",
            "source_updated_at",
            "updated_at",
          ].join(",")
        )
        .in("source_table", [...SOURCE_TABLES])
        .order("source_updated_at", { ascending: false })
        .limit(1000),
      service
        .from("loombus_local_locations")
        .select(
          [
            "source_table",
            "entity_id",
            "owner_id",
            "location_precision",
            "city",
            "region",
            "postal_code",
            "country_code",
            "updated_at",
          ].join(",")
        )
        .in("source_table", [...DIRECT_LOCATION_TABLES])
        .limit(2000),
    ]);

    if (documentsResult.error) {
      throw new LocalAdminError(
        documentsResult.error.message ||
          "Unable to load Local source documents.",
        503,
        "local_documents_unavailable"
      );
    }

    if (locationsResult.error) {
      throw new LocalAdminError(
        locationsResult.error.message ||
          "Unable to load Local location anchors.",
        503,
        "local_locations_unavailable"
      );
    }

    const documentRows =
      (documentsResult.data ?? []) as unknown as Row[];
    const locationRows =
      (locationsResult.data ?? []) as unknown as Row[];

    const ownerIds = [
      ...new Set(
        documentRows
          .map((row) => text(row.owner_id, 60))
          .filter(Boolean)
      ),
    ];

    const profilesResult = ownerIds.length
      ? await service
          .from("profiles")
          .select("id, full_name, username")
          .in("id", ownerIds)
      : { data: [] as Row[], error: null };

    if (profilesResult.error) {
      throw new LocalAdminError(
        "Unable to load Local owner attribution.",
        503,
        "local_owners_unavailable"
      );
    }

    const profiles = new Map<string, Row>(
      ((profilesResult.data ?? []) as unknown as Row[]).map(
        (row) => [text(row.id, 60), row]
      )
    );

    const locations = new Map<string, Row>(
      locationRows.map((row) => [
        `${text(row.source_table, 80)}:${text(row.entity_id, 60)}`,
        row,
      ])
    );

    const staleThreshold =
      Date.now() - 30 * 86_400_000;

    const normalized = documentRows.map((row) => {
      const sourceTable = text(row.source_table, 80);
      const entityId = text(row.entity_id, 60);
      const direct = locations.get(`${sourceTable}:${entityId}`);
      const businessId = text(row.local_business_id, 60);
      const inherited =
        !direct && businessId
          ? locations.get(`businesses:${businessId}`)
          : undefined;
      const activePublic =
        text(row.visibility, 40) === "public" &&
        text(row.status, 40) === "active";
      const hasPlace = Boolean(
        text(row.local_city, 100) ||
          text(row.local_region, 100) ||
          text(row.local_postal_code, 30)
      );
      const remoteAvailable =
        row.local_remote_available === true;
      const anchored = Boolean(
        direct || inherited || hasPlace
      );
      const missingLocation =
        activePublic && !anchored && !remoteAvailable;
      const updatedAt =
        iso(row.source_updated_at) ?? iso(row.updated_at);
      const stale =
        activePublic &&
        (!updatedAt ||
          new Date(updatedAt).getTime() < staleThreshold);
      const ownerId = text(row.owner_id, 60);

      return {
        id: entityId,
        sourceTable,
        sourceLabel:
          SOURCE_LABELS[sourceTable] ?? sourceTable,
        title: text(row.title, 300) || "Untitled Local item",
        href: text(row.href, 1000) || "/local",
        ownerId: ownerId || null,
        ownerLabel: displayName(profiles.get(ownerId)),
        visibility: text(row.visibility, 40) || "unknown",
        status: text(row.status, 40) || "unknown",
        activePublic,
        locationLabel: locationLabel(direct, inherited, row),
        locationMode: text(row.local_mode, 80) || null,
        locationPrecision:
          text(
            direct?.location_precision ??
              inherited?.location_precision,
            30
          ) || null,
        remoteAvailable,
        directLocation: Boolean(direct),
        inheritedLocation: Boolean(inherited),
        anchored,
        missingLocation,
        stale,
        updatedAt,
        ageDays: ageInDays(updatedAt),
        startsAt: iso(row.local_starts_at),
        endsAt: iso(row.local_ends_at),
      };
    });

    const sources = SOURCE_TABLES.map((sourceTable) => {
      const records = normalized.filter(
        (record) => record.sourceTable === sourceTable
      );
      const active = records.filter(
        (record) => record.activePublic
      );
      const anchored = active.filter(
        (record) => record.anchored
      ).length;

      return {
        sourceTable,
        label: SOURCE_LABELS[sourceTable],
        total: records.length,
        activePublic: active.length,
        anchored,
        missingLocation: active.filter(
          (record) => record.missingLocation
        ).length,
        stale30Days: active.filter(
          (record) => record.stale
        ).length,
        remoteAvailable: active.filter(
          (record) => record.remoteAvailable
        ).length,
        coveragePercent: active.length
          ? Math.round((anchored / active.length) * 100)
          : 100,
      };
    });

    const active = normalized.filter(
      (record) => record.activePublic
    );
    const attention = normalized
      .filter(
        (record) =>
          record.activePublic &&
          (record.missingLocation || record.stale)
      )
      .sort((left, right) => {
        if (
          left.missingLocation !== right.missingLocation
        ) {
          return left.missingLocation ? -1 : 1;
        }

        return (
          (right.ageDays ?? -1) -
          (left.ageDays ?? -1)
        );
      })
      .slice(0, 250);

    return response({
      isAdmin: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalDocuments: normalized.length,
        activePublic: active.length,
        anchored: active.filter(
          (record) => record.anchored
        ).length,
        missingLocation: active.filter(
          (record) => record.missingLocation
        ).length,
        stale30Days: active.filter(
          (record) => record.stale
        ).length,
        remoteAvailable: active.filter(
          (record) => record.remoteAvailable
        ).length,
        attentionRecords: attention.length,
        sourceCount: sources.filter(
          (source) => source.total > 0
        ).length,
      },
      sources,
      attention,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
