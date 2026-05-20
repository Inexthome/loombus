import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_DISCUSSION_BODY_CHARS = 6000;

type CachedSummary = {
  id: string;
  discussion_id: string;
  summary: string;
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

  return `${text.slice(0, maxLength)}\n\n[Content truncated for summary generation.]`;
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
      monthlySummaryLimit: Number.MAX_SAFE_INTEGER,
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
    monthlySummaryLimit: entitlement?.monthly_summary_limit ?? 0,
  };
}

function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function getMonthlySummaryUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", "thread_summary")
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());

  if (error) {
    console.error("AI usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function generateOpenAISummary({
  title,
  topic,
  body,
  replyCount,
}: {
  title: string;
  topic: string;
  body: string;
  replyCount: number;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI summaries are not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "You write concise, neutral discussion summaries for a public social discussion platform. Do not add facts not present in the source. Do not quote long passages. Keep the tone clear and non-sensational.",
        },
        {
          role: "user",
          content: `Summarize this discussion opener for readers. Return 2-3 short bullets and one short takeaway.\n\nTopic: ${topic}\nTitle: ${title}\nReply count at generation time: ${replyCount}\n\nDiscussion body:\n${clampText(body, MAX_DISCUSSION_BODY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI summary generation failed.";
    throw new Error(message);
  }

  const summary = payload?.choices?.[0]?.message?.content?.trim();

  if (!summary) {
    throw new Error("AI summary generation returned no summary.");
  }

  return summary;
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
        featureKey: "thread_summary",
        targetType: "discussion",
        targetId: discussionId || undefined,
        provider: "openai",
        modelName: SUMMARY_MODEL,
        success: false,
        errorMessage: "Premium AI access required.",
      });

      return NextResponse.json(
        {
          error: "Premium AI access is required for discussion summaries.",
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

    const { count: replyCount } = await supabase
      .from("replies")
      .select("*", { count: "exact", head: true })
      .eq("discussion_id", discussionId)
      .is("deleted_at", null);

    const sourceReplyCount = replyCount ?? 0;
    const sourceContent = [
      discussion.title,
      discussion.topic,
      discussion.body,
      `reply_count:${sourceReplyCount}`,
    ].join("\n\n");

    const sourceContentHash = createContentHash(sourceContent);

    const { data: existingSummary } = await supabase
      .from("discussion_summaries")
      .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .eq("discussion_id", discussionId)
      .maybeSingle();

    if (existingSummary) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "thread_summary",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: existingSummary.model_name ?? SUMMARY_MODEL,
        cached: true,
        success: true,
      });

      return NextResponse.json({
        summary: existingSummary as CachedSummary,
        cached: true,
      });
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlySummaryUsageCount(supabase, user.id);

    if (!access.isAdmin && monthlyUsageCount >= access.monthlySummaryLimit) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "thread_summary",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: SUMMARY_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium AI summary limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium AI summary limit reached.",
          code: "summary_limit_reached",
          monthlySummaryLimit: access.monthlySummaryLimit,
          monthlySummaryUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let summaryText: string;

    try {
      summaryText = await generateOpenAISummary({
        title: discussion.title,
        topic: discussion.topic,
        body: discussion.body,
        replyCount: sourceReplyCount,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI summary generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "thread_summary",
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: SUMMARY_MODEL,
        success: false,
        errorMessage: message,
      });

      return NextResponse.json(
        { error: message },
        { status: message.includes("not configured") ? 503 : 500 }
      );
    }

    const { data: insertedSummary, error: insertError } = await supabase
      .from("discussion_summaries")
      .insert({
        discussion_id: discussionId,
        summary: summaryText,
        model_name: SUMMARY_MODEL,
        source_reply_count: sourceReplyCount,
        source_content_hash: sourceContentHash,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .single();

    if (insertError) {
      const { data: fallbackSummary } = await supabase
        .from("discussion_summaries")
        .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
        .eq("discussion_id", discussionId)
        .maybeSingle();

      if (fallbackSummary) {
        await logAiUsage({
          supabase,
          userId: user.id,
          featureKey: "thread_summary",
          targetType: "discussion",
          targetId: discussionId,
          provider: "openai",
          modelName: fallbackSummary.model_name ?? SUMMARY_MODEL,
          cached: true,
          success: true,
        });

        return NextResponse.json({
          summary: fallbackSummary as CachedSummary,
          cached: true,
        });
      }

      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: "thread_summary",
      targetType: "discussion",
      targetId: discussionId,
      provider: "openai",
      modelName: SUMMARY_MODEL,
      cached: false,
      success: true,
    });

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "discussion.summary_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: SUMMARY_MODEL,
        source_reply_count: sourceReplyCount,
        access_tier: access.tier,
        monthly_summary_limit: access.isAdmin ? "unlimited" : access.monthlySummaryLimit,
        monthly_summary_usage_before_generation: access.isAdmin ? 0 : monthlyUsageCount,
      },
    });

    return NextResponse.json({
      summary: insertedSummary as CachedSummary,
      cached: false,
      monthlySummaryLimit: access.isAdmin ? null : access.monthlySummaryLimit,
      monthlySummaryUsage: access.isAdmin ? null : monthlyUsageCount + 1,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
