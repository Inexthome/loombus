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

export type ProfessionalBookingPolicySnapshot = ProfessionalBookingPolicy & {
  acknowledgedAt: string;
};

export type ProfessionalBookingRequesterCancellationTiming =
  | "on_time"
  | "late";

export type PublicProfessionalBookingPolicyResponse = {
  serviceId: string;
  active: boolean;
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

export function normalizeProfessionalBookingPolicySnapshot(
  value: unknown,
): ProfessionalBookingPolicySnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const row = value as Record<string, unknown>;
  if (typeof row.policyText !== "string") return null;
  if (
    typeof row.cancellationNoticeHours !== "number" ||
    !Number.isInteger(row.cancellationNoticeHours) ||
    row.cancellationNoticeHours < 0 ||
    row.cancellationNoticeHours >
      PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS
  ) {
    return null;
  }
  if (
    row.policyText.length > PROFESSIONAL_BOOKING_POLICY_TEXT_MAX ||
    typeof row.acknowledgedAt !== "string"
  ) {
    return null;
  }

  const acknowledgedAt = new Date(row.acknowledgedAt);
  if (!Number.isFinite(acknowledgedAt.getTime())) return null;

  const policyText = row.policyText.trim();
  if (!policyText && row.cancellationNoticeHours === 0) return null;

  return {
    policyText,
    cancellationNoticeHours: row.cancellationNoticeHours,
    acknowledgedAt: acknowledgedAt.toISOString(),
  };
}
