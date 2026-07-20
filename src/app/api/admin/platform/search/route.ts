import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

class SearchAdminError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "search_admin_error",
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
  if (error instanceof SearchAdminError) {
    return response({ error: error.message, code: error.code }, error.status);
  }

  console.error("Search administrator request failed:", error);
  return response(
    {
      error: "Search administration could not complete this request.",
      code: "search_admin_failed",
    },
    500,
  );
}

async function requireAdministrator(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new SearchAdminError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  if (access.profile.is_admin !== true) {
    throw new SearchAdminError(
      "Administrator access is required.",
      403,
      "administrator_required",
    );
  }

  return { service: createRoomServiceSupabase() };
}

function iso(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);

    const [totalResult, activeResult, sampleResult] = await Promise.all([
      service
        .from("loombus_search_documents")
        .select("entity_id", { count: "exact", head: true }),
      service
        .from("loombus_search_documents")
        .select("entity_id", { count: "exact", head: true })
        .eq("visibility", "public")
        .eq("status", "active"),
      service
        .from("loombus_search_documents")
        .select(
          "source_table,entity_id,visibility,status,href,source_updated_at,updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(1000),
    ]);

    const firstError = totalResult.error || activeResult.error || sampleResult.error;
    if (firstError) {
      throw new SearchAdminError(
        firstError.message || "Unable to load the Search index registry.",
        503,
        "search_index_unavailable",
      );
    }

    const totalDocuments = totalResult.count ?? 0;
    const activePublic = activeResult.count ?? 0;
    const sample = (sampleResult.data ?? []) as Row[];
    const staleThreshold = Date.now() - 30 * 86_400_000;
    const sourceMap = new Map<
      string,
      {
        sourceTable: string;
        total: number;
        activePublic: number;
        stale30Days: number;
        missingHref: number;
        lastUpdatedAt: string | null;
      }
    >();

    let stale30Days = 0;
    let missingHref = 0;

    for (const row of sample) {
      const sourceTable = String(row.source_table ?? "unknown").trim() || "unknown";
      const updatedAt = iso(row.source_updated_at) ?? iso(row.updated_at);
      const updatedTimestamp = updatedAt ? new Date(updatedAt).getTime() : Number.NaN;
      const stale = !Number.isFinite(updatedTimestamp) || updatedTimestamp < staleThreshold;
      const hrefMissing = !String(row.href ?? "").trim();
      const publicActive = row.visibility === "public" && row.status === "active";

      if (stale) stale30Days += 1;
      if (hrefMissing) missingHref += 1;

      const current = sourceMap.get(sourceTable) ?? {
        sourceTable,
        total: 0,
        activePublic: 0,
        stale30Days: 0,
        missingHref: 0,
        lastUpdatedAt: null,
      };
      current.total += 1;
      if (publicActive) current.activePublic += 1;
      if (stale) current.stale30Days += 1;
      if (hrefMissing) current.missingHref += 1;
      if (
        updatedAt &&
        (!current.lastUpdatedAt ||
          new Date(updatedAt).getTime() > new Date(current.lastUpdatedAt).getTime())
      ) {
        current.lastUpdatedAt = updatedAt;
      }
      sourceMap.set(sourceTable, current);
    }

    const sources = [...sourceMap.values()].sort(
      (left, right) => right.total - left.total || left.sourceTable.localeCompare(right.sourceTable),
    );

    return response({
      isAdmin: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        totalDocuments,
        activePublic,
        otherIndexed: Math.max(0, totalDocuments - activePublic),
        sourceCount: sources.length,
        sampleSize: sample.length,
        stale30Days,
        missingHref,
      },
      sources,
      boundaries: {
        foundationOnly: true,
        rebuildAvailable: false,
        deleteAvailable: false,
        visibilityMutationAvailable: false,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
