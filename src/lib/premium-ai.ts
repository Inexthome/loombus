import { createHash } from "crypto";

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
  supabase,
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
  supabase: any;
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
  const { error } = await supabase.from("ai_usage_events").insert({
    user_id: userId,
    feature_key: featureKey,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    provider: provider ?? null,
    model_name: modelName ?? null,
    cached: cached ?? false,
    success: success ?? true,
    error_message: errorMessage ?? null,
  });

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
