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

    const body = await request.json();
    const discussionId = String(body.discussionId ?? "").trim();

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
      return NextResponse.json({
        summary: existingSummary as CachedSummary,
        cached: true,
      });
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

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      action: "discussion.summary_generated",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        model_name: SUMMARY_MODEL,
        source_reply_count: sourceReplyCount,
      },
    });

    return NextResponse.json({
      summary: insertedSummary as CachedSummary,
      cached: false,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
