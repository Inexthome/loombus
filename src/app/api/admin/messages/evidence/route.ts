import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type MessageReportMetadata = {
  type?: string;
  message_id?: string;
  conversation_id?: string;
  notes?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
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

function getSupabaseServiceRole() {
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

function parseMessageReportMetadata(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as MessageReportMetadata;

    if (
      parsed?.type === "private_message" ||
      parsed?.type === "private_conversation"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile?.is_admin) {
    return jsonError("Forbidden.", 403);
  }

  const reportId = new URL(request.url).searchParams.get("reportId");

  if (!isValidUuid(reportId)) {
    return jsonError("Invalid report id.", 400);
  }

  let serviceSupabase;

  try {
    serviceSupabase = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { data: report, error: reportError } = await serviceSupabase
    .from("reports")
    .select("id, reason, reporter_id, resolution_note, created_at")
    .eq("id", reportId)
    .maybeSingle();

  if (reportError) {
    return jsonError(reportError.message, 500);
  }

  if (!report) {
    return jsonError("Report not found.", 404);
  }

  const metadata = parseMessageReportMetadata(report.resolution_note);

  if (!metadata?.conversation_id || !isValidUuid(metadata.conversation_id)) {
    return jsonError("Message report metadata not found.", 400);
  }

  const { data: conversation, error: conversationError } = await serviceSupabase
    .from("private_conversations")
    .select("id, created_by, created_at, updated_at, last_message_at, is_system")
    .eq("id", metadata.conversation_id)
    .maybeSingle();

  if (conversationError) {
    return jsonError(conversationError.message, 500);
  }

  if (!conversation) {
    return jsonError("Conversation not found.", 404);
  }

  const { data: members, error: membersError } = await serviceSupabase
    .from("private_conversation_members")
    .select("user_id, joined_at, archived_at, deleted_at")
    .eq("conversation_id", metadata.conversation_id);

  if (membersError) {
    return jsonError(membersError.message, 500);
  }

  const memberRows = (members ?? []) as {
    user_id: string;
    joined_at: string | null;
    archived_at: string | null;
    deleted_at: string | null;
  }[];

  const participantIds = [...new Set(memberRows.map((member) => member.user_id))];

  const { data: profiles } =
    participantIds.length > 0
      ? await serviceSupabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, account_status")
          .in("id", participantIds)
      : { data: [] };

  const profileMap = new Map(
    ((profiles ?? []) as any[]).map((item) => [item.id, item])
  );

  let messagesQuery = serviceSupabase
    .from("private_messages")
    .select("id, conversation_id, sender_id, message_type, body, created_at, edited_at, deleted_by_sender, read_by_recipient_at, reported_count")
    .eq("conversation_id", metadata.conversation_id)
    .order("created_at", { ascending: true })
    .limit(25);

  if (metadata.message_id && isValidUuid(metadata.message_id)) {
    const { data: reportedMessage } = await serviceSupabase
      .from("private_messages")
      .select("created_at")
      .eq("id", metadata.message_id)
      .eq("conversation_id", metadata.conversation_id)
      .maybeSingle();

    if (reportedMessage?.created_at) {
      messagesQuery = serviceSupabase
        .from("private_messages")
        .select("id, conversation_id, sender_id, message_type, body, created_at, edited_at, deleted_by_sender, read_by_recipient_at, reported_count")
        .eq("conversation_id", metadata.conversation_id)
        .gte("created_at", new Date(new Date(reportedMessage.created_at).getTime() - 10 * 60 * 1000).toISOString())
        .lte("created_at", new Date(new Date(reportedMessage.created_at).getTime() + 10 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true })
        .limit(50);
    }
  }

  const { data: messages, error: messagesError } = await messagesQuery;

  if (messagesError) {
    return jsonError(messagesError.message, 500);
  }

  return NextResponse.json({
    report: {
      id: report.id,
      reason: report.reason,
      reporterId: report.reporter_id,
      createdAt: report.created_at,
      notes: metadata.notes ?? "",
      type: metadata.type,
      messageId: metadata.message_id ?? null,
      conversationId: metadata.conversation_id,
    },
    conversation,
    participants: memberRows.map((member) => {
      const participantProfile = profileMap.get(member.user_id);

      return {
        userId: member.user_id,
        username: participantProfile?.username ?? null,
        fullName: participantProfile?.full_name ?? null,
        avatarUrl: participantProfile?.avatar_url ?? null,
        accountStatus: participantProfile?.account_status ?? null,
        joinedAt: member.joined_at,
        archivedAt: member.archived_at,
        deletedAt: member.deleted_at,
      };
    }),
    messages: ((messages ?? []) as any[]).map((message) => ({
      id: message.id,
      senderId: message.sender_id,
      messageType: message.message_type,
      body: message.deleted_by_sender ? "" : message.body,
      createdAt: message.created_at,
      editedAt: message.edited_at,
      deletedBySender: message.deleted_by_sender,
      readByRecipientAt: message.read_by_recipient_at,
      reportedCount: message.reported_count,
      isReportedMessage: Boolean(
        metadata.message_id && message.id === metadata.message_id
      ),
    })),
  });
}
