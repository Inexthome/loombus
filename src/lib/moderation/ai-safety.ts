import { generateAnthropicText } from "@/lib/anthropic-ai";

export type AiSafetyAction = "allow" | "warn" | "block";

export type AiSafetyReview = {
  action: AiSafetyAction;
  category: string;
  message: string;
  provider: "openai" | "anthropic" | "none";
  modelName: string | null;
  unavailable?: boolean;
};

type ReviewContentSafetyOptions = {
  content: string;
  contentType: "discussion" | "reply";
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_SAFETY_MODEL =
  process.env.OPENAI_SAFETY_MODEL ||
  process.env.OPENAI_QUALITY_CHECK_MODEL ||
  process.env.OPENAI_SUMMARY_MODEL ||
  "gpt-4o-mini";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_FALLBACK_MODEL =
  process.env.ANTHROPIC_FALLBACK_MODEL || "claude-haiku-4-5-20251001";

const SAFETY_SYSTEM_PROMPT =
  "You are a strict but careful safety reviewer for Loombus, a public discussion platform focused on thoughtful discourse. Classify submitted user content before it is published. Return only valid JSON with keys: action, category, message. action must be allow, warn, or block. Use block only for high-confidence threats, intimidation, stalking, doxxing/private information abuse, sexual exploitation or abuse, non-consensual sexual content, child sexual content, severe targeted harassment, or direct hateful/dehumanizing abuse. Use warn for hostility, rage bait, broad shaming, abusive tone, or borderline personal attacks that should be revised. Use allow for normal disagreement, criticism of ideas, personal experience, non-abusive debate, or policy discussion. Do not over-block good-faith discussion.";

function buildSafetyPrompt({ content, contentType }: ReviewContentSafetyOptions) {
  return `Review this ${contentType} before it is published on Loombus.

Return JSON only:
{
  "action": "allow" | "warn" | "block",
  "category": "short category",
  "message": "short user-facing explanation"
}

Content:
${content}`;
}

function normalizeAction(value: unknown): AiSafetyAction {
  if (value === "block" || value === "warn" || value === "allow") {
    return value;
  }

  return "allow";
}

function parseSafetyJson(rawText: string): Omit<AiSafetyReview, "provider" | "modelName"> {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as {
    action?: unknown;
    category?: unknown;
    message?: unknown;
  };

  const action = normalizeAction(parsed.action);
  const category =
    typeof parsed.category === "string" && parsed.category.trim()
      ? parsed.category.trim().slice(0, 80)
      : action === "allow"
        ? "allowed"
        : "safety_review";

  const fallbackMessage =
    action === "block"
      ? "This content appears to violate Loombus safety rules. Please revise before posting."
      : action === "warn"
        ? "This content may violate Loombus discussion standards. Please revise before posting."
        : "Content passed safety review.";

  const message =
    typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message.trim().slice(0, 240)
      : fallbackMessage;

  return {
    action,
    category,
    message,
  };
}

async function reviewWithOpenAI(options: ReviewContentSafetyOptions): Promise<AiSafetyReview> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI safety review is not configured.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_SAFETY_MODEL,
      temperature: 0,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: SAFETY_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildSafetyPrompt(options),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI safety review failed.");
  }

  const rawText = payload?.choices?.[0]?.message?.content;

  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("OpenAI safety review returned no content.");
  }

  return {
    ...parseSafetyJson(rawText),
    provider: "openai",
    modelName: OPENAI_SAFETY_MODEL,
  };
}

async function reviewWithAnthropic(options: ReviewContentSafetyOptions): Promise<AiSafetyReview> {
  const result = await generateAnthropicText({
    apiKey: ANTHROPIC_API_KEY,
    modelName: ANTHROPIC_FALLBACK_MODEL,
    system: SAFETY_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildSafetyPrompt(options),
      },
    ],
    maxTokens: 180,
    temperature: 0,
  });

  return {
    ...parseSafetyJson(result.text),
    provider: "anthropic",
    modelName: ANTHROPIC_FALLBACK_MODEL,
  };
}

export async function reviewContentSafety(
  options: ReviewContentSafetyOptions
): Promise<AiSafetyReview> {
  try {
    return await reviewWithOpenAI(options);
  } catch (openAiError) {
    console.error("OpenAI safety review failed:", openAiError);
  }

  try {
    return await reviewWithAnthropic(options);
  } catch (anthropicError) {
    console.error("Anthropic safety review failed:", anthropicError);
  }

  return {
    action: "allow",
    category: "ai_safety_unavailable",
    message: "AI safety review was unavailable. Rule-based moderation still applied.",
    provider: "none",
    modelName: null,
    unavailable: true,
  };
}

export function getAiSafetyErrorPayload(review: AiSafetyReview) {
  return {
    error: review.message,
    code:
      review.action === "block"
        ? "content_safety_blocked"
        : "content_safety_warning",
    category: review.category,
    provider: review.provider,
  };
}
