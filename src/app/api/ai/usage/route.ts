import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAiFeatureLimitPolicy } from "@/lib/premium-ai";

type ProfileRow = {
  is_admin: boolean | null;
};

type EntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  monthly_writing_limit: number | null;
  monthly_research_limit: number | null;
  monthly_discovery_limit: number | null;
};

type UsageEventRow = {
  id: string;
  feature_key: string;
  target_type: string | null;
  target_id: string | null;
  provider: string | null;
  model_name: string | null;
  cached: boolean | null;
  success: boolean | null;
  created_at: string;
};

type FeatureUsage = {
  featureKey: string;
  bucket: string;
  label: string;
  total: number;
  metered: number;
  generated: number;
  cached: number;
  failed: number;
  lastUsedAt: string | null;
};

type LimitBucketUsage = {
  bucket: string;
  label: string;
  limit: number | null;
  usage: number;
  remaining: number | null;
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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function resolveEntitlement(entitlement: EntitlementRow | null, isAdmin: boolean) {
  if (isAdmin) {
    return {
      tier: "admin",
      ai_assisted_enabled: true,
      monthly_summary_limit: 999999,
      monthly_writing_limit: 999999,
      monthly_research_limit: 999999,
      monthly_discovery_limit: 999999,
    };
  }

  return {
    tier: entitlement?.tier ?? "free",
    ai_assisted_enabled: Boolean(entitlement?.ai_assisted_enabled),
    monthly_summary_limit: entitlement?.monthly_summary_limit ?? 0,
    monthly_writing_limit: entitlement?.monthly_writing_limit ?? 0,
    monthly_research_limit: entitlement?.monthly_research_limit ?? 0,
    monthly_discovery_limit: entitlement?.monthly_discovery_limit ?? 0,
  };
}

function summarizeFeatures(events: UsageEventRow[]) {
  const usage: Record<string, FeatureUsage> = {};

  for (const event of events) {
    const featureKey = event.feature_key || "unknown";

    const policy = getAiFeatureLimitPolicy(featureKey);

    usage[featureKey] ??= {
      featureKey,
      bucket: policy.bucket,
      label: policy.label,
      total: 0,
      metered: 0,
      generated: 0,
      cached: 0,
      failed: 0,
      lastUsedAt: null,
    };

    usage[featureKey].total += 1;

    if (event.cached) {
      usage[featureKey].cached += 1;
    } else {
      usage[featureKey].metered += 1;
    }

    if (event.success === false) {
      usage[featureKey].failed += 1;
    } else if (!event.cached) {
      usage[featureKey].generated += 1;
    }

    if (
      !usage[featureKey].lastUsedAt ||
      new Date(event.created_at).getTime() >
        new Date(usage[featureKey].lastUsedAt).getTime()
    ) {
      usage[featureKey].lastUsedAt = event.created_at;
    }
  }

  return Object.values(usage).sort((a, b) => {
    if (b.metered !== a.metered) {
      return b.metered - a.metered;
    }

    return b.total - a.total;
  });
}

function summarizeLimitBuckets(
  events: UsageEventRow[],
  entitlement: ReturnType<typeof resolveEntitlement>,
  isAdmin: boolean
): LimitBucketUsage[] {
  const usageByBucket: Record<string, number> = {
    summary: 0,
    writing: 0,
    research: 0,
    discovery: 0,
  };

  for (const event of events) {
    if (event.cached || event.success === false) {
      continue;
    }

    const policy = getAiFeatureLimitPolicy(event.feature_key || "unknown");
    usageByBucket[policy.bucket] = (usageByBucket[policy.bucket] ?? 0) + 1;
  }

  const bucketLimits = {
    summary: entitlement.monthly_summary_limit,
    writing: entitlement.monthly_writing_limit,
    research: entitlement.monthly_research_limit,
    discovery: entitlement.monthly_discovery_limit,
  };

  const labels: Record<string, string> = {
    summary: "Thread understanding",
    writing: "Writing assist",
    research: "Research assist",
    discovery: "Discovery assist",
  };

  return Object.entries(bucketLimits).map(([bucket, limit]) => {
    const usage = usageByBucket[bucket] ?? 0;
    const normalizedLimit = isAdmin ? null : limit;

    return {
      bucket,
      label: labels[bucket] ?? bucket,
      limit: normalizedLimit,
      usage,
      remaining:
        normalizedLimit === null ? null : Math.max(normalizedLimit - usage, 0),
    };
  });
}

function sanitizeRecentEvents(events: UsageEventRow[]) {
  return events.map((event) => ({
    id: event.id,
    feature_key: event.feature_key,
    target_type: event.target_type,
    target_id: event.target_id,
    provider: event.provider,
    model_name: event.model_name,
    cached: Boolean(event.cached),
    success: event.success !== false,
    created_at: event.created_at,
  }));
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const monthStart = getCurrentMonthStart();

  const [
    { data: profile, error: profileError },
    { data: entitlement, error: entitlementError },
    { data: monthlyEvents, error: monthlyUsageError },
    { data: recentEvents, error: recentUsageError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),

    supabase
      .from("user_ai_entitlements")
      .select(`
        tier,
        ai_assisted_enabled,
        monthly_summary_limit,
        monthly_writing_limit,
        monthly_research_limit,
        monthly_discovery_limit
      `)
      .eq("user_id", user.id)
      .maybeSingle<EntitlementRow>(),

    supabase
      .from("ai_usage_events")
      .select(`
        id,
        feature_key,
        target_type,
        target_id,
        provider,
        model_name,
        cached,
        success,
        created_at
      `)
      .eq("user_id", user.id)
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false })
      .limit(500),

    supabase
      .from("ai_usage_events")
      .select(`
        id,
        feature_key,
        target_type,
        target_id,
        provider,
        model_name,
        cached,
        success,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const firstError =
    profileError || entitlementError || monthlyUsageError || recentUsageError;

  if (firstError) {
    return jsonError(firstError.message || "Unable to load AI usage.", 400);
  }

  const isAdmin = Boolean(profile?.is_admin);
  const resolvedEntitlement = resolveEntitlement(entitlement ?? null, isAdmin);
  const loadedMonthlyEvents = (monthlyEvents ?? []) as UsageEventRow[];
  const loadedRecentEvents = (recentEvents ?? []) as UsageEventRow[];

  const meteredUsage = loadedMonthlyEvents.filter((event) => !event.cached).length;
  const generatedUsage = loadedMonthlyEvents.filter(
    (event) => !event.cached && event.success !== false
  ).length;
  const cachedUsage = loadedMonthlyEvents.filter((event) => event.cached).length;
  const failedUsage = loadedMonthlyEvents.filter(
    (event) => event.success === false
  ).length;

  const monthlyLimit = isAdmin
    ? null
    : resolvedEntitlement.monthly_summary_limit;

  const remaining =
    monthlyLimit === null ? null : Math.max(monthlyLimit - meteredUsage, 0);

  return NextResponse.json({
    ok: true,
    isAdmin,
    entitlement: resolvedEntitlement,
    currentMonth: {
      start: monthStart,
      limit: monthlyLimit,
      meteredUsage,
      generatedUsage,
      cachedUsage,
      failedUsage,
      remaining,
      featureUsage: summarizeFeatures(loadedMonthlyEvents),
      limitBuckets: summarizeLimitBuckets(
        loadedMonthlyEvents,
        resolvedEntitlement,
        isAdmin
      ),
    },
    recentEvents: sanitizeRecentEvents(loadedRecentEvents),
  });
}
