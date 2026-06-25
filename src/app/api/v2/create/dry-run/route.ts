import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { normalizeDiscussionTags } from "@/lib/discussion-tags";

export const dynamic = "force-dynamic";

type FeatureFlag = {
  enabled: boolean | null;
  rollout_percentage: number | null;
  allowed_user_ids: string[] | null;
};

type ShadowRecord = {
  id: string;
  title: string;
  topic: string;
  body: string;
  mode: string;
  tags: string[] | null;
  status: string;
  created_at: string;
};

const VALID_MODES = new Set(["open_discussion", "debate", "research_question", "problem_solving"]);
const STANDARD_DISCUSSION_MAX_LENGTH = 5000;

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

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function makeCheck(key: string, label: string, passed: boolean, detail: string) {
  return { key, label, passed, detail };
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json({ ok: false, locked: true, reason: "Dry-run endpoint is not configured." });
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
      return NextResponse.json({ ok: false, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: flag, error: flagError } = await adminSupabase
      .from("loombus_feature_flags")
      .select("enabled, rollout_percentage, allowed_user_ids")
      .eq("key", "v2_shell")
      .maybeSingle();

    if (flagError || !isFlagEnabledForUser((flag as FeatureFlag | null) ?? null, user.id)) {
      return NextResponse.json({ ok: false, locked: true, reason: "V2 access is required." }, { status: 403 });
    }

    const { data: shadowRow, error: shadowError } = await adminSupabase
      .from("loombus_v2_create_shadow_records")
      .select("id, title, topic, body, mode, tags, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (shadowError) {
      return NextResponse.json({ ok: false, locked: true, reason: "Shadow record could not be loaded." });
    }

    const shadowRecord = (shadowRow as ShadowRecord | null) ?? null;

    if (!shadowRecord) {
      return NextResponse.json({ ok: false, locked: true, reason: "Create a shadow record before running dry-run comparison." });
    }

    const title = normalizeText(shadowRecord.title);
    const topic = normalizeText(shadowRecord.topic);
    const body = normalizeText(shadowRecord.body);
    const discussionType = VALID_MODES.has(shadowRecord.mode) ? shadowRecord.mode : "open_discussion";
    const tagInput = (shadowRecord.tags ?? []).join(", ");
    const tagResult = normalizeDiscussionTags(tagInput);

    const checks = [
      makeCheck("title", "Title maps to V1 payload", title.length > 0, "A live discussion needs a title."),
      makeCheck("topic", "Topic maps to V1 list", DISCUSSION_TOPICS.includes(topic as DiscussionTopic), "A live discussion needs a configured topic."),
      makeCheck("body", "Body maps to V1 content", body.length > 0, "A live discussion needs body content."),
      makeCheck("body_limit", "Body fits standard V1 limit", body.length <= STANDARD_DISCUSSION_MAX_LENGTH, "Dry-run uses 5,000 characters as a conservative baseline."),
      makeCheck("mode", "Mode maps to V1 discussion type", VALID_MODES.has(discussionType), "Mode must be accepted by the V1 create endpoint."),
      makeCheck("tags", "Tags pass V1 normalization", !tagResult.error, tagResult.error ?? "Tags are valid."),
      makeCheck("no_live_discussion", "Live discussion write skipped", true, "Dry-run does not write to discussions."),
      makeCheck("no_notifications", "Notifications skipped", true, "Dry-run does not notify users."),
    ];
    const ok = checks.every((check) => check.passed);

    return NextResponse.json({
      ok,
      locked: true,
      status: ok ? "dry_run_ready" : "dry_run_needs_work",
      reason: ok ? "Dry-run comparison passed. No live discussion was created." : "Dry-run comparison found issues.",
      checks,
      shadowRecord: {
        id: shadowRecord.id,
        status: shadowRecord.status,
        created_at: shadowRecord.created_at,
      },
      wouldPublishPayload: ok
        ? {
            title,
            topic,
            realityLens: null,
            purposeLane: null,
            discussionType,
            discussionMetadata: {},
            body,
            tags: tagResult.tags.join(", "),
          }
        : null,
    });
  } catch (error) {
    console.error("Unexpected V2 dry-run comparison failure:", error);
    return NextResponse.json({ ok: false, locked: true, reason: "Unexpected dry-run comparison failure." }, { status: 500 });
  }
}
