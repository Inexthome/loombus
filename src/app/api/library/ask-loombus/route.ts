import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  consumeExtraAiCredit,
  getAiAccess,
  getAiProviderErrorResponse,
  getMonthlyAiFeatureUsageCount,
  getOpenAiUsageMetadata,
  logAiUsage,
} from "@/lib/premium-ai";

const FEATURE_KEY = "ask_loombus";
const MIN_PASSAGE_CHARS = 20;
const MAX_PASSAGE_CHARS = 1200;
const MAX_QUESTION_CHARS = 600;
const MAX_NEARBY_CONTEXT_CHARS = 7000;

const MODES = ["explain", "key_claims", "counterarguments", "evidence_questions", "study_help"] as const;
type AskMode = (typeof MODES)[number];

type PassageInput = {
  publicationId?: unknown;
  locator?: unknown;
  selectedText?: unknown;
  startOffset?: unknown;
  endOffset?: unknown;
  textSha256?: unknown;
};

const MODE_INSTRUCTIONS: Record<AskMode, string> = {
  explain: "Explain the selected passage clearly. Separate what the passage directly says from any interpretation you add.",
  key_claims: "Identify the key claims in the selected passage. For each claim, state whether it is explicit in the passage or an inference.",
  counterarguments: "Develop the strongest reasonable counterarguments to the selected passage. Clearly label them as counterarguments rather than claims made by the source.",
  evidence_questions: "Identify the evidence the selected passage relies on or would need. Give concrete questions a careful reader should ask before accepting its claims.",
  study_help: "Turn the selected passage into concise study help: core idea, important terms, what to remember, and 3 self-check questions. Do not invent facts absent from the supplied text.",
};

function sha256Text(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function isAskMode(value: unknown): value is AskMode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

function nearbyContext(text: string, startOffset: number, endOffset: number) {
  const available = Math.max(0, MAX_NEARBY_CONTEXT_CHARS - (endOffset - startOffset));
  const beforeBudget = Math.floor(available / 2);
  const afterBudget = available - beforeBudget;
  const start = Math.max(0, startOffset - beforeBudget);
  const end = Math.min(text.length, endOffset + afterBudget);
  return text.slice(start, end);
}

function extractResponseText(payload: any) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string" && part.text.trim()) {
        return part.text.trim();
      }
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  let modelName: string | null = null;
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const token = authHeader.slice("Bearer ".length);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userResult, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userResult.user) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }
    userId = userResult.user.id;

    const body = await request.json();
    const passage = (body.passage ?? {}) as PassageInput;
    const publicationId = asNonEmptyString(passage.publicationId);
    const locator = asNonEmptyString(passage.locator);
    const selectedText = asNonEmptyString(passage.selectedText);
    const textSha256 = asNonEmptyString(passage.textSha256);
    const startOffset = asInteger(passage.startOffset);
    const endOffset = asInteger(passage.endOffset);
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const mode = body.mode;

    if (!publicationId || !locator || !selectedText || !textSha256 || startOffset === null || endOffset === null) {
      return NextResponse.json({ error: "Passage context is incomplete." }, { status: 400 });
    }
    if (!isAskMode(mode)) {
      return NextResponse.json({ error: "Choose an Ask Loombus mode." }, { status: 400 });
    }
    if (question.length > MAX_QUESTION_CHARS) {
      return NextResponse.json({ error: `Your question is limited to ${MAX_QUESTION_CHARS} characters.` }, { status: 400 });
    }
    if (selectedText.length < MIN_PASSAGE_CHARS || selectedText.length > MAX_PASSAGE_CHARS) {
      return NextResponse.json({ error: `Select between ${MIN_PASSAGE_CHARS} and ${MAX_PASSAGE_CHARS} passage characters.` }, { status: 400 });
    }
    if (!/^[0-9a-f]{64}$/.test(textSha256) || startOffset < 0 || endOffset <= startOffset) {
      return NextResponse.json({ error: "Passage verification data is invalid." }, { status: 400 });
    }

    const access = await getAiAccess(supabase, userId);
    if (!access.allowed) {
      return NextResponse.json(
        { error: "Ask Loombus requires AI access on your Loombus plan.", code: "ai_access_required" },
        { status: 403 }
      );
    }

    const [publicationResult, sectionResult] = await Promise.all([
      supabase.from("library_publications").select("id, title, author_name, status").eq("id", publicationId).single(),
      supabase.from("library_publication_sections").select("section_key, title, content_text").eq("publication_id", publicationId).eq("section_key", locator).single(),
    ]);

    if (publicationResult.error || !publicationResult.data || publicationResult.data.status !== "published") {
      return NextResponse.json({ error: "This publication is not available for Ask Loombus." }, { status: 404 });
    }
    if (sectionResult.error || !sectionResult.data) {
      return NextResponse.json({ error: "This passage chapter is no longer available." }, { status: 409 });
    }

    const sectionText = sectionResult.data.content_text as string;
    const canonicalHash = sha256Text(sectionText);
    if (canonicalHash !== textSha256) {
      return NextResponse.json({ error: "The chapter changed after this passage was selected. Select it again before asking Loombus." }, { status: 409 });
    }
    if (endOffset > sectionText.length || sectionText.slice(startOffset, endOffset) !== selectedText) {
      return NextResponse.json({ error: "The selected passage no longer matches this chapter. Select it again before asking Loombus." }, { status: 409 });
    }

    const limit = access.isAdmin ? Number.MAX_SAFE_INTEGER : access.monthlyResearchLimit;
    const used = await getMonthlyAiFeatureUsageCount(supabase, userId, FEATURE_KEY);
    if (!access.isAdmin && used >= limit) {
      const consumed = await consumeExtraAiCredit({
        userId,
        featureKey: FEATURE_KEY,
        targetType: "library_publication",
        targetId: publicationId,
      });
      if (!consumed) {
        return NextResponse.json(
          { error: "You have reached your monthly Ask Loombus allowance.", code: "ai_limit_reached", limit, used },
          { status: 429 }
        );
      }
    }

    const apiKey = process.env.OPENAI_API_KEY;
    modelName = process.env.OPENAI_ASK_LOOMBUS_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.6";
    if (!apiKey) {
      return NextResponse.json({ error: "Ask Loombus AI is not configured." }, { status: 503 });
    }

    const publicationTitle = publicationResult.data.title as string;
    const authorName = publicationResult.data.author_name as string | null;
    const sectionTitle = (sectionResult.data.title as string | null) ?? "Current chapter";
    const localContext = nearbyContext(sectionText, startOffset, endOffset);
    const userPrompt = [
      `Publication: ${publicationTitle}`,
      authorName ? `Author: ${authorName}` : "",
      `Chapter: ${sectionTitle}`,
      "",
      "SELECTED PASSAGE (primary evidence):",
      selectedText,
      "",
      "NEARBY NORMALIZED CHAPTER CONTEXT (secondary context only):",
      localContext,
      question ? `\nREADER QUESTION:\n${question}` : "",
      "",
      `TASK:\n${MODE_INSTRUCTIONS[mode]}`,
    ].filter(Boolean).join("\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        store: false,
        max_output_tokens: 1000,
        instructions: [
          "You are Ask Loombus inside the Loombus Library Reader.",
          "Ground the answer only in the selected passage and nearby normalized chapter context supplied by Loombus.",
          "Do not browse the web and do not claim access to outside sources.",
          "Do not fabricate citations, quotations, facts, or author intent.",
          "If the supplied text does not support an answer, say that plainly.",
          "Clearly distinguish source-supported statements from interpretation, inference, counterargument, or study guidance.",
          "Be concise, analytical, and useful to a careful reader.",
        ].join(" "),
        input: userPrompt,
      }),
    });

    const payload = await openAiResponse.json().catch(() => ({}));
    if (!openAiResponse.ok) {
      const providerMessage = payload?.error?.message ?? `OpenAI request failed with status ${openAiResponse.status}`;
      await logAiUsage({ userId, featureKey: FEATURE_KEY, targetType: "library_publication", targetId: publicationId, provider: "openai", modelName, cached: false, success: false, errorMessage: providerMessage });
      const safeError = getAiProviderErrorResponse(providerMessage);
      return NextResponse.json({ error: safeError.error }, { status: safeError.status });
    }

    const answer = extractResponseText(payload);
    if (!answer) {
      await logAiUsage({ userId, featureKey: FEATURE_KEY, targetType: "library_publication", targetId: publicationId, provider: "openai", modelName, cached: false, success: false, errorMessage: "OpenAI returned no output text." });
      return NextResponse.json({ error: "Ask Loombus returned no answer. Please try again." }, { status: 502 });
    }

    const usage = getOpenAiUsageMetadata(payload, modelName);
    await logAiUsage({
      userId,
      featureKey: FEATURE_KEY,
      targetType: "library_publication",
      targetId: publicationId,
      provider: "openai",
      modelName,
      cached: false,
      success: true,
      ...usage,
    });

    return NextResponse.json({
      answer,
      mode,
      grounding: "selected_passage_and_nearby_chapter",
      source: { publicationId, locator, publicationTitle, sectionTitle },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (userId) {
      await logAiUsage({ userId, featureKey: FEATURE_KEY, targetType: "library_publication", provider: "openai", modelName: modelName ?? undefined, cached: false, success: false, errorMessage: message });
    }
    console.error("Library Ask Loombus failed:", error);
    return NextResponse.json({ error: "Ask Loombus is temporarily unavailable." }, { status: 500 });
  }
}
