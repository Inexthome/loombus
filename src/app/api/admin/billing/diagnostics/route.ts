import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AdminProfileRow = {
  is_admin: boolean | null;
};

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  updated_at: string | null;
};

type ExtraCreditPackRow = {
  id: string;
  user_id: string;
  purchased_credits: number | null;
  remaining_credits: number | null;
  status: string | null;
  source: string | null;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  created_at: string | null;
};

type ExtraCreditLedgerRow = {
  id: string;
  user_id: string;
  credits_delta: number | null;
  reason: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string | null;
};

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdmin(supabase: ReturnType<typeof getSupabaseForRequest>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<AdminProfileRow>();

  if (profileError || !profile?.is_admin) {
    return { user: null, error: jsonError("Admin access required.", 403) };
  }

  return { user, error: null };
}

function present(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function getConfigStatus() {
  return {
    stripeSecretKey: present(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: present(process.env.STRIPE_WEBHOOK_SECRET),
    premiumMonthlyPrice: present(process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID),
    premiumAnnualPrice: present(process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID),
    premiumPlusMonthlyPrice: present(process.env.STRIPE_PREMIUM_PLUS_MONTHLY_PRICE_ID),
    premiumPlusAnnualPrice: present(process.env.STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID),
    extraAiPackPrice: present(process.env.STRIPE_EXTRA_AI_PACK_PRICE_ID),
    siteUrl: present(process.env.NEXT_PUBLIC_SITE_URL),
    supabaseServiceRole: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function getPlanKey(entitlement: EntitlementRow) {
  if (!entitlement.ai_assisted_enabled) {
    return "free";
  }

  if (entitlement.tier === "admin") {
    return "admin";
  }

  if (entitlement.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50) {
    return "premium_plus";
  }

  if (entitlement.tier === "premium") {
    return "premium";
  }

  return "free";
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { error: adminError } = await requireAdmin(supabase);

  if (adminError) {
    return adminError;
  }

  const [
    entitlementsResult,
    packsResult,
    ledgerResult,
  ] = await Promise.all([
    supabase
      .from("user_ai_entitlements")
      .select(`
        user_id,
        tier,
        ai_assisted_enabled,
        monthly_summary_limit,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        stripe_subscription_status,
        stripe_current_period_end,
        updated_at
      `)
      .order("updated_at", { ascending: false }),
    supabase
      .from("ai_extra_credit_packs")
      .select(`
        id,
        user_id,
        purchased_credits,
        remaining_credits,
        status,
        source,
        stripe_checkout_session_id,
        stripe_customer_id,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("ai_extra_credit_ledger")
      .select(`
        id,
        user_id,
        credits_delta,
        reason,
        stripe_checkout_session_id,
        created_at
      `)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (entitlementsResult.error) {
    return jsonError(
      entitlementsResult.error.message || "Unable to load billing entitlements.",
      400
    );
  }

  if (packsResult.error) {
    return jsonError(
      packsResult.error.message || "Unable to load Extra AI Pack records.",
      400
    );
  }

  if (ledgerResult.error) {
    return jsonError(
      ledgerResult.error.message || "Unable to load Extra AI Pack ledger.",
      400
    );
  }

  const entitlements = (entitlementsResult.data ?? []) as EntitlementRow[];
  const packs = (packsResult.data ?? []) as ExtraCreditPackRow[];
  const ledger = (ledgerResult.data ?? []) as ExtraCreditLedgerRow[];

  const planCounts = entitlements.reduce<Record<string, number>>(
    (counts, entitlement) => {
      const key = getPlanKey(entitlement);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    {
      free: 0,
      premium: 0,
      premium_plus: 0,
      admin: 0,
    }
  );

  const subscriptionStatuses = entitlements.reduce<Record<string, number>>(
    (counts, entitlement) => {
      const status = entitlement.stripe_subscription_status ?? "missing";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {}
  );

  const extraCreditStats = packs.reduce(
    (stats, pack) => {
      stats.totalPacks += 1;
      stats.purchasedCredits += pack.purchased_credits ?? 0;
      stats.remainingCredits += pack.remaining_credits ?? 0;

      const status = pack.status ?? "unknown";
      stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;

      return stats;
    },
    {
      totalPacks: 0,
      purchasedCredits: 0,
      remainingCredits: 0,
      byStatus: {} as Record<string, number>,
    }
  );

  const ledgerStats = ledger.reduce(
    (stats, entry) => {
      stats.totalLedgerEntries += 1;
      stats.netCreditsDelta += entry.credits_delta ?? 0;

      const reason = entry.reason ?? "unknown";
      stats.byReason[reason] = (stats.byReason[reason] ?? 0) + 1;

      return stats;
    },
    {
      totalLedgerEntries: 0,
      netCreditsDelta: 0,
      byReason: {} as Record<string, number>,
    }
  );

  return NextResponse.json({
    config: getConfigStatus(),
    entitlementSummary: {
      totalEntitlements: entitlements.length,
      planCounts,
      stripeLinked: entitlements.filter((item) => Boolean(item.stripe_customer_id)).length,
      subscriptionLinked: entitlements.filter((item) => Boolean(item.stripe_subscription_id)).length,
      priceLinked: entitlements.filter((item) => Boolean(item.stripe_price_id)).length,
      subscriptionStatuses,
    },
    extraCreditStats,
    ledgerStats,
    recentEntitlements: entitlements.slice(0, 25),
    recentPacks: packs,
    recentLedger: ledger,
  });
}
