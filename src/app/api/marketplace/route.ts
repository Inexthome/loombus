import { NextRequest, NextResponse } from "next/server";
import {
  MarketplaceError,
  createMarketplaceListing,
  getMarketplaceManageData,
  getPublicMarketplaceListing,
  listPublicMarketplace,
  markMarketplaceListingSold,
  moderateMarketplaceListing,
  removeMarketplaceListing,
  reopenMarketplaceListing,
  reportMarketplaceListing,
  reviewMarketplaceReport,
  updateMarketplaceListing,
} from "@/lib/marketplace-server";

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

    if (action === "create") {
      return response(
        { listing: await createMarketplaceListing(request, input) },
        201
      );
    }
    if (action === "update") {
      return response({ listing: await updateMarketplaceListing(request, input) });
    }
    if (action === "sold") {
      return response(await markMarketplaceListingSold(request, input));
    }
    if (action === "reopen") {
      return response(await reopenMarketplaceListing(request, input));
    }
    if (action === "remove") {
      return response(await removeMarketplaceListing(request, input));
    }
    if (action === "report") {
      return response(await reportMarketplaceListing(request, input), 201);
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
