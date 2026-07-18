import type { MarketplaceListing, MarketplacePhoto } from "@/lib/marketplace";
import { marketplaceAuthorizedFetch } from "@/lib/marketplace-auth-client";

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
  const saved =
    listing.status === "draft" &&
    listing.draftData &&
    typeof listing.draftData === "object" &&
    !Array.isArray(listing.draftData)
      ? listing.draftData
      : {};

  const savedText = (key: string, fallback: string) =>
    typeof saved[key] === "string" ? (saved[key] as string) : fallback;

  const savedBoolean = (key: string, fallback: boolean) =>
    typeof saved[key] === "boolean" ? (saved[key] as boolean) : fallback;

  const attributes: AttributeRow[] = [];

  if (Array.isArray(saved.attributes)) {
    for (const item of saved.attributes) {
      const row =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : {};

      attributes.push({
        id: crypto.randomUUID(),
        key: typeof row.key === "string" ? row.key : "",
        value: typeof row.value === "string" ? row.value : "",
      });
    }
  } else {
    for (const [key, value] of Object.entries(listing.attributes)) {
      attributes.push({
        id: crypto.randomUUID(),
        key,
        value,
      });
    }
  }

  return {
    businessId: savedText("businessId", listing.businessId ?? ""),
    title: savedText("title", listing.title),
    description: savedText("description", listing.description),
    category: savedText("category", listing.category),
    condition: savedText("condition", listing.condition),
    price: savedText(
      "price",
      listing.isFree ? "" : String(listing.price)
    ),
    currency: savedText("currency", listing.currency),
    isFree: savedBoolean("isFree", listing.isFree),
    isNegotiable: savedBoolean(
      "isNegotiable",
      listing.isNegotiable
    ),
    city: savedText("city", listing.city),
    region: savedText("region", listing.region),
    postalCode: savedText("postalCode", listing.postalCode),
    countryCode: savedText("countryCode", listing.countryCode),
    pickupAvailable: savedBoolean(
      "pickupAvailable",
      listing.pickupAvailable
    ),
    localDeliveryAvailable: savedBoolean(
      "localDeliveryAvailable",
      listing.localDeliveryAvailable
    ),
    shippingAvailable: savedBoolean(
      "shippingAvailable",
      listing.shippingAvailable
    ),
    tags: savedText("tags", listing.tags.join("\n")),
    attributes,
    photos: listing.photos,
    expiresAt: savedText(
      "expiresAt",
      listing.expiresAt?.slice(0, 10) ?? ""
    ),
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
  const response = await marketplaceAuthorizedFetch("/api/marketplace", {
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
