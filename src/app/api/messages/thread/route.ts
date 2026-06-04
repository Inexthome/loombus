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

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
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

  const enforcement = getAccountEnforcementResult((profile ?? null) as ProfileAccess | null);

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

export async function GET(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const { user, error } = await getCurrentUser(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const conversationId = new URL(request.url).searchParams.get("id");

  if (!isValidUuid(conversationId)) {
    return jsonError("Invalid conversation id.", 400);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("private_conversation_members")
    .select("conversation_id, user_id, joined_at, last_read_message_id, last_read_at, archived_at, deleted_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return jsonError(membershipError.message, 500);
  }

  if (!membership) {
    return jsonError("Conversation not found.", 404);
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("private_conversations")
    .select("id, created_by, created_at, updated_at, last_message_at, is_system")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    return jsonError(conversationError.message, 500);
  }

  if (!conversation) {
    return jsonError("Conversation not found.", 404);
  }

  const { data: members, error: membersError } = await supabase
    .from("private_conversation_members")
    .select("conversation_id, user_id, joined_at, archived_at, deleted_at")
    .eq("conversation_id", conversationId);

  if (membersError) {
    return jsonError(membersError.message, 500);
  }

  const otherUserIds = [
    ...new Set(
      ((members ?? []) as { user_id: string }[])
        .filter((member) => member.user_id !== user.id)
        .map((member) => member.user_id)
    ),
  ];

  const { data: profiles } =
    otherUserIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", otherUserIds)
      : { data: [] };

  const { data: messages, error: messagesError } = await supabase
    .from("private_messages")
    .select("id, conversation_id, sender_id, message_type, body, created_at, edited_at, deleted_by_sender, read_by_recipient_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (messagesError) {
    return jsonError(messagesError.message, 500);
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      createdBy: conversation.created_by,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      lastMessageAt: conversation.last_message_at,
      isSystem: conversation.is_system,
      currentUserState: {
        joinedAt: membership.joined_at,
        lastReadMessageId: membership.last_read_message_id,
        lastReadAt: membership.last_read_at,
        archivedAt: membership.archived_at,
        deletedAt: membership.deleted_at,
      },
      members: ((members ?? []) as any[]).map((member) => ({
        userId: member.user_id,
        joinedAt: member.joined_at,
        archivedAt: member.archived_at,
        deletedAt: member.deleted_at,
      })),
      otherProfiles: profiles ?? [],
    },
    messages: ((messages ?? []) as any[]).map((message) => ({
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      messageType: message.message_type,
      body: message.deleted_by_sender ? "" : message.body,
      createdAt: message.created_at,
      editedAt: message.edited_at,
      deletedBySender: message.deleted_by_sender,
      readByRecipientAt: message.read_by_recipient_at,
    })),
  });
}
