import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FeatureFlag = {
  enabled: boolean | null;
  rollout_percentage: number | null;
  allowed_user_ids: string[] | null;
};

const FINAL_ACTION_LOCKED = true;
const V2_CREATE_RELEASE_GATE_KEY = "v2_create_publish_enabled";

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

async function loadFlag(adminSupabase: ReturnType<typeof createClient>, key: string) {
  const { data, error } = await adminSupabase
    .from("loombus_feature_flags")
    .select("enabled, rollout_percentage, allowed_user_ids")
    .eq("key", key)
    .maybeSingle();

  return { data: (data as FeatureFlag | null) ?? null, error };
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    if (FINAL_ACTION_LOCKED) {
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          status: "hard_locked",
          reason: "The V2 final action is hard-locked on the server.",
        },
        { status: 423 }
      );
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json({ ok: false, locked: true, reason: "Final endpoint is not configured." });
    }

    const userSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userSupabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ ok: false, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const shellGate = await loadFlag(adminSupabase, "v2_shell");

    if (shellGate.error || !isFlagEnabledForUser(shellGate.data, user.id)) {
      return NextResponse.json({ ok: false, locked: true, reason: "V2 access is required." }, { status: 403 });
    }

    const releaseGate = await loadFlag(adminSupabase, V2_CREATE_RELEASE_GATE_KEY);

    if (releaseGate.error || !isFlagEnabledForUser(releaseGate.data, user.id)) {
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          status: "rollback_guard_active",
          reason: "V2 Create final action is blocked by the release gate.",
        },
        { status: 423 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        locked: true,
        status: "not_enabled",
        reason: "Final action remains disabled.",
      },
      { status: 423 }
    );
  } catch (error) {
    console.error("Unexpected V2 final endpoint failure:", error);
    return NextResponse.json({ ok: false, locked: true, reason: "Unexpected final endpoint failure." }, { status: 500 });
  }
}
