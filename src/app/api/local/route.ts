import { NextRequest, NextResponse } from "next/server";
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

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
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
    const result = await searchLocalDiscovery({
      query: params.get("q"),
      entityTypes: params.getAll("type"),
      location: params.get("location"),
      includeRemote: params.get("includeRemote") !== "0",
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    });
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
      const result = await searchLocalDiscovery(input);
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
