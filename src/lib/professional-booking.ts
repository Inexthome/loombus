import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export type ProfessionalBookingAvailabilityWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

export type ProfessionalBookingSettings = {
  timezone: string;
  weeklyAvailability: ProfessionalBookingAvailabilityWindow[];
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
};

export type ProfessionalBookingAvailabilityResponse = {
  subscriptionPlan: SubscriptionPlanId;
  canUseProfessionalBooking: boolean;
  subscriptionResolutionAvailable: boolean;
  hasSavedSettings: boolean;
  settings: ProfessionalBookingSettings;
};

export const PROFESSIONAL_BOOKING_DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const PROFESSIONAL_BOOKING_DEFAULT_SETTINGS: ProfessionalBookingSettings = {
  timezone: "UTC",
  weeklyAvailability: [],
  minimumNoticeMinutes: 60,
  maximumAdvanceDays: 60,
};
