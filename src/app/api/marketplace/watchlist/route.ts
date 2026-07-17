import { NextRequest, NextResponse } from "next/server";
import {
  MarketplaceError,
  cleanUuid,
} from "@/lib/marketplace-server-core";
import { resolveMarketplaceViewer } from "@/lib/marketplace-server-access";
import {
  MARKETPLACE_SELECT,
  normalizeMarketplaceListing,
} from "@/lib/marketplace-server-normalize";
import { marketplaceRowIsPublic } from "@/lib/marketplace-public-server";

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
  console.error("Marketplace watchlist request failed:", error);
  return response({ error: "Marketplace saved items could not be updated." }, 500);
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await resolveMarketplaceViewer(request, true);
    const userId = viewer.user!.id;
    const listingId = request.nextUrl.searchParams.get("listingId");

    if (listingId) {
      const id = cleanUuid(listingId, "listing id");
      const { data, error } = await viewer.service
        .from("marketplace_saved_listings")
        .select("id")
        .eq("user_id", userId)
        .eq("listing_id", id)
        .maybeSingle();
      if (error) throw error;
      return response({ saved: Boolean(data) });
    }

    const { data: savedRows, error: savedError } = await viewer.service
      .from("marketplace_saved_listings")
      .select("listing_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (savedError) throw savedError;
    const rows = (savedRows ?? []) as Array<{
      listing_id: string;
      created_at: string;
    }>;
    const ids = rows.map((row: { listing_id: string }) => row.listing_id);
    if (ids.length === 0) return response({ items: [] });

    const { data: listingRows, error: listingError } = await viewer.service
      .from("marketplace_listings")
      .select(MARKETPLACE_SELECT)
      .in("id", ids);
    if (listingError) throw listingError;

    const listingMap = new Map<string, Record<string, unknown>>(
      (listingRows ?? []).map((row: unknown) => {
        const raw = row as Record<string, unknown>;
        return [String(raw.id), raw] as const;
      })
    );

    const items = rows.flatMap((saved) => {
      const raw = listingMap.get(saved.listing_id);
      if (!raw) return [];
      return [
        {
          listing: normalizeMarketplaceListing(raw),
          savedAt: saved.created_at,
          available: marketplaceRowIsPublic(raw),
        },
      ];
    });

    return response({ items });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await resolveMarketplaceViewer(request, true);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new MarketplaceError("Invalid saved-item request.", 400, "invalid_payload");
    }

    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "").trim();
    const listingId = cleanUuid(input.listingId, "listing id");

    if (action === "save") {
      const { data: listing } = await viewer.service
        .from("marketplace_listings")
        .select(MARKETPLACE_SELECT)
        .eq("id", listingId)
        .maybeSingle();
      if (!listing || !marketplaceRowIsPublic(listing as Record<string, unknown>)) {
        throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
      }

      const { error } = await viewer.service
        .from("marketplace_saved_listings")
        .upsert(
          { user_id: viewer.user!.id, listing_id: listingId },
          { onConflict: "user_id,listing_id", ignoreDuplicates: true }
        );
      if (error) throw error;
      return response({ saved: true });
    }

    if (action === "unsave") {
      const { error } = await viewer.service
        .from("marketplace_saved_listings")
        .delete()
        .eq("user_id", viewer.user!.id)
        .eq("listing_id", listingId);
      if (error) throw error;
      return response({ saved: false });
    }

    throw new MarketplaceError(
      "Unsupported saved-item action.",
      400,
      "unsupported_action"
    );
  } catch (error) {
    return errorResponse(error);
  }
}
