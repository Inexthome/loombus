export type SubscriptionDisplayKey = "free" | "premium" | "premium_plus" | "admin";

export type AiEntitlementLike = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

export const SUBSCRIPTION_DISPLAY = {
  free: {
    label: "Free",
    badge: "Free",
    description:
      "Core Loombus access for reading, posting, replying, following, saving, basic attachments, and limited Video Context.",
    nextAction: "View Premium options",
    href: "/premium",
  },
  premium: {
    label: "Premium",
    badge: "Premium Member",
    description:
      "AI discussion tools, saved folders, drafts, topic alerts, extended editing, and longer Video Context.",
    nextAction: "Manage Premium",
    href: "/premium",
  },
  premium_plus: {
    label: "Premium Plus",
    badge: "Premium Plus Member",
    description:
      "Highest AI usage, pre-posting AI support, private notes, exports, Labs access, creator tools, and 3-minute Video Context.",
    nextAction: "Manage Premium Plus",
    href: "/premium",
  },
  admin: {
    label: "Admin",
    badge: "Admin Access",
    description:
      "Administrative access with Premium AI tools and operational controls.",
    nextAction: "Open AI Access Admin",
    href: "/admin/ai-access",
  },
} as const;

export function getSubscriptionDisplayKey(
  entitlement: AiEntitlementLike
): SubscriptionDisplayKey {
  if (!entitlement || !entitlement.ai_assisted_enabled) {
    return "free";
  }

  if (entitlement.tier === "admin") {
    return "admin";
  }

  if (entitlement.tier === "premium") {
    const monthlyLimit = entitlement.monthly_summary_limit ?? 0;

    if (monthlyLimit > 50) {
      return "premium_plus";
    }

    return "premium";
  }

  return "free";
}

export function getSubscriptionDisplay(entitlement: AiEntitlementLike) {
  return SUBSCRIPTION_DISPLAY[getSubscriptionDisplayKey(entitlement)];
}

export function getAiUsageLabel(entitlement: AiEntitlementLike) {
  const key = getSubscriptionDisplayKey(entitlement);

  if (key === "admin") {
    return "Unlimited/admin";
  }

  const limit = entitlement?.monthly_summary_limit ?? 0;

  if (limit <= 0) {
    return "No Premium AI usage included";
  }

  return `${limit} AI actions/month`;
}
