import "server-only";

import type { NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import {
  asBoolean,
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import {
  MarketplaceError,
  type MarketplaceInput,
  cleanAttributes,
  cleanExpiry,
  cleanMoney,
  cleanOptionalUuid,
  cleanPhotos,
  cleanStringArray,
  cleanMarketplaceText,
  cleanLongText,
  enforceMarketplacePolicy,
  slugifyMarketplace,
} from "@/lib/marketplace-server-core";

export type MarketplaceViewer = {
  user: User | null;
  isAdmin: boolean;
  service: SupabaseClient;
};

export async function resolveMarketplaceViewer(
  request: NextRequest,
  requireUser = false
): Promise<MarketplaceViewer> {
  const requestClient = createRequestSupabase(request);
  const service = createRoomServiceSupabase();
  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (!user) {
    if (requireUser) {
      throw new MarketplaceError(
        "Sign in to use Loombus Marketplace.",
        401,
        "authentication_required"
      );
    }
    return { user: null, isAdmin: false, service };
  }

  const { data: profile, error } = await service
    .from("profiles")
    .select("is_admin, account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    throw new MarketplaceError(
      "Unable to verify Marketplace access.",
      503,
      "marketplace_access_unavailable"
    );
  }

  const enforcement = getAccountEnforcementResult(profile);
  if (!enforcement.allowed) {
    throw new MarketplaceError(
      enforcement.errorMessage ?? "Account access is restricted.",
      403,
      enforcement.code ?? "account_restricted"
    );
  }

  return { user, isAdmin: Boolean(profile.is_admin), service };
}

export async function refreshExpiredListings(service: SupabaseClient) {
  const { error } = await service.rpc("expire_marketplace_listings");
  if (!error) return;
  const missing =
    error.code === "42883" ||
    /expire_marketplace_listings|schema cache|could not find the function/i.test(
      error.message ?? ""
    );
  if (!missing) console.error("Unable to expire Marketplace listings:", error);
}

export function missingMarketplaceSchema(error: {
  code?: string | null;
  message?: string | null;
}) {
  return (
    error.code === "42P01" ||
    /marketplace_listings|marketplace_reports|search_public_marketplace.*does not exist/i.test(
      error.message ?? ""
    )
  );
}

export function requireMarketplacePhotoOrigins(
  service: SupabaseClient,
  urls: string[],
  paths: string[]
) {
  for (let index = 0; index < paths.length; index += 1) {
    const { data } = service.storage
      .from("marketplace-images")
      .getPublicUrl(paths[index]);
    const expectedUrl = new URL(data.publicUrl).toString();
    const submittedUrl = new URL(urls[index]).toString();
    if (submittedUrl !== expectedUrl) {
      throw new MarketplaceError(
        "Marketplace photos must come from the protected listing uploader.",
        400,
        "invalid_photo_source"
      );
    }
  }
}

export function normalizeInput(input: MarketplaceInput, userId: string) {
  const title = cleanMarketplaceText(input.title, 200);
  const description = cleanLongText(input.description, 16000);
  const category = cleanMarketplaceText(input.category, 120);
  const condition = cleanMarketplaceText(input.condition, 30) || "good";
  const isFree = asBoolean(input.isFree);
  const price = isFree ? 0 : cleanMoney(input.price);
  const currency = (
    cleanMarketplaceText(input.currency, 3) || "USD"
  ).toUpperCase();
  const tags = cleanStringArray(input.tags, 120);
  const attributes = cleanAttributes(input.attributes);
  const photos = cleanPhotos(input, userId);
  const pickupAvailable = asBoolean(input.pickupAvailable);
  const localDeliveryAvailable = asBoolean(input.localDeliveryAvailable);
  const shippingAvailable = asBoolean(input.shippingAvailable);
  const expiresAt = cleanExpiry(input.expiresAt);

  if (title.length < 3) {
    throw new MarketplaceError(
      "Add a clear listing title.",
      400,
      "listing_title_required"
    );
  }
  if (description.length < 30) {
    throw new MarketplaceError(
      "Describe the item in at least 30 characters.",
      400,
      "listing_description_required"
    );
  }
  if (!category) {
    throw new MarketplaceError(
      "Choose a Marketplace category.",
      400,
      "listing_category_required"
    );
  }
  if (
    !["new", "like_new", "good", "fair", "for_parts", "not_applicable"].includes(
      condition
    )
  ) {
    throw new MarketplaceError(
      "Choose a valid item condition.",
      400,
      "invalid_condition"
    );
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new MarketplaceError(
      "Use a three-letter currency such as USD.",
      400,
      "invalid_currency"
    );
  }
  if (!pickupAvailable && !localDeliveryAvailable && !shippingAvailable) {
    throw new MarketplaceError(
      "Choose pickup, local delivery, or shipping.",
      400,
      "fulfillment_required"
    );
  }
  const city = cleanMarketplaceText(input.city, 100);
  const region = cleanMarketplaceText(input.region, 100);
  if ((pickupAvailable || localDeliveryAvailable) && !city && !region) {
    throw new MarketplaceError(
      "Add a city or region for pickup or local delivery.",
      400,
      "listing_location_required"
    );
  }
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw new MarketplaceError(
      "The listing expiration date must be in the future.",
      400,
      "listing_expiration_past"
    );
  }

  enforceMarketplacePolicy([title, description, category, tags, attributes]);

  return {
    businessId: cleanOptionalUuid(input.businessId, "business id"),
    row: {
      title,
      description,
      category,
      item_condition: condition,
      price,
      currency,
      is_free: isFree,
      is_negotiable: !isFree && asBoolean(input.isNegotiable),
      city,
      region,
      postal_code: cleanMarketplaceText(input.postalCode, 30),
      country_code: (
        cleanMarketplaceText(input.countryCode, 2) || "US"
      ).toUpperCase(),
      pickup_available: pickupAvailable,
      local_delivery_available: localDeliveryAvailable,
      shipping_available: shippingAvailable,
      tags,
      attributes,
      photo_urls: photos.urls,
      photo_paths: photos.paths,
      expires_at: expiresAt,
    },
  };
}

export async function requireBusinessAttribution(
  viewer: MarketplaceViewer,
  businessId: string | null
) {
  if (!businessId) return null;
  const { data, error } = await viewer.service
    .from("businesses")
    .select("id, owner_id, name, slug, status, verification_status")
    .eq("id", businessId)
    .maybeSingle();
  if (error) {
    throw new MarketplaceError(
      "Unable to verify the business attribution.",
      503,
      "business_access_unavailable"
    );
  }
  if (!data) {
    throw new MarketplaceError(
      "Business profile not found.",
      404,
      "business_not_found"
    );
  }
  if (cleanMarketplaceText(data.owner_id, 60) !== viewer.user!.id) {
    throw new MarketplaceError(
      "You may attribute a listing only to a business profile you control.",
      403,
      "business_forbidden"
    );
  }
  if (cleanMarketplaceText(data.status, 20) !== "published") {
    throw new MarketplaceError(
      "The business profile must be approved and published before attribution.",
      409,
      "business_not_approved"
    );
  }
  return data as Record<string, unknown>;
}

export async function requireListingControl(
  viewer: MarketplaceViewer,
  listingId: string
) {
  const { data, error } = await viewer.service
    .from("marketplace_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (error) {
    throw new MarketplaceError(
      "Unable to verify the Marketplace listing.",
      503,
      "listing_access_unavailable"
    );
  }
  if (!data) {
    throw new MarketplaceError("Listing not found.", 404, "listing_not_found");
  }
  if (cleanMarketplaceText(data.seller_id, 60) !== viewer.user!.id) {
    throw new MarketplaceError(
      "Only the original seller may edit this listing.",
      403,
      "listing_forbidden"
    );
  }
  return data as Record<string, unknown>;
}

export async function uniqueListingSlug(service: SupabaseClient, title: string) {
  const base = slugifyMarketplace(title);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug =
      attempt === 0
        ? `${base}-${crypto.randomUUID().slice(0, 7)}`
        : `${base.slice(0, 60)}-${crypto.randomUUID().slice(0, 11)}`;
    const { data } = await service
      .from("marketplace_listings")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
  }
  return `${base.slice(0, 54)}-${crypto.randomUUID().slice(0, 16)}`;
}
