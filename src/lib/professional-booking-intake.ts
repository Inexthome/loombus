import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export type ProfessionalBookingIntakeQuestion = {
  id: string;
  label: string;
  required: boolean;
};

export type ProfessionalBookingIntakeService = {
  id: string;
  name: string;
  businessName: string;
  status: "active" | "paused" | "archived";
};

export type ProfessionalBookingIntakeResponse = {
  subscriptionPlan: SubscriptionPlanId;
  canUseProfessionalBooking: boolean;
  subscriptionResolutionAvailable: boolean;
  hasSavedForm: boolean;
  service: ProfessionalBookingIntakeService;
  questions: ProfessionalBookingIntakeQuestion[];
};

export const PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT = 5;
