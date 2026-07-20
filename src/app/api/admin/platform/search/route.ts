import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type ErrorLike = {
  code?: string;
  message?: string;
};

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

function text(value: unknown, maximum = 120) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function rpcError(error: ErrorLike | null, fallback: string) {
  if (!error) return;

  const missing =
    error.code === "42883" ||
    /admin_loombus_search|schema cache|could not find the function/i.test(
      error.message ?? "",
    );

  throw new SearchAdminError(
    missing
      ? "The Search Operations migration has not been applied."
      : error.message || fallback,
    503,
    missing ? "search_operations_schema_unavailable" : "search_operations_unavailable",
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

  return {
    administratorId: access.user.id,
    service: createRoomServiceSupabase(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { service } = await requireAdministrator(request);
    const { data, error } = await service.rpc("admin_loombus_search_health");
    rpcError(error, "Unable to load Search index health.");

    const health =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    return response({ isAdmin: true, ...health });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { administratorId, service } = await requireAdministrator(request);
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new SearchAdminError(
        "Invalid Search administrator request.",
        400,
        "invalid_payload",
      );
    }

    const input = body as Record<string, unknown>;
    const action = text(input.action, 80);
    const sourceTable = text(input.sourceTable, 100).toLowerCase();

    if (!sourceTable) {
      throw new SearchAdminError(
        "Choose a registered Search source.",
        400,
        "search_source_required",
      );
    }

    if (action === "rebuild_source") {
      const { data, error } = await service.rpc(
        "admin_rebuild_loombus_search_source",
        { target_source_table: sourceTable },
      );
      rpcError(error, "The Search source could not be rebuilt.");

      await logAuditEvent({
        actor_id: administratorId,
        action: "admin.search_source_rebuilt",
        target_type: "loombus_search_source",
        target_id: null,
        metadata: {
          source_table: sourceTable,
          result: data ?? null,
        },
      });

      return response({ updated: true, operation: data });
    }

    if (action === "repair_document") {
      const entityId = text(input.entityId, 60);
      if (!validUuid(entityId)) {
        throw new SearchAdminError(
          "Invalid Search entity id.",
          400,
          "invalid_search_entity_id",
        );
      }

      const { data, error } = await service.rpc(
        "admin_repair_loombus_search_document",
        {
          target_source_table: sourceTable,
          target_entity_id: entityId,
        },
      );
      rpcError(error, "The Search document could not be repaired.");

      await logAuditEvent({
        actor_id: administratorId,
        action: "admin.search_document_repaired",
        target_type: "loombus_search_document",
        target_id: entityId,
        metadata: {
          source_table: sourceTable,
          result: data ?? null,
        },
      });

      return response({ updated: true, operation: data });
    }

    throw new SearchAdminError(
      "Unsupported Search administrator action.",
      400,
      "unsupported_action",
    );
  } catch (error) {
    return errorResponse(error);
  }
}
