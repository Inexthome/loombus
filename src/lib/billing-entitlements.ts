import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  AI_ALLOWANCES,
  PLAN_RANK,
  normalizeSubscriptionPlan,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import {
  isGeneralSubscriptionActive,
  type GeneralSubscriptionRow,
} from "@/lib/general-subscriptions";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const EXTRA_AI_PACK_CREDITS = 25;

export const PREMIUM_LIMITS = {
  monthly_summary_limit: AI_ALLOWANCES.premium.understanding,
  monthly_writing_limit: AI_ALLOWANCES.premium.writing,
  monthly_research_limit: AI_ALLOWANCES.premium.research,
  monthly_discovery_limit: AI_ALLOWANCES.premium.discovery,
};

export const PREMIUM_PLUS_LIMITS = {
  monthly_summary_limit: AI_ALLOWANCES.pro.understanding,
  monthly_writing_limit: AI_ALLOWANCES.pro.writing,
  monthly_research_limit: AI_ALLOWANCES.pro.research,
  monthly_discovery_limit: AI_ALLOWANCES.pro.discovery,
};

const FREE_LIMITS = {
  monthly_summary_limit: 0,
  monthly_writing_limit: 0,
  monthly_research_limit: 0,
  monthly_discovery_limit: 0,
};

export type BillingProvider = "stripe" | "apple";

export type BillingIdentity = {
  provider?: BillingProvider | null;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  providerProductId?: string | null;
  originalTransactionId?: string | null;
  appAccountToken?: string | null;
  environment?: "Production" | "Sandbox" | null;
  currentPeriodEnd?: string | null;
  subscriptionStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  lastVerifiedAt?: string | null;

  // Compatibility fields used by existing Stripe/Floor call sites while the
  // general-subscription foundation rolls out. New non-Stripe code should use
  // the provider-neutral fields above.
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  stripeSubscriptionStatus?: string | null;
};

export type PremiumBillingPlanKey =
  | "premium_monthly"
  | "premium_annual"
  | "premium_plus_monthly"
  | "premium_plus_annual";

const PREMIUM_PRICE_ENV: Array<{
  planKey: PremiumBillingPlanKey;
  envNames: string[];
}> = [
  {
    planKey: "premium_monthly",
    envNames: ["STRIPE_PREMIUM_MONTHLY_PRICE_ID", "STRIPE_PREMIUM_PRICE_ID"],
  },
  {
    planKey: "premium_annual",
    envNames: ["STRIPE_PREMIUM_ANNUAL_PRICE_ID"],
  },
  {
    planKey: "premium_plus_monthly",
    envNames: ["STRIPE_PREMIUM_PLUS_MONTHLY_PRICE_ID"],
  },
  {
    planKey: "premium_plus_annual",
    envNames: ["STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID"],
  },
];

export function getPremiumPlanKeyFromPriceId(
  priceId: string | null | undefined
): PremiumBillingPlanKey | null {
  if (!priceId) return null;

  for (const entry of PREMIUM_PRICE_ENV) {
    if (entry.envNames.some((name) => process.env[name] === priceId)) {
      return entry.planKey;
    }
  }

  return null;
}

export function getBillingSupabaseAdmin() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

function getStoredPlanKey(planKey: string | null | undefined): SubscriptionPlanId {
  if (planKey?.startsWith("premium_plus")) return "pro";
  if (planKey?.startsWith("premium")) return "premium";
  return normalizeSubscriptionPlan(planKey);
}

export function getLimitsForPlan(planKey: string | null | undefined) {
  return getStoredPlanKey(planKey) === "pro"
    ? PREMIUM_PLUS_LIMITS
    : PREMIUM_LIMITS;
}

export function getBillingPlanLabel(planKey: string | null | undefined) {
  if (planKey === "premium_annual") return "Premium Annual";
  if (planKey === "premium_plus_monthly") return "Premium Pro Monthly";
  if (planKey === "premium_plus_annual") return "Premium Pro Annual";
  if (getStoredPlanKey(planKey) === "pro") return "Premium Pro";
  return "Premium Monthly";
}

function resolveProvider(identity: BillingIdentity): BillingProvider | null {
  if (identity.provider) return identity.provider;
  if (
    identity.stripeCustomerId === "apple" ||
    identity.stripePriceId?.startsWith("loombus_")
  ) {
    return "apple";
  }
  if (
    identity.stripeCustomerId ||
    identity.stripeSubscriptionId ||
    identity.stripePriceId
  ) {
    return "stripe";
  }
  return null;
}

function getProviderNeutralIdentity(identity: BillingIdentity) {
  const provider = resolveProvider(identity);
  return {
    provider,
    providerCustomerId:
      identity.providerCustomerId ??
      (provider === "stripe" ? identity.stripeCustomerId ?? null : null),
    providerSubscriptionId:
      identity.providerSubscriptionId ?? identity.stripeSubscriptionId ?? null,
    providerProductId:
      identity.providerProductId ?? identity.stripePriceId ?? null,
    currentPeriodEnd:
      identity.currentPeriodEnd ?? identity.stripeCurrentPeriodEnd ?? null,
    subscriptionStatus:
      identity.subscriptionStatus ?? identity.stripeSubscriptionStatus ?? null,
  };
}

async function upsertGeneralSubscription({
  userId,
  planKey,
  identity,
  defaultStatus,
}: {
  userId: string;
  planKey: string | null | undefined;
  identity: BillingIdentity;
  defaultStatus: string;
}) {
  const supabase = getBillingSupabaseAdmin();
  const neutral = getProviderNeutralIdentity(identity);
  const updatedAt = new Date().toISOString();

  if (!neutral.provider || !neutral.providerSubscriptionId) {
    throw new Error("General subscription provider identity is incomplete.");
  }

  const { data: existing, error: existingError } = await (
    supabase.from("user_general_subscriptions") as any
  )
    .select("user_id")
    .eq("provider", neutral.provider)
    .eq("provider_subscription_id", neutral.providerSubscriptionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Unable to verify general subscription ownership: ${existingError.message}`);
  }

  if (existing && existing.user_id !== userId) {
    throw new Error("General subscription is already bound to another Loombus account.");
  }

  const { error } = await (supabase.from("user_general_subscriptions") as any).upsert(
    {
      user_id: userId,
      plan_key: getStoredPlanKey(planKey),
      provider: neutral.provider,
      provider_customer_id: neutral.providerCustomerId,
      provider_subscription_id: neutral.providerSubscriptionId,
      provider_product_id: neutral.providerProductId,
      original_transaction_id: identity.originalTransactionId ?? null,
      app_account_token: identity.appAccountToken ?? null,
      environment: identity.environment ?? null,
      status: neutral.subscriptionStatus ?? defaultStatus,
      current_period_end: neutral.currentPeriodEnd,
      cancel_at_period_end: identity.cancelAtPeriodEnd ?? false,
      last_verified_at: identity.lastVerifiedAt ?? updatedAt,
      updated_at: updatedAt,
    },
    { onConflict: "provider,provider_subscription_id" }
  );

  if (error) {
    throw new Error(`Unable to sync general subscription state: ${error.message}`);
  }

  // Once a real billing provider has identified the member's subscription,
  // historic migration-only access must stop participating in entitlement
  // resolution. This prevents a legacy row from preserving paid access after
  // the real Stripe or Apple subscription later expires or is canceled.
  const { error: legacySupersedeError } = await (
    supabase.from("user_general_subscriptions") as any
  )
    .update({
      status: "superseded",
      cancel_at_period_end: false,
      last_verified_at: updatedAt,
      updated_at: updatedAt,
    })
    .eq("user_id", userId)
    .eq("provider", "legacy")
    .neq("status", "superseded");

  if (legacySupersedeError) {
    throw new Error(
      `Unable to retire legacy subscription state: ${legacySupersedeError.message}`
    );
  }

  // Before server verification existed, Apple purchases were stored in the
  // legacy Stripe-shaped columns using the client transaction id. A renewal
  // transaction id is not guaranteed to equal Apple's stable
  // originalTransactionId. Once Apple gives us the authoritative subscription
  // identity, retire any other Apple compatibility rows for this account so a
  // stale historic row cannot keep Premium active after the real subscription
  // expires. Stripe rows are intentionally untouched because cross-provider
  // overlap can be legitimate during a billing-method transition.
  if (neutral.provider === "apple") {
    const { error: appleSupersedeError } = await (
      supabase.from("user_general_subscriptions") as any
    )
      .update({
        status: "superseded",
        cancel_at_period_end: false,
        last_verified_at: updatedAt,
        updated_at: updatedAt,
      })
      .eq("user_id", userId)
      .eq("provider", "apple")
      .neq("provider_subscription_id", neutral.providerSubscriptionId)
      .neq("status", "superseded");

    if (appleSupersedeError) {
      throw new Error(
        `Unable to reconcile historic Apple subscription state: ${appleSupersedeError.message}`
      );
    }
  }
}

async function getEffectivePaidPlanForUser(
  supabase: ReturnType<typeof getBillingSupabaseAdmin>,
  userId: string
): Promise<SubscriptionPlanId> {
  const { data, error } = await (
    supabase.from("user_general_subscriptions") as any
  )
    .select(
      "user_id, plan_key, provider, provider_customer_id, provider_subscription_id, provider_product_id, original_transaction_id, app_account_token, environment, status, current_period_end, cancel_at_period_end, last_verified_at, updated_at"
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Unable to resolve effective subscription state: ${error.message}`);
  }

  const rows = (data ?? []) as GeneralSubscriptionRow[];
  const hasProviderSubscription = rows.some(
    (row) => row.provider === "stripe" || row.provider === "apple"
  );
  const eligibleRows = hasProviderSubscription
    ? rows.filter((row) => row.provider !== "legacy")
    : rows;
  const activeRows = eligibleRows.filter(isGeneralSubscriptionActive);
  if (activeRows.length === 0) return "free";

  return activeRows.reduce<SubscriptionPlanId>((highest, row) => {
    const plan = normalizeSubscriptionPlan(row.plan_key);
    return PLAN_RANK[plan] > PLAN_RANK[highest] ? plan : highest;
  }, "free");
}

async function syncAiEntitlementsFromGeneralSubscriptions({
  userId,
  note,
  legacyStripeFields = {},
}: {
  userId: string;
  note: string;
  legacyStripeFields?: Record<string, string | null>;
}) {
  const supabase = getBillingSupabaseAdmin();
  const updatedAt = new Date().toISOString();

  const { data: currentAiRow, error: currentAiError } = await (
    supabase.from("user_ai_entitlements") as any
  )
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();

  if (currentAiError) {
    throw new Error(`Unable to inspect AI entitlement state: ${currentAiError.message}`);
  }

  // Platform admins are authorization overrides, not subscription products.
  // Billing lifecycle events must never downgrade or rewrite the admin tier.
  if (currentAiRow?.tier?.trim().toLowerCase() === "admin") {
    return;
  }

  const effectivePlan = await getEffectivePaidPlanForUser(supabase, userId);
  const active = effectivePlan !== "free";
  const limits = active
    ? getLimitsForPlan(effectivePlan)
    : FREE_LIMITS;

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      tier: active ? "premium" : "free",
      ai_assisted_enabled: active,
      ...limits,
      ...legacyStripeFields,
      notes: `${note} Effective general plan: ${effectivePlan}.`,
      updated_at: updatedAt,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Unable to synchronize Premium AI access: ${error.message}`);
  }
}

function getLegacyStripeFields(
  identity: BillingIdentity,
  defaultStatus: string
): Record<string, string | null> {
  const neutral = getProviderNeutralIdentity(identity);
  if (neutral.provider !== "stripe") return {};

  return {
    stripe_customer_id: neutral.providerCustomerId,
    stripe_subscription_id: neutral.providerSubscriptionId,
    stripe_price_id: neutral.providerProductId,
    stripe_current_period_end: neutral.currentPeriodEnd,
    stripe_subscription_status: neutral.subscriptionStatus ?? defaultStatus,
  };
}

export async function activatePremiumForUser(
  userId: string,
  note: string,
  planKey?: string | null,
  billingIdentity: BillingIdentity = {}
) {
  const resolvedPlanKey =
    getPremiumPlanKeyFromPriceId(billingIdentity.stripePriceId) ?? planKey;

  await upsertGeneralSubscription({
    userId,
    planKey: resolvedPlanKey,
    identity: billingIdentity,
    defaultStatus: "active",
  });

  await syncAiEntitlementsFromGeneralSubscriptions({
    userId,
    note: `${note} Plan event: ${getBillingPlanLabel(resolvedPlanKey)}.`,
    legacyStripeFields: getLegacyStripeFields(billingIdentity, "active"),
  });
}

export async function deactivatePremiumForUser(
  userId: string,
  note: string,
  billingIdentity: BillingIdentity = {},
  planKey?: string | null
) {
  const supabase = getBillingSupabaseAdmin();
  const neutral = getProviderNeutralIdentity(billingIdentity);
  let resolvedPlanKey =
    getPremiumPlanKeyFromPriceId(billingIdentity.stripePriceId) ?? planKey;

  if (!resolvedPlanKey && neutral.provider && neutral.providerSubscriptionId) {
    const { data: currentSubscription } = await (
      supabase.from("user_general_subscriptions") as any
    )
      .select("plan_key")
      .eq("provider", neutral.provider)
      .eq("provider_subscription_id", neutral.providerSubscriptionId)
      .maybeSingle();
    resolvedPlanKey = currentSubscription?.plan_key ?? "free";
  }

  await upsertGeneralSubscription({
    userId,
    planKey: resolvedPlanKey,
    identity: billingIdentity,
    defaultStatus: "canceled",
  });

  await syncAiEntitlementsFromGeneralSubscriptions({
    userId,
    note,
    legacyStripeFields: getLegacyStripeFields(billingIdentity, "canceled"),
  });
}

export async function ensureExtraAiPackPurchaseLedger({
  supabase,
  packId,
  userId,
  checkoutSessionId,
}: {
  supabase: any;
  packId: string;
  userId: string;
  checkoutSessionId: string;
}) {
  const { data: existingLedger } = await (supabase.from("ai_extra_credit_ledger") as any)
    .select("id")
    .eq("stripe_checkout_session_id", checkoutSessionId)
    .eq("reason", "purchase")
    .limit(1)
    .maybeSingle();

  if (existingLedger) {
    return;
  }

  const { error } = await (supabase.from("ai_extra_credit_ledger") as any).insert({
    pack_id: packId,
    user_id: userId,
    credits_delta: EXTRA_AI_PACK_CREDITS,
    reason: "purchase",
    stripe_checkout_session_id: checkoutSessionId,
  });

  if (error) {
    throw new Error(`Unable to record Extra AI Pack ledger entry: ${error.message}`);
  }
}
