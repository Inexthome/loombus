import { NextRequest, NextResponse } from "next/server";
import {
  MarketplaceError,
  createMarketplaceListing,
  getMarketplaceManageData,
  getPublicMarketplaceListing,
  listPublicMarketplace,
  moderateMarketplaceListing,
  removeMarketplaceListing,
  reviewMarketplaceReport,
  updateMarketplaceListing,
} from "@/lib/marketplace-server";
import {
  markMarketplaceListingSoldSafely,
  releaseMarketplaceListing,
  reopenMarketplaceListingSafely,
  reportMarketplaceListingWithReserved,
  reserveMarketplaceListing,
} from "@/lib/marketplace-server-lifecycle";
import { enforceAdultOnlyAction } from "@/lib/teen-safety-server";

const ADULT_ONLY_ACTIONS = new Set([
  "create",
  "update",
  "reopen",
  "reserve",
  "release",
]);

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function errorResponse(error: unknown) {
  if (error instanceof MarketplaceError) {
    return response({ error: error.message, code: error.code }, error.status);
  }
  console.error("Marketplace request failed:", error);
  return response(
    {
      error: "Loombus Marketplace could not complete this request.",
      code: "marketplace_failed",
    },
    500
  );
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const slug = params.get("slug");
    if (slug) {
      return response({ listing: await getPublicMarketplaceListing(request, slug) });
    }
    if (params.get("manage") === "1") {
      return response(await getMarketplaceManageData(request));
    }
    return response(
      await listPublicMarketplace(request, {
        query: params.get("q"),
        category: params.get("category"),
        condition: params.get("condition"),
        city: params.get("city"),
        fulfillment: params.get("fulfillment"),
        minimumPrice: params.get("minimumPrice"),
        maximumPrice: params.get("maximumPrice"),
        page: params.get("page"),
        pageSize: params.get("pageSize"),
      })
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new MarketplaceError(
        "Invalid Marketplace request.",
        400,
        "invalid_payload"
      );
    }
    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();

    if (ADULT_ONLY_ACTIONS.has(action)) {
      const restriction = await enforceAdultOnlyAction(
        request,
        "Publishing or reopening a Marketplace listing"
      );
      if (restriction) return restriction;
    }

    if (action === "create") {
      return response(
        { listing: await createMarketplaceListing(request, input) },
        201
      );
    }
    if (action === "update") {
      return response({ listing: await updateMarketplaceListing(request, input) });
    }
    if (action === "reserve") {
      return response(await reserveMarketplaceListing(request, input));
    }
    if (action === "release") {
      return response(await releaseMarketplaceListing(request, input));
    }
    if (action === "sold") {
      return response(await markMarketplaceListingSoldSafely(request, input));
    }
    if (action === "reopen") {
      return response(await reopenMarketplaceListingSafely(request, input));
    }
    if (action === "remove") {
      return response(await removeMarketplaceListing(request, input));
    }
    if (action === "report") {
      return response(await reportMarketplaceListingWithReserved(request, input), 201);
    }
    if (action === "moderate") {
      return response(await moderateMarketplaceListing(request, input));
    }
    if (action === "review_report") {
      return response(await reviewMarketplaceReport(request, input));
    }

    throw new MarketplaceError(
      "Unsupported Marketplace action.",
      400,
      "unsupported_action"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
