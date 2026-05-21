import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const WHAT_CHANGED_MODEL =
  process.env.OPENAI_WHAT_CHANGED_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_DISCUSSION_BODY_CHARS = 6000;
const MAX_REPLY_CHARS = 9000;

type CachedAiOutput = {
  id: string;
  discussion_id: string;
  feature_key: string;
  output_text: string;
  model_name: string | null;
  source_reply_count: number;
  source_content_hash: string | null;
  generated_by: string | null;
  generated_at: string;
};

function createContentHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Content truncated for what-changed generation.]`;
}

function getAiProviderErrorResponse(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("not configured")) {
    return {
      status: 503,
      error: "AI generation is not configured yet.",
    };
  }

  if (
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota")
  ) {
    return {
      status: 503,
      error: "AI generation is temporarily unavailable because the AI provider quota or billing needs attention.",
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return {
      status: 429,
      error: "AI generation is temporarily rate-limited. Please try again later.",
    };
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid_api_key")
  ) {
    return {
      status: 503,
      error: "AI generation is temporarily unavailable because the AI provider credentials need attention.",
    };
  }

  return {
    status: 500,
    error: "AI generation failed. Please try again later.",
  };
}

async function logAiUsage({
  supabase,
  userId,
  featureKey,
  targetType,
  targetId,
  provider,
  modelName,
  cached,
  success,
  errorMessage,
}: {
  supabase: any;
  userId: string;
  featureKey: string;
  targetType?: string;
  targetId?: string;
  provider?: string;
  modelName?: string;
  cached?: boolean;
  success?: boolean;
  errorMessage?: string;
}) {
  const { error } = await supabase.from("ai_usage_events").insert({
    user_id: userId,
    feature_key: featureKey,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    provider: provider ?? null,
    model_name: modelName ?? null,
    cached: cached ?? false,
    success: success ?? true,
    error_message: errorMessage ?? null,
  });

  if (error) {
    console.error("AI usage logging failed:", error.message);
  }
}

async function getAiAccess(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (profile?.is_admin) {
    return {
      allowed: true,
      tier: "admin",
      isAdmin: true,
      monthlyThreadAiLimit: Number.MAX_SAFE_INTEGER,
    };
  }

  const { data: entitlement } = await supabase
    .from("user_ai_entitlements")
    .select("tier, ai_assisted_enabled, monthly_summary_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const allowed =
    Boolean(entitlement?.ai_assisted_enabled) &&
    ["premium", "admin"].includes(entitlement?.tier ?? "");

  return {
    allowed,
    tier: entitlement?.tier ?? "free",
    isAdmin: false,
    monthlyThreadAiLimit: entitlement?.monthly_summary_limit ?? 0,
  };
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function getMonthlyWhatChangedUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", "what_changed")
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());

  if (error) {
    console.error("AI what-changed usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function generateOpenAIWhatChanged({
  title,
  topic,
  body,
  replies,
  replyCount,
}: {
  title: string;
  topic: string;
  body: string;
  replies: string;
  replyCount: number;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI what-changed analysis is not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: WHAT_CHANGED_MODEL,
      temperature: 0.2,
      max_tokens: 320,
      messages: [
        {
          role: "system",
          content:
            "You analyze how a discussion evolved over time for a public high-signal discussion platform. Stay neutral. Do not add facts not present in the source. Avoid speculation. Do not quote long passages.",
        },
        {
          role: "user",
          content: `Explain what changed in this thread since the original post. Return 3-6 concise bullets. Focus on new angles, shifts in concern, unresolved questions, and whether replies changed the direction of the discussion. If there are no replies, say there is not enough thread activity yet.\n\nTopic: ${topic}\nTitle: ${title}\nReply count: ${replyCount}\n\nOriginal discussion body:\n${clampText(body, MAX_DISCUSSION_BODY_CHARS)}\n\nReplies in chronological order:\n${clampText(replies || "No replies yet.", MAX_REPLY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI what-changed generation failed.";
    throw new Error(message);
  }

  const whatChanged = payload?.choices?.[0]?.message?.content?.trim();

  if (!whatChanged) {
    throw new Error("AI what-changed generation returned no content.");
  }

  return whatChanged;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
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
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const access = await getAiAccess(supabase, user.id);

    const body = await request.json();
    const discussionId = String(body.discussionId ?? "").trim();

    if (!access.allowed) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "what_changed",
        targetType: "discussion",
        targetId: discussionId || undefined,
        provider: "openai",
        modelName: WHAT_CHANGED_MODEL,
        success: false,
        errorMessage: "Premium AI access required.",
      });

      return NextResponse.json(
        {
          error: "Premium AI access is required for what-changed analysis.",
          code: "premium_required",
        },
        { status: 403 }
      );
    }

    if (!discussionId) {
      return NextResponse.json(
        { error: "Missing discussion id." },
        { status: 400 }
      );
    }

    const { data: discussion, error: discussionError } = await supabase
      .from("discussions")
      .select("id, title, topic, body")
      .eq("id", discussionId)
      .is("deleted_at", null)
      .single();

    if (discussionError || !discussion) {
      return NextResponse.json(
        { error: "Discussion not found." },
        { status: 404 }
      );
    }

    const { data: replyData } = await supabase
      .from("replies")
      .select("body, created_at")
      .eq("discussion_id", discussionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(30);

    const visibleReplies = (replyData ?? []) as { body: string; created_at: string }[];
    const replies = visibleReplies
      .map((reply, index) => `Reply ${index + 1}: ${reply.body}`)
      .join("\n\n");

    const sourceReplyCount = visibleReplies.length;
    const sourceContent = [
      discussion.title,
      discussion.topic,
      discussion.body,
      ...visibleReplies.map((reply, index) => `reply_${index + 1}:${reply.body}`),
    ].join("\n\n");

    const sourceContentHash = createContentHash(sourceContent);

    const { data: existingOutput } = await supabase
      .from("discussion_ai_outputs")
      .select("id, discussion_id, feature_key, output_text, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .eq("discussion_id", discussionId)
      .eq("feature_key", "what_changed")
      .maybeSingle();

    if (
      existingOutput &&
      existingOutput.source_content_hash === sourceContentHash
    ) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "what_changed",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: existingOutput.model_name ?? WHAT_CHANGED_MODEL,
        cached: true,
        success: true,
      });

      return NextResponse.json({
        whatChanged: (existingOutput as CachedAiOutput).output_text,
        cached: true,
        modelName: existingOutput.model_name ?? WHAT_CHANGED_MODEL,
        generatedAt: existingOutput.generated_at,
        sourceReplyCount: existingOutput.source_reply_count,
      });
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyWhatChangedUsageCount(supabase, user.id);

    if (!access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "what_changed",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: WHAT_CHANGED_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium AI what-changed limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium AI what-changed limit reached.",
          code: "what_changed_limit_reached",
          monthlyWhatChangedLimit: access.monthlyThreadAiLimit,
          monthlyWhatChangedUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let whatChanged: string;

    try {
      whatChanged = await generateOpenAIWhatChanged({
        title: discussion.title,
        topic: discussion.topic,
        body: discussion.body,
        replies,
        replyCount: sourceReplyCount,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI what-changed generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "what_changed",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: WHAT_CHANGED_MODEL,
        success: false,
        errorMessage: message,
      });

      const aiError = getAiProviderErrorResponse(message);

      return NextResponse.json(
        { error: aiError.error },
        { status: aiError.status }
      );
    }

    const generatedAt = new Date().toISOString();

    const { error: cacheError } = await supabase
      .from("discussion_ai_outputs")
      .upsert(
        {
          discussion_id: discussionId,
          feature_key: "what_changed",
          output_text: whatChanged,
          model_name: WHAT_CHANGED_MODEL,
          source_reply_count: sourceReplyCount,
          source_content_hash: sourceContentHash,
          generated_by: user.id,
          generated_at: generatedAt,
          updated_at: generatedAt,
        },
        {
          onConflict: "discussion_id,feature_key",
        }
      );

    if (cacheError) {
      console.error("AI what-changed cache write failed:", cacheError.message);
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: "what_changed",
      targetType: "discussion",
      targetId: discussionId,
      provider: "openai",
      modelName: WHAT_CHANGED_MODEL,
      cached: false,
      success: true,
    });

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "discussion.what_changed_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: WHAT_CHANGED_MODEL,
        access_tier: access.tier,
        source_reply_count: sourceReplyCount,
        source_content_hash: sourceContentHash,
        monthly_what_changed_limit: access.isAdmin ? "unlimited" : access.monthlyThreadAiLimit,
        monthly_what_changed_usage_before_generation: access.isAdmin ? 0 : monthlyUsageCount,
      },
    });

    return NextResponse.json({
      whatChanged,
      cached: false,
      modelName: WHAT_CHANGED_MODEL,
      generatedAt,
      sourceReplyCount,
      monthlyWhatChangedLimit: access.isAdmin ? null : access.monthlyThreadAiLimit,
      monthlyWhatChangedUsage: access.isAdmin ? null : monthlyUsageCount + 1,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
