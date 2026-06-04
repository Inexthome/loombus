import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VALID_REASONS = [
  "spam",
  "harassment",
  "abuse",
  "impersonation",
  "scam",
  "other",
] as const;

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status }
  );
}

function getSupabaseForRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: authorization ? { Authorization: authorization } : {} },
    }
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function getCurrentUser(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );

  if (!enforcement.allowed) {
    return {
      user: null,
      error: jsonError(
        enforcement.errorMessage ?? "Account restricted.",
        403,
        enforcement.code
      ),
    };
  }

  return { user, error: null };
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);

  const { user, error } = await getCurrentUser(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid report payload.", 400);
  }

  const reason = String(
    (body as Record<string, unknown>).reason ?? "other"
  ).trim();

  const notes = String(
    (body as Record<string, unknown>).notes ?? ""
  ).trim();

  const messageId = (body as Record<string, unknown>).messageId;
  const conversationId = (body as Record<string, unknown>).conversationId;

  const normalizedReason = VALID_REASONS.includes(reason as any)
    ? reason
    : "other";

  if (!messageId && !conversationId) {
    return jsonError(
      "Provide a messageId or conversationId.",
      400
    );
  }

  if (messageId) {
    if (!isValidUuid(messageId)) {
      return jsonError("Invalid message id.", 400);
    }

    const { data: message } = await supabase
      .from("private_messages")
      .select("id, conversation_id")
      .eq("id", messageId)
      .maybeSingle();

    if (!message) {
      return jsonError("Message not found.", 404);
    }

    const { data: membership } = await supabase
      .from("private_conversation_members")
      .select("conversation_id")
      .eq("conversation_id", message.conversation_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return jsonError("Message not found.", 404);
    }

    const { error: reportError } = await supabase
      .from("reports")
      .insert({
        reporter_id: user.id,
        reason: normalizedReason,
        resolution_note: JSON.stringify({
          type: "private_message",
          message_id: message.id,
          conversation_id: message.conversation_id,
          notes,
        }),
      });

    if (reportError) {
      return jsonError(reportError.message, 500);
    }

    await supabase
      .from("private_messages")
      .update({
        reported_count: 1,
      })
      .eq("id", message.id);

    return NextResponse.json({
      success: true,
      reportType: "message",
    });
  }

  if (!isValidUuid(conversationId)) {
    return jsonError("Invalid conversation id.", 400);
  }

  const { data: membership } = await supabase
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return jsonError("Conversation not found.", 404);
  }

  const { error: reportError } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      reason: normalizedReason,
      resolution_note: JSON.stringify({
        type: "private_conversation",
        conversation_id: conversationId,
        notes,
      }),
    });

  if (reportError) {
    return jsonError(reportError.message, 500);
  }

  return NextResponse.json({
    success: true,
    reportType: "conversation",
  });
}
