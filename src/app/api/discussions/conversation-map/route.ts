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

const FEATURE_KEY = "conversation_map";
const CONVERSATION_MAP_MODEL =
  process.env.OPENAI_CONVERSATION_MAP_MODEL ||
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
  if (text.length <= maxLength) {
    return text;
  }

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
    throw new Error("AI conversation mapping is not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CONVERSATION_MAP_MODEL,
      temperature: 0.2,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You create neutral conversation maps for a public high-signal discussion platform. Do not add facts not present in the source. Do not write a summary only. Map how ideas relate. Avoid hype, moralizing, diagnosis, or long quotes. Return useful structure for readers who want to understand the conversation.",
        },
        {
          role: "user",
          content: `Create an AI Conversation Map for this discussion. Return exactly these sections with concise bullets:\n\n1. Core idea\n2. Supporting points\n3. Open questions\n4. Tensions\n5. Related directions\n\nFocus on how the ideas connect, what is still unresolved, and where the conversation could productively go next. Do not invent facts.\n\nTopic: ${topic}\nReality Lens: ${realityLens || "None"}\nTitle: ${title}\nReply count: ${replyCount}\n\nOriginal discussion body:\n${clampText(body, MAX_DISCUSSION_BODY_CHARS)}\n\nReplies in chronological order:\n${clampText(replies || "No replies yet.", MAX_REPLY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI conversation mapping failed.";
    throw new Error(message);
  }

  const conversationMap = payload?.choices?.[0]?.message?.content?.trim();

  if (!conversationMap) {
    throw new Error("AI conversation mapping returned no content.");
  }

  return {
    conversationMap,
    usageMetadata: getOpenAiUsageMetadata(payload, CONVERSATION_MAP_MODEL),
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
        modelName: CONVERSATION_MAP_MODEL,
        success: false,
        errorMessage: "Premium AI access required.",
      });

      return NextResponse.json(
        {
          error: "Premium AI access is required for conversation mapping.",
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
      .limit(30);

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
        modelName: existingOutput.model_name ?? CONVERSATION_MAP_MODEL,
        cached: true,
        success: true,
      });

      return NextResponse.json({
        conversationMap: (existingOutput as CachedAiOutput).output_text,
        cached: true,
        modelName: existingOutput.model_name ?? CONVERSATION_MAP_MODEL,
        generatedAt: existingOutput.generated_at,
        sourceReplyCount: existingOutput.source_reply_count,
      });
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyConversationMapUsageCount(supabase, user.id);

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
        modelName: CONVERSATION_MAP_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium AI conversation map limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium AI conversation map limit reached.",
          code: "conversation_map_limit_reached",
          monthlyConversationMapLimit: access.monthlyThreadAiLimit,
          monthlyConversationMapUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let conversationMap: string;
    let usageMetadata = {};

    try {
      const generatedConversationMap = await generateOpenAIConversationMap({
        title: discussion.title,
        topic: discussion.topic,
        realityLens: discussion.reality_lens ?? null,
        body: discussion.body,
        replies,
        replyCount: sourceReplyCount,
      });
      conversationMap = generatedConversationMap.conversationMap;
      usageMetadata = generatedConversationMap.usageMetadata;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI conversation mapping failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: CONVERSATION_MAP_MODEL,
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
      output_text: conversationMap,
      model_name: CONVERSATION_MAP_MODEL,
      source_reply_count: sourceReplyCount,
      source_content_hash: sourceContentHash,
      generated_by: user.id,
      generated_at: generatedAt,
      updated_at: generatedAt,
    });

    if (cacheError) {
      console.error("AI conversation map cache write failed:", cacheError.message);
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "discussion",
      targetId: discussionId,
      provider: "openai",
      modelName: CONVERSATION_MAP_MODEL,
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
        console.error("Extra AI credit consume failed for conversation map.");
      }
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "ai.conversation_map.generated",
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
      conversationMap,
      cached: false,
      modelName: CONVERSATION_MAP_MODEL,
      generatedAt,
      sourceReplyCount,
      monthlyConversationMapUsage: nextUsage,
    });
  } catch (error) {
    console.error("AI conversation map route failed:", error);
    return NextResponse.json(
      { error: "Unable to generate conversation map." },
      { status: 500 }
    );
  }
}
