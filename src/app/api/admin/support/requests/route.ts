import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

type AdminProfileRow = {
  is_admin: boolean | null;
};

const SUPPORT_STATUSES = new Set(["new", "reviewing", "resolved", "closed"]);

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

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
    .maybeSingle<AdminProfileRow>();

  if (profileError || !profile?.is_admin) {
    return { user: null, error: jsonError("Admin access required.", 403) };
  }

  return { user, error: null };
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
  const requestId = body?.requestId;
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim().slice(0, 2000) : "";

  if (!isValidUuid(requestId)) {
    return jsonError("Invalid support request id.", 400);
  }

  if (!SUPPORT_STATUSES.has(status)) {
    return jsonError("Invalid support request status.", 400);
  }

  const { data, error } = await supabase
    .from("support_requests")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: user.id,
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to update support request.", 400);
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "support_request.updated",
    target_type: "support_request",
    target_id: requestId,
    metadata: {
      status,
      has_admin_note: Boolean(adminNote),
    },
  });

  return NextResponse.json({ request: data });
}
