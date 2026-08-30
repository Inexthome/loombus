import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } }
  );
}

function getUserClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("Missing Supabase environment configuration.");

  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Admin Supabase configuration.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(request: NextRequest) {
  try {
    const userClient = getUserClient(request);
    const adminClient = getAdminClient();
    const access = await verifyRequestAccountAccess(userClient);

    if (!access.ok) {
      return {
        access: null,
        adminClient: null,
        error: jsonError(access.error, access.status),
      };
    }

    if (!access.profile.is_admin) {
      return {
        access: null,
        adminClient: null,
        error: jsonError("Admin access required.", 403),
      };
    }

    return { access, adminClient, error: null };
  } catch {
    return {
      access: null,
      adminClient: null,
      error: jsonError("Server configuration error.", 500),
    };
  }
}

function cleanDiscussionId(value: unknown) {
  const id = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export async function POST(request: NextRequest) {
  const { access, adminClient, error } = await requireAdmin(request);
  if (error || !access || !adminClient) return error;

  const body = await request.json().catch(() => ({}));
  const discussionId = cleanDiscussionId(body?.discussionId);
  if (!discussionId) return jsonError("A valid discussion id is required.", 400);

  const { data: weeklyQuestion, error: weeklyError } = await adminClient
    .from("questions_of_the_week")
    .select("id, week_start")
    .eq("discussion_id", discussionId)
    .maybeSingle();

  if (weeklyError) return jsonError(weeklyError.message, 500);
  if (!weeklyQuestion) {
    return jsonError("Only a Question of the Week discussion can be restored here.", 400);
  }

  const { data: discussion, error: discussionError } = await adminClient
    .from("discussions")
    .select("id, deleted_at, audience_type")
    .eq("id", discussionId)
    .maybeSingle();

  if (discussionError) return jsonError(discussionError.message, 500);
  if (!discussion) return jsonError("Discussion not found.", 404);
  if (!discussion.deleted_at) {
    return NextResponse.json(
      { ok: true, discussionId, alreadyRestored: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
  if (discussion.audience_type !== "public") {
    return jsonError("Question of the Week must remain a public discussion.", 400);
  }

  const now = new Date().toISOString();
  const { error: restoreError } = await adminClient
    .from("discussions")
    .update({ deleted_at: null, updated_at: now })
    .eq("id", discussionId);

  if (restoreError) return jsonError(restoreError.message, 500);

  await logAuditEvent({
    actor_id: access.user.id,
    action: "question_of_the_week.discussion_restored",
    target_type: "discussion",
    target_id: discussionId,
    metadata: {
      question_of_the_week_id: weeklyQuestion.id,
      week_start: weeklyQuestion.week_start,
    },
  });

  return NextResponse.json(
    { ok: true, discussionId, restoredAt: now },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
