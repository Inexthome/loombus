import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { POST as createDiscussionPost } from "@/app/api/discussions/create/route";

export const dynamic = "force-dynamic";

type FeatureFlag = {
  enabled: boolean | null;
  rollout_percentage: number | null;
  allowed_user_ids: string[] | null;
};

type V2CreateDraft = {
  id: string;
  title: string | null;
  topic: string | null;
  body: string | null;
  tags: string | null;
  mode: string | null;
  updated_at: string | null;
};

const VALID_MODES = new Set(["open_discussion", "debate", "research_question", "problem_solving"]);
const V2_CREATE_FINAL_WRITE_ENABLED = false;

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

async function getFeatureFlag(adminSupabase: any, key: string) {
  const { data, error } = await adminSupabase
    .from("loombus_feature_flags")
    .select("enabled, rollout_percentage, allowed_user_ids")
    .eq("key", key)
    .maybeSingle();

  return { flag: (data as FeatureFlag | null) ?? null, error };
}

function normalizeTags(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeTopic(value: string | null): DiscussionTopic {
  const topic = String(value ?? "").trim();
  return DISCUSSION_TOPICS.includes(topic as DiscussionTopic) ? (topic as DiscussionTopic) : "Other";
}

function normalizeMode(value: string | null) {
  return VALID_MODES.has(value ?? "") ? value : "open_discussion";
}

function getDraftChecks(draft: V2CreateDraft | null, tags: string[]) {
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
      return NextResponse.json({ ok: false, locked: true, reason: "Authentication required." }, { status: 401 });
    }

    const requestBody = await request.json().catch(() => ({}));

    if (requestBody?.finalizeAcknowledged !== true) {
      return NextResponse.json(
        {
          ok: false,
          locked: false,
          status: "acknowledgement_required",
          reason: "Confirm the guarded V2 final action before publishing.",
        },
        { status: 400 }
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

    const [{ flag: shellFlag, error: shellFlagError }, { flag: publishFlag, error: publishFlagError }] = await Promise.all([
      getFeatureFlag(adminSupabase, "v2_shell"),
      getFeatureFlag(adminSupabase, "v2_create_publish_enabled"),
    ]);

    if (shellFlagError || !isFlagEnabledForUser(shellFlag, user.id)) {
      return NextResponse.json({ ok: false, locked: true, reason: "V2 access is required." }, { status: 403 });
    }

    if (!V2_CREATE_FINAL_WRITE_ENABLED || publishFlagError || !isFlagEnabledForUser(publishFlag, user.id)) {
      return NextResponse.json(
        {
          ok: false,
          locked: true,
          status: "rollback_guard_active",
          reason: "V2 Create publishing is disabled by the rollback guard.",
          flag: {
            key: "v2_create_publish_enabled",
            enabled: Boolean(publishFlag?.enabled),
            rolloutPercentage: publishFlag?.rollout_percentage ?? 0,
            userAllowlisted: Boolean((publishFlag?.allowed_user_ids ?? []).includes(user.id)),
          },
        },
        { status: 423 }
      );
    }

    const { data: draftRow, error: draftError } = await userSupabase
      .from("loombus_v2_create_drafts")
      .select("id, title, topic, body, tags, mode, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (draftError) {
      return NextResponse.json({ ok: false, locked: false, reason: "Draft could not be loaded." }, { status: 500 });
    }

    const draft = (draftRow as V2CreateDraft | null) ?? null;
    const tags = normalizeTags(draft?.tags ?? null);
    const checks = getDraftChecks(draft, tags);
    const ready = Boolean(draft) && checks.every((check) => check.passed);

    if (!ready || !draft) {
      return NextResponse.json(
        {
          ok: false,
          locked: false,
          status: "needs_work",
          reason: "Draft is not ready to publish.",
          checks,
        },
        { status: 400 }
      );
    }

    const title = draft.title?.trim() ?? "";
    const originalTopic = draft.topic?.trim() ?? "";
    const topic = normalizeTopic(originalTopic);
    const body = draft.body?.trim() ?? "";
    const discussionType = normalizeMode(draft.mode);
    const discussionMetadata = {
      createdFrom: "v2_create",
      ...(topic === "Other" && originalTopic && originalTopic !== "Other" ? { originalV2Topic: originalTopic } : {}),
    };

    const createRequest = new NextRequest(new URL("/api/discussions/create", request.url), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        topic,
        realityLens: null,
        purposeLane: null,
        discussionType,
        discussionMetadata,
        body,
        tags: tags.join(", "),
        pastedCharacterCount: 0,
      }),
    });

    const createResponse = await createDiscussionPost(createRequest);
    const createPayload = await createResponse.json().catch(() => null);

    if (!createResponse.ok || !createPayload?.discussion?.id) {
      return NextResponse.json(
        {
          ok: false,
          locked: false,
          status: "create_failed",
          reason: createPayload?.error ?? "The guarded V2 publish could not create a discussion.",
          code: createPayload?.code,
          category: createPayload?.category,
          provider: createPayload?.provider,
          createStatus: createResponse.status,
        },
        { status: createResponse.status || 500 }
      );
    }

    const { error: clearDraftError } = await userSupabase
      .from("loombus_v2_create_drafts")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      locked: false,
      status: "published",
      reason: clearDraftError
        ? "Discussion published. Private V2 draft could not be cleared automatically."
        : "Discussion published through the guarded V2 finalizer.",
      discussion: createPayload.discussion,
      draftCleared: !clearDraftError,
      mappedTopic: topic,
      originalTopic: originalTopic || null,
    });
  } catch (error) {
    console.error("Unexpected V2 final endpoint failure:", error);
    return NextResponse.json({ ok: false, locked: true, reason: "Unexpected final endpoint failure." }, { status: 500 });
  }
}
