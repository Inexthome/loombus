import "server-only";

import { asBoolean } from "@/lib/room-operations";
import type {
  MarketplaceCondition,
  MarketplaceListing,
  MarketplaceListingStatus,
  MarketplacePhoto,
} from "@/lib/marketplace";
import {
  cleanLongText,
  cleanMarketplaceText,
  nestedRow,
  nullableNumber,
} from "@/lib/marketplace-server-core";

export function normalizeMarketplaceListing(
  row: Record<string, unknown>
): MarketplaceListing {
  const seller = nestedRow(row, "profiles");
  const business = nestedRow(row, "businesses");
  const condition = cleanMarketplaceText(row.item_condition, 30);
  const status = cleanMarketplaceText(row.status, 20);
  const photoUrls = Array.isArray(row.photo_urls) ? row.photo_urls : [];
  const photoPaths = Array.isArray(row.photo_paths) ? row.photo_paths : [];
  const photos: MarketplacePhoto[] = photoUrls
    .map((value, index) => ({
      url: cleanMarketplaceText(value, 2048),
      path: cleanMarketplaceText(photoPaths[index], 500),
    }))
    .filter((photo) => photo.url && photo.path);

  const rawAttributes =
    row.attributes && typeof row.attributes === "object" && !Array.isArray(row.attributes)
      ? (row.attributes as Record<string, unknown>)
      : {};

  return {
    id: cleanMarketplaceText(row.id, 60),
    sellerId: cleanMarketplaceText(row.seller_id, 60),
    sellerName:
      cleanMarketplaceText(row.seller_name, 160) ||
      cleanMarketplaceText(seller.full_name, 160) ||
      cleanMarketplaceText(seller.username, 100) ||
      "Loombus member",
    sellerUsername:
      cleanMarketplaceText(row.seller_username, 100) ||
      cleanMarketplaceText(seller.username, 100),
    sellerAvatarUrl:
      cleanMarketplaceText(row.seller_avatar_url, 2048) ||
      cleanMarketplaceText(seller.avatar_url, 2048),
    businessId: cleanMarketplaceText(row.business_id, 60) || null,
    businessName:
      cleanMarketplaceText(row.business_name, 200) ||
      cleanMarketplaceText(business.name, 200),
    businessSlug:
      cleanMarketplaceText(row.business_slug, 100) ||
      cleanMarketplaceText(business.slug, 100),
    businessLogoUrl:
      cleanMarketplaceText(row.business_logo_url, 2048) ||
      cleanMarketplaceText(business.logo_url, 2048),
    businessVerificationStatus:
      cleanMarketplaceText(row.business_verification_status, 20) ||
      cleanMarketplaceText(business.verification_status, 20),
    businessStatus:
      cleanMarketplaceText(row.business_status, 20) ||
      cleanMarketplaceText(business.status, 20),
    slug: cleanMarketplaceText(row.slug, 100),
    title: cleanMarketplaceText(row.title, 200),
    description: cleanLongText(row.description, 16000),
    category: cleanMarketplaceText(row.category, 120),
    condition: (
      ["new", "like_new", "good", "fair", "for_parts", "not_applicable"].includes(
        condition
      )
        ? condition
        : "good"
    ) as MarketplaceCondition,
    price: nullableNumber(row.price),
    currency: cleanMarketplaceText(row.currency, 3).toUpperCase() || "USD",
    isFree: asBoolean(row.is_free),
    isNegotiable: asBoolean(row.is_negotiable),
    city: cleanMarketplaceText(row.city, 100),
    region: cleanMarketplaceText(row.region, 100),
    postalCode: cleanMarketplaceText(row.postal_code, 30),
    countryCode: cleanMarketplaceText(row.country_code, 2).toUpperCase() || "US",
    pickupAvailable: asBoolean(row.pickup_available),
    localDeliveryAvailable: asBoolean(row.local_delivery_available),
    shippingAvailable: asBoolean(row.shipping_available),
    tags: Array.isArray(row.tags)
      ? row.tags.map((item) => cleanMarketplaceText(item, 120)).filter(Boolean)
      : [],
    attributes: (() => {
      const values: Record<string, string> = {};
      for (const [rawKey, rawValue] of Object.entries(rawAttributes)) {
        const key = cleanMarketplaceText(rawKey, 80);
        const value = cleanMarketplaceText(rawValue, 300);
        if (key && value) values[key] = value;
      }
      return values;
    })(),
    photos,
    expiresAt: cleanMarketplaceText(row.expires_at, 60) || null,
    status: (
      [
        "draft",
        "pending",
        "published",
        "rejected",
        "suspended",
        "sold",
        "expired",
        "removed",
      ].includes(status)
        ? status
        : "pending"
    ) as MarketplaceListingStatus,
    moderationReason: cleanLongText(row.moderation_reason, 2000),
    publishedAt: cleanMarketplaceText(row.published_at, 60) || null,
    soldAt: cleanMarketplaceText(row.sold_at, 60) || null,
    removedAt: cleanMarketplaceText(row.removed_at, 60) || null,
    createdAt: cleanMarketplaceText(row.created_at, 60) || null,
    updatedAt: cleanMarketplaceText(row.updated_at, 60) || null,
  };
}

export const MARKETPLACE_SELECT = `
  id,
  seller_id,
  business_id,
  slug,
  title,
  description,
  category,
  item_condition,
  price,
  currency,
  is_free,
  is_negotiable,
  city,
  region,
  postal_code,
  country_code,
  pickup_available,
  local_delivery_available,
  shipping_available,
  tags,
  attributes,
  photo_urls,
  photo_paths,
  expires_at,
  status,
  moderation_reason,
  published_at,
  sold_at,
  removed_at,
  created_at,
  updated_at,
  profiles!marketplace_listings_seller_id_fkey (
    id,
    full_name,
    username,
    avatar_url,
    account_status,
    suspended_until
  ),
  businesses (
    id,
    owner_id,
    slug,
    name,
    logo_url,
    verification_status,
    status
  )
`;
