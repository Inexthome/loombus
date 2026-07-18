export type ProviderServiceStatus =
  | "draft"
  | "pending"
  | "published"
  | "paused"
  | "rejected"
  | "archived"
  | "removed";

export type ProviderServiceMode =
  | "remote"
  | "requester_location"
  | "provider_location"
  | "flexible";

export type ProviderServicePriceType =
  | "fixed"
  | "range"
  | "hourly"
  | "contact";

export type ProviderServiceInquiryStatus =
  | "submitted"
  | "accepted"
  | "declined"
  | "cancelled"
  | "closed";

export type PublicProviderService = {
  id: string;
  slug: string;
  providerId: string;
  providerName: string;
  providerUsername: string | null;
  providerAvatarUrl: string | null;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  appointmentServiceId: string | null;
  appointmentServiceName: string | null;
  title: string;
  description: string;
  category: string;
  specialties: string[];
  serviceMode: ProviderServiceMode;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  priceType: ProviderServicePriceType;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  typicalDurationMinutes: number | null;
  responseExpectation: string | null;
  availabilityText: string | null;
  attachmentUrls: string[];
  attachmentPaths: string[];
  attachmentTypes: string[];
  attachmentNames: string[];
  status: ProviderServiceStatus;
  moderationReason: string | null;
  inquiryCount: number;
  savedCount: number;
  viewerSaved: boolean;
  viewerCanManage: boolean;
  viewerHasInquiry: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderServiceInquiry = {
  id: string;
  serviceId: string;
  serviceTitle: string;
  serviceSlug: string | null;
  providerId: string;
  requesterId: string;
  requesterName: string;
  requesterUsername: string | null;
  requesterAvatarUrl: string | null;
  linkedRequestId: string | null;
  linkedRequestTitle: string | null;
  linkedRequestSlug: string | null;
  message: string;
  preferredStart: string | null;
  preferredEnd: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  status: ProviderServiceInquiryStatus;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderServicesDirectoryResponse = {
  services: PublicProviderService[];
  total: number;
  page: number;
  pageSize: number;
  authenticated: boolean;
  isAdmin: boolean;
};

export type ProviderServicesManageResponse = {
  businesses: Array<{ id: string; name: string; slug: string }>;
  appointmentServices: Array<{
    id: string;
    businessId: string;
    businessName: string;
    name: string;
    durationMinutes: number;
    status: string;
  }>;
  services: PublicProviderService[];
  receivedInquiries: ProviderServiceInquiry[];
  sentInquiries: ProviderServiceInquiry[];
  matchingRequests: Array<{
    id: string;
    slug: string;
    title: string;
    description: string;
    category: string;
    urgency: string;
    serviceMode: string;
    city: string | null;
    region: string | null;
    budgetMin: number | null;
    budgetMax: number | null;
    currency: string;
    budgetType: string;
  }>;
  reports: Array<{
    id: string;
    serviceId: string;
    serviceTitle: string;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
  }>;
  metrics: {
    pending: number;
    published: number;
    paused: number;
    inquiries: number;
    accepted: number;
    openReports: number;
  };
  isAdmin: boolean;
};

export const PROVIDER_SERVICE_CATEGORIES = [
  "Home and property",
  "Professional services",
  "Technology",
  "Education and tutoring",
  "Health and wellness",
  "Transportation",
  "Events and hospitality",
  "Creative work",
  "Community and civic",
  "Family and caregiving",
  "Business operations",
  "Other",
] as const;

export function providerServiceModeLabel(value: ProviderServiceMode) {
  if (value === "remote") return "Remote or online";
  if (value === "requester_location") return "At customer location";
  if (value === "provider_location") return "At provider location";
  return "Flexible location";
}

export function providerServiceLocationLabel(
  service: Pick<PublicProviderService, "serviceMode" | "city" | "region">,
) {
  if (service.serviceMode === "remote") return "Remote or online";
  const place = [service.city, service.region].filter(Boolean).join(", ");
  return place || providerServiceModeLabel(service.serviceMode);
}

export function formatProviderServicePrice(
  service: Pick<
    PublicProviderService,
    "priceType" | "priceMin" | "priceMax" | "currency"
  >,
) {
  if (service.priceType === "contact") return "Contact for pricing";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: service.currency || "USD",
    maximumFractionDigits: 2,
  });
  const suffix = service.priceType === "hourly" ? " per hour" : "";
  if (service.priceType === "fixed" && service.priceMin !== null) {
    return `${formatter.format(service.priceMin)}${suffix}`;
  }
  if (service.priceMin !== null && service.priceMax !== null) {
    return `${formatter.format(service.priceMin)} to ${formatter.format(service.priceMax)}${suffix}`;
  }
  if (service.priceMin !== null) {
    return `From ${formatter.format(service.priceMin)}${suffix}`;
  }
  if (service.priceMax !== null) {
    return `Up to ${formatter.format(service.priceMax)}${suffix}`;
  }
  return "Contact for pricing";
}

export function formatProviderServiceDuration(minutes: number | null) {
  if (!minutes) return "Duration varies";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours} hr ${remainder} min`
    : `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function formatProviderServiceDate(value: string | null) {
  if (!value) return "Not specified";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not specified";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
