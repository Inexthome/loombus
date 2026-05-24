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

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid deletion request payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const confirmation = String(source.confirmation ?? "").trim();
  const reason = cleanOptionalText(source.reason, 2000);

  if (confirmation !== "DELETE") {
    return jsonError("Type DELETE to request account deletion.", 400);
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
    return jsonError("You cannot request deletion for the only admin account.", 403);
  }

  const { data: existingRequest } = await supabase
    .from("account_deletion_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["requested", "reviewing"])
    .maybeSingle();

  if (existingRequest) {
    return jsonError("You already have an open account deletion request.", 409);
  }

  const { data: requestRow, error: requestError } = await supabase
    .from("account_deletion_requests")
    .insert({
      user_id: user.id,
      reason: reason || null,
      status: "requested",
    })
    .select("id, requested_at")
    .single();

  if (requestError) {
    if (requestError.code === "23505") {
      return jsonError("You already have an open account deletion request.", 409);
    }

    return jsonError(requestError.message || "Unable to request account deletion.", 400);
  }

  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      account_status: "deletion_requested",
      enforcement_reason: "Self-requested account deletion",
      enforcement_note: reason || null,
      enforced_by: user.id,
      enforced_at: now,
      suspended_until: null,
    })
    .eq("id", user.id);

  if (profileError) {
    return jsonError(profileError.message || "Unable to update account status.", 400);
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "account.deletion_requested",
    target_type: "profile",
    target_id: user.id,
    metadata: {
      previous_status: profile.account_status,
      account_status: "deletion_requested",
      deletion_request_id: requestRow.id,
      has_reason: Boolean(reason),
      self_service: true,
    },
  });

  return NextResponse.json({
    ok: true,
    accountStatus: "deletion_requested",
    deletionRequestId: requestRow.id,
    requestedAt: requestRow.requested_at,
  });
}
