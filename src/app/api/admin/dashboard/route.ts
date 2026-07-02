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

  const [
    totalReports,
    openReports,
    dismissedReports,
    actionedReports,
    profileReports,
    deletedDiscussions,
    deletedReplies,
    labsRequests,
    supportRequests,
  ] = await Promise.all([
    admin.from("reports").select("*", { count: "exact", head: true }),
    admin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "new"),
    admin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "dismissed"),
    admin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "actioned"),
    admin
      .from("reports")
      .select("*", { count: "exact", head: true })
      .not("reported_profile_id", "is", null),
    admin
      .from("discussions")
      .select("*", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    admin
      .from("replies")
      .select("*", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    admin.from("labs_feature_requests").select("*", { count: "exact", head: true }),
    admin
      .from("support_requests")
      .select("*", { count: "exact", head: true })
      .in("status", ["new", "reviewing"]),
  ]);

  return NextResponse.json({
    totalReports: totalReports.count ?? 0,
    openReports: openReports.count ?? 0,
    dismissedReports: dismissedReports.count ?? 0,
    actionedReports: actionedReports.count ?? 0,
    profileReports: profileReports.count ?? 0,
    deletedDiscussions: deletedDiscussions.count ?? 0,
    deletedReplies: deletedReplies.count ?? 0,
    labsRequests: labsRequests.count ?? 0,
    supportRequests: supportRequests.count ?? 0,
  });
}
