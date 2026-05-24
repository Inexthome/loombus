import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

type ProfileRow = {
  id: string;
  is_admin: boolean | null;
  account_status: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

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

async function wouldRemoveOnlyAdmin(
  supabase: ReturnType<typeof getSupabaseForRequest>,
  userId: string
) {
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("is_admin", true)
    .neq("id", userId);

  return (count ?? 0) === 0;
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);
  const confirmation =
    body && typeof body === "object" && !Array.isArray(body)
      ? String((body as Record<string, unknown>).confirmation ?? "").trim()
      : "";

  if (confirmation !== "DEACTIVATE") {
    return jsonError("Type DEACTIVATE to confirm account deactivation.", 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_admin, account_status")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) {
    return jsonError("Profile not found.", 404);
  }

  if (profile.is_admin && (await wouldRemoveOnlyAdmin(supabase, user.id))) {
    return jsonError("You cannot deactivate the only admin account.", 403);
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      account_status: "deactivated",
      enforcement_reason: "Self-deactivated account",
      enforcement_note: null,
      enforced_by: user.id,
      enforced_at: now,
      suspended_until: null,
    })
    .eq("id", user.id);

  if (error) {
    return jsonError(error.message || "Unable to deactivate account.", 400);
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "account.deactivated",
    target_type: "profile",
    target_id: user.id,
    metadata: {
      previous_status: profile.account_status,
      account_status: "deactivated",
      self_service: true,
    },
  });

  return NextResponse.json({
    ok: true,
    accountStatus: "deactivated",
  });
}
