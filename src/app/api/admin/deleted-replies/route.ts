import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type DeletedReplyRow = {
  id: string;
  body: string;
  user_id: string;
  discussion_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
};

type DiscussionRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  deleted_at: string | null;
  deletion_reason: string | null;
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

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Admin Supabase configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}

export async function GET(request: NextRequest) {
  let supabase;
  let adminSupabase;

  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const repliesResult = await adminSupabase
    .from("replies")
    .select("id, body, user_id, discussion_id, created_at, deleted_at, deleted_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (repliesResult.error) {
    return jsonError(
      repliesResult.error.message || "Unable to load deleted replies.",
      500
    );
  }

  const replies = (repliesResult.data ?? []) as DeletedReplyRow[];
  const profileIds = [
    ...new Set(
      replies
        .flatMap((reply) => [reply.user_id, reply.deleted_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const discussionIds = [
    ...new Set(
      replies
        .map((reply) => reply.discussion_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profiles: ProfileRow[] = [];
  let discussions: DiscussionRow[] = [];

  const [profilesResult, discussionsResult] = await Promise.all([
    profileIds.length
      ? adminSupabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, is_admin, account_status")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    discussionIds.length
      ? adminSupabase
          .from("discussions")
          .select("id, user_id, title, topic, deleted_at, deletion_reason")
          .in("id", discussionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    return jsonError(
      profilesResult.error.message || "Unable to load reply member context.",
      500
    );
  }

  if (discussionsResult.error) {
    return jsonError(
      discussionsResult.error.message || "Unable to load parent discussion context.",
      500
    );
  }

  profiles = (profilesResult.data ?? []) as ProfileRow[];
  discussions = (discussionsResult.data ?? []) as DiscussionRow[];

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      replies,
      profiles,
      discussions,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
