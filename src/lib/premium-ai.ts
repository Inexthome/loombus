import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

export type PremiumAiAccess = {
  allowed: boolean;
  tier: string;
  isAdmin: boolean;
  monthlyThreadAiLimit: number;
  monthlySummaryLimit: number;
  monthlyWritingLimit: number;
  monthlyResearchLimit: number;
  monthlyDiscoveryLimit: number;
};

export type AiFeatureLimitBucket = "summary" | "writing" | "research" | "discovery";

export type AiFeatureLimitPolicy = {
  featureKey: string;
  bucket: AiFeatureLimitBucket;
  label: string;
};

export const AI_FEATURE_LIMIT_POLICIES: Record<string, AiFeatureLimitPolicy> = {
  thread_summary: {
    featureKey: "thread_summary",
    bucket: "summary",
    label: "Thread summaries",
  },
  key_takeaways: {
    featureKey: "key_takeaways",
    bucket: "summary",
    label: "Key takeaways",
  },
  what_changed: {
    featureKey: "what_changed",
    bucket: "summary",
    label: "What changed",
  },
  disagreement_map: {
    featureKey: "disagreement_map",
    bucket: "summary",
    label: "Disagreement maps",
  },
  conversation_map: {
    featureKey: "conversation_map",
    bucket: "summary",
    label: "Conversation maps",
  },
  discussion_quality_check: {
    featureKey: "discussion_quality_check",
    bucket: "writing",
    label: "Discussion quality checks",
  },
  discussion_clarity_rewrite: {
    featureKey: "discussion_clarity_rewrite",
    bucket: "writing",
    label: "Clarity rewrites",
  },
  research_summary: {
    featureKey: "research_summary",
    bucket: "research",
    label: "Research summaries",
  },
  discovery: {
    featureKey: "discovery",
    bucket: "discovery",
    label: "Discovery assist",
  },
  reply_suggestions: {
    featureKey: "reply_suggestions",
    bucket: "discovery",
    label: "Reply suggestions",
  },
};

export type AiProviderErrorResponse = {
  status: number;
  error: string;
};

export type AiUsageMetadata = {
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
};

type ServiceRoleError = {
  message: string;
};

type OpenAiTextPricing = {
  input: number;
  output: number;
};

const OPENAI_TEXT_PRICING_PER_MILLION: Record<string, OpenAiTextPricing> = {
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
  },
  "gpt-4o-mini-2024-07-18": {
    input: 0.15,
    output: 0.6,
  },
  "gpt-5.4-mini": {
    input: 0.75,
    output: 4.5,
  },
  "gpt-5.4": {
    input: 2.5,
    output: 15,
  },
  "gpt-5.5": {
    input: 5,
    output: 30,
  },
};

let premiumAiServiceClient: ReturnType<typeof createClient> | null = null;

function getPremiumAiServiceClient() {
  if (premiumAiServiceClient) {
    return premiumAiServiceClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  premiumAiServiceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return premiumAiServiceClient;
}

function serviceRoleMissingError(tableName: string): ServiceRoleError {
  return {
    message: `SUPABASE_SERVICE_ROLE_KEY is not configured for ${tableName} writes.`,
  };
}

function safeTokenCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.round(value);
}

function normalizeModelName(modelName: string | null | undefined) {
  return (modelName ?? "").trim().toLowerCase();
}

function getOpenAiTextPricing(modelName: string | null | undefined) {
  const normalized = normalizeModelName(modelName);

  if (!normalized) {
    return null;
  }

  if (OPENAI_TEXT_PRICING_PER_MILLION[normalized]) {
    return OPENAI_TEXT_PRICING_PER_MILLION[normalized];
  }

  const knownPrefix = Object.keys(OPENAI_TEXT_PRICING_PER_MILLION).find(
    (modelKey) => normalized.startsWith(`${modelKey}-`)
  );

  return knownPrefix ? OPENAI_TEXT_PRICING_PER_MILLION[knownPrefix] : null;
}

export function estimateOpenAiTextCostUsd({
  modelName,
  promptTokens,
  completionTokens,
}: {
  modelName: string | null | undefined;
  promptTokens: number | null | undefined;
  completionTokens: number | null | undefined;
}) {
  const pricing = getOpenAiTextPricing(modelName);

  if (!pricing || promptTokens == null || completionTokens == null) {
    return null;
  }

  const cost =
    (promptTokens / 1_000_000) * pricing.input +
    (completionTokens / 1_000_000) * pricing.output;

  return Number(cost.toFixed(8));
}

export function getOpenAiUsageMetadata(
  payload: any,
  modelName: string | null | undefined
): AiUsageMetadata {
  const usage = payload?.usage;

  if (!usage || typeof usage !== "object") {
    return {
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      estimatedCostUsd: null,
    };
  }

  const promptTokens = safeTokenCount(
    usage.prompt_tokens ?? usage.input_tokens
  );

  const completionTokens = safeTokenCount(
    usage.completion_tokens ?? usage.output_tokens
  );

  const totalTokens =
    safeTokenCount(usage.total_tokens) ??
    (promptTokens != null && completionTokens != null
      ? promptTokens + completionTokens
      : null);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd: estimateOpenAiTextCostUsd({
      modelName,
      promptTokens,
      completionTokens,
    }),
  };
}

type AiUsagePayload = {
  user_id: string;
  feature_key: string;
  target_type: string | null;
  target_id: string | null;
  provider: string | null;
  model_name: string | null;
  cached: boolean;
  success: boolean;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
};

export type DiscussionAiOutputPayload = {
  discussion_id: string;
  feature_key: string;
  output_text: string;
  model_name: string | null;
  source_reply_count: number;
  source_content_hash: string | null;
  generated_by: string | null;
  generated_at: string;
  updated_at: string;
};

export type DiscussionSummaryPayload = {
  discussion_id: string;
  summary: string;
  model_name: string | null;
  source_reply_count: number;
  source_content_hash: string | null;
  generated_by: string | null;
  generated_at: string;
  updated_at: string;
};

export async function upsertDiscussionAiOutput(
  payload: DiscussionAiOutputPayload
): Promise<{ error: ServiceRoleError | null }> {
  const supabase = getPremiumAiServiceClient();

  if (!supabase) {
    return { error: serviceRoleMissingError("discussion_ai_outputs") };
  }

  const { error } = await (supabase.from("discussion_ai_outputs") as any).upsert(
    payload,
    {
      onConflict: "discussion_id,feature_key",
    }
  );

  return { error };
}

export async function insertDiscussionSummary(
  payload: DiscussionSummaryPayload
): Promise<{ data: any | null; error: ServiceRoleError | null }> {
  const supabase = getPremiumAiServiceClient();

  if (!supabase) {
    return {
      data: null,
      error: serviceRoleMissingError("discussion_summaries"),
    };
  }

  const { data, error } = await (supabase.from("discussion_summaries") as any)
    .insert(payload)
    .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
    .single();

  return { data, error };
}


export async function upsertDiscussionSummary(
  payload: DiscussionSummaryPayload
): Promise<{ data: any | null; error: ServiceRoleError | null }> {
  const supabase = getPremiumAiServiceClient();

  if (!supabase) {
    return {
      data: null,
      error: serviceRoleMissingError("discussion_summaries"),
    };
  }

  const { data, error } = await (supabase.from("discussion_summaries") as any)
    .upsert(payload, {
      onConflict: "discussion_id",
    })
    .select("id, discussion_id, summary, model_name, source_reply_count, source_content_hash, generated_by, generated_at")
    .single();

  return { data, error };
}

export function createContentHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function getAiProviderErrorResponse(message: string): AiProviderErrorResponse {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return {
      status: 429,
      error: "AI is temporarily busy. Please try again later.",
    };
  }

  if (
    normalized.includes("not configured") ||
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota") ||
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid_api_key")
  ) {
    return {
      status: 503,
      error: "AI is temporarily unavailable. Please try again later.",
    };
  }

  return {
    status: 500,
    error: "AI generation failed. Please try again later.",
  };
}

export async function logAiUsage({
  userId,
  featureKey,
  targetType,
  targetId,
  provider,
  modelName,
  cached,
  success,
  errorMessage,
  promptTokens,
  completionTokens,
  totalTokens,
  estimatedCostUsd,
}: {
  supabase?: any;
  userId: string;
  featureKey: string;
  targetType?: string;
  targetId?: string;
  provider?: string;
  modelName?: string;
  cached?: boolean;
  success?: boolean;
  errorMessage?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
}) {
  const supabase = getPremiumAiServiceClient();

  if (!supabase) {
    console.error("AI usage logging skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return;
  }

  const payload: AiUsagePayload = {
    user_id: userId,
    feature_key: featureKey,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    provider: provider ?? null,
    model_name: modelName ?? null,
    cached: cached ?? false,
    success: success ?? true,
    error_message: errorMessage ?? null,
    prompt_tokens: promptTokens ?? null,
    completion_tokens: completionTokens ?? null,
    total_tokens: totalTokens ?? null,
    estimated_cost_usd: estimatedCostUsd ?? null,
  };

  const { error } = await (supabase.from("ai_usage_events") as any).insert(payload);

  if (error) {
    console.error("AI usage logging failed:", error.message);
  }
}

export async function getAiAccess(
  supabase: any,
  userId: string
): Promise<PremiumAiAccess> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .single();

  if (profile?.is_admin) {
    return {
      allowed: true,
      tier: "admin",
      isAdmin: true,
      monthlyThreadAiLimit: Number.MAX_SAFE_INTEGER,
      monthlySummaryLimit: Number.MAX_SAFE_INTEGER,
      monthlyWritingLimit: Number.MAX_SAFE_INTEGER,
      monthlyResearchLimit: Number.MAX_SAFE_INTEGER,
      monthlyDiscoveryLimit: Number.MAX_SAFE_INTEGER,
    };
  }

  const { data: entitlement } = await supabase
    .from("user_ai_entitlements")
    .select(`
      tier,
      ai_assisted_enabled,
      monthly_summary_limit,
      monthly_writing_limit,
      monthly_research_limit,
      monthly_discovery_limit
    `)
    .eq("user_id", userId)
    .maybeSingle();

  const allowed =
    Boolean(entitlement?.ai_assisted_enabled) &&
    ["premium", "admin"].includes(entitlement?.tier ?? "");

  const monthlySummaryLimit = entitlement?.monthly_summary_limit ?? 0;
  const monthlyWritingLimit = entitlement?.monthly_writing_limit ?? 0;
  const monthlyResearchLimit = entitlement?.monthly_research_limit ?? 0;
  const monthlyDiscoveryLimit = entitlement?.monthly_discovery_limit ?? 0;

  return {
    allowed,
    tier: entitlement?.tier ?? "free",
    isAdmin: false,
    monthlyThreadAiLimit: monthlySummaryLimit,
    monthlySummaryLimit,
    monthlyWritingLimit,
    monthlyResearchLimit,
    monthlyDiscoveryLimit,
  };
}

export function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function getAiFeatureLimitPolicy(featureKey: string): AiFeatureLimitPolicy {
  return (
    AI_FEATURE_LIMIT_POLICIES[featureKey] ?? {
      featureKey,
      bucket: "summary",
      label: featureKey
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
    }
  );
}

export function getAiFeatureLimit(access: PremiumAiAccess, featureKey: string) {
  if (access.isAdmin) {
    return Number.MAX_SAFE_INTEGER;
  }

  const policy = getAiFeatureLimitPolicy(featureKey);

  if (policy.bucket === "writing") {
    return access.monthlyWritingLimit;
  }

  if (policy.bucket === "research") {
    return access.monthlyResearchLimit;
  }

  if (policy.bucket === "discovery") {
    return access.monthlyDiscoveryLimit;
  }

  return access.monthlySummaryLimit;
}

export async function getMonthlyAiFeatureUsageCount(
  supabase: any,
  userId: string,
  featureKey: string
) {
  const monthStart = getCurrentMonthStart();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .eq("cached", false)
    .eq("success", true)
    .gte("created_at", monthStart);

  if (error) {
    console.error(`AI ${featureKey} usage count failed:`, error.message);
    return 0;
  }

  return count ?? 0;
}


export async function getExtraAiCreditBalance(userId: string) {
  const supabase = getPremiumAiServiceClient();

  if (!supabase) {
    console.error("Extra AI credit balance skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return 0;
  }

  const { data, error } = await (supabase.from("ai_extra_credit_packs") as any)
    .select("remaining_credits")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("remaining_credits", 0);

  if (error) {
    console.error("Extra AI credit balance lookup failed:", error.message);
    return 0;
  }

  return (data ?? []).reduce((total: number, pack: { remaining_credits?: number | null }) => {
    const remaining = pack.remaining_credits ?? 0;
    return total + (Number.isFinite(remaining) && remaining > 0 ? remaining : 0);
  }, 0);
}

export async function consumeExtraAiCredit({
  userId,
  featureKey,
  targetType,
  targetId,
}: {
  userId: string;
  featureKey: string;
  targetType?: string;
  targetId?: string;
}) {
  const supabase = getPremiumAiServiceClient();

  if (!supabase) {
    console.error("Extra AI credit consumption skipped: SUPABASE_SERVICE_ROLE_KEY is not configured.");
    return false;
  }

  const { data: pack, error: packError } = await (supabase.from("ai_extra_credit_packs") as any)
    .select("id, remaining_credits")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("remaining_credits", 0)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (packError) {
    console.error("Extra AI credit pack lookup failed:", packError.message);
    return false;
  }

  if (!pack?.id || !pack.remaining_credits || pack.remaining_credits <= 0) {
    return false;
  }

  const nextRemaining = Math.max(Number(pack.remaining_credits) - 1, 0);

  const { error: updateError } = await (supabase.from("ai_extra_credit_packs") as any)
    .update({
      remaining_credits: nextRemaining,
      status: nextRemaining === 0 ? "depleted" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", pack.id)
    .eq("user_id", userId)
    .gt("remaining_credits", 0);

  if (updateError) {
    console.error("Extra AI credit pack update failed:", updateError.message);
    return false;
  }

  const { error: ledgerError } = await (supabase.from("ai_extra_credit_ledger") as any)
    .insert({
      pack_id: pack.id,
      user_id: userId,
      feature_key: featureKey,
      target_type: targetType ?? null,
      target_id: targetId ?? null,
      credits_delta: -1,
      reason: "consume",
    });

  if (ledgerError) {
    console.error("Extra AI credit ledger consumption failed:", ledgerError.message);
    return false;
  }

  return true;
}

