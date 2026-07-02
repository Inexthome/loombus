import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AdminProfileRow = {
  is_admin: boolean | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  identity_verification_status: string | null;
  identity_verification_provider: string | null;
  identity_verified_at: string | null;
  legal_name_verified: boolean | null;
  identity_restriction_reason: string | null;
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

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

  let admin;

  try {
    admin = getServiceRoleClient();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { data: profileRows, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, username, full_name, bio, avatar_url, is_admin, account_status, identity_verification_status, identity_verification_provider, identity_verified_at, legal_name_verified, identity_restriction_reason, date_of_birth, age_band, teen_safety_mode, guardian_required"
    )
    .order("username", { ascending: true });

  if (profileError) {
    return jsonError(profileError.message || "Unable to load users.", 400);
  }

  const profiles = (profileRows ?? []) as ProfileRow[];
  const userIds = profiles.map((profile) => profile.id);

  let entitlements: EntitlementRow[] = [];

  if (userIds.length > 0) {
    const { data: entitlementRows, error: entitlementError } = await admin
      .from("user_ai_entitlements")
      .select(
        `
        user_id,
        tier,
        ai_assisted_enabled,
        monthly_summary_limit,
        monthly_writing_limit,
        monthly_research_limit,
        monthly_discovery_limit,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        stripe_subscription_status,
        stripe_current_period_end,
        updated_at
      `
      )
      .in("user_id", userIds);

    if (entitlementError) {
      return jsonError(
        entitlementError.message || "Unable to load entitlements.",
        400
      );
    }

    entitlements = (entitlementRows ?? []) as EntitlementRow[];
  }

  return NextResponse.json({ profiles, entitlements });
}
