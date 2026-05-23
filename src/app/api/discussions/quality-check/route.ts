import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getAiAccess,
  getAiProviderErrorResponse,
  getCurrentMonthStart,
  logAiUsage,
} from "@/lib/premium-ai";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";

const QUALITY_CHECK_MODEL =
  process.env.OPENAI_QUALITY_CHECK_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FEATURE_KEY = "discussion_quality_check";
const MAX_BODY_CHARS = 12000;

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[Content truncated for quality check.]`;
}

function hasQualityCheckAccess(access: {
  allowed: boolean;
  isAdmin: boolean;
  monthlyThreadAiLimit: number;
}) {
  return access.isAdmin || (access.allowed && access.monthlyThreadAiLimit > 50);
}

async function getMonthlyQualityCheckUsageCount(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", FEATURE_KEY)
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());

  if (error) {
    console.error("AI quality check usage count failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

async function generateQualityCheck({
  title,
  topic,
  body,
}: {
  title: string;
  topic: string;
  body: string;
}) {
  if (!OPENAI_API_KEY) {
    throw new Error("AI quality check is not configured yet.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: QUALITY_CHECK_MODEL,
      temperature: 0.2,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You are a pre-post quality reviewer for Loombus, a high-signal discussion platform. Give concise, practical feedback. Do not rewrite the post. Do not be harsh. Do not add facts. Focus on clarity, signal, context, and risk of low-quality posting.",
        },
        {
          role: "user",
          content: `Review this discussion draft before posting. Return exactly these sections with short bullet points:\n\n1. Clarity\n2. Signal strength\n3. Missing context\n4. Low-quality risk\n5. Best improvement before posting\n\nTopic: ${topic}\nTitle: ${title}\n\nBody:\n${clampText(body, MAX_BODY_CHARS)}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "AI quality check generation failed.";
    throw new Error(message);
  }

  const qualityCheck = payload?.choices?.[0]?.message?.content?.trim();

  if (!qualityCheck) {
    throw new Error("AI quality check returned no feedback.");
  }

  return qualityCheck;
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
        { error: "Please enter a discussion title before running the quality check." },
        { status: 400 }
      );
    }

    if (!body || body.length < 8) {
      return NextResponse.json(
        { error: "Please enter more discussion content before running the quality check." },
        { status: 400 }
      );
    }

    const access = await getAiAccess(supabase, user.id);

    if (!hasQualityCheckAccess(access)) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion_draft",
        provider: "openai",
        modelName: QUALITY_CHECK_MODEL,
        cached: false,
        success: false,
        errorMessage: "Premium Plus or Admin access required.",
      });

      return NextResponse.json(
        {
          error: "AI discussion quality check requires Premium Plus or Admin access.",
          code: "premium_plus_required",
        },
        { status: 403 }
      );
    }

    const monthlyUsageCount = access.isAdmin
      ? 0
      : await getMonthlyQualityCheckUsageCount(supabase, user.id);

    if (!access.isAdmin && monthlyUsageCount >= access.monthlyThreadAiLimit) {
      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion_draft",
        provider: "openai",
        modelName: QUALITY_CHECK_MODEL,
        cached: false,
        success: false,
        errorMessage: "Monthly Premium Plus AI quality-check limit reached.",
      });

      return NextResponse.json(
        {
          error: "Monthly Premium Plus AI quality-check limit reached.",
          code: "quality_check_limit_reached",
          monthlyQualityCheckLimit: access.monthlyThreadAiLimit,
          monthlyQualityCheckUsage: monthlyUsageCount,
        },
        { status: 429 }
      );
    }

    let qualityCheck: string;

    try {
      qualityCheck = await generateQualityCheck({
        title,
        topic,
        body,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI quality check generation failed.";

      await logAiUsage({
        supabase,
        userId: user.id,
        featureKey: FEATURE_KEY,
        targetType: "discussion_draft",
        provider: "openai",
        modelName: QUALITY_CHECK_MODEL,
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
      modelName: QUALITY_CHECK_MODEL,
      cached: false,
      success: true,
    });

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.quality_check_generated",
      target_type: "discussion_draft",
      target_id: null,
      metadata: {
        model_name: QUALITY_CHECK_MODEL,
        access_tier: access.tier,
        monthly_quality_check_limit: access.isAdmin ? "unlimited" : access.monthlyThreadAiLimit,
        monthly_quality_check_usage_before_generation: access.isAdmin ? 0 : monthlyUsageCount,
      },
    });

    return NextResponse.json({
      qualityCheck,
      modelName: QUALITY_CHECK_MODEL,
      monthlyQualityCheckLimit: access.isAdmin ? null : access.monthlyThreadAiLimit,
      monthlyQualityCheckUsage: access.isAdmin ? null : monthlyUsageCount + 1,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
