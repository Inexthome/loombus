import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

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

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
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

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { error: adminError } = await requireAdmin(supabase);

  if (adminError) {
    return adminError;
  }

  let admin;

  try {
    admin = getServiceRoleClient();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { data: requestRows, error: requestsError } = await admin
    .from("labs_feature_requests")
    .select(
      "id, user_id, title, description, status, admin_note, reviewed_by, reviewed_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (requestsError) {
    return jsonError(requestsError.message || "Unable to load Labs requests.", 400);
  }

  const requests = requestRows ?? [];
  const requestIds = requests.map((request) => request.id);

  let votes: { request_id: string }[] = [];

  if (requestIds.length > 0) {
    const { data: voteRows, error: votesError } = await admin
      .from("labs_feature_request_votes")
      .select("request_id")
      .in("request_id", requestIds);

    if (votesError) {
      return jsonError(votesError.message || "Unable to load Labs votes.", 400);
    }

    votes = voteRows ?? [];
  }

  const profileIds = [
    ...new Set(
      requests
        .flatMap((request) => [request.user_id, request.reviewed_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profiles: { id: string; username: string | null; full_name: string | null; avatar_url: string | null }[] = [];

  if (profileIds.length > 0) {
    const { data: profileRows, error: profilesError } = await admin
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .in("id", profileIds);

    if (profilesError) {
      return jsonError(profilesError.message || "Unable to load profiles.", 400);
    }

    profiles = profileRows ?? [];
  }

  return NextResponse.json({ requests, votes, profiles });
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

  await logAuditEvent({
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

  await logAuditEvent({
    actor_id: user.id,
    action: "labs.request_deleted",
    target_type: "labs_feature_request",
    target_id: requestId,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
