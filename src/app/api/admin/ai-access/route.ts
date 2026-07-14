import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type AiEntitlementRow = {
  user_id: string;
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
  monthly_writing_limit: number;
  monthly_research_limit: number;
  monthly_discovery_limit: number;
  notes: string | null;
  updated_at: string;
};

type AiUsageEventRow = {
  id: string;
  user_id: string;
  feature_key: string;
  target_type: string | null;
  target_id: string | null;
  provider: string | null;
  model_name: string | null;
  cached: boolean;
  success: boolean;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | string | null;
  created_at: string;
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

const USAGE_LIMIT = 500;

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

  const [entitlementsResult, usageResult] = await Promise.all([
    adminSupabase
      .from("user_ai_entitlements")
      .select(
        "user_id, tier, ai_assisted_enabled, monthly_summary_limit, monthly_writing_limit, monthly_research_limit, monthly_discovery_limit, notes, updated_at"
      )
      .order("updated_at", { ascending: false }),
    adminSupabase
      .from("ai_usage_events")
      .select(
        "id, user_id, feature_key, target_type, target_id, provider, model_name, cached, success, error_message, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(USAGE_LIMIT),
  ]);

  if (entitlementsResult.error) {
    return jsonError(
      entitlementsResult.error.message || "Unable to load AI entitlements.",
      500
    );
  }

  if (usageResult.error) {
    return jsonError(
      usageResult.error.message || "Unable to load AI usage events.",
      500
    );
  }

  const entitlements = (entitlementsResult.data ?? []) as AiEntitlementRow[];
  const usageEvents = (usageResult.data ?? []) as AiUsageEventRow[];
  const userIds = [
    ...new Set([
      ...entitlements.map((item) => item.user_id),
      ...usageEvents.map((item) => item.user_id),
    ]),
  ];

  let profiles: ProfileRow[] = [];

  if (userIds.length > 0) {
    const profilesResult = await adminSupabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, is_admin, account_status, enforcement_reason, suspended_until"
      )
      .in("id", userIds);

    if (profilesResult.error) {
      return jsonError(
        profilesResult.error.message || "Unable to load AI member context.",
        500
      );
    }

    profiles = (profilesResult.data ?? []) as ProfileRow[];
  }

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      usageLimit: USAGE_LIMIT,
      entitlements,
      usageEvents,
      profiles,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
