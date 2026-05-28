import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getAiAccess,
  getAiFeatureLimit,
  getAiProviderErrorResponse,
  getMonthlyAiFeatureUsageCount,
  getOpenAiUsageMetadata,
  logAiUsage,
} from "@/lib/premium-ai";

const FEATURE_KEY = "reply_suggestions";
const REPLY_SUGGESTIONS_MODEL =
  process.env.OPENAI_REPLY_SUGGESTIONS_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MAX_DISCUSSION_BODY_CHARS = 6000;
const MAX_REPLY_CHARS = 9000;

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Content truncated for reply target suggestions.]`;
}

async function generateReplySuggestions({
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
    throw new Error("AI reply suggestions are not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REPLY_SUGGESTIONS_MODEL,
      temperature: 0.2,
      max_tokens: 360,
      messages: [
        {
          role: "system",
          content:
            "You help members of a high-signal discussion platform decide what is worth replying to. Do not write a reply for the user. Do not tell the user what opinion to hold. Identify useful reply targets only: unclear assumptions, unresolved questions, missing evidence, personal experience that could add context, or tensions worth clarifying. Do not add facts not present in the source.",
        },
        {
          role: "user",
          content: `Identify 3-5 useful things a member could reply to in this discussion. Return short bullets. Each bullet should name the reply target and why it may add signal. Do not draft the reply itself.\n\nTopic: ${topic}\nTitle: ${title}\nReply count: ${replyCount}\n\nOriginal discussion body:\n${clampText(body, MAX_DISCUSSION_BODY_CHARS)}\n\nReplies in chronological order:\n${clampText(replies || "No replies yet.", MAX_REPLY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI reply suggestions generation failed.";
    throw new Error(message);
  }

  const replySuggestions = payload?.choices?.[0]?.message?.content?.trim();

  if (!replySuggestions) {
    throw new Error("AI reply suggestions returned no content.");
  }

  return {
    replySuggestions,
    usageMetadata: getOpenAiUsageMetadata(payload, REPLY_SUGGESTIONS_MODEL),
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

    const body = await request.json().catch(() => ({}));
    const discussionId = String(body.discussionId ?? "").trim();

    if (!discussionId) {
      return NextResponse.json(
        { error: "Missing discussion id." },
        { status: 400 }
      );
    }

    if (!access.allowed) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: REPLY_SUGGESTIONS_MODEL,
        cached: false,
        success: false,
        errorMessage: "Premium AI access required.",
      });

      return NextResponse.json(
        {
          error: "Premium AI access is required for reply suggestions.",
          code: "premium_required",
        },
        { status: 403 }
      );
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyAiFeatureUsageCount(supabase, user.id, FEATURE_KEY);
    const monthlyFeatureLimit = getAiFeatureLimit(access, FEATURE_KEY);

    if (!access.isAdmin && monthlyUsageCount >= monthlyFeatureLimit) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: REPLY_SUGGESTIONS_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium AI reply suggestions limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium AI reply suggestions limit reached.",
          code: "reply_suggestions_limit_reached",
          monthlyReplySuggestionsLimit: monthlyFeatureLimit,
          monthlyReplySuggestionsUsage: monthlyUsageCount,
        },
        { status: 429 }
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

    const visibleReplies = (replyData ?? []) as {
      body: string;
      created_at: string;
    }[];

    const replies = visibleReplies
      .map((reply, index) => `Reply ${index + 1}: ${reply.body}`)
      .join("\n\n");

    const replyCount = visibleReplies.length;

    let replySuggestions: string;
    let usageMetadata = {};

    try {
      const generated = await generateReplySuggestions({
        title: discussion.title,
        topic: discussion.topic,
        body: discussion.body,
        replies,
        replyCount,
      });

      replySuggestions = generated.replySuggestions;
      usageMetadata = generated.usageMetadata;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "AI reply suggestions generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion",
        targetId: discussionId,
        provider: "openai",
        modelName: REPLY_SUGGESTIONS_MODEL,
        cached: false,
        success: false,
        errorMessage: message,
      });

      const aiError = getAiProviderErrorResponse(message);

      return NextResponse.json(
        { error: aiError.error },
        { status: aiError.status }
      );
    }

    await logAiUsage({
      supabase,
      userId: user.id,
      featureKey: FEATURE_KEY,
      targetType: "discussion",
      targetId: discussionId,
      provider: "openai",
      modelName: REPLY_SUGGESTIONS_MODEL,
      cached: false,
      success: true,
      ...usageMetadata,
    });

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.reply_suggestions_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: REPLY_SUGGESTIONS_MODEL,
        access_tier: access.tier,
        source_reply_count: replyCount,
        monthly_reply_suggestions_limit: access.isAdmin
          ? "unlimited"
          : monthlyFeatureLimit,
        monthly_reply_suggestions_usage_before_generation: access.isAdmin
          ? 0
          : monthlyUsageCount,
      },
    });

    return NextResponse.json({
      replySuggestions,
      modelName: REPLY_SUGGESTIONS_MODEL,
      monthlyReplySuggestionsLimit: access.isAdmin ? null : monthlyFeatureLimit,
      monthlyReplySuggestionsUsage: access.isAdmin
        ? null
        : monthlyUsageCount + 1,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
