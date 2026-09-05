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
  upsertDiscussionSummary,
} from "@/lib/premium-ai";

const SUMMARY_MODEL = process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_DISCUSSION_BODY_CHARS = 6000;
const MAX_REPLY_CHARS = 8000;
const CITATION_SCHEMA_VERSION = "semantic-citations-v1";
const SOURCE_TOKEN_PATTERN = /\[\[source:([^|\]]+)\|([^|\]]+)\|([^\]]+)\]\]/g;
const CONTRIBUTION_ROLES = new Set([
  "Opening claim",
  "Supporting point",
  "Counterpoint",
  "Evidence",
  "Example",
  "Clarification",
  "Question",
  "Synthesis",
  "Changed view",
  "Proposed solution",
  "Contribution",
]);

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

type SourceReply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

type SourceProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

function getSummaryProvider(modelName: string | null | undefined) {
  return modelName?.toLowerCase().startsWith("claude") ? "anthropic" : "openai";
}

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Content truncated for summary generation.]`;
}

function profileName(profile?: SourceProfile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function safeTokenField(value: string) {
  return value.replace(/[|\[\]]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCitationTokens(text: string, sourceAuthors: Map<string, string>) {
  return text.replace(SOURCE_TOKEN_PATTERN, (_match, rawId: string, _rawAuthor: string, rawRole: string) => {
    const sourceId = rawId.trim();
    const author = sourceAuthors.get(sourceId);
    if (!author) return "";
    const requestedRole = rawRole.trim();
    const role = CONTRIBUTION_ROLES.has(requestedRole) ? requestedRole : "Contribution";
    return `[[source:${sourceId}|${safeTokenField(author)}|${role}]]`;
  });
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
  if (!OPENAI_API_KEY) throw new Error("AI summaries are not configured yet.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SUMMARY_MODEL,
      store: false,
      temperature: 0.15,
      max_tokens: 520,
      messages: [
        {
          role: "system",
          content:
            "You write concise, neutral editorial intelligence for a public high-signal discussion platform. Use only supplied material. Do not invent facts, consensus, participant intent, author names, or source IDs. Explain the reasoning structure of the discussion rather than narrating a numbered transcript. Never output [Original post], [Reply N], reply numbers, or ordinal citation labels. Every source attribution must use the exact source token format supplied below.",
        },
        {
          role: "user",
          content: `Create a professional Overview of this discussion. Return 3-5 concise findings followed by one short paragraph beginning exactly with "Synthesis:". Each finding should identify the substantive idea, agreement, tension, evidence pressure, or reasoning shift rather than merely saying that members replied.\n\nAfter a statement that depends on a source, append one or more source tokens using exactly this form:\n[[source:SOURCE_ID|AUTHOR_NAME|ROLE]]\n\nSOURCE_ID must be either "opening" or an exact reply UUID shown in the source material. AUTHOR_NAME must match the supplied author. ROLE must be one of: Opening claim, Supporting point, Counterpoint, Evidence, Example, Clarification, Question, Synthesis, Changed view, Proposed solution. Choose the role according to what that contribution actually does in context. Do not cite every sentence mechanically; cite the contributions that materially support the finding.\n\nTopic: ${topic}\nTitle: ${title}\nReply count at generation time: ${replyCount}\n\n${sourceText}`,
        },
      ],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "AI summary generation failed.";
    throw new Error(message);
  }

  const rawSummary = payload?.choices?.[0]?.message?.content?.trim();
  if (!rawSummary) throw new Error("AI summary generation returned no summary.");

  return {
    summary: normalizeCitationTokens(rawSummary, sourceAuthors),
    usageMetadata: getOpenAiUsageMetadata(payload, SUMMARY_MODEL),
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const access = await getAiAccess(supabase, user.id);
    const requestBody = await request.json();
    const discussionId = String(requestBody.discussionId ?? "").trim();

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
        { error: "Premium AI access is required for discussion summaries.", code: "premium_required" },
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
      .limit(25);

    const visibleReplies = (replyData ?? []) as SourceReply[];
    const profileIds = [...new Set([discussion.user_id, ...visibleReplies.map((reply) => reply.user_id)])];
    const { data: profileData } = profileIds.length
      ? await supabase.from("profiles").select("id, full_name, username").in("id", profileIds)
      : { data: [] };
    const profiles = new Map(
      ((profileData ?? []) as SourceProfile[]).map((profile) => [profile.id, profile])
    );

    const openingAuthor = profileName(profiles.get(discussion.user_id));
    const sourceAuthors = new Map<string, string>([["opening", openingAuthor]]);
    for (const reply of visibleReplies) {
      sourceAuthors.set(reply.id, profileName(profiles.get(reply.user_id)));
    }

    const replySources = visibleReplies
      .map((reply) => {
        const author = sourceAuthors.get(reply.id) ?? "Loombus member";
        return `[Source reply id=${reply.id} author="${safeTokenField(author)}"]\n${reply.body}`;
      })
      .join("\n\n");

    const sourceText = `[Source opening id=opening author="${safeTokenField(openingAuthor)}"]\n${clampText(
      discussion.body,
      MAX_DISCUSSION_BODY_CHARS
    )}\n\nReplies in chronological order:\n${clampText(replySources || "No replies yet.", MAX_REPLY_CHARS)}`;

    const sourceReplyCount = visibleReplies.length;
    const sourceContent = [
      CITATION_SCHEMA_VERSION,
      discussion.title,
      discussion.topic,
      `opening:${discussion.user_id}:${openingAuthor}:${discussion.body}`,
      ...visibleReplies.map(
        (reply) => `reply:${reply.id}:${reply.user_id}:${sourceAuthors.get(reply.id) ?? "Loombus member"}:${reply.body}`
      ),
    ].join("\n\n");
    const sourceContentHash = createContentHash(sourceContent);

    const { data: existingSummary } = await supabase
      .from("discussion_summaries")
      .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .eq("discussion_id", discussionId)
      .maybeSingle();

    if (existingSummary && existingSummary.source_content_hash === sourceContentHash) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: "thread_summary",
        targetType: "discussion",
        targetId: discussionId,
        provider: getSummaryProvider(existingSummary.model_name ?? SUMMARY_MODEL),
        modelName: existingSummary.model_name ?? SUMMARY_MODEL,
        cached: true,
        success: true,
      });
      return NextResponse.json({ summary: existingSummary as CachedSummary, cached: true });
    }

    const monthlyUsageCount = access.isAdmin ? 0 : await getMonthlySummaryUsageCount(supabase, user.id);
    const shouldUseExtraCredit = !access.isAdmin && monthlyUsageCount >= access.monthlySummaryLimit;
    const extraCreditsRemaining = shouldUseExtraCredit ? await getExtraAiCreditBalance(user.id) : 0;

    if (shouldUseExtraCredit && extraCreditsRemaining <= 0) {
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
    const generationProvider = "openai" as const;

    try {
      const generated = await generateOpenAISummary({
        title: discussion.title,
        topic: discussion.topic,
        sourceText,
        replyCount: sourceReplyCount,
        sourceAuthors,
      });
      summaryText = generated.summary;
      usageMetadata = generated.usageMetadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI summary generation failed.";
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
      return NextResponse.json({ error: aiError.error }, { status: aiError.status });
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

      if (fallbackSummary && fallbackSummary.source_content_hash === sourceContentHash) {
        await logAiUsage({
          supabase,
          userId: user.id,
          featureKey: "thread_summary",
          targetType: "discussion",
          targetId: discussionId,
          provider: getSummaryProvider(fallbackSummary.model_name ?? SUMMARY_MODEL),
          modelName: fallbackSummary.model_name ?? SUMMARY_MODEL,
          cached: true,
          success: true,
        });
        return NextResponse.json({ summary: fallbackSummary as CachedSummary, cached: true });
      }

      console.error("AI summary cache write failed:", insertError.message);
      return NextResponse.json({ error: "Unable to save AI summary. Please try again later." }, { status: 500 });
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: "thread_summary",
      targetType: "discussion",
      targetId: discussionId,
      provider: generationProvider,
      modelName: SUMMARY_MODEL,
      cached: false,
      success: true,
      ...usageMetadata,
    });

    if (shouldUseExtraCredit) {
      const consumed = await consumeExtraAiCredit({
        userId: user.id,
        featureKey: "thread_summary",
        targetType: "discussion",
        targetId: discussionId,
      });
      if (!consumed) {
        return NextResponse.json(
          { error: "Extra AI Pack credits could not be consumed. Please try again." },
          { status: 429 }
        );
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.summary_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: SUMMARY_MODEL,
        ai_provider: generationProvider,
        source_reply_count: sourceReplyCount,
        citation_schema: CITATION_SCHEMA_VERSION,
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
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
