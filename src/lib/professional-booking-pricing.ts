import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export const PROFESSIONAL_BOOKING_PRICING_CURRENCY = "usd" as const;

export type ProfessionalBookingPricing = {
  amountCents: number;
  currency: typeof PROFESSIONAL_BOOKING_PRICING_CURRENCY;
};

export type ProfessionalBookingPricingService = {
  id: string;
  name: string;
  businessName: string;
  status: "active" | "paused" | "archived";
};

export type ProfessionalBookingPricingResponse = {
  subscriptionPlan: SubscriptionPlanId;
  canUseProfessionalBooking: boolean;
  subscriptionResolutionAvailable: boolean;
  hasSavedPricing: boolean;
  service: ProfessionalBookingPricingService;
  pricing: ProfessionalBookingPricing | null;
};
