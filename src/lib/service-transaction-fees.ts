import {
  evaluateSubscriptionEntitlement,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";

const BASIS_POINTS_DENOMINATOR = 10_000;

/**
 * Canonical Loombus service-commerce fee schedule.
 *
 * This module is economics/configuration only. It does not create Stripe
 * objects, move money, alter appointment lifecycle state, or impose fees on
 * existing free product surfaces. The standard rate is the baseline for
 * future eligible service-commerce flows. Premium Pro receives the reduced
 * rate through the existing `reduced_service_fees` entitlement.
 */
export const SERVICE_TRANSACTION_FEE_SCHEDULE = {
  version: "services-2026-08-v1",
  currency: "usd",
  standardFeeBps: 1_200,
  proReducedFeeBps: 800,
} as const;

export type ServiceTransactionFeeRate = {
  feeScheduleVersion: typeof SERVICE_TRANSACTION_FEE_SCHEDULE.version;
  platformFeeBps: number;
  providerPlan: SubscriptionPlanId;
  reducedServiceFeeApplied: boolean;
};

export type ServiceTransactionFeeBreakdown = ServiceTransactionFeeRate & {
  grossAmountCents: number;
  currency: typeof SERVICE_TRANSACTION_FEE_SCHEDULE.currency;
  platformFeeCents: number;
  /**
   * Gross amount less only the Loombus platform fee. This deliberately does
   * not represent final provider proceeds and excludes payment processing,
   * taxes, refunds, disputes, adjustments, or any future settlement costs.
   */
  providerNetBeforeProcessingCents: number;
};

export function resolveServiceTransactionFeeRate(
  providerPlan: SubscriptionPlanId,
): ServiceTransactionFeeRate {
  const reducedServiceFeeApplied = evaluateSubscriptionEntitlement(
    providerPlan,
    "reduced_service_fees",
  ).allowed;

  return {
    feeScheduleVersion: SERVICE_TRANSACTION_FEE_SCHEDULE.version,
    platformFeeBps: reducedServiceFeeApplied
      ? SERVICE_TRANSACTION_FEE_SCHEDULE.proReducedFeeBps
      : SERVICE_TRANSACTION_FEE_SCHEDULE.standardFeeBps,
    providerPlan,
    reducedServiceFeeApplied,
  };
}

/**
 * Applies basis points using integer arithmetic with round-half-up semantics.
 * Keeping the calculation in cents avoids floating-point currency drift and
 * gives future payment code an exact cent-denominated platform fee.
 */
function calculateBasisPointAmount(amountCents: number, feeBps: number): number {
  const wholeBlocks = Math.floor(amountCents / BASIS_POINTS_DENOMINATOR);
  const remainder = amountCents % BASIS_POINTS_DENOMINATOR;

  return (
    wholeBlocks * feeBps +
    Math.floor((remainder * feeBps + BASIS_POINTS_DENOMINATOR / 2) / BASIS_POINTS_DENOMINATOR)
  );
}

export function calculateServiceTransactionFee(input: {
  grossAmountCents: number;
  providerPlan: SubscriptionPlanId;
}): ServiceTransactionFeeBreakdown {
  if (!Number.isSafeInteger(input.grossAmountCents) || input.grossAmountCents <= 0) {
    throw new RangeError("grossAmountCents must be a positive safe integer.");
  }

  const rate = resolveServiceTransactionFeeRate(input.providerPlan);
  const platformFeeCents = calculateBasisPointAmount(
    input.grossAmountCents,
    rate.platformFeeBps,
  );

  return {
    ...rate,
    grossAmountCents: input.grossAmountCents,
    currency: SERVICE_TRANSACTION_FEE_SCHEDULE.currency,
    platformFeeCents,
    providerNetBeforeProcessingCents: input.grossAmountCents - platformFeeCents,
  };
}
