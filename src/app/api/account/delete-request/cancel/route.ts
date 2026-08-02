import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

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
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
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
  if (userError || !user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid cancellation payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const confirmation = String(source.confirmation ?? "").trim();
  const reason = String(source.reason ?? "").trim().slice(0, 2000);
  if (confirmation !== "CANCEL DELETION") {
    return jsonError("Type CANCEL DELETION to cancel this request.", 400);
  }
  if (!reason) return jsonError("A cancellation reason is required.", 400);

  const { data: openRequest, error: lookupError } = await supabase
    .from("account_deletion_requests")
    .select("id, status")
    .eq("user_id", user.id)
    .in("status", ["requested", "reviewing", "blocked", "failed"])
    .maybeSingle();

  if (lookupError) return jsonError("Unable to verify the deletion request.", 400);
  if (!openRequest) return jsonError("No cancellable deletion request was found.", 404);

  const { data: resultRows, error: cancelError } = await supabase.rpc(
    "cancel_account_deletion_request",
    { p_request_id: openRequest.id, p_reason: reason }
  );
  if (cancelError) {
    return jsonError(cancelError.message || "Unable to cancel the deletion request.", 400);
  }

  const result = Array.isArray(resultRows) ? resultRows[0] : resultRows;
  if (!result?.request_id) return jsonError("Unable to confirm cancellation.", 500);

  await logAuditEvent({
    actor_id: user.id,
    action: "account.deletion_cancelled",
    target_type: "profile",
    target_id: user.id,
    metadata: {
      deletion_request_id: result.request_id,
      previous_request_status: openRequest.status,
      account_status: result.account_status,
      self_service: true,
    },
  });

  return NextResponse.json({
    ok: true,
    deletionRequestId: result.request_id,
    cancelledAt: result.cancelled_at,
    accountStatus: result.account_status,
  });
}
