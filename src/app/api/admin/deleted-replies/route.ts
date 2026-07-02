import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type AdminProfileRow = {
  is_admin: boolean | null;
};

type ReplyRow = {
  id: string;
  body: string;
  user_id: string;
  discussion_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
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

  const { data: replyRows, error: repliesError } = await admin
    .from("replies")
    .select("id, body, user_id, discussion_id, created_at, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (repliesError) {
    return jsonError(repliesError.message || "Unable to load deleted replies.", 400);
  }

  const replies = (replyRows ?? []) as ReplyRow[];

  const userIds = [
    ...new Set(replies.map((reply) => reply.user_id).filter((id): id is string => Boolean(id))),
  ];

  let profiles: { id: string; username: string | null; full_name: string | null }[] = [];

  if (userIds.length > 0) {
    const { data: profileRows, error: profilesError } = await admin
      .from("profiles")
      .select("id, username, full_name")
      .in("id", userIds);

    if (profilesError) {
      return jsonError(profilesError.message || "Unable to load profiles.", 400);
    }

    profiles = profileRows ?? [];
  }

  const discussionIds = [
    ...new Set(
      replies.map((reply) => reply.discussion_id).filter((id): id is string => Boolean(id))
    ),
  ];

  let discussions: { id: string; title: string; topic: string }[] = [];

  if (discussionIds.length > 0) {
    const { data: discussionRows, error: discussionsError } = await admin
      .from("discussions")
      .select("id, title, topic")
      .in("id", discussionIds);

    if (discussionsError) {
      return jsonError(discussionsError.message || "Unable to load discussions.", 400);
    }

    discussions = discussionRows ?? [];
  }

  return NextResponse.json({ replies, profiles, discussions });
}
