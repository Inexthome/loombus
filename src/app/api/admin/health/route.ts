import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type HealthSeverity = "notice" | "attention" | "warning";
type HealthStatus = "healthy" | "attention" | "degraded";
type ServiceStatus = HealthStatus | "not_configured";

type CountResult = {
  key: string;
  label: string;
  count: number | null;
  ok: boolean;
  error: string | null;
};

type HealthWarning = {
  key: string;
  severity: HealthSeverity;
  message: string;
  detail: string | null;
  destination: string | null;
};

type ServiceCheck = {
  key: string;
  label: string;
  status: ServiceStatus;
  summary: string;
  detail: string;
  destination: string | null;
};

const DATABASE_COUNT_DEFINITIONS = [
  { key: "profiles", label: "Profiles", table: "profiles" },
  { key: "discussions", label: "Discussions", table: "discussions" },
  { key: "replies", label: "Replies", table: "replies" },
  { key: "reports", label: "Reports", table: "reports" },
  { key: "notifications", label: "Notifications", table: "notifications" },
  { key: "audit_logs", label: "Audit logs", table: "audit_logs" },
  { key: "ai_usage_events", label: "AI usage events", table: "ai_usage_events" },
  {
    key: "user_ai_entitlements",
    label: "AI entitlements",
    table: "user_ai_entitlements",
  },
  {
    key: "labs_feature_requests",
    label: "Labs requests",
    table: "labs_feature_requests",
  },
  {
    key: "ai_extra_credit_packs",
    label: "Extra AI packs",
    table: "ai_extra_credit_packs",
  },
  { key: "user_topic_alerts", label: "Topic alerts", table: "user_topic_alerts" },
  {
    key: "account_deletion_requests",
    label: "Account deletion requests",
    table: "account_deletion_requests",
  },
  { key: "support_requests", label: "Support requests", table: "support_requests" },
  {
    key: "welcome_email_events",
    label: "Welcome email events",
    table: "welcome_email_events",
  },
] as const;

const OPERATIONAL_SIGNAL_DEFINITIONS = [
  { key: "open_reports", label: "Open reports" },
  { key: "failed_ai_24h", label: "Failed AI events, 24h" },
  { key: "failed_ai_7d", label: "Failed AI events, 7d" },
  { key: "new_discussions_24h", label: "New discussions, 24h" },
  { key: "new_replies_24h", label: "New replies, 24h" },
  { key: "new_notifications_24h", label: "New notifications, 24h" },
  { key: "audit_events_24h", label: "Audit events, 24h" },
  { key: "digest_opt_ins", label: "Email digest opt-ins" },
  {
    key: "unlinked_premium_entitlements",
    label: "Active paid Premium subscriptions missing Stripe customer",
  },
  { key: "open_support_requests", label: "Open support requests" },
  { key: "failed_welcome_emails", label: "Failed welcome emails, all time" },
  { key: "failed_welcome_emails_7d", label: "Failed welcome emails, 7d" },
] as const;

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
    return null;
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
    digestCronSecret:
      present(process.env.CRON_SECRET) || present(process.env.DIGEST_CRON_SECRET),

    apnsTeamId: present(process.env.APNS_TEAM_ID),
    apnsKeyId: present(process.env.APNS_KEY_ID),
    apnsPrivateKey:
      present(process.env.APNS_PRIVATE_KEY) ||
      present(process.env.APNS_PRIVATE_KEY_BASE64),
    apnsBundleId: present(process.env.APNS_BUNDLE_ID),
    apnsEnvironment: present(process.env.APNS_ENVIRONMENT),

    firebaseServiceAccount:
      present(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) ||
      present(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64),
    firebaseProjectId: present(process.env.FIREBASE_PROJECT_ID),
    firebaseClientEmail: present(process.env.FIREBASE_CLIENT_EMAIL),
    firebasePrivateKey:
      present(process.env.FIREBASE_PRIVATE_KEY) ||
      present(process.env.FIREBASE_PRIVATE_KEY_BASE64),
  };
}

type ConfigStatus = ReturnType<typeof getConfigStatus>;

function unavailableCount(key: string, label: string, error: string): CountResult {
  return {
    key,
    label,
    count: null,
    ok: false,
    error,
  };
}

async function countTable(
  supabase: any,
  key: string,
  label: string,
  tableName: string
): Promise<CountResult> {
  const { count, error } = await supabase.from(tableName).select("*", {
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
  supabase: any,
  key: string,
  label: string,
  tableName: string,
  applyFilter: (query: any) => any
): Promise<CountResult> {
  const query = supabase.from(tableName).select("*", {
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

function findCount(items: CountResult[], key: string) {
  return items.find((item) => item.key === key)?.count ?? 0;
}

function getServiceChecks(
  config: ConfigStatus,
  databaseCounts: CountResult[],
  operationalSignals: CountResult[]
): ServiceCheck[] {
  const failedDatabaseChecks = databaseCounts.filter((item) => !item.ok).length;
  const failedOperationalChecks = operationalSignals.filter((item) => !item.ok).length;
  const failedAi24h = findCount(operationalSignals, "failed_ai_24h");
  const unlinkedPaidPremium = findCount(
    operationalSignals,
    "unlinked_premium_entitlements"
  );
  const failedWelcomeEmailsAllTime = findCount(
    operationalSignals,
    "failed_welcome_emails"
  );
  const failedWelcomeEmails7d = findCount(
    operationalSignals,
    "failed_welcome_emails_7d"
  );

  const coreConfigured = [
    config.supabaseUrl,
    config.supabaseAnonKey,
    config.supabaseServiceRole,
    config.siteUrl,
  ].filter(Boolean).length;
  const aiModelsConfigured = [
    config.openAiSummaryModel,
    config.openAiTakeawaysModel,
    config.openAiWhatChangedModel,
    config.openAiDisagreementModel,
    config.openAiQualityCheckModel,
    config.openAiRewriteModel,
    config.openAiReplySuggestionsModel,
  ].filter(Boolean).length;
  const billingPricesConfigured = [
    config.premiumMonthlyPrice || config.premiumMonthlyFallbackPrice,
    config.premiumAnnualPrice,
    config.premiumPlusMonthlyPrice,
    config.premiumPlusAnnualPrice,
    config.extraAiPackPrice,
  ].filter(Boolean).length;
  const emailConfigured = [
    config.resendApiKey,
    config.digestFromEmail,
    config.digestCronSecret,
  ].filter(Boolean).length;
  const apnsConfigured = [
    config.apnsTeamId,
    config.apnsKeyId,
    config.apnsPrivateKey,
    config.apnsBundleId,
    config.apnsEnvironment,
  ].every(Boolean);
  const firebaseConfigured =
    config.firebaseServiceAccount ||
    [
      config.firebaseProjectId,
      config.firebaseClientEmail,
      config.firebasePrivateKey,
    ].every(Boolean);

  return [
    {
      key: "core",
      label: "Core platform",
      status: coreConfigured === 4 ? "healthy" : "degraded",
      summary: `${coreConfigured}/4 core settings configured`,
      detail:
        coreConfigured === 4
          ? "Application URL and Supabase server configuration are present."
          : "One or more core runtime settings are missing.",
      destination: null,
    },
    {
      key: "database",
      label: "Database visibility",
      status:
        failedDatabaseChecks > 0 || failedOperationalChecks > 0
          ? "degraded"
          : "healthy",
      summary:
        failedDatabaseChecks + failedOperationalChecks === 0
          ? "All read checks completed"
          : `${failedDatabaseChecks + failedOperationalChecks} checks failed`,
      detail:
        failedDatabaseChecks + failedOperationalChecks === 0
          ? "Admin operational tables and filtered signals are readable."
          : "At least one Admin health query could not complete.",
      destination: "/admin/audit",
    },
    {
      key: "ai",
      label: "AI operations",
      status: !config.openAiApiKey
        ? "degraded"
        : failedAi24h > 0
          ? "attention"
          : "healthy",
      summary: !config.openAiApiKey
        ? "OpenAI key missing"
        : `${aiModelsConfigured}/7 model settings configured`,
      detail:
        failedAi24h > 0
          ? `${failedAi24h} AI events failed during the last 24 hours.`
          : "No recent AI failures require attention.",
      destination: "/admin/ai-access",
    },
    {
      key: "billing",
      label: "Billing sync",
      status: !config.stripeSecretKey
        ? "not_configured"
        : !config.stripeWebhookSecret || unlinkedPaidPremium > 0
          ? "attention"
          : "healthy",
      summary: `${billingPricesConfigured}/5 billing prices configured`,
      detail:
        unlinkedPaidPremium > 0
          ? `${unlinkedPaidPremium} active paid Premium subscriptions have no Stripe customer.`
          : "No current active paid entitlement-linkage warning was detected.",
      destination: "/admin/billing",
    },
    {
      key: "email",
      label: "Email delivery",
      status: emailConfigured === 0
        ? "not_configured"
        : emailConfigured < 3 || failedWelcomeEmails7d > 0
          ? "attention"
          : "healthy",
      summary: `${emailConfigured}/3 email settings configured`,
      detail:
        failedWelcomeEmails7d > 0
          ? `${failedWelcomeEmails7d} welcome email events were updated as failed during the last 7 days.`
          : failedWelcomeEmailsAllTime > 0
            ? `No recent welcome-email failures require attention. ${failedWelcomeEmailsAllTime} historical failed records remain visible in diagnostics.`
            : "No welcome-email failures require attention.",
      destination: "/admin/audit?search=welcome_email",
    },
    {
      key: "push",
      label: "Push delivery",
      status:
        apnsConfigured && firebaseConfigured
          ? "healthy"
          : apnsConfigured || firebaseConfigured
            ? "attention"
            : "not_configured",
      summary: `${apnsConfigured ? "APNs ready" : "APNs incomplete"} · ${
        firebaseConfigured ? "Firebase ready" : "Firebase incomplete"
      }`,
      detail:
        apnsConfigured && firebaseConfigured
          ? "Both iOS and Android push-provider settings are present."
          : "Push configuration is incomplete for one or both mobile platforms.",
      destination: null,
    },
  ];
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
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

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const config = getConfigStatus();
  const adminSupabase = getAdminSupabase();
  const unavailableMessage =
    "Admin service-role configuration is unavailable; this check was not executed.";

  let databaseCounts: CountResult[];
  let operationalSignals: CountResult[];

  if (!adminSupabase) {
    databaseCounts = DATABASE_COUNT_DEFINITIONS.map((definition) =>
      unavailableCount(definition.key, definition.label, unavailableMessage)
    );
    operationalSignals = OPERATIONAL_SIGNAL_DEFINITIONS.map((definition) =>
      unavailableCount(definition.key, definition.label, unavailableMessage)
    );
  } else {
    databaseCounts = await Promise.all(
      DATABASE_COUNT_DEFINITIONS.map((definition) =>
        countTable(
          adminSupabase,
          definition.key,
          definition.label,
          definition.table
        )
      )
    );

    operationalSignals = await Promise.all([
      countFiltered(adminSupabase, "open_reports", "Open reports", "reports", (query) =>
        query.in("status", ["new", "reviewing"])
      ),
      countFiltered(
        adminSupabase,
        "failed_ai_24h",
        "Failed AI events, 24h",
        "ai_usage_events",
        (query) => query.eq("success", false).gte("created_at", dayAgo)
      ),
      countFiltered(
        adminSupabase,
        "failed_ai_7d",
        "Failed AI events, 7d",
        "ai_usage_events",
        (query) => query.eq("success", false).gte("created_at", weekAgo)
      ),
      countFiltered(
        adminSupabase,
        "new_discussions_24h",
        "New discussions, 24h",
        "discussions",
        (query) => query.gte("created_at", dayAgo)
      ),
      countFiltered(
        adminSupabase,
        "new_replies_24h",
        "New replies, 24h",
        "replies",
        (query) => query.gte("created_at", dayAgo)
      ),
      countFiltered(
        adminSupabase,
        "new_notifications_24h",
        "New notifications, 24h",
        "notifications",
        (query) => query.gte("created_at", dayAgo)
      ),
      countFiltered(
        adminSupabase,
        "audit_events_24h",
        "Audit events, 24h",
        "audit_logs",
        (query) => query.gte("created_at", dayAgo)
      ),
      countFiltered(
        adminSupabase,
        "digest_opt_ins",
        "Email digest opt-ins",
        "notification_preferences",
        (query) => query.eq("email_digest_enabled", true)
      ),
      countFiltered(
        adminSupabase,
        "unlinked_premium_entitlements",
        "Active paid Premium subscriptions missing Stripe customer",
        "user_ai_entitlements",
        (query) =>
          query
            .eq("ai_assisted_enabled", true)
            .eq("tier", "premium")
            .in("stripe_subscription_status", ["active", "trialing"])
            .is("stripe_customer_id", null)
      ),
      countFiltered(
        adminSupabase,
        "open_support_requests",
        "Open support requests",
        "support_requests",
        (query) => query.in("status", ["new", "reviewing"])
      ),
      countFiltered(
        adminSupabase,
        "failed_welcome_emails",
        "Failed welcome emails, all time",
        "welcome_email_events",
        (query) => query.eq("status", "failed")
      ),
      countFiltered(
        adminSupabase,
        "failed_welcome_emails_7d",
        "Failed welcome emails, 7d",
        "welcome_email_events",
        (query) =>
          query.eq("status", "failed").gte("updated_at", weekAgo)
      ),
    ]);
  }

  const missingConfig = Object.entries(config)
    .filter(([, isPresent]) => !isPresent)
    .map(([key]) => key);
  const failedCounts = [...databaseCounts, ...operationalSignals].filter(
    (item) => !item.ok
  );
  const openReports = findCount(operationalSignals, "open_reports");
  const failedAi24h = findCount(operationalSignals, "failed_ai_24h");
  const openSupportRequests = findCount(
    operationalSignals,
    "open_support_requests"
  );
  const failedWelcomeEmails7d = findCount(
    operationalSignals,
    "failed_welcome_emails_7d"
  );
  const unlinkedPremiumEntitlements = findCount(
    operationalSignals,
    "unlinked_premium_entitlements"
  );

  const warnings: HealthWarning[] = [
    ...failedCounts.map((item) => ({
      key: `count_${item.key}`,
      severity: "warning" as const,
      message: `${item.label} could not be counted.`,
      detail: item.error,
      destination: "/admin/audit",
    })),
    ...(failedWelcomeEmails7d > 0
      ? [
          {
            key: "failed_welcome_email_count_7d",
            severity: "attention" as const,
            message: `${failedWelcomeEmails7d} welcome emails failed in the last 7 days.`,
            detail:
              "Review recent welcome-email events and current Resend delivery status.",
            destination: "/admin/audit?search=welcome_email",
          },
        ]
      : []),
    ...(openSupportRequests > 0
      ? [
          {
            key: "support_request_count",
            severity: "attention" as const,
            message: `${openSupportRequests} support requests need review.`,
            detail: "Support requests with status new or reviewing are open.",
            destination: "/admin/support",
          },
        ]
      : []),
    ...(openReports > 0
      ? [
          {
            key: "open_reports",
            severity: "attention" as const,
            message: `${openReports} reports need review.`,
            detail: "Reports with status new or reviewing are open.",
            destination: "/admin/reports",
          },
        ]
      : []),
    ...(failedAi24h > 0
      ? [
          {
            key: "failed_ai_24h",
            severity: "attention" as const,
            message: `${failedAi24h} AI events failed in the last 24 hours.`,
            detail: "Review AI usage diagnostics and provider errors.",
            destination: "/admin/ai-access",
          },
        ]
      : []),
    ...(unlinkedPremiumEntitlements > 0
      ? [
          {
            key: "unlinked_premium_entitlements",
            severity: "attention" as const,
            message: `${unlinkedPremiumEntitlements} active paid Premium subscriptions have no Stripe customer ID.`,
            detail:
              "Admin and manually granted Premium access are excluded. Review active or trialing paid subscriptions only.",
            destination: "/admin/billing?link=attention",
          },
        ]
      : []),
    ...(!config.supabaseServiceRole
      ? [
          {
            key: "missing_service_role",
            severity: "warning" as const,
            message: "SUPABASE_SERVICE_ROLE_KEY is missing.",
            detail:
              "Admin operational reads and server-side writes may fail. Health counts were not executed.",
            destination: null,
          },
        ]
      : []),
    ...(!config.openAiApiKey
      ? [
          {
            key: "missing_openai",
            severity: "warning" as const,
            message: "OPENAI_API_KEY is missing.",
            detail: "Premium AI generation routes will be unavailable.",
            destination: "/admin/ai-access",
          },
        ]
      : []),
    ...(!config.stripeSecretKey
      ? [
          {
            key: "missing_stripe",
            severity: "notice" as const,
            message: "STRIPE_SECRET_KEY is missing.",
            detail:
              "Premium checkout and billing-portal routes cannot create Stripe sessions.",
            destination: "/admin/billing",
          },
        ]
      : []),
    ...(config.stripeSecretKey && !config.stripeWebhookSecret
      ? [
          {
            key: "missing_stripe_webhook",
            severity: "attention" as const,
            message: "STRIPE_WEBHOOK_SECRET is missing.",
            detail:
              "Checkout can start, but subscription and Extra AI Pack fulfillment cannot be verified through Stripe webhooks.",
            destination: "/admin/billing",
          },
        ]
      : []),
    ...(!config.resendApiKey
      ? [
          {
            key: "missing_resend",
            severity: "notice" as const,
            message: "RESEND_API_KEY is missing.",
            detail: "Transactional email and digest delivery will be unavailable.",
            destination: null,
          },
        ]
      : []),
  ];

  const status: HealthStatus =
    failedCounts.length > 0 ||
    !config.supabaseUrl ||
    !config.supabaseAnonKey ||
    !config.supabaseServiceRole
      ? "degraded"
      : warnings.some((warning) =>
            ["warning", "attention"].includes(warning.severity)
          )
        ? "attention"
        : "healthy";
  const serviceChecks = getServiceChecks(
    config,
    databaseCounts,
    operationalSignals
  );

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: now.toISOString(),
      lookback: {
        dayAgo,
        weekAgo,
      },
      status,
      dataAccessMode: adminSupabase ? "service_role" : "unavailable",
      config,
      missingConfig,
      databaseCounts,
      operationalSignals,
      warnings,
      serviceChecks,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
