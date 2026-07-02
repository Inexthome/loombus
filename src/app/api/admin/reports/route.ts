import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AdminProfileRow = {
  is_admin: boolean | null;
};

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

  const { data: reportRows, error: reportsError } = await admin
    .from("reports")
    .select(
      `
      id,
      reason,
      status,
      reviewed_by,
      reviewed_at,
      resolution_note,
      status_updated_by,
      status_updated_at,
      actioned_by,
      actioned_at,
      created_at,
      discussion_id,
      reply_id,
      reported_profile_id,
      discussions (
        id,
        title,
        topic
      ),
      replies (
        id,
        body,
        user_id,
        discussion_id,
        deleted_at
      )
    `
    )
    .order("created_at", { ascending: false });

  if (reportsError) {
    return jsonError(reportsError.message || "Unable to load reports.", 400);
  }

  type RawReportRow = {
    reported_profile_id: string | null;
    reviewed_by: string | null;
    replies: { user_id: string } | { user_id: string }[] | null;
  };

  const reports = (reportRows ?? []) as unknown as RawReportRow[];

  const replyUserIds = reports
    .map((report) =>
      Array.isArray(report.replies) ? report.replies[0]?.user_id : report.replies?.user_id
    )
    .filter((id): id is string => Boolean(id));

  const reportedProfileIds = reports
    .map((report) => report.reported_profile_id)
    .filter((id): id is string => Boolean(id));

  const reviewerIds = reports
    .map((report) => report.reviewed_by)
    .filter((id): id is string => Boolean(id));

  const profileIds = [...new Set([...replyUserIds, ...reportedProfileIds, ...reviewerIds])];

  let profiles: Record<string, unknown>[] = [];

  if (profileIds.length > 0) {
    const { data: profileRows, error: profilesError } = await admin
      .from("profiles")
      .select(
        "id, username, full_name, account_status, enforcement_reason, enforcement_note, enforced_at, suspended_until"
      )
      .in("id", profileIds);

    if (profilesError) {
      return jsonError(profilesError.message || "Unable to load profiles.", 400);
    }

    profiles = profileRows ?? [];
  }

  return NextResponse.json({ reports, profiles });
}
