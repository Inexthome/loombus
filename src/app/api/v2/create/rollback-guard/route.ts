import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FeatureFlag = {
  enabled: boolean | null;
  rollout_percentage: number | null;
  allowed_user_ids: string[] | null;
};

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "").trim() || null : null;
}

function getDeterministicBucket(userId: string) {
  let hash = 0;

  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) % 100;
  }

  return hash;
}

function isFlagEnabledForUser(flag: FeatureFlag | null | undefined, userId: string | null) {
  if (!flag?.enabled) return false;
  if (userId && (flag.allowed_user_ids ?? []).includes(userId)) return true;

  const rolloutPercentage = flag.rollout_percentage ?? 0;
  if (rolloutPercentage >= 100) return true;
  if (!userId || rolloutPercentage <= 0) return false;

  return getDeterministicBucket(userId) < rolloutPercentage;
}

async function getFeatureFlag(adminSupabase: ReturnType<typeof createClient>, key: string) {
  const { data, error } = await adminSupabase
    .from("loombus_feature_flags")
    .select("enabled, rollout_percentage, allowed_user_ids")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    return { flag: null, error };
  }

  return { flag: (data as FeatureFlag | null) ?? null, error: null };
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, blocked: true, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json({ ok: false, blocked: true, locked: true, reason: "Rollback guard is not configured." });
    }

    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ ok: false, blocked: true, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { flag: shellFlag, error: shellFlagError } = await getFeatureFlag(adminSupabase, "v2_shell");

    if (shellFlagError || !isFlagEnabledForUser(shellFlag, user.id)) {
      return NextResponse.json({ ok: false, blocked: true, locked: true, reason: "V2 access is required." }, { status: 403 });
    }

    const { flag: publishFlag, error: publishFlagError } = await getFeatureFlag(adminSupabase, "v2_create_publish_enabled");
    const publishAllowed = !publishFlagError && isFlagEnabledForUser(publishFlag, user.id);

    if (!publishAllowed) {
      return NextResponse.json({
        ok: true,
        blocked: true,
        locked: true,
        status: "rollback_guard_active",
        reason: "V2 Create publishing is disabled by the rollback guard.",
        flag: {
          key: "v2_create_publish_enabled",
          enabled: Boolean(publishFlag?.enabled),
          rolloutPercentage: publishFlag?.rollout_percentage ?? 0,
          userAllowlisted: Boolean((publishFlag?.allowed_user_ids ?? []).includes(user.id)),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      blocked: false,
      locked: true,
      status: "rollback_guard_open",
      reason: "Rollback guard would allow this user, but final action remains separately locked.",
      flag: {
        key: "v2_create_publish_enabled",
        enabled: true,
        rolloutPercentage: publishFlag?.rollout_percentage ?? 0,
        userAllowlisted: Boolean((publishFlag?.allowed_user_ids ?? []).includes(user.id)),
      },
    });
  } catch (error) {
    console.error("Unexpected V2 rollback guard failure:", error);
    return NextResponse.json({ ok: false, blocked: true, locked: true, reason: "Unexpected rollback guard failure." }, { status: 500 });
  }
}
