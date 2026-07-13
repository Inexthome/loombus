import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforcement_note: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
  identity_verification_status: string | null;
  identity_verification_provider: string | null;
  identity_verified_at: string | null;
  legal_name_verified: boolean | null;
  identity_restriction_reason: string | null;
};

type SensitiveProfileRow = {
  id: string;
  date_of_birth: string | null;
  age_band: string | null;
  teen_safety_mode: boolean | null;
  guardian_required: boolean | null;
};

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  monthly_writing_limit: number | null;
  monthly_research_limit: number | null;
  monthly_discovery_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  updated_at: string | null;
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
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
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

  const [profilesResult, sensitiveResult, entitlementsResult] = await Promise.all([
    adminSupabase
      .from("profiles")
      .select(
        "id, username, full_name, bio, avatar_url, is_admin, account_status, enforcement_reason, enforcement_note, enforced_at, suspended_until, identity_verification_status, identity_verification_provider, identity_verified_at, legal_name_verified, identity_restriction_reason"
      )
      .order("username", { ascending: true }),
    adminSupabase
      .from("profile_sensitive")
      .select(
        "id, date_of_birth, age_band, teen_safety_mode, guardian_required"
      ),
    adminSupabase
      .from("user_ai_entitlements")
      .select(
        "user_id, tier, ai_assisted_enabled, monthly_summary_limit, monthly_writing_limit, monthly_research_limit, monthly_discovery_limit, stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status, stripe_current_period_end, updated_at"
      ),
  ]);

  if (profilesResult.error) {
    return jsonError(
      profilesResult.error.message || "Unable to load member profiles.",
      500
    );
  }

  if (sensitiveResult.error) {
    return jsonError(
      sensitiveResult.error.message || "Unable to load age-safety records.",
      500
    );
  }

  if (entitlementsResult.error) {
    return jsonError(
      entitlementsResult.error.message || "Unable to load member entitlements.",
      500
    );
  }

  const sensitiveByUserId = new Map(
    ((sensitiveResult.data ?? []) as SensitiveProfileRow[]).map((row) => [
      row.id,
      row,
    ])
  );
  const entitlementByUserId = new Map(
    ((entitlementsResult.data ?? []) as EntitlementRow[]).map((row) => [
      row.user_id,
      row,
    ])
  );

  const users = ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => {
    const sensitive = sensitiveByUserId.get(profile.id) ?? null;

    return {
      ...profile,
      date_of_birth_on_file: Boolean(sensitive?.date_of_birth),
      age_band: sensitive?.age_band ?? null,
      teen_safety_mode: Boolean(sensitive?.teen_safety_mode),
      guardian_required: Boolean(sensitive?.guardian_required),
      entitlement: entitlementByUserId.get(profile.id) ?? null,
    };
  });

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      users,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
