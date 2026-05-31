import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import {
  createContentHash,
  getAiAccess,
  getAiProviderErrorResponse,
  getCurrentMonthStart,
  logAiUsage,
  getExtraAiCreditBalance,
  consumeExtraAiCredit,
  getOpenAiUsageMetadata,
  upsertDiscussionAiOutput,
} from "@/lib/premium-ai";

const FEATURE_KEY = "related_ideas";
const RELATED_IDEAS_MODEL =
  process.env.OPENAI_RELATED_IDEAS_MODEL ||
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

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Content truncated for related ideas generation.]`;
}

async function getMonthlyRelatedIdeasUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", FEATURE_KEY)
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());

  if (error) {
    console.error("AI related ideas usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function generateOpenAIRelatedIdeas({
  title,
  topic,
  realityLens,
  body,
  replies,
  replyCount,
}: {
  title: string;
  topic: string;
  realityLens: string | null;
  body: string;
  replies: string;
  replyCount: number;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI related ideas are not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: RELATED_IDEAS_MODEL,
      temperature: 0.2,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You identify related ideas for a public high-signal discussion platform. Do not add unsupported claims. Do not summarize the thread. Extract idea connections that could help readers discover adjacent discussions. Keep labels short, neutral, and non-sensational.",
        },
        {
          role: "user",
          content: `Identify 6-10 related ideas for this discussion. Return only a concise bullet list. Each bullet should use this format: - Idea label: one short reason it connects. Keep idea labels broad enough to become future clickable idea graph nodes.\n\nTopic: ${topic}\nReality Lens: ${realityLens || "None"}\nTitle: ${title}\nReply count: ${replyCount}\n\nOriginal discussion body:\n${clampText(body, MAX_DISCUSSION_BODY_CHARS)}\n\nReplies in chronological order:\n${clampText(replies || "No replies yet.", MAX_REPLY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI related ideas generation failed.";
    throw new Error(message);
  }

  const relatedIdeas = payload?.choices?.[0]?.message?.content?.trim();

  if (!relatedIdeas) {
    throw new Error("AI related ideas generation returned no content.");
  }

  return {
    relatedIdeas,
    usageMetadata: getOpenAiUsageMetadata(payload, RELATED_IDEAS_MODEL),
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
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId || undefined,
        provider: "openai",
        modelName: RELATED_IDEAS_MODEL,
        success: false,
        errorMessage: "Premium AI access required.",
      });

      return NextResponse.json(
        {
          error: "Premium AI access is required for related ideas.",
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
      .select("id, title, topic, reality_lens, body")
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
      discussion.reality_lens ?? "",
      discussion.body,
      ...visibleReplies.map((reply, index) => `reply_${index + 1}:${reply.body}`),
    ].join("\n\n");

    const sourceContentHash = createContentHash(sourceContent);

    const { data: existingOutput } = await supabase
      .from("discussion_ai_outputs")
      .select("id, discussion_id, feature_key, output_text, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .eq("discussion_id", discussionId)
      .eq("feature_key", FEATURE_KEY)
      .maybeSingle();

    if (
      existingOutput &&
      existingOutput.source_content_hash === sourceContentHash
    ) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: existingOutput.model_name ?? RELATED_IDEAS_MODEL,
        cached: true,
        success: true,
      });

      return NextResponse.json({
        relatedIdeas: (existingOutput as CachedAiOutput).output_text,
        cached: true,
        modelName: existingOutput.model_name ?? RELATED_IDEAS_MODEL,
        generatedAt: existingOutput.generated_at,
        sourceReplyCount: existingOutput.source_reply_count,
      });
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyRelatedIdeasUsageCount(supabase, user.id);

    const shouldUseExtraCredit =
      !access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit;
    const extraCreditsRemaining = shouldUseExtraCredit
      ? await getExtraAiCreditBalance(user.id)
      : 0;

    if (shouldUseExtraCredit && extraCreditsRemaining <= 0) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: RELATED_IDEAS_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium AI related ideas limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium AI related ideas limit reached.",
          code: "related_ideas_limit_reached",
          monthlyRelatedIdeasLimit: access.monthlyThreadAiLimit,
          monthlyRelatedIdeasUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let relatedIdeas: string;
    let usageMetadata = {};

    try {
      const generatedRelatedIdeas = await generateOpenAIRelatedIdeas({
        title: discussion.title,
        topic: discussion.topic,
        realityLens: discussion.reality_lens ?? null,
        body: discussion.body,
        replies,
        replyCount: sourceReplyCount,
      });
      relatedIdeas = generatedRelatedIdeas.relatedIdeas;
      usageMetadata = generatedRelatedIdeas.usageMetadata;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI related ideas generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: RELATED_IDEAS_MODEL,
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

    const { error: cacheError } = await upsertDiscussionAiOutput({
      discussion_id: discussionId,
      feature_key: FEATURE_KEY,
      output_text: relatedIdeas,
      model_name: RELATED_IDEAS_MODEL,
      source_reply_count: sourceReplyCount,
      source_content_hash: sourceContentHash,
      generated_by: user.id,
      generated_at: generatedAt,
      updated_at: generatedAt,
    });

    if (cacheError) {
      console.error("AI related ideas cache write failed:", cacheError.message);
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "discussion",
      targetId: discussionId,
      provider: "openai",
      modelName: RELATED_IDEAS_MODEL,
      cached: false,
      success: true,
      ...usageMetadata,
    });

    if (shouldUseExtraCredit) {
      const creditConsumed = await consumeExtraAiCredit({
        userId: user.id,
        featureKey: FEATURE_KEY,
      });

      if (!creditConsumed) {
        console.error("Extra AI credit consume failed for related ideas.");
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "ai.related_ideas.generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        cached: false,
        source_reply_count: sourceReplyCount,
      },
    });

    const nextUsage = access.isAdmin
      ? 0
      : monthlyUsageCount + 1;

    return NextResponse.json({
      relatedIdeas,
      cached: false,
      modelName: RELATED_IDEAS_MODEL,
      generatedAt,
      sourceReplyCount,
      monthlyRelatedIdeasUsage: nextUsage,
    });
  } catch (error) {
    console.error("AI related ideas route failed:", error);
    return NextResponse.json(
      { error: "Unable to generate related ideas." },
      { status: 500 }
    );
  }
}
