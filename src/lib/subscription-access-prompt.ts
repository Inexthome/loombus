"use client";

import { showLoombusPrompt } from "@/lib/loombus-prompt";
import {
  SUBSCRIPTION_PLANS,
  evaluateSubscriptionEntitlement,
  type SubscriptionEntitlementKey,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";

export function requireSubscriptionEntitlement({
  plan,
  entitlement,
  featureLabel,
  isVerifiedExpert = false,
}: {
  plan: SubscriptionPlanId;
  entitlement: SubscriptionEntitlementKey;
  featureLabel: string;
  isVerifiedExpert?: boolean;
}) {
  const decision = evaluateSubscriptionEntitlement(plan, entitlement, {
    isVerifiedExpert,
  });

  if (decision.allowed) return true;

  if (decision.reason === "verification") {
    showLoombusPrompt({
      title: "Verification required",
      message: `${featureLabel} is available after independent expert verification. A Premium Pro subscription does not purchase or guarantee verification.`,
      tone: "warning",
      autoDismissMs: 4200,
      compact: true,
    });
    return false;
  }

  const requiredPlan = SUBSCRIPTION_PLANS[decision.requiredPlan];
  showLoombusPrompt({
    title: `${requiredPlan.label} required`,
    message: `Upgrade to ${requiredPlan.label} to use ${featureLabel}.`,
    tone: "warning",
    autoDismissMs: 3600,
    compact: true,
    actionHref: "/premium",
    actionLabel: "View plans",
  });

  return false;
}

export function showSubscriptionWarning({
  title = "Plan access",
  message,
  actionHref,
  actionLabel,
}: {
  title?: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  showLoombusPrompt({
    title,
    message,
    tone: "warning",
    autoDismissMs: 3600,
    compact: true,
    actionHref,
    actionLabel,
  });
}
