import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

type AdminProfileRow = {
  is_admin: boolean | null;
};

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
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const adminNote =
    typeof body?.adminNote === "string" ? body.adminNote.trim() : "";

  if (!requestId) {
    return jsonError("Missing Labs request id.", 400);
  }

  if (!status || status.length > 40) {
    return jsonError("Invalid Labs request status.", 400);
  }

  if (adminNote.length > 2000) {
    return jsonError("Admin note is too long.", 400);
  }

  const reviewedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("labs_feature_requests")
    .update({
      status,
      admin_note: adminNote || null,
      reviewed_by: user.id,
      reviewed_at: reviewedAt,
    })
    .eq("id", requestId)
    .select("*")
    .single();

  if (error) {
    return jsonError(error.message || "Unable to update Labs request.", 400);
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "labs.request_updated",
    target_type: "labs_feature_request",
    target_id: requestId,
    metadata: {
      status,
      has_admin_note: Boolean(adminNote),
    },
  });

  return NextResponse.json({ request: data });
}

export async function DELETE(request: NextRequest) {
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
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";

  if (!requestId) {
    return jsonError("Missing Labs request id.", 400);
  }

  const { error } = await supabase
    .from("labs_feature_requests")
    .delete()
    .eq("id", requestId);

  if (error) {
    return jsonError(error.message || "Unable to delete Labs request.", 400);
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "labs.request_deleted",
    target_type: "labs_feature_request",
    target_id: requestId,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
