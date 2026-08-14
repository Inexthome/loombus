import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

export const PROFESSIONAL_BOOKING_PAYMENT_PRODUCT =
  "loombus_professional_booking" as const;
export const PROFESSIONAL_BOOKING_PAYMENT_CURRENCY = "usd" as const;

export type ProfessionalBookingPaymentStatus =
  | "checkout_pending"
  | "authorized"
  | "authorization_expired"
  | "capture_pending"
  | "captured"
  | "cancel_pending"
  | "canceled"
  | "refund_pending"
  | "refunded"
  | "failed";

export type ProfessionalBookingPaymentAttemptStatus =
  | "checkout_pending"
  | "authorized"
  | "captured"
  | "canceled"
  | "expired"
  | "failed";

export type ProfessionalBookingPaymentSummary = {
  id: string;
  appointmentRequestId: string;
  role: "requester" | "provider";
  serviceName: string;
  appointmentStatus: string;
  paymentStatus: ProfessionalBookingPaymentStatus;
  grossAmountCents: number;
  currency: typeof PROFESSIONAL_BOOKING_PAYMENT_CURRENCY;
  feeScheduleVersion: string;
  platformFeeBps: number;
  platformFeeCents: number;
  providerNetBeforeProcessingCents: number;
  providerPlan: SubscriptionPlanId;
  reducedServiceFeeApplied: boolean;
  authorizationExpiresAt: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
  canCheckout: boolean;
  canRefresh: boolean;
};

export type ProfessionalBookingPaymentListResponse = {
  paymentsEnabled: boolean;
  livePaymentsAllowed: boolean;
  payments: ProfessionalBookingPaymentSummary[];
};

export function professionalBookingPaymentAmountLabel(amountCents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}
