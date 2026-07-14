import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const AUDIT_LIMIT = 100;

type AuditLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
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
  deleted_by: string | null;
  deletion_reason: string | null;
};

type ReplyRow = {
  id: string;
  user_id: string;
  discussion_id: string;
  body: string;
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

function uniqueIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function isProfileTarget(targetType: string) {
  return ["profile", "account", "user", "member"].includes(targetType);
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

  const auditResult = await adminSupabase
    .from("audit_logs")
    .select("id, action, target_type, target_id, metadata, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(AUDIT_LIMIT);

  if (auditResult.error) {
    return jsonError(
      auditResult.error.message || "Unable to load audit records.",
      500
    );
  }

  const logs = (auditResult.data ?? []) as AuditLogRow[];
  const directDiscussionIds = uniqueIds(
    logs
      .filter((log) => log.target_type === "discussion")
      .map((log) => log.target_id)
  );
  const directReplyIds = uniqueIds(
    logs
      .filter((log) => log.target_type === "reply")
      .map((log) => log.target_id)
  );

  const [discussionResult, replyResult] = await Promise.all([
    directDiscussionIds.length
      ? adminSupabase
          .from("discussions")
          .select(
            "id, user_id, title, topic, deleted_at, deleted_by, deletion_reason"
          )
          .in("id", directDiscussionIds)
      : Promise.resolve({ data: [], error: null }),
    directReplyIds.length
      ? adminSupabase
          .from("replies")
          .select("id, user_id, discussion_id, body, deleted_at, deleted_by")
          .in("id", directReplyIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (discussionResult.error) {
    return jsonError(
      discussionResult.error.message || "Unable to load discussion audit context.",
      500
    );
  }

  if (replyResult.error) {
    return jsonError(
      replyResult.error.message || "Unable to load reply audit context.",
      500
    );
  }

  const directDiscussions = (discussionResult.data ?? []) as DiscussionRow[];
  const replies = (replyResult.data ?? []) as ReplyRow[];
  const loadedDiscussionIds = new Set(directDiscussions.map((row) => row.id));
  const parentDiscussionIds = uniqueIds(
    replies
      .map((reply) => reply.discussion_id)
      .filter((id) => !loadedDiscussionIds.has(id))
  );

  let parentDiscussions: DiscussionRow[] = [];

  if (parentDiscussionIds.length) {
    const parentResult = await adminSupabase
      .from("discussions")
      .select(
        "id, user_id, title, topic, deleted_at, deleted_by, deletion_reason"
      )
      .in("id", parentDiscussionIds);

    if (parentResult.error) {
      return jsonError(
        parentResult.error.message || "Unable to load parent discussion context.",
        500
      );
    }

    parentDiscussions = (parentResult.data ?? []) as DiscussionRow[];
  }

  const discussions = [...directDiscussions, ...parentDiscussions];
  const profileTargetIds = uniqueIds(
    logs
      .filter((log) => isProfileTarget(log.target_type))
      .map((log) => log.target_id)
  );
  const profileIds = uniqueIds([
    ...logs.map((log) => log.actor_id),
    ...profileTargetIds,
    ...discussions.flatMap((discussion) => [
      discussion.user_id,
      discussion.deleted_by,
    ]),
    ...replies.flatMap((reply) => [reply.user_id, reply.deleted_by]),
  ]);

  let profiles: ProfileRow[] = [];

  if (profileIds.length) {
    const profileResult = await adminSupabase
      .from("profiles")
      .select("id, username, full_name, avatar_url, is_admin, account_status")
      .in("id", profileIds);

    if (profileResult.error) {
      return jsonError(
        profileResult.error.message || "Unable to load audit member context.",
        500
      );
    }

    profiles = (profileResult.data ?? []) as ProfileRow[];
  }

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      limit: AUDIT_LIMIT,
      logs,
      profiles,
      discussions,
      replies,
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  );
}
