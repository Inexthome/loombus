import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  consumeExtraAiCredit,
  createContentHash,
  getAiAccess,
  getAiProviderErrorResponse,
  getCurrentMonthStart,
  getExtraAiCreditBalance,
  getOpenAiUsageMetadata,
  logAiUsage,
  upsertDiscussionAiOutput,
} from "@/lib/premium-ai";

const FEATURE_KEY = "conversation_intelligence";
const MODEL = process.env.OPENAI_CONVERSATION_INTELLIGENCE_MODEL || process.env.OPENAI_SUMMARY_MODEL || "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

type Candidate = {
  reply_id: string;
  user_id: string;
  referenced_reply_id: string | null;
  body: string;
  created_at: string;
  direct_response_count: number | string;
  helpful_count: number | string;
  insightful_count: number | string;
  well_reasoned_count: number | string;
  changed_view_count: number | string;
  needs_evidence_count: number | string;
  signal_total: number | string;
  intelligence_score: number | string;
};

type IntelligenceItem = { replyId: string; title: string; note: string };
type IntelligencePayload = {
  summary: string;
  majorPoints: IntelligenceItem[];
  counterpoints: IntelligenceItem[];
  evidenceToVerify: IntelligenceItem[];
  changedViews: IntelligenceItem[];
  openQuestions: string[];
};

function clamp(text: string, max = 900) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function validatePayload(value: unknown, allowedIds: Set<string>): IntelligencePayload {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = (key: string) => Array.isArray(source[key])
    ? (source[key] as unknown[]).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const replyId = String(row.replyId ?? "");
        if (!allowedIds.has(replyId)) return [];
        return [{
          replyId,
          title: String(row.title ?? "").trim().slice(0, 140),
          note: String(row.note ?? "").trim().slice(0, 320),
        }];
      }).slice(0, 6)
    : [];
  return {
    summary: String(source.summary ?? "").trim().slice(0, 700),
    majorPoints: items("majorPoints"),
    counterpoints: items("counterpoints"),
    evidenceToVerify: items("evidenceToVerify"),
    changedViews: items("changedViews"),
    openQuestions: Array.isArray(source.openQuestions)
      ? source.openQuestions.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}

async function monthlyUsage(supabase: any, userId: string) {
  const { count } = await supabase
    .from("ai_usage_events")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", FEATURE_KEY)
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", getCurrentMonthStart());
  return count ?? 0;
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
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Invalid session." }, { status: 401 });

    const { discussionId } = await request.json();
    const id = String(discussionId ?? "").trim();
    if (!id) return NextResponse.json({ error: "Missing discussion id." }, { status: 400 });

    const access = await getAiAccess(supabase, user.id);
    if (!access.allowed) return NextResponse.json({ error: "Premium AI access is required.", code: "premium_required" }, { status: 403 });

    const [{ data: discussion }, { data: candidateData, error: candidateError }] = await Promise.all([
      supabase.from("discussions").select("id, title, topic, reality_lens, body").eq("id", id).is("deleted_at", null).single(),
      supabase.rpc("get_discussion_intelligence_candidates", { p_discussion_id: id, p_limit: 60 }),
    ]);
    if (!discussion) return NextResponse.json({ error: "Discussion not found." }, { status: 404 });
    if (candidateError) return NextResponse.json({ error: "Conversation intelligence is not available yet." }, { status: 503 });

    const candidates = (candidateData ?? []) as Candidate[];
    const sourceContent = JSON.stringify({
      discussion: { title: discussion.title, topic: discussion.topic, realityLens: discussion.reality_lens, body: clamp(discussion.body, 3000) },
      candidates: candidates.map((c) => ({ ...c, body: clamp(c.body) })),
    });
    const sourceHash = createContentHash(sourceContent);

    const { data: cached } = await supabase
      .from("discussion_ai_outputs")
      .select("output_text, source_content_hash, generated_at, source_reply_count")
      .eq("discussion_id", id)
      .eq("feature_key", FEATURE_KEY)
      .maybeSingle();
    if (cached?.source_content_hash === sourceHash) {
      await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: id, provider: "openai", modelName: MODEL, cached: true, success: true });
      return NextResponse.json({ intelligence: JSON.parse(cached.output_text), cached: true, generatedAt: cached.generated_at, candidateCount: candidates.length });
    }

    const used = access.isAdmin ? 0 : await monthlyUsage(supabase, user.id);
    const useExtra = !access.isAdmin && used >= access.monthlyThreadAiLimit;
    if (useExtra && (await getExtraAiCreditBalance(user.id)) <= 0) {
      return NextResponse.json({ error: "Monthly Premium AI limit reached.", code: "conversation_intelligence_limit_reached" }, { status: 429 });
    }
    if (!OPENAI_API_KEY) return NextResponse.json({ error: "AI conversation intelligence is not configured yet." }, { status: 503 });

    const allowedIds = new Set(candidates.map((c) => c.reply_id));
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.15,
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You analyze structured public discussions neutrally. Use only supplied material. Never invent evidence, consensus, participant intent, or reply IDs. A needs_evidence signal means members are asking for substantiation; it does not mean the reply itself contains evidence. Return valid JSON only.",
          },
          {
            role: "user",
            content: `Build conversation intelligence from the discussion and ranked candidate responses below. Return exactly this JSON shape: {"summary":"...","majorPoints":[{"replyId":"uuid","title":"...","note":"..."}],"counterpoints":[...],"evidenceToVerify":[...],"changedViews":[...],"openQuestions":["..."]}. Use only replyId values present in candidates. Major points should represent substantive branches/strong signal, counterpoints should identify genuine tensions when supported, evidenceToVerify should prioritize needs_evidence_count and sourcing gaps, changedViews should only use candidates with changed_view_count > 0, and openQuestions should be grounded unresolved questions. Keep each list to at most 6 items.\n\n${sourceContent}`,
          },
        ],
      }),
    });
    const providerPayload = await response.json();
    if (!response.ok) {
      const message = providerPayload?.error?.message || "Conversation intelligence generation failed.";
      const aiError = getAiProviderErrorResponse(message);
      return NextResponse.json({ error: aiError.error }, { status: aiError.status });
    }

    let parsed: unknown = {};
    try { parsed = JSON.parse(providerPayload?.choices?.[0]?.message?.content ?? "{}"); } catch { parsed = {}; }
    const intelligence = validatePayload(parsed, allowedIds);
    const generatedAt = new Date().toISOString();
    const usageMetadata = getOpenAiUsageMetadata(providerPayload, MODEL);

    await upsertDiscussionAiOutput({
      discussion_id: id,
      feature_key: FEATURE_KEY,
      output_text: JSON.stringify(intelligence),
      model_name: MODEL,
      source_reply_count: candidates.length,
      source_content_hash: sourceHash,
      generated_by: user.id,
      generated_at: generatedAt,
      updated_at: generatedAt,
    });
    await logAiUsage({ supabase, userId: user.id, featureKey: FEATURE_KEY, targetType: "discussion", targetId: id, provider: "openai", modelName: MODEL, cached: false, success: true, ...usageMetadata });
    if (useExtra) await consumeExtraAiCredit({ userId: user.id, featureKey: FEATURE_KEY });

    return NextResponse.json({ intelligence, cached: false, generatedAt, candidateCount: candidates.length });
  } catch (error) {
    console.error("Conversation intelligence route failed:", error);
    return NextResponse.json({ error: "Unable to generate conversation intelligence." }, { status: 500 });
  }
}
