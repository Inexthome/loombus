import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

type DeletedDiscussionRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
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

  const discussionsResult = await adminSupabase
    .from("discussions")
    .select(
      "id, user_id, title, topic, body, created_at, updated_at, deleted_at, deleted_by, deletion_reason"
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (discussionsResult.error) {
    return jsonError(
      discussionsResult.error.message || "Unable to load deleted discussions.",
      500
    );
  }

  const discussions = (discussionsResult.data ?? []) as DeletedDiscussionRow[];
  const profileIds = [
    ...new Set(
      discussions
        .flatMap((discussion) => [discussion.user_id, discussion.deleted_by])
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let profiles: ProfileRow[] = [];

  if (profileIds.length > 0) {
    const profilesResult = await adminSupabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_admin, account_status")
      .in("id", profileIds);

    if (profilesResult.error) {
      return jsonError(
        profilesResult.error.message || "Unable to load moderation profile context.",
        500
      );
    }

    profiles = (profilesResult.data ?? []) as ProfileRow[];
  }

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      discussions,
      profiles,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
