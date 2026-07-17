import type { MarketplaceListing, MarketplacePhoto } from "@/lib/marketplace";

export type AttributeRow = { id: string; key: string; value: string };

export type MarketplaceDraft = {
  businessId: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  price: string;
  currency: string;
  isFree: boolean;
  isNegotiable: boolean;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  pickupAvailable: boolean;
  localDeliveryAvailable: boolean;
  shippingAvailable: boolean;
  tags: string;
  attributes: AttributeRow[];
  photos: MarketplacePhoto[];
  expiresAt: string;
};

export type UpdateMarketplaceDraft = <K extends keyof MarketplaceDraft>(
  key: K,
  value: MarketplaceDraft[K]
) => void;

export const marketplaceInputClass =
  "w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 outline-none";

export function emptyMarketplaceDraft(): MarketplaceDraft {
  return {
    businessId: "",
    title: "",
    description: "",
    category: "",
    condition: "good",
    price: "",
    currency: "USD",
    isFree: false,
    isNegotiable: false,
    city: "",
    region: "",
    postalCode: "",
    countryCode: "US",
    pickupAvailable: true,
    localDeliveryAvailable: false,
    shippingAvailable: false,
    tags: "",
    attributes: [],
    photos: [],
    expiresAt: "",
  };
}

export function marketplaceDraftFromListing(
  listing: MarketplaceListing
): MarketplaceDraft {
  return {
    businessId: listing.businessId ?? "",
    title: listing.title,
    description: listing.description,
    category: listing.category,
    condition: listing.condition,
    price: listing.isFree ? "" : String(listing.price),
    currency: listing.currency,
    isFree: listing.isFree,
    isNegotiable: listing.isNegotiable,
    city: listing.city,
    region: listing.region,
    postalCode: listing.postalCode,
    countryCode: listing.countryCode,
    pickupAvailable: listing.pickupAvailable,
    localDeliveryAvailable: listing.localDeliveryAvailable,
    shippingAvailable: listing.shippingAvailable,
    tags: listing.tags.join("\n"),
    attributes: Object.entries(listing.attributes).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value,
    })),
    photos: listing.photos,
    expiresAt: listing.expiresAt?.slice(0, 10) ?? "",
  };
}

export function parseMarketplaceTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
}

export function buildMarketplaceAttributes(rows: AttributeRow[]) {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (key && value) result[key] = value;
  }
  return result;
}

export async function marketplaceApiAction(body: Record<string, unknown>) {
  const response = await fetch("/api/marketplace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as Record<string, unknown> & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Marketplace request failed.");
  }
  return payload;
}
