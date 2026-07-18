export type ServiceRequestStatus =
  | "draft"
  | "pending"
  | "open"
  | "reviewing"
  | "in_progress"
  | "resolved"
  | "closed"
  | "rejected"
  | "suspended"
  | "removed";

export type ServiceRequestType =
  | "service_needed"
  | "recommendation"
  | "quote_request"
  | "community_help"
  | "volunteer_help"
  | "consultation"
  | "local_problem";

export type ServiceRequestUrgency = "normal" | "soon" | "urgent";
export type ServiceRequestMode =
  | "remote"
  | "requester_location"
  | "provider_location"
  | "flexible";

export type ServiceRequestResponseStatus =
  | "submitted"
  | "selected"
  | "declined"
  | "withdrawn";

export type PublicServiceRequest = {
  id: string;
  slug: string;
  requesterId: string;
  requesterName: string;
  requesterUsername: string | null;
  requesterAvatarUrl: string | null;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  title: string;
  description: string;
  requestType: ServiceRequestType;
  category: string;
  urgency: ServiceRequestUrgency;
  serviceMode: ServiceRequestMode;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  budgetType: "total" | "hourly" | "flexible";
  deadline: string | null;
  preferredStart: string | null;
  preferredEnd: string | null;
  tags: string[];
  attachmentUrls: string[];
  attachmentPaths: string[];
  attachmentTypes: string[];
  attachmentNames: string[];
  status: ServiceRequestStatus;
  moderationReason: string | null;
  selectedResponseId: string | null;
  responseCount: number;
  savedCount: number;
  viewerSaved: boolean;
  viewerCanManage: boolean;
  viewerHasResponded: boolean;
  publishedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRequestResponse = {
  id: string;
  requestId: string;
  requestTitle: string;
  requestSlug: string | null;
  responderId: string;
  responderName: string;
  responderUsername: string | null;
  responderAvatarUrl: string | null;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  message: string;
  availabilityText: string | null;
  estimateMin: number | null;
  estimateMax: number | null;
  currency: string;
  appointmentServiceId: string | null;
  appointmentServiceName: string | null;
  status: ServiceRequestResponseStatus;
  conversationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceRequestManageResponse = {
  businesses: Array<{ id: string; name: string; slug: string }>;
  appointmentServices: Array<{
    id: string;
    businessId: string;
    businessName: string;
    name: string;
    durationMinutes: number;
    status: string;
  }>;
  requests: PublicServiceRequest[];
  receivedResponses: ServiceRequestResponse[];
  sentResponses: ServiceRequestResponse[];
  reports: Array<{
    id: string;
    requestId: string;
    requestTitle: string;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
  }>;
  metrics: {
    pending: number;
    open: number;
    reviewing: number;
    inProgress: number;
    resolved: number;
    openReports: number;
  };
  isAdmin: boolean;
};

export type ServiceRequestsDirectoryResponse = {
  requests: PublicServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
  authenticated: boolean;
  isAdmin: boolean;
};

export const SERVICE_REQUEST_TYPES: Array<{
  value: ServiceRequestType;
  label: string;
  description: string;
}> = [
  { value: "service_needed", label: "Service needed", description: "Find a member or business that can perform a specific service." },
  { value: "quote_request", label: "Quote or estimate", description: "Describe the work and invite attributable estimates." },
  { value: "recommendation", label: "Recommendation", description: "Ask for a focused recommendation based on real experience." },
  { value: "consultation", label: "Consultation", description: "Request professional or subject-matter guidance." },
  { value: "community_help", label: "Community help", description: "Ask for practical help from the broader community." },
  { value: "volunteer_help", label: "Volunteer help", description: "Organize a volunteer need without turning it into a paid listing." },
  { value: "local_problem", label: "Local problem", description: "Surface a local issue that needs an accountable solution." },
];

export const SERVICE_REQUEST_CATEGORIES = [
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

export function requestTypeLabel(value: ServiceRequestType) {
  return SERVICE_REQUEST_TYPES.find((type) => type.value === value)?.label ?? "Request";
}

export function requestModeLabel(value: ServiceRequestMode) {
  if (value === "remote") return "Remote or online";
  if (value === "requester_location") return "At requester location";
  if (value === "provider_location") return "At provider location";
  return "Flexible location";
}

export function requestUrgencyLabel(value: ServiceRequestUrgency) {
  if (value === "urgent") return "Urgent";
  if (value === "soon") return "Needed soon";
  return "Normal timing";
}

export function formatRequestBudget(
  request: Pick<PublicServiceRequest, "budgetMin" | "budgetMax" | "currency" | "budgetType">,
) {
  if (request.budgetMin === null && request.budgetMax === null) return "Budget not stated";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: request.currency || "USD",
    maximumFractionDigits: 2,
  });
  const suffix = request.budgetType === "hourly" ? " per hour" : "";
  if (request.budgetMin !== null && request.budgetMax !== null) {
    return `${formatter.format(request.budgetMin)} to ${formatter.format(request.budgetMax)}${suffix}`;
  }
  if (request.budgetMin !== null) return `From ${formatter.format(request.budgetMin)}${suffix}`;
  return `Up to ${formatter.format(request.budgetMax ?? 0)}${suffix}`;
}

export function requestLocationLabel(
  request: Pick<PublicServiceRequest, "serviceMode" | "city" | "region">,
) {
  if (request.serviceMode === "remote") return "Remote or online";
  return [request.city, request.region].filter(Boolean).join(", ") || requestModeLabel(request.serviceMode);
}

export function formatRequestDate(value: string | null) {
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
