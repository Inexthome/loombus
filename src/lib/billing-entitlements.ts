import "server-only";
import { createClient } from "@supabase/supabase-js";
import { AI_ALLOWANCES, normalizeSubscriptionPlan } from "@/lib/subscription-entitlements";

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

export function getLimitsForPlan(planKey: string | null | undefined) {
  if (planKey?.startsWith("premium_plus")) {
    return PREMIUM_PLUS_LIMITS;
  }

  return PREMIUM_LIMITS;
}

export function getBillingPlanLabel(planKey: string | null | undefined) {
  if (planKey === "premium_annual") return "Premium Annual";
  if (planKey === "premium_plus_monthly") return "Premium Pro Monthly";
  if (planKey === "premium_plus_annual") return "Premium Pro Annual";
  if (planKey === "extra_ai_pack") return "Extra AI Pack";
  return "Premium Monthly";
}

function getStoredPlanKey(planKey: string | null | undefined) {
  return normalizeSubscriptionPlan(
    planKey?.startsWith("premium_plus") ? "pro" : planKey?.startsWith("premium") ? "premium" : planKey
  );
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

  if (!neutral.provider) {
    throw new Error("General subscription billing provider is missing.");
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
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`Unable to sync general subscription state: ${error.message}`);
  }
}

export async function activatePremiumForUser(
  userId: string,
  note: string,
  planKey?: string | null,
  billingIdentity: BillingIdentity = {}
) {
  const supabase = getBillingSupabaseAdmin();
  const updatedAt = new Date().toISOString();
  const resolvedPlanKey =
    getPremiumPlanKeyFromPriceId(billingIdentity.stripePriceId) ?? planKey;
  const limits = getLimitsForPlan(resolvedPlanKey);
  const neutral = getProviderNeutralIdentity(billingIdentity);

  await upsertGeneralSubscription({
    userId,
    planKey: resolvedPlanKey,
    identity: billingIdentity,
    defaultStatus: "active",
  });

  const legacyStripeFields = neutral.provider === "stripe"
    ? {
        stripe_customer_id: neutral.providerCustomerId,
        stripe_subscription_id: neutral.providerSubscriptionId,
        stripe_price_id: neutral.providerProductId,
        stripe_current_period_end: neutral.currentPeriodEnd,
        stripe_subscription_status: neutral.subscriptionStatus ?? "active",
      }
    : {};

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      // AI quota storage remains backward compatible while plan identity now
      // lives in user_general_subscriptions.
      tier: "premium",
      ai_assisted_enabled: true,
      ...limits,
      ...legacyStripeFields,
      notes: `${note} Plan: ${getBillingPlanLabel(resolvedPlanKey)}.`,
      updated_at: updatedAt,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw new Error(`Unable to activate Premium AI access: ${error.message}`);
  }
}

export async function deactivatePremiumForUser(
  userId: string,
  note: string,
  billingIdentity: BillingIdentity = {},
  planKey?: string | null
) {
  const supabase = getBillingSupabaseAdmin();
  const updatedAt = new Date().toISOString();
  const neutral = getProviderNeutralIdentity(billingIdentity);

  let resolvedPlanKey = planKey;
  if (!resolvedPlanKey) {
    const { data: currentSubscription } = await (
      supabase.from("user_general_subscriptions") as any
    )
      .select("plan_key")
      .eq("user_id", userId)
      .maybeSingle();
    resolvedPlanKey = currentSubscription?.plan_key ?? "free";
  }

  await upsertGeneralSubscription({
    userId,
    planKey: resolvedPlanKey,
    identity: billingIdentity,
    defaultStatus: "canceled",
  });

  const legacyStripeFields = neutral.provider === "stripe"
    ? {
        stripe_customer_id: neutral.providerCustomerId,
        stripe_subscription_id: neutral.providerSubscriptionId,
        stripe_price_id: neutral.providerProductId,
        stripe_current_period_end: neutral.currentPeriodEnd,
        stripe_subscription_status: neutral.subscriptionStatus ?? "canceled",
      }
    : {};

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      tier: "free",
      ai_assisted_enabled: false,
      monthly_summary_limit: 0,
      monthly_writing_limit: 0,
      monthly_research_limit: 0,
      monthly_discovery_limit: 0,
      ...legacyStripeFields,
      notes: note,
      updated_at: updatedAt,
    },
    {
      onConflict: "user_id",
    }
  );

  if (error) {
    throw new Error(`Unable to deactivate Premium AI access: ${error.message}`);
  }
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
