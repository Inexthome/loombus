import "server-only";

import {
  evaluateSubscriptionEntitlement,
  type EntitlementDecision,
  type SubscriptionEntitlementKey,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import {
  getResolvedGeneralSubscriptionForUser,
  type ResolvedGeneralSubscription,
} from "@/lib/general-subscriptions";

export type SubscriptionAccessContext = {
  isVerifiedExpert?: boolean;
};

export type SubscriptionAccessDecision = EntitlementDecision & {
  plan: SubscriptionPlanId;
  paidPlan: SubscriptionPlanId;
  isAdminOverride: boolean;
  source: ResolvedGeneralSubscription["source"];
};

export class SubscriptionAccessError extends Error {
  readonly code = "subscription_entitlement_required";
  readonly status = 403;
  readonly entitlement: SubscriptionEntitlementKey;
  readonly decision: SubscriptionAccessDecision;

  constructor(
    entitlement: SubscriptionEntitlementKey,
    decision: SubscriptionAccessDecision
  ) {
    super(
      decision.reason === "verification"
        ? "This feature requires approved expert verification."
        : `This feature requires the ${decision.requiredPlan} subscription tier.`
    );
    this.name = "SubscriptionAccessError";
    this.entitlement = entitlement;
    this.decision = decision;
  }
}

export async function getUserSubscriptionPlan(userId: string) {
  return getResolvedGeneralSubscriptionForUser(userId);
}

export async function getSubscriptionEntitlementDecisionForUser(
  userId: string,
  entitlement: SubscriptionEntitlementKey,
  context: SubscriptionAccessContext = {}
): Promise<SubscriptionAccessDecision> {
  const subscription = await getResolvedGeneralSubscriptionForUser(userId);
  const decision = evaluateSubscriptionEntitlement(
    subscription.plan,
    entitlement,
    context
  );

  return {
    ...decision,
    plan: subscription.plan,
    paidPlan: subscription.paidPlan,
    isAdminOverride: subscription.isAdminOverride,
    source: subscription.source,
  };
}

export async function requireSubscriptionEntitlement(
  userId: string,
  entitlement: SubscriptionEntitlementKey,
  context: SubscriptionAccessContext = {}
): Promise<SubscriptionAccessDecision> {
  const decision = await getSubscriptionEntitlementDecisionForUser(
    userId,
    entitlement,
    context
  );

  if (!decision.allowed) {
    throw new SubscriptionAccessError(entitlement, decision);
  }

  return decision;
}
