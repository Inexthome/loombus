import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

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

export async function GET(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const { user, error } = await getCurrentUser(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("private_conversation_members")
    .select("conversation_id, last_read_at, deleted_at")
    .eq("user_id", user.id)
    .is("deleted_at", null);

  if (membershipError) {
    return jsonError(membershipError.message, 500);
  }

  const membershipRows = (memberships ?? []) as {
    conversation_id: string;
    last_read_at: string | null;
  }[];

  if (membershipRows.length === 0) {
    return NextResponse.json({ unreadCount: 0 });
  }

  const conversationIds = membershipRows.map(
    (membership) => membership.conversation_id
  );

  const { data: conversations, error: conversationError } = await supabase
    .from("private_conversations")
    .select("id, last_message_at")
    .in("id", conversationIds);

  if (conversationError) {
    return jsonError(conversationError.message, 500);
  }

  const conversationMap = new Map(
    ((conversations ?? []) as { id: string; last_message_at: string | null }[]).map(
      (conversation) => [conversation.id, conversation]
    )
  );

  const unreadCount = membershipRows.filter((membership) => {
    const conversation = conversationMap.get(membership.conversation_id);

    if (!conversation?.last_message_at) {
      return false;
    }

    if (!membership.last_read_at) {
      return true;
    }

    return (
      new Date(conversation.last_message_at).getTime() >
      new Date(membership.last_read_at).getTime()
    );
  }).length;

  return NextResponse.json({ unreadCount });
}
