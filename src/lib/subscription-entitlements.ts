export type SubscriptionPlanId = "free" | "premium" | "pro";

export type SubscriptionEntitlementRow = {
  tier?: string | null;
  ai_assisted_enabled?: boolean | null;
  monthly_summary_limit?: number | null;
};

export type MasterEntitlementValue = string | boolean;

export type MasterEntitlementRow = {
  capability: string;
  free: MasterEntitlementValue;
  premium: MasterEntitlementValue;
  pro: MasterEntitlementValue;
};

export type MasterEntitlementGroup = {
  label: string;
  rows: MasterEntitlementRow[];
};

export const PLAN_RANK: Record<SubscriptionPlanId, number> = {
  free: 0,
  premium: 1,
  pro: 2,
};

export const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    label: "Free",
    positioning: "Participate & discover",
  },
  premium: {
    id: "premium",
    label: "Premium",
    positioning: "Intelligence & productivity",
  },
  pro: {
    id: "pro",
    label: "Premium Pro",
    positioning: "Professional leverage",
  },
} as const satisfies Record<SubscriptionPlanId, {
  id: SubscriptionPlanId;
  label: string;
  positioning: string;
}>;

/**
 * Loombus officially launched June 15, 2026. Launch-year pricing runs for the
 * first 12 months and ends when June 15, 2027 begins in the launch market.
 * Stripe/App Store product identifiers remain unchanged until the billing
 * price transition is deliberately activated.
 */
export const LOOMBUS_OFFICIAL_LAUNCH_DATE = "2026-06-15" as const;
export const EARLY_ACCESS_PROMOTION_DURATION_MONTHS = 12 as const;
export const EARLY_ACCESS_PROMOTION_END_DATE = "2027-06-15" as const;
export const EARLY_ACCESS_PROMOTION_ENDS_AT = "2027-06-15T04:00:00.000Z" as const;

export const EARLY_ACCESS_PRICING = {
  active: true,
  transitionMode: "scheduled" as const,
  startsOn: LOOMBUS_OFFICIAL_LAUNCH_DATE,
  endsOn: EARLY_ACCESS_PROMOTION_END_DATE,
  endsAt: EARLY_ACCESS_PROMOTION_ENDS_AT,
  current: {
    premium: { monthlyUsd: 7, annualUsd: 70 },
    pro: { monthlyUsd: 12, annualUsd: 120 },
  },
  futureMonthlyTarget: {
    premium: 12,
    pro: 19,
  },
} as const;

export function isLaunchYearPricingActive(now = new Date()) {
  return now.getTime() < Date.parse(EARLY_ACCESS_PROMOTION_ENDS_AT);
}

/**
 * These are monthly per-action AI limits used by the billing activation path.
 * They deliberately remain separate buckets rather than pretending Loombus
 * already has one shared generic-credit ledger.
 */
export const AI_ALLOWANCES = {
  free: {
    understanding: 0,
    writing: 0,
    research: 0,
    discovery: 0,
  },
  premium: {
    understanding: 150,
    writing: 75,
    research: 30,
    discovery: 75,
  },
  pro: {
    understanding: 300,
    writing: 150,
    research: 60,
    discovery: 150,
  },
} as const;

export type VideoContextLimit = {
  uploadsPerMonth: number;
  maxMinutesPerUpload: number;
  totalMinutesPerMonth: number;
};

/**
 * Video Context quota boundaries are intentionally independent: upload count,
 * per-video duration, and cumulative processed minutes. Free's concrete
 * 3-video / 5-minute / 15-minute ceiling is the implementation of the public
 * "Trial only / Short preview / Limited trial" language. Higher upload counts
 * let paid members use more short videos without silently multiplying the
 * more expensive processed-minute allowance.
 */
export const VIDEO_CONTEXT_LIMITS = {
  free: {
    uploadsPerMonth: 3,
    maxMinutesPerUpload: 5,
    totalMinutesPerMonth: 15,
  },
  premium: {
    uploadsPerMonth: 25,
    maxMinutesPerUpload: 15,
    totalMinutesPerMonth: 150,
  },
  pro: {
    uploadsPerMonth: 50,
    maxMinutesPerUpload: 30,
    totalMinutesPerMonth: 900,
  },
} as const satisfies Record<SubscriptionPlanId, VideoContextLimit>;

export function getVideoContextLimit(plan: SubscriptionPlanId): VideoContextLimit {
  return VIDEO_CONTEXT_LIMITS[plan];
}

/**
 * Public naming changes to Premium Pro while the existing premium_plus keys
 * remain valid aliases for Stripe, Apple and existing database records.
 */
export function normalizeSubscriptionPlan(
  value: string | null | undefined
): SubscriptionPlanId {
  const normalized = value?.trim().toLowerCase().replaceAll("-", "_");

  if (
    normalized === "pro" ||
    normalized === "premium_pro" ||
    normalized === "premium_plus"
  ) {
    return "pro";
  }

  if (normalized === "premium" || normalized === "paid") {
    return "premium";
  }

  return "free";
}

/**
 * Existing Premium Pro rows can still carry tier='premium'. Until a dedicated
 * database-tier migration is performed, the provisioned AI allowance is the
 * stable discriminator. Centralizing that compatibility rule prevents each
 * surface from inventing its own Premium-vs-Pro heuristic.
 */
export function resolvePlanFromEntitlementRow(
  row: SubscriptionEntitlementRow | null | undefined
): SubscriptionPlanId {
  if (!row?.ai_assisted_enabled) return "free";

  const normalizedTier = normalizeSubscriptionPlan(row.tier);
  if (normalizedTier === "pro") return "pro";

  if (
    normalizedTier === "premium" &&
    (row.monthly_summary_limit ?? 0) >= AI_ALLOWANCES.pro.understanding
  ) {
    return "pro";
  }

  return normalizedTier === "premium" ? "premium" : "free";
}

export const TRUST_GUARDRAILS = {
  payToRank: false,
  verificationPurchasable: false,
  verificationRequiresIndependentApproval: true,
} as const;

export type SubscriptionEntitlementKey =
  | "unlimited_messaging"
  | "unlimited_organization"
  | "ai_powered_search"
  | "advanced_alerts"
  | "external_calendar_sync"
  | "ai_understanding"
  | "ai_quality_tools"
  | "saved_discussion_export"
  | "knowledge_graph_ai"
  | "advanced_export_formats"
  | "advanced_creator_analytics"
  | "advanced_applicant_profile"
  | "professional_portfolio"
  | "professional_booking"
  | "expert_verification_application"
  | "verified_expert_badge"
  | "verified_expert_surfacing"
  | "professional_matching"
  | "reduced_service_fees"
  | "service_analytics";

export type EntitlementDefinition = {
  minimumPlan: SubscriptionPlanId;
  requiresVerifiedExpert?: boolean;
};

export const SUBSCRIPTION_ENTITLEMENTS: Record<
  SubscriptionEntitlementKey,
  EntitlementDefinition
> = {
  unlimited_messaging: { minimumPlan: "premium" },
  unlimited_organization: { minimumPlan: "premium" },
  ai_powered_search: { minimumPlan: "premium" },
  advanced_alerts: { minimumPlan: "premium" },
  external_calendar_sync: { minimumPlan: "premium" },
  ai_understanding: { minimumPlan: "premium" },
  ai_quality_tools: { minimumPlan: "premium" },
  saved_discussion_export: { minimumPlan: "premium" },
  knowledge_graph_ai: { minimumPlan: "pro" },
  advanced_export_formats: { minimumPlan: "pro" },
  advanced_creator_analytics: { minimumPlan: "pro" },
  advanced_applicant_profile: { minimumPlan: "pro" },
  professional_portfolio: { minimumPlan: "pro" },
  professional_booking: { minimumPlan: "pro" },
  expert_verification_application: { minimumPlan: "pro" },
  verified_expert_badge: {
    minimumPlan: "pro",
    requiresVerifiedExpert: true,
  },
  verified_expert_surfacing: {
    minimumPlan: "pro",
    requiresVerifiedExpert: true,
  },
  professional_matching: { minimumPlan: "pro" },
  reduced_service_fees: { minimumPlan: "pro" },
  service_analytics: { minimumPlan: "pro" },
};

export type EntitlementDecision = {
  allowed: boolean;
  requiredPlan: SubscriptionPlanId;
  reason: "plan" | "verification" | null;
};

export function evaluateSubscriptionEntitlement(
  plan: SubscriptionPlanId,
  entitlement: SubscriptionEntitlementKey,
  context: { isVerifiedExpert?: boolean } = {}
): EntitlementDecision {
  const definition = SUBSCRIPTION_ENTITLEMENTS[entitlement];

  if (PLAN_RANK[plan] < PLAN_RANK[definition.minimumPlan]) {
    return {
      allowed: false,
      requiredPlan: definition.minimumPlan,
      reason: "plan",
    };
  }

  if (definition.requiresVerifiedExpert && !context.isVerifiedExpert) {
    return {
      allowed: false,
      requiredPlan: definition.minimumPlan,
      reason: "verification",
    };
  }

  return {
    allowed: true,
    requiredPlan: definition.minimumPlan,
    reason: null,
  };
}

export const MASTER_SUBSCRIPTION_ENTITLEMENTS: MasterEntitlementGroup[] = [
  {
    label: "Core & social",
    rows: [
      { capability: "Discussions, replies, follows", free: true, premium: true, pro: true },
      { capability: "Topics", free: true, premium: true, pro: true },
      { capability: "People", free: true, premium: true, pro: true },
      { capability: "Following", free: true, premium: true, pro: true },
      { capability: "Messages", free: "Mutuals", premium: "Unlimited", pro: "Unlimited" },
      { capability: "Images / PDF attachments", free: true, premium: true, pro: true },
      { capability: "Signal Inbox", free: true, premium: true, pro: true },
      { capability: "Reading history", free: true, premium: true, pro: true },
      { capability: "Draft mode", free: true, premium: true, pro: true },
      { capability: "Normal post editing", free: true, premium: true, pro: true },
      { capability: "Saved", free: "Limited", premium: "Unlimited", pro: "Unlimited" },
      { capability: "Saved folders", free: "Limited", premium: "Unlimited", pro: "Unlimited" },
      { capability: "Private notes", free: "Limited", premium: "Unlimited", pro: "Unlimited" },
      { capability: "Stickies", free: "Limited", premium: "Unlimited", pro: "Unlimited" },
    ],
  },
  {
    label: "Find & connect — the free front door",
    rows: [
      { capability: "Search everything on Loombus", free: "Basic", premium: "AI-powered", pro: "AI + Knowledge Graph" },
      { capability: "Intelligent matching", free: "Basic", premium: "Enhanced", pro: "Enhanced + professional" },
      { capability: "Local", free: true, premium: true, pro: true },
      { capability: "Businesses", free: true, premium: true, pro: true },
      { capability: "Services", free: true, premium: true, pro: true },
      { capability: "Requests", free: true, premium: true, pro: true },
      { capability: "Jobs", free: true, premium: true, pro: true },
      { capability: "Job applications", free: "Standard", premium: "Standard", pro: "Advanced profile + analytics" },
      { capability: "Events", free: true, premium: true, pro: true },
      { capability: "Marketplace", free: true, premium: true, pro: true },
      { capability: "Appointments", free: true, premium: true, pro: true },
      { capability: "Calendar", free: true, premium: "+ external sync", pro: "+ external sync" },
      { capability: "Topic alerts", free: "Basic", premium: "Advanced", pro: "Advanced" },
      { capability: "Email digest", free: "Basic", premium: "Customizable", pro: "Customizable" },
    ],
  },
  {
    label: "Loombus AI — the Premium engine",
    rows: [
      { capability: "AI discussion understanding / month", free: false, premium: AI_ALLOWANCES.premium.understanding.toString(), pro: AI_ALLOWANCES.pro.understanding.toString() },
      { capability: "AI writing actions / month", free: false, premium: AI_ALLOWANCES.premium.writing.toString(), pro: AI_ALLOWANCES.pro.writing.toString() },
      { capability: "AI research actions / month", free: false, premium: AI_ALLOWANCES.premium.research.toString(), pro: AI_ALLOWANCES.pro.research.toString() },
      { capability: "AI discovery actions / month", free: false, premium: AI_ALLOWANCES.premium.discovery.toString(), pro: AI_ALLOWANCES.pro.discovery.toString() },
      { capability: "Key Takeaways / What Changed", free: false, premium: true, pro: true },
      { capability: "Conversation Map", free: false, premium: true, pro: true },
      { capability: "Disagreement / Viewpoint Map", free: false, premium: true, pro: true },
      { capability: "Related Ideas", free: false, premium: true, pro: true },
      { capability: "AI quality check", free: false, premium: true, pro: true },
      { capability: "AI clarity rewrite", free: false, premium: true, pro: true },
      { capability: "AI-powered search", free: false, premium: true, pro: true },
      { capability: "Knowledge Graph-assisted AI", free: false, premium: false, pro: true },
    ],
  },
  {
    label: "AI Video Context",
    rows: [
      { capability: "AI video analysis", free: "Trial only", premium: `${VIDEO_CONTEXT_LIMITS.premium.uploadsPerMonth} videos/mo`, pro: `${VIDEO_CONTEXT_LIMITS.pro.uploadsPerMonth} videos/mo` },
      { capability: "Maximum video analyzed", free: "Short preview", premium: `${VIDEO_CONTEXT_LIMITS.premium.maxMinutesPerUpload} min/video`, pro: `${VIDEO_CONTEXT_LIMITS.pro.maxMinutesPerUpload} min/video` },
      { capability: "AI video allowance", free: "Limited trial", premium: `Up to ${VIDEO_CONTEXT_LIMITS.premium.totalMinutesPerMonth} min/mo`, pro: `Up to ${VIDEO_CONTEXT_LIMITS.pro.totalMinutesPerMonth} min/mo` },
    ],
  },
  {
    label: "Organization & productivity",
    rows: [
      { capability: "Unlimited saves", free: false, premium: true, pro: true },
      { capability: "Unlimited folders", free: false, premium: true, pro: true },
      { capability: "Unlimited private notes", free: false, premium: true, pro: true },
      { capability: "Unlimited Stickies", free: false, premium: true, pro: true },
      { capability: "Advanced reminders", free: false, premium: true, pro: true },
      { capability: "Calendar synchronization", free: false, premium: true, pro: true },
      { capability: "Advanced alerts", free: false, premium: true, pro: true },
      { capability: "Personalized digest", free: false, premium: true, pro: true },
    ],
  },
  {
    label: "Export & Labs",
    rows: [
      { capability: "Saved-discussion export", free: false, premium: true, pro: true },
      { capability: "Standard export formats", free: false, premium: true, pro: true },
      { capability: "Advanced export formats", free: false, premium: false, pro: true },
      { capability: "Loombus Labs", free: "Standard", premium: "Early access", pro: "Priority access" },
    ],
  },
  {
    label: "Creator & professional tools",
    rows: [
      { capability: "Standard member profile", free: true, premium: true, pro: true },
      { capability: "Creator profile", free: false, premium: "Enhanced", pro: "Advanced" },
      { capability: "Creator analytics", free: false, premium: "Basic", pro: "Advanced" },
      { capability: "Audience / content insights", free: false, premium: "Basic", pro: "Advanced" },
      { capability: "Professional portfolio", free: false, premium: false, pro: true },
      { capability: "Professional service profile", free: false, premium: false, pro: true },
      { capability: "Professional booking tools", free: false, premium: false, pro: true },
      { capability: "Booking availability", free: false, premium: false, pro: true },
      { capability: "Client intake forms", free: false, premium: false, pro: true },
      { capability: "Booking policies / cancellation controls", free: false, premium: false, pro: true },
      { capability: "Paid-service booking support", free: false, premium: false, pro: true },
    ],
  },
  {
    label: "Trust & professional discovery",
    rows: [
      { capability: "Expert verification", free: false, premium: false, pro: "Eligible to apply" },
      { capability: "Verified expert badge", free: false, premium: false, pro: "Only after independent approval" },
      { capability: "Verified expert surfacing", free: false, premium: false, pro: "Enhanced after verification" },
      { capability: "Service-request matching", free: false, premium: false, pro: "Based on relevance / eligibility" },
      { capability: "Professional discovery", free: false, premium: false, pro: true },
      { capability: "Pay-to-rank in search", free: "Never", premium: "Never", pro: "Never" },
    ],
  },
  {
    label: "Services & economic benefits",
    rows: [
      { capability: "Offer services", free: true, premium: true, pro: true },
      { capability: "Respond to service requests", free: true, premium: true, pro: true },
      { capability: "Reduced service transaction fee", free: false, premium: false, pro: true },
      { capability: "Professional booking workflow", free: false, premium: false, pro: true },
      { capability: "Service analytics", free: false, premium: false, pro: true },
    ],
  },
];
