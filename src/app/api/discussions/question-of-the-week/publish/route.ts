import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { sendNativePushBroadcast } from "@/lib/push-broadcast";

const MODEL =
  process.env.OPENAI_QUESTION_OF_WEEK_MODEL ||
  process.env.OPENAI_RESEARCH_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5.6";

const MAX_SOURCES = 6;
const MIN_SOURCES = 3;
const PUSH_TITLE = "Question of the Week is here";
const PUSH_BODY = "One real-world question worth thinking through together. Join this week’s discussion.";
const PUSH_AUDIT_ACTION = "question_of_the_week.push_announcement";

type SourceCandidate = {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
};

type WeeklyQuestionCandidate = {
  title: string;
  topic: DiscussionTopic;
  whyNow: string;
  context: string;
  discussionPrompt: string;
  sources: SourceCandidate[];
};

type WeeklyQuestionRecord = {
  id: string;
  discussion_id: string;
  week_start: string;
  week_end: string;
  published_at?: string | null;
  category?: string | null;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: { message?: string };
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getConfiguredSecret() {
  return process.env.QUESTION_OF_WEEK_CRON_SECRET ?? process.env.CRON_SECRET ?? "";
}

function getProvidedSecret(request: NextRequest) {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    request.headers.get("x-question-of-week-secret")?.trim() ||
    ""
  );
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getWeekWindow(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    start: date.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function clamp(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function extractResponseText(payload: OpenAiResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text.trim();
      }
    }
  }
  return "";
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isDiscussionTopic(value: string): value is DiscussionTopic {
  return (DISCUSSION_TOPICS as readonly string[]).includes(value);
}

function validateCandidate(value: unknown): WeeklyQuestionCandidate {
  if (!value || typeof value !== "object") {
    throw new Error("AI returned an invalid weekly question payload.");
  }

  const row = value as Record<string, unknown>;
  const title = clamp(row.title, 160);
  const topicValue = clamp(row.topic, 80);
  const whyNow = clamp(row.whyNow, 700);
  const context = clamp(row.context, 3500);
  const discussionPrompt = clamp(row.discussionPrompt, 1500);

  if (title.length < 20 || !title.endsWith("?")) {
    throw new Error("AI did not return a usable question title.");
  }
  if (!isDiscussionTopic(topicValue)) {
    throw new Error("AI returned a topic outside the canonical discussion topics.");
  }
  if (whyNow.length < 40 || context.length < 120 || discussionPrompt.length < 40) {
    throw new Error("AI returned insufficient editorial context.");
  }

  const rawSources = Array.isArray(row.sources) ? row.sources : [];
  const sources: SourceCandidate[] = [];
  const seenUrls = new Set<string>();
  for (const item of rawSources) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const url = normalizeUrl(source.url);
    if (!url || seenUrls.has(url)) continue;
    seenUrls.add(url);
    sources.push({
      title: clamp(source.title, 220),
      publisher: clamp(source.publisher, 120),
      url,
      publishedAt: source.publishedAt ? clamp(source.publishedAt, 40) : null,
    });
    if (sources.length >= MAX_SOURCES) break;
  }

  const distinctHosts = new Set(sources.map((source) => new URL(source.url).hostname));
  if (sources.length < MIN_SOURCES || distinctHosts.size < 2) {
    throw new Error("AI did not return enough independently sourced current context.");
  }

  return { title, topic: topicValue, whyNow, context, discussionPrompt, sources };
}

async function generateCandidate(weekStart: string, weekEnd: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const prompt = `You are the Loombus Editorial research desk. Select exactly one Question of the Week for ${weekStart} through ${weekEnd}.

Use live web search before choosing. The question must be grounded in a meaningful current or very recent real-world development, broad enough for thoughtful public discussion, and specific enough to produce evidence-driven replies. Prefer developments from the last 7 days; use older context only when it is necessary to understand a current event.

Editorial rules:
- Be politically neutral and nonpartisan. Do not write advocacy or persuasion copy.
- Do not assume allegations are facts. Distinguish established facts, claims, uncertainty, and forecasts.
- Avoid sensationalism, rage bait, celebrity gossip, and trivial trend-chasing.
- Favor questions with durable implications for society, technology, science, economics, education, work, culture, law, health, environment, or public life.
- The title must be a genuine open question ending in a question mark, not a disguised conclusion.
- Use at least 3 credible HTTPS sources across at least 2 independent publishers.
- Do not invent source URLs, dates, quotations, statistics, or events.
- topic must be exactly one of: ${DISCUSSION_TOPICS.join(", ")}.

Return JSON only with this exact shape:
{
  "title": "Question ending in ?",
  "topic": "one canonical topic",
  "whyNow": "2 to 4 sentences explaining the current trigger and why the question matters now",
  "context": "neutral factual background that gives members enough context to participate without telling them what to think",
  "discussionPrompt": "2 to 4 sentences telling members what tensions, evidence, tradeoffs, or uncertainties are worth examining",
  "sources": [
    {"title":"source title","publisher":"publisher","url":"https://...","publishedAt":"date or null"}
  ]
}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      store: false,
      tools: [{ type: "web_search" }],
      input: prompt,
      max_output_tokens: 2200,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI returned HTTP ${response.status}.`);
  }

  const text = extractResponseText(payload);
  if (!text) throw new Error("OpenAI returned no weekly question output.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    throw new Error("OpenAI returned malformed weekly question JSON.");
  }
  return validateCandidate(parsed);
}

function buildDiscussionBody(candidate: WeeklyQuestionCandidate) {
  const sources = candidate.sources
    .map((source, index) => {
      const date = source.publishedAt ? ` (${source.publishedAt})` : "";
      const publisher = source.publisher || "Source";
      return `${index + 1}. ${publisher}${date}: ${source.url}`;
    })
    .join("\n");

  return [
    "Why this matters now",
    candidate.whyNow,
    "",
    "Context",
    candidate.context,
    "",
    "What to think through",
    candidate.discussionPrompt,
    "",
    "Sources used for this week's framing",
    sources,
    "",
    "Loombus Editorial uses these sources to frame the question. Members should evaluate the evidence and add stronger or conflicting sources in the discussion.",
  ].join("\n");
}

async function ensureQuestionAnnouncement(
  supabase: NonNullable<ReturnType<typeof getServiceClient>>,
  actorId: string,
  question: WeeklyQuestionRecord
) {
  const { data: discussion, error: discussionError } = await supabase
    .from("discussions")
    .select("id, deleted_at, audience_type")
    .eq("id", question.discussion_id)
    .maybeSingle();

  if (discussionError) throw new Error(discussionError.message);
  if (!discussion) throw new Error("Question of the Week discussion no longer exists.");
  if (discussion.deleted_at) throw new Error("Question of the Week discussion is deleted and cannot be announced.");
  if (discussion.audience_type !== "public") {
    throw new Error("Question of the Week must be public before it can be announced.");
  }

  const { data: existingSend, error: existingSendError } = await supabase
    .from("audit_logs")
    .select("id, created_at")
    .eq("action", PUSH_AUDIT_ACTION)
    .eq("target_type", "discussion")
    .eq("target_id", question.discussion_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSendError) throw new Error(existingSendError.message);
  if (existingSend) {
    return {
      sent: false,
      alreadySent: true,
      sentAt: existingSend.created_at,
    };
  }

  const summary = await sendNativePushBroadcast({
    title: PUSH_TITLE,
    body: PUSH_BODY,
    url: `/discussions/${question.discussion_id}`,
  });

  const { error: announcementAuditError } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action: PUSH_AUDIT_ACTION,
    target_type: "discussion",
    target_id: question.discussion_id,
    metadata: {
      question_of_the_week_id: question.id,
      week_start: question.week_start,
      week_end: question.week_end,
      title: PUSH_TITLE,
      body: PUSH_BODY,
      automatic: true,
      eligible_users: summary.eligibleUsers,
      eligible_tokens: summary.eligibleTokens,
      attempted_tokens: summary.attemptedTokens,
      accepted_tokens: summary.acceptedTokens,
      failed_tokens: summary.failedTokens,
      skipped_tokens: summary.skippedTokens,
    },
  });

  if (announcementAuditError) {
    throw new Error(`QOTW announcement was submitted but audit logging failed: ${announcementAuditError.message}`);
  }

  return {
    sent: true,
    alreadySent: false,
    ...summary,
  };
}

async function publishQuestion(request: NextRequest) {
  const configuredSecret = getConfiguredSecret();
  const providedSecret = getProvidedSecret(request);
  if (!configuredSecret || providedSecret !== configuredSecret) {
    return jsonError("Unauthorized.", 401);
  }

  const supabase = getServiceClient();
  if (!supabase) return jsonError("Question of the Week service is not configured.", 503);

  const authorId = process.env.QUESTION_OF_WEEK_AUTHOR_USER_ID?.trim();
  if (!authorId) return jsonError("QUESTION_OF_WEEK_AUTHOR_USER_ID is not configured.", 503);

  const { start, end } = getWeekWindow();
  const { data: existing, error: existingError } = await supabase
    .from("questions_of_the_week")
    .select("id, discussion_id, week_start, week_end, published_at")
    .eq("week_start", start)
    .maybeSingle();

  if (existingError) return jsonError(existingError.message, 500);
  if (existing) {
    try {
      const announcement = await ensureQuestionAnnouncement(supabase, authorId, existing as WeeklyQuestionRecord);
      return NextResponse.json({
        ok: true,
        created: false,
        reason: "Question of the Week already exists for this week.",
        question: existing,
        announcement,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Question of the Week announcement failed.";
      console.error("Question of the Week automatic announcement failed:", message);
      return jsonError(`Question of the Week exists, but its automatic announcement failed: ${message}`, 502);
    }
  }

  const { data: author, error: authorError } = await supabase
    .from("profiles")
    .select("id, is_admin, account_status")
    .eq("id", authorId)
    .maybeSingle();
  if (authorError) return jsonError(authorError.message, 500);
  if (!author || author.is_admin !== true || author.account_status !== "active") {
    return jsonError("Question of the Week author must be an active Loombus admin profile.", 503);
  }

  let candidate: WeeklyQuestionCandidate;
  try {
    candidate = await generateCandidate(start, end);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly question generation failed.";
    console.error("Question of the Week generation failed:", message);
    return jsonError(message, 502);
  }

  const now = new Date().toISOString();
  const body = buildDiscussionBody(candidate);
  const { data: discussion, error: discussionError } = await supabase
    .from("discussions")
    .insert({
      user_id: authorId,
      title: candidate.title,
      topic: candidate.topic,
      body,
      discussion_status: "open",
      discussion_type: "research_question",
      discussion_metadata: {
        editorial_feature: "question_of_the_week",
        generated_by: "loombus_editorial_ai",
        model: MODEL,
        week_start: start,
        week_end: end,
      },
      audience_type: "public",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (discussionError || !discussion) {
    return jsonError(discussionError?.message || "Unable to create the weekly discussion.", 500);
  }

  const sourceContext = {
    generated_at: now,
    model: MODEL,
    selection_method: "openai_web_search",
    sources: candidate.sources,
  };

  const { data: weeklyQuestion, error: weeklyError } = await supabase
    .from("questions_of_the_week")
    .insert({
      discussion_id: discussion.id,
      week_start: start,
      week_end: end,
      category: candidate.topic,
      why_now: candidate.whyNow,
      source_context: sourceContext,
      published_at: now,
      updated_at: now,
    })
    .select("id, discussion_id, week_start, week_end, category, published_at")
    .single();

  if (weeklyError || !weeklyQuestion) {
    await supabase.from("discussions").delete().eq("id", discussion.id);
    return jsonError(weeklyError?.message || "Unable to publish weekly-question metadata.", 500);
  }

  const tags = ["Question of the Week", candidate.topic]
    .filter((tag, index, values) => values.indexOf(tag) === index)
    .filter((tag) => tag.length >= 2 && tag.length <= 40);
  if (tags.length > 0) {
    const { error: tagError } = await supabase.from("discussion_tags").insert(
      tags.map((tag) => ({
        discussion_id: discussion.id,
        tag,
        created_by: authorId,
      }))
    );
    if (tagError) console.error("Question of the Week tag insert failed:", tagError.message);
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: authorId,
    action: "question_of_the_week.publish",
    target_type: "discussion",
    target_id: discussion.id,
    metadata: {
      week_start: start,
      week_end: end,
      model: MODEL,
      source_count: candidate.sources.length,
    },
  });
  if (auditError) console.error("Question of the Week audit log failed:", auditError.message);

  let announcement;
  try {
    announcement = await ensureQuestionAnnouncement(
      supabase,
      authorId,
      weeklyQuestion as WeeklyQuestionRecord
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question of the Week announcement failed.";
    console.error("Question of the Week automatic announcement failed:", message);
    return jsonError(`Question of the Week was published, but its automatic announcement failed: ${message}`, 502);
  }

  return NextResponse.json({
    ok: true,
    created: true,
    question: weeklyQuestion,
    title: candidate.title,
    sourceCount: candidate.sources.length,
    announcement,
  });
}

export async function GET(request: NextRequest) {
  return publishQuestion(request);
}

export async function POST(request: NextRequest) {
  return publishQuestion(request);
}
