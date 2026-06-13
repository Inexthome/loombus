import {
  getSubscriptionDisplayKey,
  type AiEntitlementLike,
} from "@/lib/subscription-plans";

export const FREE_MONTHLY_PASTE_CHARACTER_LIMIT = 2500;

export type PasteLimitResult =
  | {
      allowed: true;
      limit: number | null;
      used: number;
      remaining: number | null;
    }
  | {
      allowed: false;
      limit: number;
      used: number;
      remaining: number;
      error: string;
      code: "paste_limit_reached";
    };

export function getMonthlyPasteCharacterLimit(
  entitlement: AiEntitlementLike,
  isAdmin: boolean
) {
  if (isAdmin) {
    return null;
  }

  const planKey = getSubscriptionDisplayKey(entitlement);

  if (planKey === "premium" || planKey === "premium_plus" || planKey === "admin") {
    return null;
  }

  return FREE_MONTHLY_PASTE_CHARACTER_LIMIT;
}

export function normalizePastedCharacterCount(value: unknown) {
  const count = Number(value ?? 0);

  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }

  return Math.min(Math.floor(count), 100000);
}

export async function checkAndRecordPasteUsage({
  supabase,
  userId,
  entitlement,
  isAdmin,
  featureKey,
  pastedCharacterCount,
}: {
  supabase: any;
  userId: string;
  entitlement: AiEntitlementLike;
  isAdmin: boolean;
  featureKey: "discussion_body_paste" | "reply_body_paste";
  pastedCharacterCount: number;
}): Promise<PasteLimitResult> {
  const normalizedCount = normalizePastedCharacterCount(pastedCharacterCount);
  const limit = getMonthlyPasteCharacterLimit(entitlement, isAdmin);

  if (normalizedCount <= 0) {
    return {
      allowed: true,
      limit,
      used: 0,
      remaining: limit,
    };
  }

  if (limit === null) {
    await supabase.from("paste_usage_events").insert({
      user_id: userId,
      feature_key: featureKey,
      character_count: normalizedCount,
    });

    return {
      allowed: true,
      limit: null,
      used: normalizedCount,
      remaining: null,
    };
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );

  const { data, error } = await supabase
    .from("paste_usage_events")
    .select("character_count")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());

  if (error) {
    console.error("Paste usage lookup failed:", error.message);

    return {
      allowed: true,
      limit,
      used: 0,
      remaining: limit,
    };
  }

  const used = (data ?? []).reduce(
    (total: number, row: { character_count: number | null }) =>
      total + (row.character_count ?? 0),
    0
  );

  if (used + normalizedCount > limit) {
    return {
      allowed: false,
      limit,
      used,
      remaining: Math.max(0, limit - used),
      error:
        "You’ve reached this month’s paste limit for free accounts. Loombus is built for original, high-signal conversation. Upgrade to Premium for unlimited pasting.",
      code: "paste_limit_reached",
    };
  }

  const { error: insertError } = await supabase
    .from("paste_usage_events")
    .insert({
      user_id: userId,
      feature_key: featureKey,
      character_count: normalizedCount,
    });

  if (insertError) {
    console.error("Paste usage insert failed:", insertError.message);
  }

  return {
    allowed: true,
    limit,
    used: used + normalizedCount,
    remaining: Math.max(0, limit - used - normalizedCount),
  };
}
