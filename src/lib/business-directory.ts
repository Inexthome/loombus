export type BusinessDirectoryStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected"
  | "suspended";

export type BusinessVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "denied";

export type BusinessService = {
  id: string;
  businessId: string;
  name: string;
  description: string;
  category: string;
  priceText: string;
  bookingUrl: string;
  serviceArea: string;
  status: "active" | "paused" | "archived";
  sortOrder: number;
};

export type BusinessProfile = {
  id: string;
  ownerId: string | null;
  slug: string;
  name: string;
  description: string;
  category: string;
  phone: string;
  contactEmail: string;
  websiteUrl: string;
  bookingUrl: string;
  logoUrl: string;
  coverImageUrl: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  serviceAreaMode: "storefront" | "mobile" | "online" | "hybrid";
  serviceRadiusMiles: number | null;
  serviceAreas: string[];
  showExactAddress: boolean;
  verificationStatus: BusinessVerificationStatus;
  status: BusinessDirectoryStatus;
  moderationReason: string;
  claimedAt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  services: BusinessService[];
};

export type BusinessClaim = {
  id: string;
  businessId: string;
  businessName: string;
  claimantId: string;
  claimantName: string;
  contactEmail: string;
  evidence: string;
  status: "pending" | "approved" | "rejected";
  decisionNote: string;
  createdAt: string | null;
};

export type BusinessReport = {
  id: string;
  businessId: string;
  businessName: string;
  reporterId: string;
  reason: string;
  details: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string | null;
};

export type BusinessManageResponse = {
  authenticated: boolean;
  isAdmin: boolean;
  businesses: BusinessProfile[];
  claims: BusinessClaim[];
  moderation: {
    pendingBusinesses: BusinessProfile[];
    pendingClaims: BusinessClaim[];
    openReports: BusinessReport[];
  };
};

export const BUSINESS_CATEGORIES = [
  "Automotive",
  "Beauty and wellness",
  "Childcare and education",
  "Construction and roofing",
  "Creative and media",
  "Dental",
  "Financial services",
  "Food and dining",
  "Healthcare",
  "Home improvement",
  "Insurance",
  "Legal services",
  "Pet services",
  "Professional services",
  "Real estate",
  "Retail",
  "Technology",
  "Transportation",
  "Other",
] as const;

export const BUSINESS_SERVICE_AREA_MODES = [
  { value: "storefront", label: "Customers visit this location" },
  { value: "mobile", label: "Business travels to customers" },
  { value: "online", label: "Online or remote service" },
  { value: "hybrid", label: "Location, mobile, and online" },
] as const;

export function businessLocationLabel(business: BusinessProfile) {
  const publicAddress = business.showExactAddress
    ? [business.addressLine1, business.addressLine2].filter(Boolean).join(", ")
    : "";

  return [
    publicAddress,
    business.city,
    business.region,
    business.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

export function businessServiceAreaLabel(business: BusinessProfile) {
  if (business.serviceAreas.length > 0) {
    return business.serviceAreas.join(" · ");
  }

  if (business.serviceAreaMode === "online") return "Online service";
  if (business.serviceRadiusMiles) {
    return `Within ${business.serviceRadiusMiles} miles`;
  }

  return businessLocationLabel(business) || "Service area not specified";
}
