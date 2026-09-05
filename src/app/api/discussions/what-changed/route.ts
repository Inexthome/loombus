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
import {
  DISCUSSION_AI_CITATION_INSTRUCTIONS,
  DISCUSSION_AI_CITATION_SCHEMA,
  buildDiscussionAiCitationContext,
  normalizeDiscussionAiCitationTokens,
  type CitationReply,
} from "@/lib/discussion-ai-source-citations";

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

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Content truncated for what-changed generation.]`;
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
  sourceText,
  replyCount,
  sourceAuthors,
}: {
  title: string;
  topic: string;
  sourceText: string;
  replyCount: number;
  sourceAuthors: Map<string, string>;
}) {
  if (!OPENAI_API_KEY) throw new Error("AI what-changed analysis is not configured yet.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: WHAT_CHANGED_MODEL,
      temperature: 0.15,
      max_tokens: 480,
      messages: [
        {
          role: "system",
          content:
            "You analyze how a discussion evolved over time for a public high-signal discussion platform. Stay neutral. Do not add facts not present in the source. Avoid speculation and long quotes. Distinguish genuine movement in reasoning from mere accumulation of replies. " + DISCUSSION_AI_CITATION_INSTRUCTIONS,
        },
        {
          role: "user",
          content: `Explain what changed in this thread since the opening contribution. Return 3-6 concise bullets. Focus on new angles, changed assumptions, shifts in concern, stronger or weaker claims, unresolved questions, and whether later contributions materially redirected the discussion. If there are no replies, say there is not enough thread activity yet. Use semantic source citations for the contributions that demonstrate each change.\n\nTopic: ${topic}\nTitle: ${title}\nReply count: ${replyCount}\n\n${sourceText}`,
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "AI what-changed generation failed.");
  const raw = payload?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("AI what-changed generation returned no content.");
  return {
    whatChanged: normalizeDiscussionAiCitationTokens(raw, sourceAuthors),
    usageMetadata: getOpenAiUsageMetadata(payload, WHAT_CHANGED_MODEL),
  };
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

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
        { error: "Premium AI access is required for what-changed analysis.", code: "premium_required" },
        { status: 403 }
      );
    }

    if (!discussionId) return NextResponse.json({ error: "Missing discussion id." }, { status: 400 });

    const { data: discussion, error: discussionError } = await supabase
      .from("discussions")
      .select("id, user_id, title, topic, body")
      .eq("id", discussionId)
      .is("deleted_at", null)
      .single();
    if (discussionError || !discussion) {
      return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
    }

    const { data: replyData } = await supabase
      .from("replies")
      .select("id, user_id, body, created_at")
      .eq("discussion_id", discussionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(30);
    const visibleReplies = (replyData ?? []) as CitationReply[];

    const citationContext = await buildDiscussionAiCitationContext({
      supabase,
      discussionUserId: discussion.user_id,
      discussionBody: clampText(discussion.body, MAX_DISCUSSION_BODY_CHARS),
      replies: visibleReplies,
      clamp: (text) => clampText(text, MAX_REPLY_CHARS),
    });

    const sourceReplyCount = visibleReplies.length;
    const sourceContentHash = createContentHash([
      DISCUSSION_AI_CITATION_SCHEMA,
      discussion.title,
      discussion.topic,
      ...citationContext.hashMaterial,
    ].join("\n\n"));

    const { data: existingOutput } = await supabase
      .from("discussion_ai_outputs")
      .select("id, discussion_id, feature_key, output_text, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .eq("discussion_id", discussionId)
      .eq("feature_key", "what_changed")
      .maybeSingle();

    if (existingOutput && existingOutput.source_content_hash === sourceContentHash) {
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

    const monthlyUsageCount = access.isAdmin ? 0 : await getMonthlyWhatChangedUsageCount(supabase, user.id);
    const shouldUseExtraCredit = !access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit;
    const extraCreditsRemaining = shouldUseExtraCredit ? await getExtraAiCreditBalance(user.id) : 0;

    if (shouldUseExtraCredit && extraCreditsRemaining <= 0) {
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
    let usageMetadata = {};
    try {
      const generated = await generateOpenAIWhatChanged({
        title: discussion.title,
        topic: discussion.topic,
        sourceText: citationContext.sourceText,
        replyCount: sourceReplyCount,
        sourceAuthors: citationContext.sourceAuthors,
      });
      whatChanged = generated.whatChanged;
      usageMetadata = generated.usageMetadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI what-changed generation failed.";
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
      return NextResponse.json({ error: aiError.error }, { status: aiError.status });
    }

    const generatedAt = new Date().toISOString();
    const { error: cacheError } = await upsertDiscussionAiOutput({
      discussion_id: discussionId,
      feature_key: "what_changed",
      output_text: whatChanged,
      model_name: WHAT_CHANGED_MODEL,
      source_reply_count: sourceReplyCount,
      source_content_hash: sourceContentHash,
      generated_by: user.id,
      generated_at: generatedAt,
      updated_at: generatedAt,
    });
    if (cacheError) console.error("AI what-changed cache write failed:", cacheError.message);

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
      ...usageMetadata,
    });

    if (shouldUseExtraCredit) {
      const consumed = await consumeExtraAiCredit({
        userId: user.id,
        featureKey: "what_changed",
        targetType: "discussion",
        targetId: discussionId,
      });
      if (!consumed) {
        return NextResponse.json({ error: "Extra AI Pack credits could not be consumed. Please try again." }, { status: 429 });
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.what_changed_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: WHAT_CHANGED_MODEL,
        access_tier: access.tier,
        source_reply_count: sourceReplyCount,
        source_content_hash: sourceContentHash,
        citation_schema: DISCUSSION_AI_CITATION_SCHEMA,
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
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
