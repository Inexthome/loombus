export type PublicEventStatus =
  | "pending"
  | "published"
  | "rejected"
  | "cancelled"
  | "completed"
  | "removed";

export type EventResponse = "going" | "interested";
export type EventFormat = "in_person" | "online" | "hybrid";

export type PublicEvent = {
  id: string;
  slug: string;
  organizerId: string;
  organizerName: string;
  organizerUsername: string | null;
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
  title: string;
  description: string;
  category: string;
  format: EventFormat;
  venueName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string;
  onlineUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  capacity: number | null;
  isFree: boolean;
  priceText: string | null;
  registrationUrl: string | null;
  status: PublicEventStatus;
  moderationReason: string | null;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  goingCount: number;
  interestedCount: number;
  viewerResponse: EventResponse | null;
  viewerCanManage: boolean;
};

export type EventsDirectoryResponse = {
  events: PublicEvent[];
  authenticated: boolean;
  isAdmin: boolean;
};

export type EventsManageResponse = {
  businesses: Array<{ id: string; name: string; slug: string }>;
  events: PublicEvent[];
  reports: Array<{
    id: string;
    eventId: string;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
    eventTitle: string;
  }>;
  isAdmin: boolean;
};

export type AppointmentService = {
  id: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  ownerId: string;
  name: string;
  description: string;
  durationMinutes: number;
  locationMode: "in_person" | "online" | "phone" | "flexible";
  locationText: string | null;
  priceText: string | null;
  instructions: string | null;
  status: "active" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type AppointmentRequest = {
  id: string;
  serviceId: string;
  serviceName: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  providerId: string;
  requesterId: string;
  requesterName: string;
  requestedStart: string;
  requestedEnd: string;
  proposedStart: string | null;
  proposedEnd: string | null;
  timezone: string;
  note: string | null;
  providerNote: string | null;
  status:
    | "pending"
    | "accepted"
    | "declined"
    | "reschedule_proposed"
    | "cancelled"
    | "completed";
  createdAt: string;
  updatedAt: string;
  actedAt: string | null;
};

export type CalendarItem = {
  id: string;
  source: "public_event" | "room_event" | "appointment";
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  location: string | null;
  status: string;
  href: string;
  context: string;
  response?: EventResponse | null;
};

export function formatEventDateRange(
  startsAt: string,
  endsAt: string | null,
  timezone?: string
) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  };
  const start = new Intl.DateTimeFormat(undefined, options).format(new Date(startsAt));
  if (!endsAt) return start;
  const end = new Intl.DateTimeFormat(undefined, options).format(new Date(endsAt));
  return `${start} to ${end}`;
}

export function eventLocationLabel(event: PublicEvent) {
  if (event.format === "online") return "Online";
  const parts = [event.venueName, event.city, event.region].filter(Boolean);
  if (event.format === "hybrid") return parts.length ? `${parts.join(", ")} + online` : "Hybrid";
  return parts.join(", ") || "Location announced by organizer";
}

export function eventPriceLabel(event: PublicEvent) {
  return event.isFree ? "Free" : event.priceText || "See registration details";
}
