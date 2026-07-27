import "server-only";

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type EnforcementRequestProfile = {
  id: string;
  is_admin: boolean | null;
  account_status: string | null;
  username: string | null;
  full_name: string | null;
};

type EnforcementRequestAuthSuccess = {
  ok: true;
  user: User;
  profile: EnforcementRequestProfile;
  supabase: SupabaseClient;
};

type EnforcementRequestAuthFailure = {
  ok: false;
  status: 401 | 403 | 500;
  error: string;
};

export type EnforcementRequestAuthResult =
  | EnforcementRequestAuthSuccess
  | EnforcementRequestAuthFailure;

function getRequestClient(authorization: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase request configuration.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

export async function authenticateEnforcementRequest(
  authorization: string,
  options: { requireAdmin?: boolean } = {}
): Promise<EnforcementRequestAuthResult> {
  let supabase: SupabaseClient;
  try {
    supabase = getRequestClient(authorization);
  } catch {
    return { ok: false, status: 500, error: "Server configuration error." };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: "Unauthorized." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_admin, account_status, username, full_name")
    .eq("id", user.id)
    .maybeSingle<EnforcementRequestProfile>();

  if (profileError || !profile) {
    return { ok: false, status: 403, error: "Account profile unavailable." };
  }

  if (options.requireAdmin && !profile.is_admin) {
    return { ok: false, status: 403, error: "Admin access required." };
  }

  // This route family intentionally authenticates restricted members so they can
  // read decisions and submit eligible appeals. It must not be reused for ordinary
  // protected product mutations, which must continue using account-status checks.
  return { ok: true, user, profile, supabase };
}
