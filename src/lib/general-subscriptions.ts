import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  PLAN_RANK,
  normalizeSubscriptionPlan,
  resolvePlanFromEntitlementRow,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";

export type GeneralSubscriptionProvider = "stripe" | "apple" | "legacy";

export type GeneralSubscriptionRow = {
  id?: string;
  user_id: string;
  plan_key: string | null;
  provider: GeneralSubscriptionProvider;
  provider_customer_id: string | null;
  provider_subscription_id: string;
  provider_product_id: string | null;
  original_transaction_id: string | null;
  app_account_token: string | null;
  environment: "Production" | "Sandbox" | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  last_verified_at: string | null;
  updated_at?: string | null;
};

export type ResolvedGeneralSubscription = {
  plan: SubscriptionPlanId;
  paidPlan: SubscriptionPlanId;
  active: boolean;
  isAdminOverride: boolean;
  source: "profile_admin" | "general_subscription" | "legacy_ai_entitlement" | "free";
  subscription: GeneralSubscriptionRow | null;
  subscriptions: GeneralSubscriptionRow[];
};

const STRIPE_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);
const APPLE_ACCESS_STATUSES = new Set(["active", "grace_period"]);
const LEGACY_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);

function createBillingReadClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !url) {
    throw new Error("Supabase billing read configuration is incomplete.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isGeneralSubscriptionActive(
  row: Pick<GeneralSubscriptionRow, "provider" | "status" | "current_period_end">
) {
  const status = row.status?.trim().toLowerCase() ?? "inactive";

  if (row.provider === "apple") {
    if (!APPLE_ACCESS_STATUSES.has(status)) return false;

    if (status === "active" && row.current_period_end) {
      const periodEnd = Date.parse(row.current_period_end);
      if (Number.isFinite(periodEnd) && periodEnd <= Date.now()) return false;
    }

    return true;
  }

  if (row.provider === "stripe") {
    return STRIPE_ACCESS_STATUSES.has(status);
  }

  return LEGACY_ACCESS_STATUSES.has(status);
}

export function resolvePlanFromGeneralSubscriptionRow(
  row: GeneralSubscriptionRow | null | undefined
): SubscriptionPlanId {
  if (!row || !isGeneralSubscriptionActive(row)) return "free";
  return normalizeSubscriptionPlan(row.plan_key);
}

export function resolveEffectiveSubscriptionFromRows(
  rows: GeneralSubscriptionRow[]
) {
  // Legacy rows exist only to bridge historic paid members into the new
  // provider-neutral model. Once Stripe or Apple has identified any real
  // subscription for the member, provider state becomes authoritative even
  // when that subscription is inactive. This prevents stale legacy access.
  const providerRows = rows.filter(
    (row) => row.provider === "stripe" || row.provider === "apple"
  );
  const candidateRows = providerRows.length > 0 ? providerRows : rows;
  const activeRows = candidateRows.filter(isGeneralSubscriptionActive);

  if (activeRows.length === 0) {
    return { plan: "free" as const, subscription: null };
  }

  const sorted = [...activeRows].sort((a, b) => {
    const planDifference =
      PLAN_RANK[normalizeSubscriptionPlan(b.plan_key)] -
      PLAN_RANK[normalizeSubscriptionPlan(a.plan_key)];
    if (planDifference !== 0) return planDifference;

    return Date.parse(b.last_verified_at ?? b.updated_at ?? "1970-01-01") -
      Date.parse(a.last_verified_at ?? a.updated_at ?? "1970-01-01");
  });

  const subscription = sorted[0];
  return {
    plan: normalizeSubscriptionPlan(subscription.plan_key),
    subscription,
  };
}

export async function getResolvedGeneralSubscriptionForUser(
  userId: string
): Promise<ResolvedGeneralSubscription> {
  const supabase = createBillingReadClient();

  const [generalResult, legacyResult, profileResult] = await Promise.all([
    (supabase.from("user_general_subscriptions") as any)
      .select(
        "id, user_id, plan_key, provider, provider_customer_id, provider_subscription_id, provider_product_id, original_transaction_id, app_account_token, environment, status, current_period_end, cancel_at_period_end, last_verified_at, updated_at"
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    (supabase.from("user_ai_entitlements") as any)
      .select("tier, ai_assisted_enabled, monthly_summary_limit")
      .eq("user_id", userId)
      .maybeSingle(),
    (supabase.from("profiles") as any)
      .select("is_admin")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const subscriptions = (generalResult.data ?? []) as GeneralSubscriptionRow[];

  if (!profileResult.error && profileResult.data?.is_admin === true) {
    return {
      plan: "pro",
      paidPlan: "free",
      active: true,
      isAdminOverride: true,
      source: "profile_admin",
      subscription: null,
      subscriptions,
    };
  }

  const legacyRow = legacyResult.data;
  const legacyTier = legacyRow?.tier?.trim().toLowerCase() ?? "";
  if (legacyTier === "admin") {
    return {
      plan: "pro",
      paidPlan: "free",
      active: true,
      isAdminOverride: true,
      source: "legacy_ai_entitlement",
      subscription: null,
      subscriptions,
    };
  }

  if (!generalResult.error && generalResult.data?.length) {
    const effective = resolveEffectiveSubscriptionFromRows(subscriptions);

    return {
      plan: effective.plan,
      paidPlan: effective.plan,
      active: effective.plan !== "free",
      isAdminOverride: false,
      source: "general_subscription",
      subscription: effective.subscription,
      subscriptions,
    };
  }

  // Rollout compatibility: if the additive migration has not reached an
  // environment yet, or a historic member has not been backfilled, resolve
  // access from the existing AI entitlement row. Once any general-subscription
  // rows exist for the member they are authoritative, including inactive rows.
  if (legacyResult.error) {
    if (generalResult.error) {
      console.error("Unable to resolve general subscription state:", {
        generalError: generalResult.error.message,
        legacyError: legacyResult.error.message,
      });
    }

    return {
      plan: "free",
      paidPlan: "free",
      active: false,
      isAdminOverride: false,
      source: "free",
      subscription: null,
      subscriptions: [],
    };
  }

  const plan = resolvePlanFromEntitlementRow(legacyRow);
  return {
    plan,
    paidPlan: plan,
    active: plan !== "free",
    isAdminOverride: false,
    source: plan === "free" ? "free" : "legacy_ai_entitlement",
    subscription: null,
    subscriptions: [],
  };
}
