import "server-only";

import type { MarketplaceListing } from "@/lib/marketplace";
import { createRoomServiceSupabase } from "@/lib/room-operations";
import {
  cleanMarketplaceText,
  nestedRow,
} from "@/lib/marketplace-server-core";
import {
  MARKETPLACE_SELECT,
  normalizeMarketplaceListing,
} from "@/lib/marketplace-server-normalize";

function sellerIsPubliclyEligible(row: Record<string, unknown>) {
  const seller = nestedRow(row, "profiles");
  const status = cleanMarketplaceText(seller.account_status, 30) || "active";
  const suspendedUntil = cleanMarketplaceText(seller.suspended_until, 60);
  const expiredSuspension =
    status === "suspended" &&
    Boolean(suspendedUntil) &&
    new Date(suspendedUntil).getTime() <= Date.now();

  return ["active", "warned"].includes(status) || expiredSuspension;
}

export function marketplaceRowIsPublic(row: Record<string, unknown>) {
  if (cleanMarketplaceText(row.status, 20) !== "published") return false;

  const expiresAt = cleanMarketplaceText(row.expires_at, 60);
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return false;
  if (!sellerIsPubliclyEligible(row)) return false;

  const sellerId = cleanMarketplaceText(row.seller_id, 60);
  const businessId = cleanMarketplaceText(row.business_id, 60);
  if (!businessId) return true;

  const business = nestedRow(row, "businesses");
  return (
    cleanMarketplaceText(business.status, 20) === "published" &&
    cleanMarketplaceText(business.owner_id, 60) === sellerId
  );
}

async function refreshExpiredListings() {
  const service = createRoomServiceSupabase();
  const { error } = await service.rpc("expire_marketplace_listings");
  if (
    error &&
    error.code !== "42883" &&
    !/expire_marketplace_listings|schema cache|could not find the function/i.test(
      error.message ?? ""
    )
  ) {
    console.error("Unable to expire Marketplace listings:", error);
  }
  return service;
}

export async function findPublicMarketplaceListingBySlug(
  rawSlug: unknown
): Promise<MarketplaceListing | null> {
  const slug = cleanMarketplaceText(rawSlug, 100).toLowerCase();
  if (!slug) return null;

  const service = await refreshExpiredListings();
  const { data, error } = await service
    .from("marketplace_listings")
    .select(MARKETPLACE_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return marketplaceRowIsPublic(row) ? normalizeMarketplaceListing(row) : null;
}

export async function findPublicMarketplaceListingById(
  rawId: unknown
): Promise<MarketplaceListing | null> {
  const id = cleanMarketplaceText(rawId, 60);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    return null;
  }

  const service = await refreshExpiredListings();
  const { data, error } = await service
    .from("marketplace_listings")
    .select(MARKETPLACE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return marketplaceRowIsPublic(row) ? normalizeMarketplaceListing(row) : null;
}

export async function listPublicMarketplaceForIdentity(options: {
  sellerUsername?: unknown;
  businessSlug?: unknown;
  limit?: unknown;
}): Promise<MarketplaceListing[]> {
  const sellerUsername = cleanMarketplaceText(options.sellerUsername, 100);
  const businessSlug = cleanMarketplaceText(options.businessSlug, 100);
  const requestedLimit = Number(options.limit ?? 6);
  const limit = Math.min(
    Math.max(Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 6, 1),
    24
  );

  if (!sellerUsername && !businessSlug) return [];

  const service = await refreshExpiredListings();
  let sellerId = "";
  let businessId = "";

  if (sellerUsername) {
    const { data } = await service
      .from("profiles")
      .select("id")
      .ilike("username", sellerUsername)
      .maybeSingle();
    sellerId = cleanMarketplaceText(data?.id, 60);
    if (!sellerId) return [];
  }

  if (businessSlug) {
    const { data } = await service
      .from("businesses")
      .select("id, status")
      .eq("slug", businessSlug)
      .eq("status", "published")
      .maybeSingle();
    businessId = cleanMarketplaceText(data?.id, 60);
    if (!businessId) return [];
  }

  let query = service
    .from("marketplace_listings")
    .select(MARKETPLACE_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (sellerId) query = query.eq("seller_id", sellerId);
  if (businessId) query = query.eq("business_id", businessId);

  const { data, error } = await query;
  if (error) {
    console.error("Unable to load identity Marketplace listings:", error);
    return [];
  }

  return (data ?? [])
    .map((row: unknown) => row as Record<string, unknown>)
    .filter(marketplaceRowIsPublic)
    .map(normalizeMarketplaceListing);
}
