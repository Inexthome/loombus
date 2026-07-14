import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type AiEntitlementRow = {
  user_id: string;
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
  monthly_writing_limit: number;
  monthly_research_limit: number;
  monthly_discovery_limit: number;
  notes: string | null;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type EntitlementUpdates = Partial<
  Pick<
    AiEntitlementRow,
    | "tier"
    | "ai_assisted_enabled"
    | "monthly_summary_limit"
    | "monthly_writing_limit"
    | "monthly_research_limit"
    | "monthly_discovery_limit"
    | "notes"
  >
>;

const ENTITLEMENT_SELECT =
  "user_id, tier, ai_assisted_enabled, monthly_summary_limit, monthly_writing_limit, monthly_research_limit, monthly_discovery_limit, notes, updated_at";
const PROFILE_SELECT =
  "id, username, full_name, avatar_url, is_admin, account_status, enforcement_reason, suspended_until";

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Admin Supabase configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function cleanEntitlementUpdates(value: unknown): EntitlementUpdates | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const updates: EntitlementUpdates = {};

  if ("tier" in source) {
    if (
      source.tier !== "free" &&
      source.tier !== "premium" &&
      source.tier !== "admin"
    ) {
      return null;
    }

    updates.tier = source.tier;
  }

  if ("ai_assisted_enabled" in source) {
    if (typeof source.ai_assisted_enabled !== "boolean") {
      return null;
    }

    updates.ai_assisted_enabled = source.ai_assisted_enabled;
  }

  const numericFields = [
    "monthly_summary_limit",
    "monthly_writing_limit",
    "monthly_research_limit",
    "monthly_discovery_limit",
  ] as const;

  for (const field of numericFields) {
    if (!(field in source)) continue;

    const fieldValue = source[field];

    if (
      typeof fieldValue !== "number" ||
      !Number.isInteger(fieldValue) ||
      fieldValue < 0 ||
      fieldValue > 999999
    ) {
      return null;
    }

    updates[field] = fieldValue;
  }

  if ("notes" in source) {
    if (source.notes !== null && typeof source.notes !== "string") {
      return null;
    }

    const cleanNotes =
      typeof source.notes === "string" ? source.notes.trim() : null;

    if (cleanNotes && cleanNotes.length > 2000) {
      return null;
    }

    updates.notes = cleanNotes || null;
  }

  return updates;
}

async function authorizeAdmin(request: NextRequest) {
  let supabase;
  let adminSupabase;

  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return {
      ok: false as const,
      error: jsonError("Server configuration error.", 500),
    };
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return {
      ok: false as const,
      error: jsonError(
        accountAccess.error,
        accountAccess.status,
        accountAccess.code
      ),
    };
  }

  if (!accountAccess.profile.is_admin) {
    return {
      ok: false as const,
      error: jsonError("Admin access required.", 403),
    };
  }

  return {
    ok: true as const,
    user: accountAccess.user,
    adminSupabase,
  };
}

export async function PATCH(request: NextRequest) {
  const authorization = await authorizeAdmin(request);

  if (!authorization.ok) return authorization.error;

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const updates = cleanEntitlementUpdates(body?.updates);

  if (!isValidUuid(userId)) {
    return jsonError("Invalid user id.", 400);
  }

  if (!updates || Object.keys(updates).length === 0) {
    return jsonError("No valid entitlement updates provided.", 400);
  }

  const existingResult = await authorization.adminSupabase
    .from("user_ai_entitlements")
    .select(ENTITLEMENT_SELECT)
    .eq("user_id", userId)
    .maybeSingle<AiEntitlementRow>();

  if (existingResult.error) {
    return jsonError(
      existingResult.error.message || "Unable to load AI access.",
      400
    );
  }

  if (!existingResult.data) {
    return jsonError("AI entitlement not found.", 404);
  }

  const updatedAt = new Date().toISOString();
  const updateResult = await authorization.adminSupabase
    .from("user_ai_entitlements")
    .update({
      ...updates,
      updated_at: updatedAt,
    })
    .eq("user_id", userId)
    .select(ENTITLEMENT_SELECT)
    .single<AiEntitlementRow>();

  if (updateResult.error) {
    return jsonError(
      updateResult.error.message || "Unable to update AI access.",
      400
    );
  }

  await logAuditEvent({
    actor_id: authorization.user.id,
    action: "ai_entitlement.updated",
    target_type: "user_ai_entitlement",
    target_id: userId,
    metadata: {
      updated_fields: Object.keys(updates),
      previous_tier: existingResult.data.tier,
      tier: updateResult.data.tier,
      previous_ai_assisted_enabled:
        existingResult.data.ai_assisted_enabled,
      ai_assisted_enabled: updateResult.data.ai_assisted_enabled,
    },
  });

  return NextResponse.json(
    { entitlement: updateResult.data },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeAdmin(request);

  if (!authorization.ok) return authorization.error;

  const body = await request.json().catch(() => null);
  const cleanUsername =
    typeof body?.username === "string"
      ? body.username.replace(/^@+/, "").trim().toLowerCase()
      : "";

  if (!cleanUsername) {
    return jsonError("Enter a username to grant Premium AI access.", 400);
  }

  if (!/^[a-z0-9_.-]{2,40}$/.test(cleanUsername)) {
    return jsonError("Invalid username.", 400);
  }

  const profileResult = await authorization.adminSupabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("username", cleanUsername)
    .maybeSingle<ProfileRow>();

  if (profileResult.error) {
    return jsonError(
      profileResult.error.message || "Unable to find user.",
      400
    );
  }

  if (!profileResult.data) {
    return jsonError(`No Loombus profile found for @${cleanUsername}.`, 404);
  }

  const updatedAt = new Date().toISOString();
  const entitlementResult = await authorization.adminSupabase
    .from("user_ai_entitlements")
    .upsert(
      {
        user_id: profileResult.data.id,
        tier: "premium",
        ai_assisted_enabled: true,
        monthly_summary_limit: 50,
        monthly_writing_limit: 25,
        monthly_research_limit: 10,
        monthly_discovery_limit: 25,
        notes: `Premium AI-Assisted Layer granted by admin for @${cleanUsername}.`,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" }
    )
    .select(ENTITLEMENT_SELECT)
    .single<AiEntitlementRow>();

  if (entitlementResult.error) {
    return jsonError(
      entitlementResult.error.message || "Unable to grant Premium AI access.",
      400
    );
  }

  await logAuditEvent({
    actor_id: authorization.user.id,
    action: "ai_entitlement.granted",
    target_type: "user_ai_entitlement",
    target_id: profileResult.data.id,
    metadata: {
      username: profileResult.data.username ?? cleanUsername,
      tier: entitlementResult.data.tier,
      ai_assisted_enabled: entitlementResult.data.ai_assisted_enabled,
    },
  });

  return NextResponse.json(
    {
      entitlement: entitlementResult.data,
      profile: profileResult.data,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
