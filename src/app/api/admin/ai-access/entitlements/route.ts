import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

type AdminProfileRow = {
  is_admin: boolean | null;
};

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

const ENTITLEMENT_SELECT = `
  user_id,
  tier,
  ai_assisted_enabled,
  monthly_summary_limit,
  monthly_writing_limit,
  monthly_research_limit,
  monthly_discovery_limit,
  notes,
  updated_at
`;

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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function requireAdmin(supabase: ReturnType<typeof getSupabaseForRequest>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<AdminProfileRow>();

  if (profileError || !profile?.is_admin) {
    return { user: null, error: jsonError("Admin access required.", 403) };
  }

  return { user, error: null };
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
    if (!(field in source)) {
      continue;
    }

    const valueForField = source[field];

    if (
      typeof valueForField !== "number" ||
      !Number.isInteger(valueForField) ||
      valueForField < 0 ||
      valueForField > 999999
    ) {
      return null;
    }

    updates[field] = valueForField;
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

export async function PATCH(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { user, error: adminError } = await requireAdmin(supabase);

  if (adminError || !user) {
    return adminError;
  }

  const body = await request.json().catch(() => null);
  const userId = body?.userId;
  const updates = cleanEntitlementUpdates(body?.updates);

  if (!isValidUuid(userId)) {
    return jsonError("Invalid user id.", 400);
  }

  if (!updates || Object.keys(updates).length === 0) {
    return jsonError("No valid entitlement updates provided.", 400);
  }

  const updatedAt = new Date().toISOString();

  const { data: entitlement, error } = await supabase
    .from("user_ai_entitlements")
    .update({
      ...updates,
      updated_at: updatedAt,
    })
    .eq("user_id", userId)
    .select(ENTITLEMENT_SELECT)
    .single<AiEntitlementRow>();

  if (error) {
    return jsonError(error.message || "Unable to update AI access.", 400);
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "ai_entitlement.updated",
    target_type: "user_ai_entitlement",
    target_id: userId,
    metadata: {
      updated_fields: Object.keys(updates),
      tier: entitlement.tier,
      ai_assisted_enabled: entitlement.ai_assisted_enabled,
    },
  });

  return NextResponse.json({ entitlement });
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { user, error: adminError } = await requireAdmin(supabase);

  if (adminError || !user) {
    return adminError;
  }

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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("username", cleanUsername)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return jsonError(profileError.message || "Unable to find user.", 400);
  }

  if (!profile) {
    return jsonError(`No Loombus profile found for @${cleanUsername}.`, 404);
  }

  const updatedAt = new Date().toISOString();

  const { data: entitlement, error: entitlementError } = await supabase
    .from("user_ai_entitlements")
    .upsert(
      {
        user_id: profile.id,
        tier: "premium",
        ai_assisted_enabled: true,
        monthly_summary_limit: 50,
        monthly_writing_limit: 25,
        monthly_research_limit: 10,
        monthly_discovery_limit: 25,
        notes: `Premium AI-Assisted Layer granted by admin for @${cleanUsername}.`,
        updated_at: updatedAt,
      },
      {
        onConflict: "user_id",
      }
    )
    .select(ENTITLEMENT_SELECT)
    .single<AiEntitlementRow>();

  if (entitlementError) {
    return jsonError(
      entitlementError.message || "Unable to grant Premium AI access.",
      400
    );
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "ai_entitlement.granted",
    target_type: "user_ai_entitlement",
    target_id: profile.id,
    metadata: {
      username: profile.username ?? cleanUsername,
      tier: entitlement.tier,
      ai_assisted_enabled: entitlement.ai_assisted_enabled,
    },
  });

  return NextResponse.json({ entitlement, profile });
}
