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

const EMPTY_USAGE_METADATA: AiUsageMetadata = {
  promptTokens: null,
  completionTokens: null,
  totalTokens: null,
  estimatedCostUsd: null,
};

/**
 * Compatibility shim while Issue #669 removes the remaining historical
 * Anthropic fallback references. Anthropic is intentionally disabled as a
 * Loombus production provider, so this function must never make a network
 * request even if an old ANTHROPIC_API_KEY remains configured temporarily.
 */
export async function generateAnthropicText(
  _options: GenerateAnthropicTextOptions
): Promise<{ text: string; usageMetadata: AiUsageMetadata }> {
  void EMPTY_USAGE_METADATA;
  throw new Error("Anthropic is disabled as a Loombus AI provider.");
}
