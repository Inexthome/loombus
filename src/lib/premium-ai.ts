import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

export type PremiumAiAccess = {
  allowed: boolean;
  tier: string;
  isAdmin: boolean;
  monthlyThreadAiLimit: number;
  monthlySummaryLimit: number;
};

export type AiProviderErrorResponse = {
  status: number;
  error: string;
};

type ServiceRoleError = {
  message: string;
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

export function createContentHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function getAiProviderErrorResponse(message: string): AiProviderErrorResponse {
  const normalized = message.toLowerCase();

  if (normalized.includes("not configured")) {
    return {
      status: 503,
      error: "AI generation is not configured yet.",
    };
  }

  if (
    normalized.includes("quota") ||
    normalized.includes("billing") ||
    normalized.includes("insufficient_quota")
  ) {
    return {
      status: 503,
      error: "AI generation is temporarily unavailable because the AI provider quota or billing needs attention.",
    };
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return {
      status: 429,
      error: "AI generation is temporarily rate-limited. Please try again later.",
    };
  }

  if (
    normalized.includes("api key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid_api_key")
  ) {
    return {
      status: 503,
      error: "AI generation is temporarily unavailable because the AI provider credentials need attention.",
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
    };
  }

  const { data: entitlement } = await supabase
    .from("user_ai_entitlements")
    .select("tier, ai_assisted_enabled, monthly_summary_limit")
    .eq("user_id", userId)
    .maybeSingle();

  const allowed =
    Boolean(entitlement?.ai_assisted_enabled) &&
    ["premium", "admin"].includes(entitlement?.tier ?? "");

  const monthlyLimit = entitlement?.monthly_summary_limit ?? 0;

  return {
    allowed,
    tier: entitlement?.tier ?? "free",
    isAdmin: false,
    monthlyThreadAiLimit: monthlyLimit,
    monthlySummaryLimit: monthlyLimit,
  };
}

export function getCurrentMonthStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
