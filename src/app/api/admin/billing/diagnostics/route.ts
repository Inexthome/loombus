import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const PACK_LIMIT = 50;
const LEDGER_LIMIT = 50;

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  monthly_writing_limit: number | null;
  monthly_research_limit: number | null;
  monthly_discovery_limit: number | null;
  notes: string | null;
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
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  notes: string | null;
  created_at: string | null;
};

type ExtraCreditLedgerRow = {
  id: string;
  pack_id: string | null;
  user_id: string;
  credits_delta: number | null;
  reason: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

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

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Admin Supabase configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function present(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

function getConfigStatus() {
  return {
    stripeSecretKey: present(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: present(process.env.STRIPE_WEBHOOK_SECRET),
    premiumMonthlyPrice: present(process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID),
    premiumMonthlyFallbackPrice: present(process.env.STRIPE_PREMIUM_PRICE_ID),
    premiumAnnualPrice: present(process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID),
    premiumPlusMonthlyPrice: present(process.env.STRIPE_PREMIUM_PLUS_MONTHLY_PRICE_ID),
    premiumPlusAnnualPrice: present(process.env.STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID),
    extraAiPackPrice: present(process.env.STRIPE_EXTRA_AI_PACK_PRICE_ID),
    siteUrl: present(process.env.NEXT_PUBLIC_SITE_URL),
    supabaseServiceRole: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function getPlanKey(entitlement: EntitlementRow) {
  if (!entitlement.ai_assisted_enabled) return "free";
  if (entitlement.tier === "admin") return "admin";

  if (
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  ) {
    return "premium_plus";
  }

  if (entitlement.tier === "premium") return "premium";
  return "free";
}

function needsSyncAttention(entitlement: EntitlementRow) {
  const status = entitlement.stripe_subscription_status;
  const isActive = status === "active" || status === "trialing";
  const periodEnd = entitlement.stripe_current_period_end
    ? new Date(entitlement.stripe_current_period_end).getTime()
    : null;
  const periodExpired =
    periodEnd !== null && Number.isFinite(periodEnd) && periodEnd < Date.now();

  if (
    isActive &&
    (!entitlement.stripe_customer_id ||
      !entitlement.stripe_subscription_id ||
      !entitlement.stripe_price_id)
  ) {
    return true;
  }

  if (isActive && periodExpired) return true;
  if (entitlement.stripe_subscription_id && !status) return true;
  return false;
}

export async function GET(request: NextRequest) {
  let supabase;
  let adminSupabase;

  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const [entitlementsResult, packsResult, ledgerResult] = await Promise.all([
    adminSupabase
      .from("user_ai_entitlements")
      .select(
        "user_id, tier, ai_assisted_enabled, monthly_summary_limit, monthly_writing_limit, monthly_research_limit, monthly_discovery_limit, notes, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status, stripe_current_period_end, updated_at"
      )
      .order("updated_at", { ascending: false }),
    adminSupabase
      .from("ai_extra_credit_packs")
      .select(
        "id, user_id, purchased_credits, remaining_credits, status, source, stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id, notes, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(PACK_LIMIT),
    adminSupabase
      .from("ai_extra_credit_ledger")
      .select(
        "id, pack_id, user_id, credits_delta, reason, stripe_checkout_session_id, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(LEDGER_LIMIT),
  ]);

  if (entitlementsResult.error) {
    return jsonError(
      entitlementsResult.error.message || "Unable to load billing entitlements.",
      500
    );
  }

  if (packsResult.error) {
    return jsonError(
      packsResult.error.message || "Unable to load Extra AI Pack records.",
      500
    );
  }

  if (ledgerResult.error) {
    return jsonError(
      ledgerResult.error.message || "Unable to load Extra AI Pack ledger.",
      500
    );
  }

  const entitlements = (entitlementsResult.data ?? []) as EntitlementRow[];
  const packs = (packsResult.data ?? []) as ExtraCreditPackRow[];
  const ledger = (ledgerResult.data ?? []) as ExtraCreditLedgerRow[];
  const userIds = [
    ...new Set([
      ...entitlements.map((item) => item.user_id),
      ...packs.map((item) => item.user_id),
      ...ledger.map((item) => item.user_id),
    ]),
  ];

  let profiles: ProfileRow[] = [];

  if (userIds.length > 0) {
    const profileResult = await adminSupabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, is_admin, account_status, enforcement_reason, suspended_until"
      )
      .in("id", userIds);

    if (profileResult.error) {
      return jsonError(
        profileResult.error.message || "Unable to load billing member context.",
        500
      );
    }

    profiles = (profileResult.data ?? []) as ProfileRow[];
  }

  const planCounts = entitlements.reduce<Record<string, number>>(
    (counts, entitlement) => {
      const key = getPlanKey(entitlement);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    },
    { free: 0, premium: 0, premium_plus: 0, admin: 0 }
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

  const activeSubscriptions = entitlements.filter((item) =>
    ["active", "trialing"].includes(item.stripe_subscription_status ?? "")
  ).length;
  const syncAttention = entitlements.filter(needsSyncAttention).length;
  const enabledWithoutSubscription = entitlements.filter(
    (item) =>
      item.ai_assisted_enabled &&
      item.tier === "premium" &&
      !item.stripe_subscription_id
  ).length;

  const payload = {
    currentAdminId: accountAccess.user.id,
    generatedAt: new Date().toISOString(),
    packLimit: PACK_LIMIT,
    ledgerLimit: LEDGER_LIMIT,
    config: getConfigStatus(),
    entitlementSummary: {
      totalEntitlements: entitlements.length,
      planCounts,
      stripeLinked: entitlements.filter((item) => Boolean(item.stripe_customer_id)).length,
      subscriptionLinked: entitlements.filter((item) =>
        Boolean(item.stripe_subscription_id)
      ).length,
      priceLinked: entitlements.filter((item) => Boolean(item.stripe_price_id)).length,
      subscriptionStatuses,
      activeSubscriptions,
      syncAttention,
      enabledWithoutSubscription,
    },
    extraCreditStats,
    ledgerStats,
    entitlements,
    packs,
    ledger,
    profiles,
    recentEntitlements: entitlements.slice(0, 25),
    recentPacks: packs,
    recentLedger: ledger,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
