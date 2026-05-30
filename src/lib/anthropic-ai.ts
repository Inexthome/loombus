import type { AiUsageMetadata } from "@/lib/premium-ai";

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string;
};

type GenerateAnthropicTextOptions = {
  apiKey?: string;
  modelName: string;
  system: string;
  messages: AnthropicMessage[];
  maxTokens: number;
  temperature?: number;
};

function safeTokenCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

export function getAnthropicUsageMetadata(payload: any): AiUsageMetadata {
  const usage = payload?.usage;

  if (!usage || typeof usage !== "object") {
    return {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
    };
  }

  const promptTokens = safeTokenCount(usage.input_tokens);
  const completionTokens = safeTokenCount(usage.output_tokens);
  const totalTokens =
    promptTokens != null && completionTokens != null
      ? promptTokens + completionTokens
      : null;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: null,
  };
}

export async function generateAnthropicText({
  apiKey,
  modelName,
  system,
  messages,
  maxTokens,
  temperature = 0.2,
}: GenerateAnthropicTextOptions) {
  if (!apiKey) {
    throw new Error("Anthropic fallback is not configured yet.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      temperature,
      system,
      messages,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message || "Anthropic fallback generation failed.";
    throw new Error(message);
  }

  const text = (payload?.content ?? [])
    .filter((block: any) => block?.type === "text" && typeof block?.text === "string")
    .map((block: any) => block.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    throw new Error("Anthropic fallback returned no text.");
  }

  return {
    text,
    usageMetadata: getAnthropicUsageMetadata(payload),
  };
}
