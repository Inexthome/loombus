import { NextResponse, type NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

export const maxDuration = 60;

const UNVERIFIED_ACCOUNT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const LIST_PAGE_SIZE = 200;
const MAX_LIST_PAGES = 20;
const MAX_DELETIONS_PER_RUN = 100;

const ALLOWED_AUTOMATIC_CLEANUP_STATUSES = new Set(["active", "warned"]);

type ProfileStatusRow = {
  id: string;
  account_status: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

function getConfiguredCronSecret() {
  return process.env.CRON_SECRET ?? process.env.AUTH_LIFECYCLE_CRON_SECRET ?? "";
}

function getProvidedCronSecret(request: NextRequest) {
  const authorizationSecret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";

  return (
    authorizationSecret ||
    request.headers.get("x-auth-lifecycle-cron-secret")?.trim() ||
    ""
  );
}

function getSupabaseServiceClient() {
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

function getAuthProviders(user: User) {
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter(
        (provider): provider is string => typeof provider === "string"
      )
    : [];

  const primaryProvider =
    typeof user.app_metadata?.provider === "string"
      ? [user.app_metadata.provider]
      : [];

  const normalized = [...new Set([...providers, ...primaryProvider])];

  if (normalized.length === 0 && user.email) {
    normalized.push("email");
  }

  return normalized;
}

function isStaleUnverifiedEmailUser(user: User, cutoffMs: number) {
  if (!user.email || user.is_sso_user) {
    return false;
  }

  if (user.email_confirmed_at || user.confirmed_at) {
    return false;
  }

  const providers = getAuthProviders(user);

  if (providers.length === 0 || providers.some((provider) => provider !== "email")) {
    return false;
  }

  const createdAtMs = new Date(user.created_at).getTime();

  return Number.isFinite(createdAtMs) && createdAtMs <= cutoffMs;
}

async function runCleanup(request: NextRequest) {
  const configuredSecret = getConfiguredCronSecret();
  const providedSecret = getProvidedCronSecret(request);

  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = getSupabaseServiceClient();

  if (!supabase) {
    return jsonError("Auth lifecycle service is not configured.", 503);
  }

  const cutoffMs = Date.now() - UNVERIFIED_ACCOUNT_MAX_AGE_MS;
  const candidates: User[] = [];
  let checkedUsers = 0;

  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: LIST_PAGE_SIZE,
    });

    if (error) {
      return jsonError(error.message || "Unable to inspect Auth users.", 500);
    }

    const users = data.users ?? [];
    checkedUsers += users.length;

    for (const user of users) {
      if (isStaleUnverifiedEmailUser(user, cutoffMs)) {
        candidates.push(user);
      }

      if (candidates.length >= MAX_DELETIONS_PER_RUN) {
        break;
      }
    }

    if (
      candidates.length >= MAX_DELETIONS_PER_RUN ||
      users.length < LIST_PAGE_SIZE
    ) {
      break;
    }
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const profileStatusById = new Map<string, string | null>();

  if (candidateIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, account_status")
      .in("id", candidateIds);

    if (profileError) {
      return jsonError(
        profileError.message || "Unable to verify account enforcement status.",
        500
      );
    }

    for (const profile of (profiles ?? []) as ProfileStatusRow[]) {
      profileStatusById.set(profile.id, profile.account_status);
    }
  }

  let deleted = 0;
  let skippedEnforced = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const accountStatus = profileStatusById.get(candidate.id) ?? null;

    if (
      accountStatus &&
      !ALLOWED_AUTOMATIC_CLEANUP_STATUSES.has(accountStatus)
    ) {
      skippedEnforced += 1;
      continue;
    }

    const { error } = await supabase.auth.admin.deleteUser(candidate.id, false);

    if (error) {
      failed += 1;
      console.error(
        "Unable to remove stale unverified Auth user:",
        candidate.id,
        error.message
      );
      continue;
    }

    deleted += 1;

    const createdAtMs = new Date(candidate.created_at).getTime();
    const ageDays = Number.isFinite(createdAtMs)
      ? Math.floor((Date.now() - createdAtMs) / (24 * 60 * 60 * 1000))
      : null;

    await logAuditEvent({
      actor_id: null,
      action: "auth.unverified_account_expired",
      target_type: "auth_user",
      target_id: candidate.id,
      metadata: {
        age_days: ageDays,
        provider: "email",
      },
    });
  }

  return NextResponse.json(
    {
      ok: true,
      checkedUsers,
      eligible: candidates.length,
      deleted,
      skippedEnforced,
      failed,
      maxAgeDays: 7,
      maxDeletionsPerRun: MAX_DELETIONS_PER_RUN,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function GET(request: NextRequest) {
  return runCleanup(request);
}

export async function POST(request: NextRequest) {
  return runCleanup(request);
}
