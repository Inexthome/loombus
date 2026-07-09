import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { logAuditEvent } from "@/lib/audit-log";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
  age_band: string | null;
  teen_safety_mode: boolean | null;
  guardian_required: boolean | null;
};

type ConversationMemberRow = {
  conversation_id: string;
  deleted_at: string | null;
  private_conversations: {
    id: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    last_message_at: string | null;
    is_system: boolean;
  } | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CREATE_COOLDOWN_SECONDS = 5;

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

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status }
  );
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function normalizeAgeBand(value: unknown) {
  if (
    value === "unknown" ||
    value === "under_13" ||
    value === "teen" ||
    value === "adult"
  ) {
    return value;
  }

  return "unknown";
}

function getMessagingAgeRestriction(
  profile: ProfileAccess | null,
  role: "sender" | "recipient"
) {
  const ageBand = normalizeAgeBand(profile?.age_band);

  if (ageBand === "under_13" || profile?.guardian_required) {
    return {
      code: "under_13_not_allowed",
      message: "Loombus is not available to children under 13.",
    };
  }

  if (ageBand === "unknown") {
    return {
      code: role === "sender" ? "age_gate_required" : "recipient_age_gate_required",
      message:
        role === "sender"
          ? "Complete age safety before using private messages."
          : "This member must complete age safety before private messages can start.",
    };
  }

  return null;
}

async function getCurrentUserAndProfile(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status, enforcement_reason, suspended_until, age_band, teen_safety_mode, guardian_required")
    .eq("id", user.id)
    .maybeSingle();

  const enforcement = getAccountEnforcementResult(
    (profile ?? null) as ProfileAccess | null
  );

  if (!enforcement.allowed) {
    return {
      user: null,
      profile: null,
      error: jsonError(
        enforcement.errorMessage ?? "Account restricted.",
        403,
        enforcement.code
      ),
    };
  }

  return { user, profile, error: null };
}

async function usersMutuallyFollow(
  supabase: any,
  userId: string,
  targetUserId: string
) {
  const [{ data: viewerFollow }, { data: targetFollow }] = await Promise.all([
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("following_id", targetUserId)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("id")
      .eq("follower_id", targetUserId)
      .eq("following_id", userId)
      .maybeSingle(),
  ]);

  return Boolean(viewerFollow && targetFollow);
}

async function hasBlockRelationship(
  supabase: any,
  userId: string,
  targetUserId: string
) {
  const { data: blocks } = await supabase
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${userId})`
    )
    .limit(1);

  return Boolean(blocks && blocks.length > 0);
}

async function findExistingConversation(
  supabase: any,
  userId: string,
  targetUserId: string
) {
  const { data: viewerMemberships, error } = await supabase
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const membershipRows =
    ((viewerMemberships ?? []) as { conversation_id: string }[]);

  const conversationIds = [
    ...new Set(
      membershipRows.map((row) => row.conversation_id)
    ),
  ];

  if (conversationIds.length === 0) {
    return null;
  }

  const { data: targetMembership } = await supabase
    .from("private_conversation_members")
    .select("conversation_id")
    .eq("user_id", targetUserId)
    .in("conversation_id", conversationIds)
    .limit(1)
    .maybeSingle();

  const matchingMembership =
    targetMembership as { conversation_id: string } | null;

  return matchingMembership?.conversation_id ?? null;
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { user, error } = await getCurrentUserAndProfile(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("private_conversation_members")
    .select(
      `
      conversation_id,
      deleted_at,
      last_read_at,
      muted_at,
      private_conversations (
        id,
        created_by,
        created_at,
        updated_at,
        last_message_at,
        is_system
      )
    `
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("joined_at", { ascending: false });

  if (membershipError) {
    return jsonError(membershipError.message, 500);
  }

  const membershipRowsForList =
    ((memberships ?? []) as unknown as ConversationMemberRow[]);

  const conversationRows = membershipRowsForList
    .map((membership) => {
      const joinedConversation = membership.private_conversations as
        | ConversationMemberRow["private_conversations"]
        | ConversationMemberRow["private_conversations"][];

      return Array.isArray(joinedConversation)
        ? joinedConversation[0] ?? null
        : joinedConversation;
    })
    .filter(Boolean);

  const conversationIds = conversationRows.map((conversation) => conversation!.id);

  if (conversationIds.length === 0) {
    return NextResponse.json({ conversations: [] });
  }

  const [{ data: allMembers }, { data: lastMessages }] = await Promise.all([
    supabase
      .from("private_conversation_members")
      .select("conversation_id, user_id")
      .in("conversation_id", conversationIds),
    supabase
      .from("private_messages")
      .select("id, conversation_id, sender_id, body, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
  ]);

  const otherUserIds = [
    ...new Set(
      (allMembers ?? [])
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

  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const lastMessageMap = new Map<string, any>();

  for (const message of lastMessages ?? []) {
    if (!lastMessageMap.has(message.conversation_id)) {
      lastMessageMap.set(message.conversation_id, message);
    }
  }

  const rawConversations = conversationRows
    .map((conversation) => {
      if (!conversation) return null;

      const otherMember = (allMembers ?? []).find(
        (member) =>
          member.conversation_id === conversation.id && member.user_id !== user.id
      );

      const otherProfile = otherMember ? profileMap.get(otherMember.user_id) : null;
      const lastMessage = lastMessageMap.get(conversation.id);

      const membership =
        membershipRowsForList.find(
          (row) => row.conversation_id === conversation.id
        ) ?? null;

      const lastReadAt =
        (membership as any)?.last_read_at ?? null;

      const hasUnread =
        Boolean(conversation.last_message_at) &&
        (
          !lastReadAt ||
          new Date(conversation.last_message_at!).getTime() >
            new Date(lastReadAt).getTime()
        );

      return {
        id: conversation.id,
        createdBy: conversation.created_by,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        lastMessageAt: conversation.last_message_at,
        otherUserId: otherMember?.user_id ?? null,
        otherUsername: otherProfile?.username ?? null,
        otherFullName: otherProfile?.full_name ?? null,
        otherAvatarUrl: otherProfile?.avatar_url ?? null,
        hasUnread,
        mutedAt: (membership as any)?.muted_at ?? null,
        lastMessagePreview: lastMessage?.body
          ? String(lastMessage.body).slice(0, 140)
          : null,
        lastMessageSenderId: lastMessage?.sender_id ?? null,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => {
      const aTime = new Date(a.lastMessageAt ?? a.updatedAt ?? a.createdAt).getTime();
      const bTime = new Date(b.lastMessageAt ?? b.updatedAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });

  const conversationsByCounterpart = new Map<string, any>();

  for (const conversation of rawConversations) {
    if (!conversation) continue;

    const counterpartKey =
      conversation.otherUserId ??
      conversation.otherUsername ??
      conversation.otherFullName ??
      conversation.id;

    const existing = conversationsByCounterpart.get(counterpartKey);

    if (!existing) {
      conversationsByCounterpart.set(counterpartKey, conversation);
      continue;
    }

    const conversationTime = new Date(
      conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt
    ).getTime();
    const existingTime = new Date(
      existing.lastMessageAt ?? existing.updatedAt ?? existing.createdAt
    ).getTime();

    const mergedUnread = Boolean(existing.hasUnread || conversation.hasUnread);

    if (conversationTime > existingTime) {
      conversationsByCounterpart.set(counterpartKey, {
        ...conversation,
        hasUnread: mergedUnread,
      });
    } else if (mergedUnread !== existing.hasUnread) {
      conversationsByCounterpart.set(counterpartKey, {
        ...existing,
        hasUnread: mergedUnread,
      });
    }
  }

  const conversations = [...conversationsByCounterpart.values()].sort((a, b) => {
    const aTime = new Date(a.lastMessageAt ?? a.updatedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.lastMessageAt ?? b.updatedAt ?? b.createdAt).getTime();

    return bTime - aTime;
  });

  return NextResponse.json({ conversations });
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { user, profile, error } = await getCurrentUserAndProfile(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const senderAgeRestriction = getMessagingAgeRestriction(
    profile as ProfileAccess | null,
    "sender"
  );

  if (senderAgeRestriction) {
    return jsonError(
      senderAgeRestriction.message,
      403,
      senderAgeRestriction.code
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid conversation payload.", 400);
  }

  const targetUserId = String((body as Record<string, unknown>).targetUserId ?? "").trim();

  if (!isValidUuid(targetUserId)) {
    return jsonError("Invalid target user id.", 400);
  }

  if (targetUserId === user.id) {
    return jsonError("You cannot message yourself.", 400);
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, account_status, enforcement_reason, suspended_until, age_band, teen_safety_mode, guardian_required")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!targetProfile) {
    return jsonError("Member not found.", 404);
  }

  const targetEnforcement = getAccountEnforcementResult(
    targetProfile as ProfileAccess
  );

  if (!targetEnforcement.allowed) {
    return jsonError("You cannot message this member.", 403);
  }

  const targetAgeRestriction = getMessagingAgeRestriction(
    targetProfile as ProfileAccess,
    "recipient"
  );

  if (targetAgeRestriction) {
    return jsonError(
      targetAgeRestriction.message,
      403,
      targetAgeRestriction.code
    );
  }

  const blocked = await hasBlockRelationship(supabase, user.id, targetUserId);

  if (blocked) {
    return jsonError("You cannot message this member.", 403);
  }

  const mutualFollow = await usersMutuallyFollow(supabase, user.id, targetUserId);

  if (!mutualFollow) {
    return jsonError("Private messages require mutual following.", 403);
  }

  const existingConversationId = await findExistingConversation(
    supabase,
    user.id,
    targetUserId
  );

  if (existingConversationId) {
    return NextResponse.json({
      conversationId: existingConversationId,
      created: false,
    });
  }

  const cooldownSince = new Date(
    Date.now() - CREATE_COOLDOWN_SECONDS * 1000
  ).toISOString();

  const { data: recentAction } = await supabase
    .from("action_rate_events")
    .select("id")
    .eq("user_id", user.id)
    .eq("action_key", "message_conversation_create")
    .gte("created_at", cooldownSince)
    .limit(1)
    .maybeSingle();

  if (recentAction) {
    return jsonError("Please wait before starting another conversation.", 429);
  }

  let serviceSupabase;

  try {
    serviceSupabase = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  await serviceSupabase.from("action_rate_events").insert({
    user_id: user.id,
    action_key: "message_conversation_create",
    target_id: targetUserId,
  });

  const { data: conversation, error: conversationError } = await serviceSupabase
    .from("private_conversations")
    .insert({
      created_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    return jsonError(
      conversationError?.message ?? "Unable to create conversation.",
      500
    );
  }

  const { error: memberError } = await serviceSupabase
    .from("private_conversation_members")
    .insert([
      {
        conversation_id: conversation.id,
        user_id: user.id,
      },
      {
        conversation_id: conversation.id,
        user_id: targetUserId,
      },
    ]);

  if (memberError) {
    return jsonError(memberError.message, 500);
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "message.conversation_created",
    target_type: "conversation",
    target_id: conversation.id,
    metadata: {
      target_user_id: targetUserId,
    },
  });

  return NextResponse.json({
    conversationId: conversation.id,
    created: true,
  });
}
