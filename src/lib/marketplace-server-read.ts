import "server-only";

import type { NextRequest } from "next/server";
import { asNumber } from "@/lib/room-operations";
import type {
  MarketplaceBusinessOption,
  MarketplaceListing,
  MarketplaceManageResponse,
  MarketplaceReport,
} from "@/lib/marketplace";
import {
  MarketplaceError,
  cleanLongText,
  cleanMarketplaceText,
  nestedRow,
} from "@/lib/marketplace-server-core";
import {
  MARKETPLACE_SELECT,
  normalizeMarketplaceListing,
} from "@/lib/marketplace-server-normalize";
import {
  missingMarketplaceSchema,
  refreshExpiredListings,
  resolveMarketplaceViewer,
} from "@/lib/marketplace-server-access";

export async function listPublicMarketplace(
  request: NextRequest,
  filters: {
    query?: unknown;
    category?: unknown;
    condition?: unknown;
    city?: unknown;
    fulfillment?: unknown;
    minimumPrice?: unknown;
    maximumPrice?: unknown;
    page?: unknown;
    pageSize?: unknown;
  }
) {
  const viewer = await resolveMarketplaceViewer(request, false);
  await refreshExpiredListings(viewer.service);
  const page = Math.max(Math.floor(asNumber(filters.page) || 1), 1);
  const pageSize = Math.min(
    Math.max(Math.floor(asNumber(filters.pageSize) || 24), 1),
    48
  );
  const minimumPriceText = cleanMarketplaceText(filters.minimumPrice, 30);
  const maximumPriceText = cleanMarketplaceText(filters.maximumPrice, 30);
  const minimumPrice = minimumPriceText ? Number(minimumPriceText) : null;
  const maximumPrice = maximumPriceText ? Number(maximumPriceText) : null;
  if (minimumPrice !== null && (!Number.isFinite(minimumPrice) || minimumPrice < 0)) {
    throw new MarketplaceError("Enter a valid minimum price.", 400, "invalid_minimum_price");
  }
  if (maximumPrice !== null && (!Number.isFinite(maximumPrice) || maximumPrice < 0)) {
    throw new MarketplaceError("Enter a valid maximum price.", 400, "invalid_maximum_price");
  }
  if (minimumPrice !== null && maximumPrice !== null && maximumPrice < minimumPrice) {
    throw new MarketplaceError(
      "Maximum price cannot be below minimum price.",
      400,
      "invalid_price_range"
    );
  }

  const { data, error } = await viewer.service.rpc("search_public_marketplace", {
    search_text: cleanMarketplaceText(filters.query, 180) || null,
    category_filter: cleanMarketplaceText(filters.category, 120) || null,
    condition_filter: cleanMarketplaceText(filters.condition, 30) || null,
    city_filter: cleanMarketplaceText(filters.city, 120) || null,
    fulfillment_filter: cleanMarketplaceText(filters.fulfillment, 30) || null,
    minimum_price: minimumPrice,
    maximum_price: maximumPrice,
    page_number: page,
    page_size: pageSize,
  });

  if (error) {
    if (missingMarketplaceSchema(error)) {
      return {
        listings: [],
        total: 0,
        page,
        pageSize,
        directoryActive: false,
      };
    }
    throw new MarketplaceError(
      "Loombus Marketplace could not load.",
      503,
      "marketplace_unavailable"
    );
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(payload.listings)
    ? (payload.listings as Record<string, unknown>[])
    : [];
  return {
    listings: rows.map(normalizeMarketplaceListing),
    total: Math.max(asNumber(payload.total), 0),
    page,
    pageSize,
    directoryActive: true,
  };
}

export async function getPublicMarketplaceListing(
  request: NextRequest,
  rawSlug: unknown
) {
  const viewer = await resolveMarketplaceViewer(request, false);
  await refreshExpiredListings(viewer.service);
  const slug = cleanMarketplaceText(rawSlug, 100).toLowerCase();
  if (!slug) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }

  const { data, error } = await viewer.service
    .from("marketplace_listings")
    .select(MARKETPLACE_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    if (missingMarketplaceSchema(error)) {
      throw new MarketplaceError(
        "Loombus Marketplace is not active yet.",
        503,
        "marketplace_unavailable"
      );
    }
    throw new MarketplaceError(
      "Unable to load this Marketplace listing.",
      503,
      "listing_unavailable"
    );
  }
  if (!data) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }

  const raw = data as Record<string, unknown>;
  const seller = nestedRow(raw, "profiles");
  const sellerStatus = cleanMarketplaceText(seller.account_status, 30) || "active";
  const suspensionExpired =
    sellerStatus === "suspended" &&
    Boolean(seller.suspended_until) &&
    new Date(cleanMarketplaceText(seller.suspended_until, 60)).getTime() <= Date.now();
  if (!["active", "warned"].includes(sellerStatus) && !suspensionExpired) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }
  const listing = normalizeMarketplaceListing(raw);
  const business = nestedRow(raw, "businesses");
  if (
    listing.businessId &&
    (listing.businessStatus !== "published" ||
      cleanMarketplaceText(business.owner_id, 60) !== listing.sellerId)
  ) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }
  return listing;
}

function normalizeBusinessOption(
  row: Record<string, unknown>
): MarketplaceBusinessOption {
  return {
    id: cleanMarketplaceText(row.id, 60),
    name: cleanMarketplaceText(row.name, 200),
    slug: cleanMarketplaceText(row.slug, 100),
    logoUrl: cleanMarketplaceText(row.logo_url, 2048),
    verificationStatus: cleanMarketplaceText(row.verification_status, 20),
    status: cleanMarketplaceText(row.status, 20),
  };
}

function normalizeReport(
  row: Record<string, unknown>,
  names: Map<string, string>
): MarketplaceReport {
  const listingId = cleanMarketplaceText(row.listing_id, 60);
  const status = cleanMarketplaceText(row.status, 20);
  return {
    id: cleanMarketplaceText(row.id, 60),
    listingId,
    listingTitle: names.get(listingId) ?? "Marketplace listing",
    reporterId: cleanMarketplaceText(row.reporter_id, 60),
    reason: cleanMarketplaceText(row.reason, 120),
    details: cleanLongText(row.details, 3000),
    status: (
      ["open", "resolved", "dismissed"].includes(status) ? status : "open"
    ) as MarketplaceReport["status"],
    createdAt: cleanMarketplaceText(row.created_at, 60) || null,
  };
}

export async function getMarketplaceManageData(
  request: NextRequest
): Promise<MarketplaceManageResponse> {
  const viewer = await resolveMarketplaceViewer(request, true);
  await refreshExpiredListings(viewer.service);
  const userId = viewer.user!.id;

  const [listingResult, businessResult] = await Promise.all([
    viewer.service
      .from("marketplace_listings")
      .select(MARKETPLACE_SELECT)
      .eq("seller_id", userId)
      .order("updated_at", { ascending: false }),
    viewer.service
      .from("businesses")
      .select("id, name, slug, logo_url, verification_status, status")
      .eq("owner_id", userId)
      .eq("status", "published")
      .order("name", { ascending: true }),
  ]);

  if (listingResult.error || businessResult.error) {
    const error = listingResult.error ?? businessResult.error!;
    if (missingMarketplaceSchema(error)) {
      throw new MarketplaceError(
        "The Marketplace migrations have not been applied.",
        503,
        "marketplace_unavailable"
      );
    }
    throw new MarketplaceError(
      "Unable to load Marketplace management.",
      503,
      "marketplace_manage_unavailable"
    );
  }

  let pendingListings: MarketplaceListing[] = [];
  let reportRows: Record<string, unknown>[] = [];
  if (viewer.isAdmin) {
    const [pendingResult, reportsResult] = await Promise.all([
      viewer.service
        .from("marketplace_listings")
        .select(MARKETPLACE_SELECT)
        .in("status", ["pending", "rejected", "suspended"])
        .order("updated_at", { ascending: true }),
      viewer.service
        .from("marketplace_reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: true }),
    ]);
    if (pendingResult.error || reportsResult.error) {
      throw new MarketplaceError(
        "Unable to load Marketplace moderation.",
        503,
        "marketplace_moderation_unavailable"
      );
    }
    pendingListings = (pendingResult.data ?? []).map((row) =>
      normalizeMarketplaceListing(row as Record<string, unknown>)
    );
    reportRows = (reportsResult.data ?? []) as Record<string, unknown>[];
  }

  const listingIds = [
    ...new Set(
      reportRows
        .map((row) => cleanMarketplaceText(row.listing_id, 60))
        .filter(Boolean)
    ),
  ];
  const listingNames = new Map<string, string>();
  if (listingIds.length > 0) {
    const { data } = await viewer.service
      .from("marketplace_listings")
      .select("id, title")
      .in("id", listingIds);
    for (const row of data ?? []) {
      listingNames.set(
        cleanMarketplaceText(row.id, 60),
        cleanMarketplaceText(row.title, 200) || "Marketplace listing"
      );
    }
  }

  return {
    authenticated: true,
    isAdmin: viewer.isAdmin,
    businesses: (businessResult.data ?? []).map((row) =>
      normalizeBusinessOption(row as Record<string, unknown>)
    ),
    listings: (listingResult.data ?? []).map((row) =>
      normalizeMarketplaceListing(row as Record<string, unknown>)
    ),
    moderation: {
      pendingListings,
      openReports: reportRows.map((row) => normalizeReport(row, listingNames)),
    },
  };
}
