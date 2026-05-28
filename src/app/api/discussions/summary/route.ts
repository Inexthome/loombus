import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createContentHash,
  getAiAccess,
  getAiProviderErrorResponse,
  getCurrentMonthStart,
  logAiUsage,
  getOpenAiUsageMetadata,
  insertDiscussionSummary,
  upsertDiscussionSummary,
} from "@/lib/premium-ai";

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
function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Content truncated for summary generation.]`;
}async function getMonthlySummaryUsageCount(supabase: any, userId: string) {
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

  return {
    summary: summary,
    usageMetadata: getOpenAiUsageMetadata(payload, SUMMARY_MODEL),
  };
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

    if (
      existingSummary &&
      existingSummary.source_content_hash === sourceContentHash
    ) {
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
    let usageMetadata = {};

    try {
      const generatedSummary = await generateOpenAISummary({
        title: discussion.title,
        topic: discussion.topic,
        body: discussion.body,
        replyCount: sourceReplyCount,
      });
      summaryText = generatedSummary.summary;
      usageMetadata = generatedSummary.usageMetadata;
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

      const aiError = getAiProviderErrorResponse(message);

      return NextResponse.json(
        { error: aiError.error },
        { status: aiError.status }
      );
    }

    const generatedAt = new Date().toISOString();

    const { data: insertedSummary, error: insertError } = await upsertDiscussionSummary({
      discussion_id: discussionId,
      summary: summaryText,
      model_name: SUMMARY_MODEL,
      source_reply_count: sourceReplyCount,
      source_content_hash: sourceContentHash,
      generated_by: user.id,
      generated_at: generatedAt,
      updated_at: generatedAt,
    });

    if (insertError) {
      const { data: fallbackSummary } = await supabase
        .from("discussion_summaries")
        .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
        .eq("discussion_id", discussionId)
        .maybeSingle();

      if (
        fallbackSummary &&
        fallbackSummary.source_content_hash === sourceContentHash
      ) {
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
      ...usageMetadata,
    });

    await logAuditEvent({
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
