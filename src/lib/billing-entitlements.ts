import { createClient } from "@supabase/supabase-js";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const EXTRA_AI_PACK_CREDITS = 25;

export const PREMIUM_LIMITS = {
  monthly_summary_limit: 50,
  monthly_writing_limit: 25,
  monthly_research_limit: 10,
  monthly_discovery_limit: 25,
};

export const PREMIUM_PLUS_LIMITS = {
  monthly_summary_limit: 150,
  monthly_writing_limit: 75,
  monthly_research_limit: 30,
  monthly_discovery_limit: 75,
};

export type BillingIdentity = {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  stripeSubscriptionStatus?: string | null;
};

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
  if (planKey === "premium_plus_monthly") return "Premium Plus Monthly";
  if (planKey === "premium_plus_annual") return "Premium Plus Annual";
  if (planKey === "extra_ai_pack") return "Extra AI Pack";
  return "Premium Monthly";
}

export async function activatePremiumForUser(
  userId: string,
  note: string,
  planKey?: string | null,
  billingIdentity: BillingIdentity = {}
) {
  const supabase = getBillingSupabaseAdmin();
  const updatedAt = new Date().toISOString();
  const limits = getLimitsForPlan(planKey);

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      tier: "premium",
      ai_assisted_enabled: true,
      ...limits,
      stripe_customer_id: billingIdentity.stripeCustomerId ?? null,
      stripe_subscription_id: billingIdentity.stripeSubscriptionId ?? null,
      stripe_price_id: billingIdentity.stripePriceId ?? null,
      stripe_current_period_end: billingIdentity.stripeCurrentPeriodEnd ?? null,
      stripe_subscription_status:
        billingIdentity.stripeSubscriptionStatus ?? "active",
      notes: `${note} Plan: ${getBillingPlanLabel(planKey)}.`,
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
  billingIdentity: BillingIdentity = {}
) {
  const supabase = getBillingSupabaseAdmin();
  const updatedAt = new Date().toISOString();

  const { error } = await supabase.from("user_ai_entitlements").upsert(
    {
      user_id: userId,
      tier: "free",
      ai_assisted_enabled: false,
      monthly_summary_limit: 0,
      monthly_writing_limit: 0,
      monthly_research_limit: 0,
      monthly_discovery_limit: 0,
      stripe_customer_id: billingIdentity.stripeCustomerId ?? null,
      stripe_subscription_id: billingIdentity.stripeSubscriptionId ?? null,
      stripe_price_id: billingIdentity.stripePriceId ?? null,
      stripe_current_period_end: billingIdentity.stripeCurrentPeriodEnd ?? null,
      stripe_subscription_status:
        billingIdentity.stripeSubscriptionStatus ?? "canceled",
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
