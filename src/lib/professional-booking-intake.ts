import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export type ProfessionalBookingIntakeQuestion = {
  id: string;
  label: string;
  required: boolean;
};

export type ProfessionalBookingIntakeAnswerInput = {
  id: string;
  answer: string;
};

export type ProfessionalBookingIntakeSnapshotItem =
  ProfessionalBookingIntakeQuestion & {
    answer: string;
  };

export type PublicProfessionalBookingIntakeResponse = {
  active: boolean;
  questions: ProfessionalBookingIntakeQuestion[];
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
export const PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH = 2000;
