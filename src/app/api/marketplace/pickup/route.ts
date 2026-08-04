import { NextRequest, NextResponse } from "next/server";
import {
  MarketplacePickupError,
  requestMarketplacePickup,
} from "@/lib/marketplace-pickup-server";
import { enforceAdultOnlyAction } from "@/lib/teen-safety-server";

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  try {
    const restriction = await enforceAdultOnlyAction(
      request,
      "Scheduling a Marketplace pickup"
    );
    if (restriction) return restriction;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new MarketplacePickupError("Invalid pickup request.", 400, "invalid_payload");
    }
    return response(
      await requestMarketplacePickup(request, body as Record<string, unknown>),
      201
    );
  } catch (error) {
    if (error instanceof MarketplacePickupError) {
      return response({ error: error.message, code: error.code }, error.status);
    }
    console.error("Marketplace pickup request failed:", error);
    return response(
      {
        error: "The pickup request could not be completed.",
        code: "marketplace_pickup_failed",
      },
      500
    );
  }
}
