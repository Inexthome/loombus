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

export type PublicProfessionalBookingPricingResponse = {
  serviceId: string;
  active: boolean;
  amountCents: number | null;
  currency: typeof PROFESSIONAL_BOOKING_PRICING_CURRENCY | null;
  sourceRevision: string | null;
};

export type ProfessionalBookingPriceSnapshot = {
  amountCents: number;
  currency: typeof PROFESSIONAL_BOOKING_PRICING_CURRENCY;
  sourceRevision: string;
  capturedAt: string;
};

export function normalizeProfessionalBookingPriceSnapshot(
  value: unknown,
): ProfessionalBookingPriceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const row = value as Record<string, unknown>;
  const amountCents = row.amountCents;
  const currency = row.currency;
  const sourceRevision = row.sourceRevision;
  const capturedAt = row.capturedAt;

  if (
    typeof amountCents !== "number" ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    currency !== PROFESSIONAL_BOOKING_PRICING_CURRENCY ||
    typeof sourceRevision !== "string" ||
    !/^[0-9a-f]{64}$/i.test(sourceRevision) ||
    typeof capturedAt !== "string" ||
    !Number.isFinite(new Date(capturedAt).getTime())
  ) {
    return null;
  }

  return {
    amountCents,
    currency: PROFESSIONAL_BOOKING_PRICING_CURRENCY,
    sourceRevision,
    capturedAt: new Date(capturedAt).toISOString(),
  };
}
