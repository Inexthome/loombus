import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  getAccountEnforcementResult,
  type AccountEnforcementCode,
} from "@/lib/account-enforcement";

export type RequestAccountProfile = {
  id: string;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type RequestAccountAccessSuccess = {
  ok: true;
  user: User;
  profile: RequestAccountProfile;
};

type RequestAccountAccessFailure = {
  ok: false;
  status: 401 | 403 | 503;
  error: string;
  code?: AccountEnforcementCode;
};

export type RequestAccountAccessResult =
  | RequestAccountAccessSuccess
  | RequestAccountAccessFailure;

export async function verifyRequestAccountAccess(
  supabase: SupabaseClient
): Promise<RequestAccountAccessResult> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, is_admin, account_status, enforcement_reason, suspended_until"
    )
    .eq("id", user.id)
    .maybeSingle<RequestAccountProfile>();

  if (profileError) {
    return {
      ok: false,
      status: 503,
      error: "Unable to verify account access.",
    };
  }

  const enforcement = getAccountEnforcementResult(profile ?? null);

  if (!enforcement.allowed) {
    return {
      ok: false,
      status: 403,
      error: enforcement.errorMessage ?? "Account access is restricted.",
      code: enforcement.code,
    };
  }

  if (!profile) {
    return {
      ok: false,
      status: 403,
      error: "Account access could not be verified.",
      code: "account_access_unverified",
    };
  }

  return {
    ok: true,
    user,
    profile,
  };
}
