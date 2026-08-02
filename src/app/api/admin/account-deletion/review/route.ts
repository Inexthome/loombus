import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function requestClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment configuration.");
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = requestClient(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return jsonError("Unauthorized.", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean | null }>();
  if (!profile?.is_admin) return jsonError("Admin access required.", 403);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid review payload.", 400);
  }
  const source = body as Record<string, unknown>;
  const action = cleanText(source.action, 32);
  const requestId = cleanText(source.requestId, 100);
  if (!requestId) return jsonError("Deletion request ID is required.", 400);

  if (action === "resolve") {
    const resourceKey = cleanText(source.resourceKey, 160);
    const resolution = cleanText(source.resolution, 32);
    const note = cleanText(source.note, 4000);
    const evidence = source.evidence;
    const irreversible = source.irreversible === true;
    if (!resourceKey || !["completed", "not_applicable"].includes(resolution)) {
      return jsonError("A valid resource and resolution are required.", 400);
    }
    if (
      note.length < 10 ||
      !evidence ||
      typeof evidence !== "object" ||
      Array.isArray(evidence)
    ) {
      return jsonError("A review note and structured evidence are required.", 400);
    }

    const { data, error } = await supabase.rpc(
      "review_account_deletion_disposition",
      {
        p_request_id: requestId,
        p_resource_key: resourceKey,
        p_resolution: resolution,
        p_note: note,
        p_evidence: evidence,
        p_irreversible: irreversible,
      }
    );
    if (error) return jsonError(error.message || "Unable to record review.", 400);

    await logAuditEvent({
      actor_id: user.id,
      action: "account.deletion_disposition_reviewed",
      target_type: "account_deletion_request",
      target_id: requestId,
      metadata: { resource_key: resourceKey, resolution, irreversible },
    });
    return NextResponse.json({
      ok: true,
      result: Array.isArray(data) ? data[0] : data,
    });
  }

  if (action === "requeue") {
    const reason = cleanText(source.reason, 2000);
    if (reason.length < 10) return jsonError("A requeue reason is required.", 400);
    const { data, error } = await supabase.rpc("requeue_account_deletion_request", {
      p_request_id: requestId,
      p_reason: reason,
    });
    if (error) return jsonError(error.message || "Unable to requeue request.", 400);

    await logAuditEvent({
      actor_id: user.id,
      action: "account.deletion_requeued",
      target_type: "account_deletion_request",
      target_id: requestId,
      metadata: { reason },
    });
    return NextResponse.json({
      ok: true,
      result: Array.isArray(data) ? data[0] : data,
    });
  }

  return jsonError("Unsupported review action.", 400);
}
