import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export const PROFESSIONAL_BOOKING_POLICY_TEXT_MAX = 3000;
export const PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS = 168;

export const PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_OPTIONS = [
  0,
  1,
  2,
  4,
  8,
  12,
  24,
  48,
  72,
  168,
] as const;

export type ProfessionalBookingPolicyService = {
  id: string;
  name: string;
  businessName: string;
  status: "active" | "paused" | "archived";
};

export type ProfessionalBookingPolicy = {
  policyText: string;
  cancellationNoticeHours: number;
};

export type ProfessionalBookingPolicyResponse = {
  subscriptionPlan: SubscriptionPlanId;
  canUseProfessionalBooking: boolean;
  subscriptionResolutionAvailable: boolean;
  hasSavedPolicy: boolean;
  service: ProfessionalBookingPolicyService;
  policy: ProfessionalBookingPolicy;
};
