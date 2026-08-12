import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  normalizeSubscriptionPlan,
  resolvePlanFromEntitlementRow,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";

export type GeneralSubscriptionProvider = "stripe" | "apple";

export type GeneralSubscriptionRow = {
  user_id: string;
  plan_key: string | null;
  provider: GeneralSubscriptionProvider | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  provider_product_id: string | null;
  original_transaction_id: string | null;
  app_account_token: string | null;
  environment: "Production" | "Sandbox" | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  last_verified_at: string | null;
};

export type ResolvedGeneralSubscription = {
  plan: SubscriptionPlanId;
  paidPlan: SubscriptionPlanId;
  active: boolean;
  isAdminOverride: boolean;
  source: "general_subscription" | "legacy_ai_entitlement" | "free";
  subscription: GeneralSubscriptionRow | null;
};

const STRIPE_ACCESS_STATUSES = new Set(["active", "trialing", "past_due"]);
const APPLE_ACCESS_STATUSES = new Set(["active", "grace_period"]);

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

  return false;
}

export function resolvePlanFromGeneralSubscriptionRow(
  row: GeneralSubscriptionRow | null | undefined
): SubscriptionPlanId {
  if (!row || !isGeneralSubscriptionActive(row)) return "free";
  return normalizeSubscriptionPlan(row.plan_key);
}

export async function getResolvedGeneralSubscriptionForUser(
  userId: string
): Promise<ResolvedGeneralSubscription> {
  const supabase = createBillingReadClient();

  const { data: generalRow, error: generalError } = await (
    supabase.from("user_general_subscriptions") as any
  )
    .select(
      "user_id, plan_key, provider, provider_customer_id, provider_subscription_id, provider_product_id, original_transaction_id, app_account_token, environment, status, current_period_end, cancel_at_period_end, last_verified_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!generalError && generalRow) {
    const subscription = generalRow as GeneralSubscriptionRow;
    const plan = resolvePlanFromGeneralSubscriptionRow(subscription);

    return {
      plan,
      paidPlan: plan,
      active: plan !== "free",
      isAdminOverride: false,
      source: "general_subscription",
      subscription,
    };
  }

  // Rollout compatibility: if the additive migration has not reached an
  // environment yet, or a historic member has not been backfilled, resolve
  // access from the existing AI entitlement row. Once a general-subscription
  // row exists it is authoritative, including an explicit inactive state.
  const { data: legacyRow, error: legacyError } = await (
    supabase.from("user_ai_entitlements") as any
  )
    .select("tier, ai_assisted_enabled, monthly_summary_limit")
    .eq("user_id", userId)
    .maybeSingle();

  if (legacyError) {
    if (generalError) {
      console.error("Unable to resolve general subscription state:", {
        generalError: generalError.message,
        legacyError: legacyError.message,
      });
    }

    return {
      plan: "free",
      paidPlan: "free",
      active: false,
      isAdminOverride: false,
      source: "free",
      subscription: null,
    };
  }

  const legacyTier = legacyRow?.tier?.trim().toLowerCase() ?? "";
  if (legacyTier === "admin") {
    return {
      plan: "pro",
      paidPlan: "free",
      active: true,
      isAdminOverride: true,
      source: "legacy_ai_entitlement",
      subscription: null,
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
  };
}
