import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type FeatureFlag = {
  enabled: boolean | null;
  rollout_percentage: number | null;
  allowed_user_ids: string[] | null;
};

type V2CreateDraft = {
  title: string | null;
  topic: string | null;
  body: string | null;
  tags: string | null;
  mode: string | null;
  updated_at: string | null;
};

const VALID_MODES = new Set(["open_discussion", "debate", "research_question", "problem_solving"]);

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

function normalizeTags(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function getChecks(draft: V2CreateDraft | null, tags: string[]) {
  const title = draft?.title?.trim() ?? "";
  const topic = draft?.topic?.trim() ?? "";
  const body = draft?.body?.trim() ?? "";
  const mode = draft?.mode ?? "open_discussion";

  return [
    { key: "title", label: "Title is clear", passed: title.length >= 8 },
    { key: "topic", label: "Topic is selected", passed: topic.length >= 2 },
    { key: "body", label: "Body has context", passed: body.length >= 40 },
    { key: "mode", label: "Mode is valid", passed: VALID_MODES.has(mode) },
    { key: "tags", label: "Tags are focused", passed: tags.length <= 6 },
  ];
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, reason: "Authentication required." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json({ ok: false, reason: "Server check is not configured." });
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

    const { data: flag, error: flagError } = await adminSupabase
      .from("loombus_feature_flags")
      .select("enabled, rollout_percentage, allowed_user_ids")
      .eq("key", "v2_shell")
      .maybeSingle();

    if (flagError) {
      return NextResponse.json({ ok: false, reason: "V2 access could not be verified." });
    }

    if (!isFlagEnabledForUser((flag as FeatureFlag | null) ?? null, user.id)) {
      return NextResponse.json({ ok: false, reason: "V2 access is required." }, { status: 403 });
    }

    const { data: draftRow, error: draftError } = await userSupabase
      .from("loombus_v2_create_drafts")
      .select("title, topic, body, tags, mode, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (draftError) {
      return NextResponse.json({ ok: false, reason: "Draft could not be loaded." });
    }

    const draft = (draftRow as V2CreateDraft | null) ?? null;
    const tags = normalizeTags(draft?.tags ?? null);
    const checks = getChecks(draft, tags);
    const ready = Boolean(draft) && checks.every((check) => check.passed);

    return NextResponse.json({
      ok: ready,
      status: ready ? "ready_preview" : "needs_work",
      locked: true,
      reason: ready ? "Draft passes server validation. Final action remains locked." : "Draft needs more work.",
      checks,
      preview: ready
        ? {
            title: draft?.title?.trim() ?? "",
            topic: draft?.topic?.trim() ?? "",
            body: draft?.body?.trim() ?? "",
            mode: VALID_MODES.has(draft?.mode ?? "") ? draft?.mode : "open_discussion",
            tags,
          }
        : null,
      draftUpdatedAt: draft?.updated_at ?? null,
    });
  } catch (error) {
    console.error("Unexpected V2 create server check failure:", error);
    return NextResponse.json({ ok: false, reason: "Unexpected server check failure." }, { status: 500 });
  }
}
