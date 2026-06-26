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

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, reason: "Authentication required." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json({ ok: false, reason: "V2 discussion viewer is not configured." }, { status: 500 });
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
      return NextResponse.json({ ok: false, reason: "Authentication required." }, { status: 401 });
    }

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: shellFlag, error: shellFlagError } = await adminSupabase
      .from("loombus_feature_flags")
      .select("enabled, rollout_percentage, allowed_user_ids")
      .eq("key", "v2_shell")
      .maybeSingle();

    if (shellFlagError || !isFlagEnabledForUser((shellFlag as FeatureFlag | null) ?? null, user.id)) {
      return NextResponse.json({ ok: false, reason: "V2 access is required." }, { status: 403 });
    }

    const requestUrl = new URL(request.url);
    const discussionId = requestUrl.searchParams.get("id");

    const columns = "id, title, topic, original_topic, body, mode, tags, discussion_metadata, status, created_at, updated_at";

    if (discussionId) {
      const { data: discussion, error: discussionError } = await adminSupabase
        .from("loombus_v2_discussions")
        .select(columns)
        .eq("id", discussionId)
        .eq("author_id", user.id)
        .maybeSingle();

      if (discussionError) {
        return NextResponse.json(
          { ok: false, reason: discussionError.message, code: discussionError.code },
          { status: 500 }
        );
      }

      if (!discussion) {
        return NextResponse.json({ ok: false, reason: "V2 preview discussion was not found." }, { status: 404 });
      }

      return NextResponse.json({ ok: true, discussion });
    }

    const { data: discussions, error: discussionsError } = await adminSupabase
      .from("loombus_v2_discussions")
      .select(columns)
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25);

    if (discussionsError) {
      return NextResponse.json(
        { ok: false, reason: discussionsError.message, code: discussionsError.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, discussions: discussions ?? [] });
  } catch (error) {
    console.error("Unexpected V2 discussions API failure:", error);
    return NextResponse.json({ ok: false, reason: "Unexpected V2 discussions API failure." }, { status: 500 });
  }
}
