import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const TAKEAWAYS_MODEL =
  process.env.OPENAI_TAKEAWAYS_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_DISCUSSION_BODY_CHARS = 6000;
const MAX_REPLY_CHARS = 8000;

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

  return `${text.slice(0, maxLength)}\n\n[Content truncated for key takeaway generation.]`;
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

async function getMonthlyKeyTakeawaysUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", "key_takeaways")
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());

  if (error) {
    console.error("AI key takeaways usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function generateOpenAIKeyTakeaways({
  title,
  topic,
  body,
  replies,
}: {
  title: string;
  topic: string;
  body: string;
  replies: string;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI key takeaways are not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TAKEAWAYS_MODEL,
      temperature: 0.2,
      max_tokens: 260,
      messages: [
        {
          role: "system",
          content:
            "You extract concise, neutral key takeaways for a public high-signal discussion platform. Do not add facts not present in the source. Avoid hype. Avoid long quotes. Return only useful takeaways.",
        },
        {
          role: "user",
          content: `Extract 3-6 key takeaways from this discussion. Use short bullets. Focus on the strongest points, important distinctions, and what readers should understand.\n\nTopic: ${topic}\nTitle: ${title}\n\nDiscussion body:\n${clampText(body, MAX_DISCUSSION_BODY_CHARS)}\n\nReplies, if any:\n${clampText(replies || "No replies yet.", MAX_REPLY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI key takeaways generation failed.";
    throw new Error(message);
  }

  const takeaways = payload?.choices?.[0]?.message?.content?.trim();

  if (!takeaways) {
    throw new Error("AI key takeaways generation returned no content.");
  }

  return takeaways;
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
        featureKey: "key_takeaways",
        targetType: "discussion",
        targetId: discussionId || undefined,
        provider: "openai",
        modelName: TAKEAWAYS_MODEL,
        success: false,
        errorMessage: "Premium AI access required.",
      });

      return NextResponse.json(
        {
          error: "Premium AI access is required for key takeaways.",
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
      .limit(25);

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
      .eq("feature_key", "key_takeaways")
      .maybeSingle();

    if (
      existingOutput &&
      existingOutput.source_content_hash === sourceContentHash
    ) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "key_takeaways",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: existingOutput.model_name ?? TAKEAWAYS_MODEL,
        cached: true,
        success: true,
      });

      return NextResponse.json({
        takeaways: (existingOutput as CachedAiOutput).output_text,
        cached: true,
        modelName: existingOutput.model_name ?? TAKEAWAYS_MODEL,
        generatedAt: existingOutput.generated_at,
        sourceReplyCount: existingOutput.source_reply_count,
      });
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyKeyTakeawaysUsageCount(supabase, user.id);

    if (!access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "key_takeaways",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: TAKEAWAYS_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium AI key takeaways limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium AI key takeaways limit reached.",
          code: "key_takeaways_limit_reached",
          monthlyTakeawaysLimit: access.monthlyThreadAiLimit,
          monthlyTakeawaysUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let takeaways: string;

    try {
      takeaways = await generateOpenAIKeyTakeaways({
        title: discussion.title,
        topic: discussion.topic,
        body: discussion.body,
        replies,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI key takeaways generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "key_takeaways",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: TAKEAWAYS_MODEL,
        success: false,
        errorMessage: message,
      });

      return NextResponse.json(
        { error: message },
        { status: message.includes("not configured") ? 503 : 500 }
      );
    }

    const generatedAt = new Date().toISOString();

    const { error: cacheError } = await supabase
      .from("discussion_ai_outputs")
      .upsert(
        {
          discussion_id: discussionId,
          feature_key: "key_takeaways",
          output_text: takeaways,
          model_name: TAKEAWAYS_MODEL,
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
      console.error("AI key takeaways cache write failed:", cacheError.message);
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: "key_takeaways",
      targetType: "discussion",
      targetId: discussionId,
      provider: "openai",
      modelName: TAKEAWAYS_MODEL,
      cached: false,
      success: true,
    });

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "discussion.key_takeaways_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: TAKEAWAYS_MODEL,
        access_tier: access.tier,
        source_reply_count: sourceReplyCount,
        source_content_hash: sourceContentHash,
        monthly_key_takeaways_limit: access.isAdmin ? "unlimited" : access.monthlyThreadAiLimit,
        monthly_key_takeaways_usage_before_generation: access.isAdmin ? 0 : monthlyUsageCount,
      },
    });

    return NextResponse.json({
      takeaways,
      cached: false,
      modelName: TAKEAWAYS_MODEL,
      generatedAt,
      sourceReplyCount,
      monthlyTakeawaysLimit: access.isAdmin ? null : access.monthlyThreadAiLimit,
      monthlyTakeawaysUsage: access.isAdmin ? null : monthlyUsageCount + 1,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
