import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { getPushBroadcastAudience, sendNativePushBroadcast } from "@/lib/push-broadcast";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const PUSH_TITLE = "Question of the Week is here";
const PUSH_BODY = "One real-world question worth thinking through together. Join this week’s discussion.";
const AUDIT_ACTION = "question_of_the_week.push_announcement";

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
      return { access: null, adminClient: null, error: jsonError(access.error, access.status) };
    }
    if (!access.profile.is_admin) {
      return { access: null, adminClient: null, error: jsonError("Admin access required.", 403) };
    }
    return { access, adminClient, error: null };
  } catch {
    return { access: null, adminClient: null, error: jsonError("Server configuration error.", 500) };
  }
}

async function loadCurrentQuestion(adminClient: ReturnType<typeof createClient>) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: question, error } = await adminClient
    .from("questions_of_the_week")
    .select("id, discussion_id, week_start, week_end")
    .lte("week_start", today)
    .gte("week_end", today)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!question) return null;

  const { data: discussion, error: discussionError } = await adminClient
    .from("discussions")
    .select("id, title, deleted_at, audience_type")
    .eq("id", question.discussion_id)
    .maybeSingle();

  if (discussionError) throw new Error(discussionError.message);
  return { question, discussion };
}

async function loadExistingSend(adminClient: ReturnType<typeof createClient>, discussionId: string) {
  const { data, error } = await adminClient
    .from("audit_logs")
    .select("id, created_at, metadata")
    .eq("action", AUDIT_ACTION)
    .eq("target_type", "discussion")
    .eq("target_id", discussionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function GET(request: NextRequest) {
  const { adminClient, error } = await requireAdmin(request);
  if (error || !adminClient) return error;

  try {
    const current = await loadCurrentQuestion(adminClient);
    if (!current?.discussion) return jsonError("No current Question of the Week is available.", 404);

    const existingSend = await loadExistingSend(adminClient, current.discussion.id);
    const audience = await getPushBroadcastAudience();

    return NextResponse.json(
      {
        title: PUSH_TITLE,
        body: PUSH_BODY,
        question: {
          id: current.question.id,
          discussionId: current.discussion.id,
          discussionTitle: current.discussion.title,
          weekStart: current.question.week_start,
          weekEnd: current.question.week_end,
          deleted: Boolean(current.discussion.deleted_at),
          audienceType: current.discussion.audience_type,
        },
        eligibleUsers: audience.eligibleUsers,
        eligibleTokens: audience.tokens.length,
        alreadySent: Boolean(existingSend),
        sentAt: existingSend?.created_at ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Unable to load push announcement status.", 500);
  }
}

export async function POST(request: NextRequest) {
  const { access, adminClient, error } = await requireAdmin(request);
  if (error || !access || !adminClient) return error;

  try {
    const current = await loadCurrentQuestion(adminClient);
    if (!current?.discussion) return jsonError("No current Question of the Week is available.", 404);
    if (current.discussion.deleted_at) {
      return jsonError("Restore the current Question of the Week discussion before announcing it.", 409);
    }
    if (current.discussion.audience_type !== "public") {
      return jsonError("Question of the Week must be public before it can be announced.", 409);
    }

    const existingSend = await loadExistingSend(adminClient, current.discussion.id);
    if (existingSend) {
      return NextResponse.json(
        { error: "This Question of the Week announcement has already been sent.", alreadySent: true, sentAt: existingSend.created_at },
        { status: 409, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const summary = await sendNativePushBroadcast({
      title: PUSH_TITLE,
      body: PUSH_BODY,
      url: `/discussions/${current.discussion.id}`,
    });

    await logAuditEvent({
      actor_id: access.user.id,
      action: AUDIT_ACTION,
      target_type: "discussion",
      target_id: current.discussion.id,
      metadata: {
        question_of_the_week_id: current.question.id,
        week_start: current.question.week_start,
        week_end: current.question.week_end,
        title: PUSH_TITLE,
        body: PUSH_BODY,
        eligible_users: summary.eligibleUsers,
        eligible_tokens: summary.eligibleTokens,
        attempted_tokens: summary.attemptedTokens,
        accepted_tokens: summary.acceptedTokens,
        failed_tokens: summary.failedTokens,
        skipped_tokens: summary.skippedTokens,
      },
    });

    return NextResponse.json(
      { ok: true, ...summary },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Unable to send the QOTW announcement.", 500);
  }
}
