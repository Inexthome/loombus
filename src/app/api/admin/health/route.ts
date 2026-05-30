import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AdminProfileRow = {
  is_admin: boolean | null;
};

type CountResult = {
  key: string;
  label: string;
  count: number | null;
  ok: boolean;
  error: string | null;
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
    supabaseUrl: present(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: present(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabaseServiceRole: present(process.env.SUPABASE_SERVICE_ROLE_KEY),
    siteUrl: present(process.env.NEXT_PUBLIC_SITE_URL),

    openAiApiKey: present(process.env.OPENAI_API_KEY),
    openAiSummaryModel: present(process.env.OPENAI_SUMMARY_MODEL),
    openAiTakeawaysModel: present(process.env.OPENAI_TAKEAWAYS_MODEL),
    openAiWhatChangedModel: present(process.env.OPENAI_WHAT_CHANGED_MODEL),
    openAiDisagreementModel: present(process.env.OPENAI_DISAGREEMENT_MODEL),
    openAiQualityCheckModel: present(process.env.OPENAI_QUALITY_CHECK_MODEL),
    openAiRewriteModel: present(process.env.OPENAI_REWRITE_MODEL),
    openAiReplySuggestionsModel: present(process.env.OPENAI_REPLY_SUGGESTIONS_MODEL),
    anthropicApiKey: present(process.env.ANTHROPIC_API_KEY),
    anthropicFallbackModel: present(process.env.ANTHROPIC_FALLBACK_MODEL),

    stripeSecretKey: present(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: present(process.env.STRIPE_WEBHOOK_SECRET),
    premiumMonthlyPrice: present(process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID),
    premiumMonthlyFallbackPrice: present(process.env.STRIPE_PREMIUM_PRICE_ID),
    premiumAnnualPrice: present(process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID),
    premiumPlusMonthlyPrice: present(process.env.STRIPE_PREMIUM_PLUS_MONTHLY_PRICE_ID),
    premiumPlusAnnualPrice: present(process.env.STRIPE_PREMIUM_PLUS_ANNUAL_PRICE_ID),
    extraAiPackPrice: present(process.env.STRIPE_EXTRA_AI_PACK_PRICE_ID),

    resendApiKey: present(process.env.RESEND_API_KEY),
    digestFromEmail: present(process.env.DIGEST_FROM_EMAIL),
    digestCronSecret: present(process.env.DIGEST_CRON_SECRET),
  };
}

async function countTable(
  supabase: ReturnType<typeof getSupabaseForRequest>,
  key: string,
  label: string,
  tableName: string
): Promise<CountResult> {
  const { count, error } = await (supabase.from(tableName) as any).select("*", {
    count: "exact",
    head: true,
  });

  return {
    key,
    label,
    count: error ? null : count ?? 0,
    ok: !error,
    error: error?.message ?? null,
  };
}

async function countFiltered(
  supabase: ReturnType<typeof getSupabaseForRequest>,
  key: string,
  label: string,
  tableName: string,
  applyFilter: (query: any) => any
): Promise<CountResult> {
  const query = (supabase.from(tableName) as any).select("*", {
    count: "exact",
    head: true,
  });

  const { count, error } = await applyFilter(query);

  return {
    key,
    label,
    count: error ? null : count ?? 0,
    ok: !error,
    error: error?.message ?? null,
  };
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

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    profileCount,
    discussionCount,
    replyCount,
    reportCount,
    notificationCount,
    auditLogCount,
    aiUsageCount,
    entitlementCount,
    labsRequestCount,
    extraCreditPackCount,
    topicAlertCount,
    accountDeletionRequestCount,
    supportRequestCount,
    welcomeEmailEventCount,
    openReports,
    failedAi24h,
    newDiscussions24h,
    newReplies24h,
    digestOptIns,
    unlinkedPremiumEntitlements,
    openSupportRequests,
    failedWelcomeEmails,
  ] = await Promise.all([
    countTable(supabase, "profiles", "Profiles", "profiles"),
    countTable(supabase, "discussions", "Discussions", "discussions"),
    countTable(supabase, "replies", "Replies", "replies"),
    countTable(supabase, "reports", "Reports", "reports"),
    countTable(supabase, "notifications", "Notifications", "notifications"),
    countTable(supabase, "audit_logs", "Audit logs", "audit_logs"),
    countTable(supabase, "ai_usage_events", "AI usage events", "ai_usage_events"),
    countTable(supabase, "user_ai_entitlements", "AI entitlements", "user_ai_entitlements"),
    countTable(supabase, "labs_feature_requests", "Labs requests", "labs_feature_requests"),
    countTable(supabase, "ai_extra_credit_packs", "Extra AI packs", "ai_extra_credit_packs"),
    countTable(supabase, "user_topic_alerts", "Topic alerts", "user_topic_alerts"),
    countTable(
      supabase,
      "account_deletion_requests",
      "Account deletion requests",
      "account_deletion_requests"
    ),
    countTable(supabase, "support_requests", "Support requests", "support_requests"),
    countTable(supabase, "welcome_email_events", "Welcome email events", "welcome_email_events"),
    countFiltered(supabase, "open_reports", "Open reports", "reports", (query) =>
      query.in("status", ["new", "reviewing"])
    ),
    countFiltered(supabase, "failed_ai_24h", "Failed AI events, 24h", "ai_usage_events", (query) =>
      query.eq("success", false).gte("created_at", dayAgo)
    ),
    countFiltered(supabase, "new_discussions_24h", "New discussions, 24h", "discussions", (query) =>
      query.gte("created_at", dayAgo)
    ),
    countFiltered(supabase, "new_replies_24h", "New replies, 24h", "replies", (query) =>
      query.gte("created_at", dayAgo)
    ),
    countFiltered(
      supabase,
      "digest_opt_ins",
      "Email digest opt-ins",
      "notification_preferences",
      (query) => query.eq("email_digest_enabled", true)
    ),
    countFiltered(
      supabase,
      "unlinked_premium_entitlements",
      "Premium entitlements missing Stripe customer",
      "user_ai_entitlements",
      (query) =>
        query
          .eq("ai_assisted_enabled", true)
          .in("tier", ["premium", "admin"])
          .is("stripe_customer_id", null)
    ),
    countFiltered(
      supabase,
      "open_support_requests",
      "Open support requests",
      "support_requests",
      (query) => query.in("status", ["new", "reviewing"])
    ),
    countFiltered(
      supabase,
      "failed_welcome_emails",
      "Failed welcome emails",
      "welcome_email_events",
      (query) => query.eq("status", "failed")
    ),
  ]);

  const databaseCounts = [
    profileCount,
    discussionCount,
    replyCount,
    reportCount,
    notificationCount,
    auditLogCount,
    aiUsageCount,
    entitlementCount,
    labsRequestCount,
    extraCreditPackCount,
    topicAlertCount,
    accountDeletionRequestCount,
    supportRequestCount,
    welcomeEmailEventCount,
  ];

  const operationalSignals = [
    openReports,
    failedAi24h,
    newDiscussions24h,
    newReplies24h,
    digestOptIns,
    unlinkedPremiumEntitlements,
    openSupportRequests,
    failedWelcomeEmails,
  ];

  const config = getConfigStatus();
  const missingConfig = Object.entries(config)
    .filter(([, isPresent]) => !isPresent)
    .map(([key]) => key);

  const failedCounts = [...databaseCounts, ...operationalSignals].filter(
    (item) => !item.ok
  );

  const warnings = [
    ...failedCounts.map((item) => ({
      key: `count_${item.key}`,
      severity: "warning",
      message: `${item.label} could not be counted.`,
      detail: item.error,
    })),
    ...(failedWelcomeEmails.count && failedWelcomeEmails.count > 0
      ? [
          {
            key: "failed_welcome_email_count",
            severity: "notice",
            message: `${failedWelcomeEmails.count} welcome emails failed.`,
            detail: "Review welcome_email_events and Resend configuration.",
          },
        ]
      : []),
    ...(openSupportRequests.count && openSupportRequests.count > 0
      ? [
          {
            key: "support_request_count",
            severity: "attention",
            message: `${openSupportRequests.count} support requests need review.`,
            detail: "Support requests with status new or reviewing are open.",
          },
        ]
      : []),
    ...(openReports.count && openReports.count > 0
      ? [
          {
            key: "open_reports",
            severity: "attention",
            message: `${openReports.count} reports need review.`,
            detail: "Reports with status new or reviewing are open.",
          },
        ]
      : []),
    ...(failedAi24h.count && failedAi24h.count > 0
      ? [
          {
            key: "failed_ai_24h",
            severity: "attention",
            message: `${failedAi24h.count} AI events failed in the last 24 hours.`,
            detail: "Review Admin AI Access diagnostics.",
          },
        ]
      : []),
    ...(unlinkedPremiumEntitlements.count && unlinkedPremiumEntitlements.count > 0
      ? [
          {
            key: "unlinked_premium_entitlements",
            severity: "notice",
            message: `${unlinkedPremiumEntitlements.count} enabled Premium/Admin entitlements have no Stripe customer id.`,
            detail:
              "This may be normal for admin-granted access, but paid members should sync after Stripe checkout/webhook.",
          },
        ]
      : []),
    ...(missingConfig.includes("supabaseServiceRole")
      ? [
          {
            key: "missing_service_role",
            severity: "warning",
            message: "SUPABASE_SERVICE_ROLE_KEY is missing.",
            detail: "Server-side writes for audit logs, notifications, and AI usage may fail.",
          },
        ]
      : []),
    ...(missingConfig.includes("openAiApiKey")
      ? [
          {
            key: "missing_openai",
            severity: "warning",
            message: "OPENAI_API_KEY is missing.",
            detail: "Premium AI generation routes will be unavailable.",
          },
        ]
      : []),
    ...(missingConfig.includes("stripeSecretKey")
      ? [
          {
            key: "missing_stripe",
            severity: "notice",
            message: "STRIPE_SECRET_KEY is missing.",
            detail: "Premium checkout and billing portal will not create Stripe sessions.",
          },
        ]
      : []),
  ];

  const status =
    failedCounts.length > 0 || missingConfig.includes("supabaseUrl") || missingConfig.includes("supabaseAnonKey")
      ? "degraded"
      : warnings.some((warning) => warning.severity === "warning")
        ? "attention"
        : "healthy";

  return NextResponse.json({
    generatedAt: now.toISOString(),
    lookback: {
      dayAgo,
      weekAgo,
    },
    status,
    config,
    missingConfig,
    databaseCounts,
    operationalSignals,
    warnings,
  });
}
