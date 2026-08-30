import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS, type DiscussionTopic } from "@/lib/discussion-topics";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const MODEL =
  process.env.OPENAI_QUESTION_OF_WEEK_MODEL ||
  process.env.OPENAI_RESEARCH_MODEL ||
  process.env.OPENAI_MODEL ||
  "gpt-5.6";
const MAX_SOURCES = 6;
const MIN_SOURCES = 3;

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

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function getUserClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase environment configuration.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Admin Supabase configuration.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function requireAdmin(request: NextRequest) {
  try {
    const userClient = getUserClient(request);
    const adminClient = getAdminClient();
    const access = await verifyRequestAccountAccess(userClient);
    if (!access.ok) return { access: null, adminClient: null, error: jsonError(access.error, access.status) };
    if (!access.profile.is_admin) return { access: null, adminClient: null, error: jsonError("Admin access required.", 403) };
    return { access, adminClient, error: null };
  } catch {
    return { access: null, adminClient: null, error: jsonError("Server configuration error.", 500) };
  }
}

function getWeekWindow(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: date.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function clamp(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function extractResponseText(payload: OpenAiResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text.trim();
    }
  }
  return "";
}

function normalizeUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? "").trim());
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isDiscussionTopic(value: string): value is DiscussionTopic {
  return (DISCUSSION_TOPICS as readonly string[]).includes(value);
}

function validateCandidate(value: unknown): WeeklyQuestionCandidate {
  if (!value || typeof value !== "object") throw new Error("Invalid weekly question candidate.");
  const row = value as Record<string, unknown>;
  const title = clamp(row.title, 160);
  const topic = clamp(row.topic, 80);
  const whyNow = clamp(row.whyNow, 700);
  const context = clamp(row.context, 3500);
  const discussionPrompt = clamp(row.discussionPrompt, 1500);
  if (title.length < 20 || !title.endsWith("?")) throw new Error("The title must be a substantive question ending in a question mark.");
  if (!isDiscussionTopic(topic)) throw new Error("The topic must be a canonical Loombus discussion topic.");
  if (whyNow.length < 40 || context.length < 120 || discussionPrompt.length < 40) throw new Error("The candidate needs more editorial context.");

  const sources: SourceCandidate[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(row.sources) ? row.sources : []) {
    if (!item || typeof item !== "object") continue;
    const source = item as Record<string, unknown>;
    const url = normalizeUrl(source.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({
      title: clamp(source.title, 220),
      publisher: clamp(source.publisher, 120),
      url,
      publishedAt: source.publishedAt ? clamp(source.publishedAt, 40) : null,
    });
    if (sources.length >= MAX_SOURCES) break;
  }
  if (sources.length < MIN_SOURCES || new Set(sources.map((source) => new URL(source.url).hostname)).size < 2) {
    throw new Error("The candidate requires at least 3 HTTPS sources from at least 2 independent publishers.");
  }
  return { title, topic, whyNow, context, discussionPrompt, sources };
}

async function generateCandidate(start: string, end: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const prompt = `You are the Loombus Editorial research desk. Propose exactly one Question of the Week for ${start} through ${end}. Use live web search. Choose a meaningful current or very recent real-world development with durable implications and genuine intellectual tension. Prefer developments from the last 7 days. Be neutral and nonpartisan. Do not sensationalize, assume allegations are facts, or invent URLs, dates, statistics, quotations, or events. The question must be open-ended and evidence-friendly, not advocacy. Use at least 3 credible HTTPS sources across at least 2 independent publishers. topic must be exactly one of: ${DISCUSSION_TOPICS.join(", ")}. Return JSON only: {"title":"Question ending in ?","topic":"canonical topic","whyNow":"2-4 sentences","context":"neutral factual background","discussionPrompt":"2-4 sentences about tensions, evidence, tradeoffs, or uncertainty","sources":[{"title":"...","publisher":"...","url":"https://...","publishedAt":"date or null"}]}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, store: false, tools: [{ type: "web_search" }], input: prompt, max_output_tokens: 2200 }),
  });
  const payload = (await response.json().catch(() => ({}))) as OpenAiResponse;
  if (!response.ok) throw new Error(payload.error?.message || `OpenAI returned HTTP ${response.status}.`);
  const text = extractResponseText(payload).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!text) throw new Error("OpenAI returned no weekly question output.");
  try {
    return validateCandidate(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("OpenAI returned malformed weekly question JSON.");
    throw error;
  }
}

function buildDiscussionBody(candidate: WeeklyQuestionCandidate) {
  const sources = candidate.sources.map((source, index) => {
    const date = source.publishedAt ? ` (${source.publishedAt})` : "";
    return `${index + 1}. ${source.publisher || "Source"}${date}: ${source.url}`;
  }).join("\n");
  return [
    "Why this matters now", candidate.whyNow, "",
    "Context", candidate.context, "",
    "What to think through", candidate.discussionPrompt, "",
    "Sources used for this week's framing", sources, "",
    "Loombus Editorial uses these sources to frame the question. Members should evaluate the evidence and add stronger or conflicting sources in the discussion.",
  ].join("\n");
}

async function verifyPublisher(adminClient: any) {
  const authorId = process.env.QUESTION_OF_WEEK_AUTHOR_USER_ID?.trim();
  if (!authorId) throw new Error("QUESTION_OF_WEEK_AUTHOR_USER_ID is not configured.");
  const { data: author, error } = await adminClient.from("profiles").select("id, is_admin, account_status").eq("id", authorId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!author || author.is_admin !== true || author.account_status !== "active") throw new Error("Question of the Week publisher must be an active Loombus admin profile.");
  return authorId;
}

async function setWeeklyMetadata(adminClient: any, args: { discussionId: string; candidate: WeeklyQuestionCandidate; start: string; end: string; actorId: string; replacement: boolean }) {
  const now = new Date().toISOString();
  const sourceContext = { generated_at: now, model: MODEL, selection_method: "admin_editorial_review", sources: args.candidate.sources };
  const { data: existing, error: existingError } = await adminClient.from("questions_of_the_week").select("id, discussion_id").eq("week_start", args.start).maybeSingle();
  if (existingError) throw new Error(existingError.message);
  let result;
  if (existing) {
    const { data, error } = await adminClient.from("questions_of_the_week").update({
      discussion_id: args.discussionId,
      week_end: args.end,
      category: args.candidate.topic,
      why_now: args.candidate.whyNow,
      source_context: sourceContext,
      published_at: now,
      updated_at: now,
    }).eq("id", existing.id).select("id, discussion_id, week_start, week_end, category, published_at").single();
    if (error) throw new Error(error.message);
    result = data;
  } else {
    const { data, error } = await adminClient.from("questions_of_the_week").insert({
      discussion_id: args.discussionId,
      week_start: args.start,
      week_end: args.end,
      category: args.candidate.topic,
      why_now: args.candidate.whyNow,
      source_context: sourceContext,
      published_at: now,
      updated_at: now,
    }).select("id, discussion_id, week_start, week_end, category, published_at").single();
    if (error) throw new Error(error.message);
    result = data;
  }
  await logAuditEvent({
    actor_id: args.actorId,
    action: existing ? "question_of_the_week.replaced" : "question_of_the_week.admin_publish",
    target_type: "discussion",
    target_id: args.discussionId,
    metadata: { week_start: args.start, previous_discussion_id: existing?.discussion_id ?? null, replacement: args.replacement, source_count: args.candidate.sources.length },
  });
  return result;
}

export async function GET(request: NextRequest) {
  const { access, adminClient, error } = await requireAdmin(request);
  if (error || !access || !adminClient) return error;
  const { start, end } = getWeekWindow();
  const { data, error: loadError } = await adminClient
    .from("questions_of_the_week")
    .select("id, discussion_id, week_start, week_end, category, why_now, source_context, published_at, discussions(id, title, topic, body, discussion_status, deleted_at, audience_type)")
    .order("week_start", { ascending: false })
    .limit(12);
  if (loadError) return jsonError(loadError.message, 500);
  return NextResponse.json({ currentAdminId: access.user.id, week: { start, end }, questions: data ?? [], model: MODEL }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const { access, adminClient, error } = await requireAdmin(request);
  if (error || !access || !adminClient) return error;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const { start, end } = getWeekWindow();

  if (action === "generate") {
    try {
      const candidate = await generateCandidate(start, end);
      await logAuditEvent({ actor_id: access.user.id, action: "question_of_the_week.candidate_generated", target_type: "question_of_the_week", metadata: { week_start: start, model: MODEL, source_count: candidate.sources.length } });
      return NextResponse.json({ candidate, week: { start, end }, model: MODEL }, { headers: { "Cache-Control": "private, no-store" } });
    } catch (generationError) {
      return jsonError(generationError instanceof Error ? generationError.message : "Unable to generate a candidate.", 502);
    }
  }

  if (action === "publish_candidate") {
    let candidate: WeeklyQuestionCandidate;
    try { candidate = validateCandidate(body?.candidate); } catch (candidateError) { return jsonError(candidateError instanceof Error ? candidateError.message : "Invalid candidate.", 400); }
    try {
      const authorId = await verifyPublisher(adminClient);
      const now = new Date().toISOString();
      const { data: discussion, error: discussionError } = await adminClient.from("discussions").insert({
        user_id: authorId,
        title: candidate.title,
        topic: candidate.topic,
        body: buildDiscussionBody(candidate),
        discussion_status: "open",
        discussion_type: "research_question",
        discussion_metadata: { editorial_feature: "question_of_the_week", generated_by: "loombus_editorial_ai", reviewed_by: access.user.id, model: MODEL, week_start: start, week_end: end },
        audience_type: "public",
        created_at: now,
        updated_at: now,
      }).select("id").single();
      if (discussionError || !discussion) throw new Error(discussionError?.message || "Unable to create the weekly discussion.");
      try {
        const question = await setWeeklyMetadata(adminClient, { discussionId: discussion.id, candidate, start, end, actorId: access.user.id, replacement: true });
        const tags = ["Question of the Week", candidate.topic].filter((tag, index, values) => values.indexOf(tag) === index && tag.length <= 40);
        if (tags.length) await adminClient.from("discussion_tags").insert(tags.map((tag) => ({ discussion_id: discussion.id, tag, created_by: authorId })));
        return NextResponse.json({ ok: true, question, discussionId: discussion.id }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (metadataError) {
        await adminClient.from("discussions").delete().eq("id", discussion.id);
        throw metadataError;
      }
    } catch (publishError) {
      return jsonError(publishError instanceof Error ? publishError.message : "Unable to publish the candidate.", 500);
    }
  }

  if (action === "select_existing") {
    const discussionId = clamp(body?.discussionId, 64);
    if (!/^[0-9a-f-]{36}$/i.test(discussionId)) return jsonError("A valid discussion id is required.", 400);
    const { data: discussion, error: discussionError } = await adminClient.from("discussions").select("id, title, topic, body, deleted_at, audience_type").eq("id", discussionId).maybeSingle();
    if (discussionError) return jsonError(discussionError.message, 500);
    if (!discussion || discussion.deleted_at) return jsonError("Discussion not found.", 404);
    if (discussion.audience_type !== "public") return jsonError("Question of the Week must point to a public discussion.", 400);
    const topic = isDiscussionTopic(String(discussion.topic)) ? discussion.topic as DiscussionTopic : "General";
    const whyNow = clamp(body?.whyNow, 700);
    if (whyNow.length < 40) return jsonError("Add a concise Why this question now explanation of at least 40 characters.", 400);
    const candidate: WeeklyQuestionCandidate = {
      title: String(discussion.title),
      topic,
      whyNow,
      context: clamp(discussion.body, 3500).padEnd(120, " ").trim(),
      discussionPrompt: "Examine the evidence, tradeoffs, uncertainties, and competing interpretations raised by this question.",
      sources: [],
    };
    const now = new Date().toISOString();
    const { data: existing, error: existingError } = await adminClient.from("questions_of_the_week").select("id, discussion_id").eq("week_start", start).maybeSingle();
    if (existingError) return jsonError(existingError.message, 500);
    const payload = { discussion_id: discussionId, week_end: end, category: topic, why_now: whyNow, source_context: { generated_at: now, selection_method: "admin_existing_discussion", sources: [] }, published_at: now, updated_at: now };
    const result = existing
      ? await adminClient.from("questions_of_the_week").update(payload).eq("id", existing.id).select("id, discussion_id, week_start, week_end, category, published_at").single()
      : await adminClient.from("questions_of_the_week").insert({ ...payload, week_start: start }).select("id, discussion_id, week_start, week_end, category, published_at").single();
    if (result.error) return jsonError(result.error.message, 500);
    await logAuditEvent({ actor_id: access.user.id, action: existing ? "question_of_the_week.manual_replace" : "question_of_the_week.manual_select", target_type: "discussion", target_id: discussionId, metadata: { week_start: start, previous_discussion_id: existing?.discussion_id ?? null } });
    return NextResponse.json({ ok: true, question: result.data }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return jsonError("Unsupported Question of the Week admin action.", 400);
}
