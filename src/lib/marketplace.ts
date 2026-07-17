export type MarketplaceListingStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "suspended"
  | "sold"
  | "expired"
  | "removed";

export type MarketplaceCondition =
  | "new"
  | "like_new"
  | "good"
  | "fair"
  | "for_parts"
  | "not_applicable";

export type MarketplacePhoto = {
  url: string;
  path: string;
};

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerUsername: string;
  sellerAvatarUrl: string;
  businessId: string | null;
  businessName: string;
  businessSlug: string;
  businessLogoUrl: string;
  businessVerificationStatus: string;
  businessStatus: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  condition: MarketplaceCondition;
  price: number;
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
  tags: string[];
  attributes: Record<string, string>;
  photos: MarketplacePhoto[];
  expiresAt: string | null;
  status: MarketplaceListingStatus;
  moderationReason: string;
  publishedAt: string | null;
  soldAt: string | null;
  removedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MarketplaceBusinessOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  verificationStatus: string;
  status: string;
};

export type MarketplaceReport = {
  id: string;
  listingId: string;
  listingTitle: string;
  reporterId: string;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string | null;
};

export type MarketplaceDirectoryResponse = {
  listings: MarketplaceListing[];
  total: number;
  page: number;
  pageSize: number;
  directoryActive: boolean;
};

export type MarketplaceManageResponse = {
  authenticated: boolean;
  isAdmin: boolean;
  businesses: MarketplaceBusinessOption[];
  listings: MarketplaceListing[];
  moderation: {
    pendingListings: MarketplaceListing[];
    openReports: MarketplaceReport[];
  };
};

export const MARKETPLACE_CATEGORIES = [
  "Appliances",
  "Arts and collectibles",
  "Baby and kids",
  "Books and media",
  "Clothing and accessories",
  "Electronics",
  "Furniture",
  "Garden and outdoor",
  "Home improvement",
  "Home goods",
  "Musical instruments",
  "Office and business",
  "Pet supplies",
  "Sports and recreation",
  "Tools and equipment",
  "Toys and games",
  "Other",
] as const;

export const MARKETPLACE_CONDITIONS: Array<{
  value: MarketplaceCondition;
  label: string;
}> = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For parts or repair" },
  { value: "not_applicable", label: "Not applicable" },
];

export function marketplaceConditionLabel(value: MarketplaceCondition) {
  return (
    MARKETPLACE_CONDITIONS.find((item) => item.value === value)?.label ??
    "Condition not specified"
  );
}

export function marketplaceStatusLabel(status: MarketplaceListingStatus) {
  if (status === "pending") return "Pending review";
  if (status === "published") return "Published";
  if (status === "rejected") return "Changes requested";
  if (status === "suspended") return "Suspended";
  if (status === "sold") return "Sold";
  if (status === "expired") return "Expired";
  if (status === "removed") return "Removed";
  return "Draft";
}

export function marketplacePriceLabel(listing: MarketplaceListing) {
  if (listing.isFree) return "Free";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: listing.currency || "USD",
      maximumFractionDigits: Number.isInteger(listing.price) ? 0 : 2,
    }).format(listing.price);
  } catch {
    return `${listing.currency || "USD"} ${listing.price.toLocaleString()}`;
  }
}

export function marketplaceLocationLabel(listing: MarketplaceListing) {
  return (
    [listing.city, listing.region, listing.postalCode]
      .filter(Boolean)
      .join(", ") || "Location not specified"
  );
}

export function marketplaceFulfillmentLabels(listing: MarketplaceListing) {
  return [
    listing.pickupAvailable ? "Pickup" : "",
    listing.localDeliveryAvailable ? "Local delivery" : "",
    listing.shippingAvailable ? "Shipping" : "",
  ].filter(Boolean);
}

export function formatMarketplaceDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
