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

type DraftRow = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  updated_at: string | null;
};

type ShadowRecordRow = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  mode: string | null;
  tags: string[] | null;
  status: string | null;
  created_at: string | null;
};

const STANDARD_DISCUSSION_MAX_LENGTH = 5000;
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

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function makeCheck(key: string, label: string, passed: boolean, detail: string) {
  return { key, label, passed, detail };
}

async function loadFlag(adminSupabase: any, key: string) {
  const { data, error } = await adminSupabase
    .from("loombus_feature_flags")
    .select("enabled, rollout_percentage, allowed_user_ids")
    .eq("key", key)
    .maybeSingle();

  return { flag: (data as FeatureFlag | null) ?? null, error };
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ ok: false, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return NextResponse.json({ ok: false, locked: true, reason: "Preflight endpoint is not configured." });
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

    const shellGate = await loadFlag(adminSupabase, "v2_shell");
    const shellAllowed = !shellGate.error && isFlagEnabledForUser(shellGate.flag, user.id);

    if (!shellAllowed) {
      return NextResponse.json({ ok: false, locked: true, reason: "V2 access is required." }, { status: 403 });
    }

    const [{ data: draftRow }, { data: shadowRow }, publishGate] = await Promise.all([
      adminSupabase
        .from("loombus_v2_create_drafts")
        .select("id, title, topic, body, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from("loombus_v2_create_shadow_records")
        .select("id, title, topic, body, mode, tags, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      loadFlag(adminSupabase, "v2_create_publish_enabled"),
    ]);

    const draft = (draftRow as DraftRow | null) ?? null;
    const shadowRecord = (shadowRow as ShadowRecordRow | null) ?? null;
    const title = normalizeText(shadowRecord?.title);
    const topic = normalizeText(shadowRecord?.topic);
    const body = normalizeText(shadowRecord?.body);
    const mode = normalizeText(shadowRecord?.mode || "open_discussion");
    const tagResult = normalizeDiscussionTags((shadowRecord?.tags ?? []).join(", "));
    const publishAllowed = !publishGate.error && isFlagEnabledForUser(publishGate.flag, user.id);
    const topicMapsToV1 = DISCUSSION_TOPICS.includes(topic as DiscussionTopic) || topic.length >= 2;

    const checks = [
      makeCheck("authenticated", "Signed-in user confirmed", true, "The preflight request includes a valid session."),
      makeCheck("v2_shell", "V2 shell access confirmed", shellAllowed, "The user is allowed into the private V2 shell."),
      makeCheck("draft", "Latest V2 draft exists", Boolean(draft), "A V2 draft should exist before final preparation."),
      makeCheck("shadow_record", "Latest shadow record exists", Boolean(shadowRecord), "A non-public shadow record should exist before final preparation."),
      makeCheck("title", "Shadow title maps to V1 payload", title.length > 0, "A future live discussion needs a title."),
      makeCheck("topic", "Shadow topic can map to V1", topicMapsToV1, "Configured topics publish directly; custom V2 topics map to Other with metadata."),
      makeCheck("body", "Shadow body maps to V1 content", body.length > 0, "A future live discussion needs body content."),
      makeCheck("body_limit", "Shadow body fits conservative V1 limit", body.length <= STANDARD_DISCUSSION_MAX_LENGTH, "Preflight uses 5,000 characters as a conservative baseline."),
      makeCheck("mode", "Shadow mode maps to V1 discussion type", VALID_MODES.has(mode), "Mode must be accepted by the current discussion type list."),
      makeCheck("tags", "Shadow tags pass V1 normalization", !tagResult.error, tagResult.error ?? "Tags are valid."),
      makeCheck("rollback_guard", "Rollback guard open for this user", publishAllowed, "v2_create_publish_enabled must allow the internal tester."),
      makeCheck("finalizer_ack", "Finalizer requires acknowledgement", true, "The finalizer only publishes when Confirm sends finalizeAcknowledged=true."),
      makeCheck("v1_routes", "V1 routes remain unchanged", true, "Preflight does not change /create, /discussions, or public navigation."),
      makeCheck("no_writes", "No writes performed", true, "Preflight does not create discussions, tags, notifications, or audit events."),
    ];
    const ready = checks.every((check) => check.passed);

    return NextResponse.json({
      ok: true,
      ready,
      locked: !publishAllowed,
      status: ready ? "preflight_ready_for_guarded_publish" : "preflight_needs_work",
      reason: ready
        ? "V2 Create preflight checks passed for a guarded internal publish."
        : "V2 Create preflight checks found items that need review before using Confirm publish.",
      checks,
      latestDraft: draft
        ? {
            id: draft.id,
            updated_at: draft.updated_at,
          }
        : null,
      latestShadowRecord: shadowRecord
        ? {
            id: shadowRecord.id,
            status: shadowRecord.status,
            created_at: shadowRecord.created_at,
          }
        : null,
      rollbackGuard: {
        blocked: !publishAllowed,
        flagPresent: Boolean(publishGate.flag),
        flagEnabled: Boolean(publishGate.flag?.enabled),
        rolloutPercentage: publishGate.flag?.rollout_percentage ?? 0,
      },
      skippedWrites: ["discussions", "discussion_tags", "audit_log", "notifications"],
    });
  } catch (error) {
    console.error("Unexpected V2 preflight status failure:", error);
    return NextResponse.json({ ok: false, locked: true, reason: "Unexpected preflight status failure." }, { status: 500 });
  }
}
