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

const FEATURE_KEY = "conversation_map";
const CONVERSATION_MAP_MODEL =
  process.env.OPENAI_CONVERSATION_MAP_MODEL || process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini";
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
  return `${text.slice(0, maxLength)}\n\n[Content truncated for conversation mapping.]`;
}

async function getMonthlyConversationMapUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", FEATURE_KEY)
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());
  if (error) {
    console.error("AI conversation map usage count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

async function generateOpenAIConversationMap({
  title,
  topic,
  realityLens,
  sourceText,
  replyCount,
  sourceAuthors,
}: {
  title: string;
  topic: string;
  realityLens: string | null;
  sourceText: string;
  replyCount: number;
  sourceAuthors: Map<string, string>;
}) {
  if (!OPENAI_API_KEY) throw new Error("AI conversation mapping is not configured yet.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CONVERSATION_MAP_MODEL,
      temperature: 0.15,
      max_tokens: 620,
      messages: [
        {
          role: "system",
          content:
            "You create neutral conversation maps for a public high-signal discussion platform. Do not add facts not present in the source. Do not write a summary only; map how ideas relate. Avoid hype, moralizing, diagnosis, and long quotes. Distinguish claims, support, counterpoints, questions, and branches. " + DISCUSSION_AI_CITATION_INSTRUCTIONS,
        },
        {
          role: "user",
          content: `Create a Conversation Map for this discussion with exactly these sections: Core idea, Supporting points, Open questions, Tensions, Related directions. Use concise bullets. Show how ideas connect and cite the contribution that establishes each important node or relationship.\n\nTopic: ${topic}\nReality Lens: ${realityLens || "None"}\nTitle: ${title}\nReply count: ${replyCount}\n\n${sourceText}`,
        },
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "AI conversation mapping failed.");
  const raw = payload?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("AI conversation mapping returned no content.");
  return {
    conversationMap: normalizeDiscussionAiCitationTokens(raw, sourceAuthors),
    usageMetadata: getOpenAiUsageMetadata(payload, CONVERSATION_MAP_MODEL),
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
      await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: discussionId || undefined, provider: "openai", modelName: CONVERSATION_MAP_MODEL, success: false, errorMessage: "Premium AI access required." });
      return NextResponse.json({ error: "Premium AI access is required for conversation mapping.", code: "premium_required" }, { status: 403 });
    }
    if (!discussionId) return NextResponse.json({ error: "Missing discussion id." }, { status: 400 });

    const { data: discussion, error: discussionError } = await supabase
      .from("discussions")
      .select("id, user_id, title, topic, reality_lens, body")
      .eq("id", discussionId)
      .is("deleted_at", null)
      .single();
    if (discussionError || !discussion) return NextResponse.json({ error: "Discussion not found." }, { status: 404 });

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
      discussion.reality_lens ?? "",
      ...citationContext.hashMaterial,
    ].join("\n\n"));

    const { data: existingOutput } = await supabase
      .from("discussion_ai_outputs")
      .select("id, discussion_id, feature_key, output_text, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
      .eq("discussion_id", discussionId)
      .eq("feature_key", FEATURE_KEY)
      .maybeSingle();
    if (existingOutput && existingOutput.source_content_hash === sourceContentHash) {
      await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: discussionId, provider: "openai", modelName: existingOutput.model_name ?? CONVERSATION_MAP_MODEL, cached: true, success: true });
      return NextResponse.json({ conversationMap: (existingOutput as CachedAiOutput).output_text, cached: true, modelName: existingOutput.model_name ?? CONVERSATION_MAP_MODEL, generatedAt: existingOutput.generated_at, sourceReplyCount: existingOutput.source_reply_count });
    }

    const monthlyUsageCount = access.isAdmin ? 0 : await getMonthlyConversationMapUsageCount(supabase, user.id);
    const shouldUseExtraCredit = !access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit;
    const extraCreditsRemaining = shouldUseExtraCredit ? await getExtraAiCreditBalance(user.id) : 0;
    if (shouldUseExtraCredit && extraCreditsRemaining <= 0) {
      await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: discussionId, provider: "openai", modelName: CONVERSATION_MAP_MODEL, cached: false, success: false, errorMessage: "Monthly Premium AI conversation map limit reached." });
      return NextResponse.json({ error: "Monthly Premium AI conversation map limit reached.", code: "conversation_map_limit_reached", monthlyConversationMapLimit: access.monthlyThreadAiLimit, monthlyConversationMapUsage: monthlyUsageCount }, { status: 429 });
    }

    let conversationMap: string;
    let usageMetadata = {};
    try {
      const generated = await generateOpenAIConversationMap({ title: discussion.title, topic: discussion.topic, realityLens: discussion.reality_lens ?? null, sourceText: citationContext.sourceText, replyCount: sourceReplyCount, sourceAuthors: citationContext.sourceAuthors });
      conversationMap = generated.conversationMap;
      usageMetadata = generated.usageMetadata;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI conversation mapping failed.";
      await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: discussionId, provider: "openai", modelName: CONVERSATION_MAP_MODEL, success: false, errorMessage: message });
      const aiError = getAiProviderErrorResponse(message);
      return NextResponse.json({ error: aiError.error }, { status: aiError.status });
    }

    const generatedAt = new Date().toISOString();
    const { error: cacheError } = await upsertDiscussionAiOutput({ discussion_id: discussionId, feature_key: FEATURE_KEY, output_text: conversationMap, model_name: CONVERSATION_MAP_MODEL, source_reply_count: sourceReplyCount, source_content_hash: sourceContentHash, generated_by: user.id, generated_at: generatedAt, updated_at: generatedAt });
    if (cacheError) console.error("AI conversation map cache write failed:", cacheError.message);

    await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: discussionId, provider: "openai", modelName: CONVERSATION_MAP_MODEL, cached: false, success: true, ...usageMetadata });
    if (shouldUseExtraCredit) {
      const creditConsumed = await consumeExtraAiCredit({ userId: user.id, featureKey: FEATURE_KEY });
      if (!creditConsumed) console.error("Extra AI credit consume failed for conversation map.");
    }

    await logAuditEvent({ actor_id: user.id, action: "ai.conversation_map.generated", target_type: "discussion", target_id: discussionId, metadata: { cached: false, source_reply_count: sourceReplyCount, citation_schema: DISCUSSION_AI_CITATION_SCHEMA } });
    const nextUsage = access.isAdmin ? 0 : monthlyUsageCount + 1;
    return NextResponse.json({ conversationMap, cached: false, modelName: CONVERSATION_MAP_MODEL, generatedAt, sourceReplyCount, monthlyConversationMapUsage: nextUsage });
  } catch (error) {
    console.error("AI conversation map route failed:", error);
    return NextResponse.json({ error: "Unable to generate conversation map." }, { status: 500 });
  }
}
