import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getAiAccess,
  getAiProviderErrorResponse,
  getCurrentMonthStart,
  logAiUsage,
} from "@/lib/premium-ai";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";

const REWRITE_MODEL =
  process.env.OPENAI_REWRITE_MODEL ||
  process.env.OPENAI_QUALITY_CHECK_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FEATURE_KEY = "discussion_clarity_rewrite";
const MAX_BODY_CHARS = 12000;

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Content truncated for clarity rewrite.]`;
}

function hasRewriteAccess(access: {
  allowed: boolean;
  isAdmin: boolean;
  monthlyThreadAiLimit: number;
}) {
  return access.isAdmin || (access.allowed && access.monthlyThreadAiLimit > 50);
}

async function getMonthlyRewriteUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", FEATURE_KEY)
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());

  if (error) {
    console.error("AI clarity rewrite usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function generateClarityRewrite({
  title,
  topic,
  body,
}: {
  title: string;
  topic: string;
  body: string;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI clarity rewrite is not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REWRITE_MODEL,
      temperature: 0.25,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "You improve clarity for a public high-signal discussion platform. Rewrite only the discussion body. Preserve the user's meaning, stance, and core ideas. Do not add new facts. Do not make claims stronger than the original. Do not include headings unless the original needs structure. Return only the rewritten body.",
        },
        {
          role: "user",
          content: `Rewrite this discussion body for clarity, structure, and signal. Keep the same meaning and do not add facts.\n\nTopic: ${topic}\nTitle: ${title}\n\nOriginal body:\n${clampText(body, MAX_BODY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI clarity rewrite generation failed.";
    throw new Error(message);
  }

  const rewrite = payload?.choices?.[0]?.message?.content?.trim();

  if (!rewrite) {
    throw new Error("AI clarity rewrite returned no text.");
  }

  return rewrite;
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

    const requestBody = await request.json();

    const title = String(requestBody.title ?? "").trim();
    const requestedTopic = String(requestBody.topic ?? "").trim();
    const body = String(requestBody.body ?? "").trim();

    const topic: DiscussionTopic = DISCUSSION_TOPICS.includes(
      requestedTopic as DiscussionTopic
    )
      ? requestedTopic as DiscussionTopic
      : "General";

    if (!title) {
      return NextResponse.json(
        { error: "Please enter a discussion title before running the rewrite." },
        { status: 400 }
      );
    }

    if (!body || body.length < 8) {
      return NextResponse.json(
        { error: "Please enter more discussion content before running the rewrite." },
        { status: 400 }
      );
    }

    const access = await getAiAccess(supabase, user.id);

    if (!hasRewriteAccess(access)) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion_draft",
        provider: "openai",
        modelName: REWRITE_MODEL,
        cached: false,
        success: false,
        errorMessage: "Premium Plus or Admin access required.",
      });

      return NextResponse.json(
        {
          error: "AI rewrite for clarity requires Premium Plus or Admin access.",
          code: "premium_plus_required",
        },
        { status: 403 }
      );
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyRewriteUsageCount(supabase, user.id);

    if (!access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion_draft",
        provider: "openai",
        modelName: REWRITE_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium Plus AI rewrite limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium Plus AI rewrite limit reached.",
          code: "rewrite_limit_reached",
          monthlyRewriteLimit: access.monthlyThreadAiLimit,
          monthlyRewriteUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let rewrite: string;

    try {
      rewrite = await generateClarityRewrite({
        title,
        topic,
        body,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI clarity rewrite generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion_draft",
        provider: "openai",
        modelName: REWRITE_MODEL,
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
      targetType: "discussion_draft",
      provider: "openai",
      modelName: REWRITE_MODEL,
      cached: false,
      success: true,
    });

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "discussion.clarity_rewrite_generated",
      target_type: "discussion_draft",
      target_id: null,
      metadata: {
        model_name: REWRITE_MODEL,
        access_tier: access.tier,
        monthly_rewrite_limit: access.isAdmin ? "unlimited" : access.monthlyThreadAiLimit,
        monthly_rewrite_usage_before_generation: access.isAdmin ? 0 : monthlyUsageCount,
      },
    });

    return NextResponse.json({
      rewrite,
      modelName: REWRITE_MODEL,
      monthlyRewriteLimit: access.isAdmin ? null : access.monthlyThreadAiLimit,
      monthlyRewriteUsage: access.isAdmin ? null : monthlyUsageCount + 1,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
