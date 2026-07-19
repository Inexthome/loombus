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
  value: MarketplaceDraft[K],
) => void;

export const marketplaceInputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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
  listing: MarketplaceListing,
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
  const savedAttributes = saved.attributes;
  const sourceAttributes = Array.isArray(savedAttributes)
    ? savedAttributes
    : Object.entries(listing.attributes).map(([key, value]) => ({ key, value }));

  for (const row of sourceAttributes) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    attributes.push({
      id: crypto.randomUUID(),
      key: String(record.key ?? ""),
      value: String(record.value ?? ""),
    });
  }

  return {
    businessId: savedText("businessId", listing.businessId ?? ""),
    title: savedText("title", listing.title),
    description: savedText("description", listing.description),
    category: savedText("category", listing.category),
    condition: savedText("condition", listing.condition),
    price: savedText("price", listing.isFree ? "" : String(listing.price)),
    currency: savedText("currency", listing.currency),
    isFree: savedBoolean("isFree", listing.isFree),
    isNegotiable: savedBoolean("isNegotiable", listing.isNegotiable),
    city: savedText("city", listing.city),
    region: savedText("region", listing.region),
    postalCode: savedText("postalCode", listing.postalCode),
    countryCode: savedText("countryCode", listing.countryCode),
    pickupAvailable: savedBoolean("pickupAvailable", listing.pickupAvailable),
    localDeliveryAvailable: savedBoolean(
      "localDeliveryAvailable",
      listing.localDeliveryAvailable,
    ),
    shippingAvailable: savedBoolean("shippingAvailable", listing.shippingAvailable),
    tags: savedText("tags", listing.tags.join("\n")),
    attributes,
    photos: listing.photos,
    expiresAt: savedText("expiresAt", listing.expiresAt?.slice(0, 10) ?? ""),
  };
}

export function parseMarketplaceTags(value: string) {
  return [...new Set(value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30);
}

export function buildMarketplaceAttributes(rows: AttributeRow[]) {
  return Object.fromEntries(
    rows
      .map((row) => [row.key.trim(), row.value.trim()] as const)
      .filter(([key, value]) => key && value),
  );
}

export async function marketplaceApiAction(body: Record<string, unknown>) {
  const response = await marketplaceAuthorizedFetch("/api/marketplace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Marketplace action failed.");
  return payload;
}
