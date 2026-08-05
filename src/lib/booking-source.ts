export const BOOKING_SOURCE_TYPES = [
  "business",
  "provider_service",
  "marketplace_listing",
  "service_request",
  "room",
  "room_resource",
  "public_event",
  "local_listing",
] as const;

export type BookingSourceType = (typeof BOOKING_SOURCE_TYPES)[number];

export type BookingSource = {
  type: BookingSourceType;
  id: string;
  label: string;
  href: string | null;
};

export type BookingActionKind =
  | "book_appointment"
  | "schedule_consultation"
  | "schedule_service"
  | "schedule_pickup"
  | "arrange_meetup"
  | "reserve_time"
  | "reserve_facility"
  | "reserve_time_slot";

export function isBookingSourceType(value: unknown): value is BookingSourceType {
  return (
    typeof value === "string" &&
    (BOOKING_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

export function bookingActionLabel(action: BookingActionKind) {
  switch (action) {
    case "schedule_consultation":
      return "Schedule consultation";
    case "schedule_service":
      return "Schedule service";
    case "schedule_pickup":
      return "Schedule pickup";
    case "arrange_meetup":
      return "Arrange meetup";
    case "reserve_time":
      return "Reserve time";
    case "reserve_facility":
      return "Reserve facility";
    case "reserve_time_slot":
      return "Reserve time slot";
    default:
      return "Book appointment";
  }
}

export function businessBookingSource(input: {
  id: string;
  name: string;
  slug: string;
}): BookingSource {
  return {
    type: "business",
    id: input.id,
    label: input.name,
    href: `/businesses/${input.slug}`,
  };
}
