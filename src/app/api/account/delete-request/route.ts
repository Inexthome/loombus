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

  const { data: requestRows, error: requestError } = await supabase.rpc(
    "request_account_deletion",
    { p_reason: reason || null }
  );

  if (requestError) {
    if (requestError.code === "23505") {
      return jsonError("You already have an open account deletion request.", 409);
    }

    return jsonError(requestError.message || "Unable to request account deletion.", 400);
  }

  const requestRow = Array.isArray(requestRows) ? requestRows[0] : requestRows;
  if (!requestRow?.request_id || !requestRow?.requested_at) {
    return jsonError("Unable to create account deletion request.", 500);
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "account.deletion_requested",
    target_type: "profile",
    target_id: user.id,
    metadata: {
      previous_status: requestRow.previous_account_status ?? profile.account_status,
      account_status: "deletion_requested",
      deletion_request_id: requestRow.request_id,
      has_reason: Boolean(reason),
      self_service: true,
    },
  });

  return NextResponse.json({
    ok: true,
    accountStatus: "deletion_requested",
    deletionRequestId: requestRow.request_id,
    requestedAt: requestRow.requested_at,
  });
}
