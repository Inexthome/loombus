import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { reviewLoombusSafety } from "@/lib/moderation/safety-policy";
import { createNotification } from "@/lib/notifications";
import { logAuditEvent } from "@/lib/audit-log";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
  age_band: string | null;
  teen_safety_mode: boolean | null;
  guardian_required: boolean | null;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SEND_COOLDOWN_SECONDS = 3;
const MAX_MESSAGE_LENGTH = 4000;

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

  const [{ data: baseProfile }, { data: sensitiveProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("account_status, enforcement_reason, suspended_until")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_sensitive")
      .select("age_band, teen_safety_mode, guardian_required")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const profile: ProfileAccess = {
    account_status: baseProfile?.account_status ?? null,
    enforcement_reason: baseProfile?.enforcement_reason ?? null,
    suspended_until: baseProfile?.suspended_until ?? null,
    age_band: sensitiveProfile?.age_band ?? null,
    teen_safety_mode: sensitiveProfile?.teen_safety_mode ?? null,
    guardian_required: sensitiveProfile?.guardian_required ?? null,
  };

  const enforcement = getAccountEnforcementResult(profile);

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

  return { user, profile, error: null };
}

async function hasBlockRelationship(supabase: any, userId: string, otherUserId: string) {
  const { data: blocks } = await supabase
    .from("user_blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${userId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${userId})`
    )
    .limit(1);

  return Boolean(blocks && blocks.length > 0);
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
          : "This member must complete age safety before private messages can continue.",
    };
  }

  return null;
}

function getTeenMessagingContext(
  senderProfile: ProfileAccess | null,
  recipientProfile: ProfileAccess | null
) {
  const senderAgeBand = normalizeAgeBand(senderProfile?.age_band);
  const recipientAgeBand = normalizeAgeBand(recipientProfile?.age_band);
  const senderTeenSafetyMode = Boolean(senderProfile?.teen_safety_mode);
  const recipientTeenSafetyMode = Boolean(recipientProfile?.teen_safety_mode);
  const teenMessageInvolved = senderTeenSafetyMode || recipientTeenSafetyMode;

  return {
    teen_safety_surface: "private_message",
    sender_age_band: senderAgeBand,
    recipient_age_band: recipientAgeBand,
    sender_teen_safety_mode: senderTeenSafetyMode,
    recipient_teen_safety_mode: recipientTeenSafetyMode,
    teen_message_involved: teenMessageInvolved,
    adult_to_teen_message: senderAgeBand === "adult" && recipientAgeBand === "teen",
    teen_to_adult_message: senderAgeBand === "teen" && recipientAgeBand === "adult",
  };
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const { user, profile: currentProfile, error } = await getCurrentUser(supabase);

  if (error || !user) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const senderAgeRestriction = getMessagingAgeRestriction(
    currentProfile as ProfileAccess | null,
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
    return jsonError("Invalid message payload.", 400);
  }

  const conversationId = String((body as Record<string, unknown>).conversationId ?? "").trim();
  const rawBody = String((body as Record<string, unknown>).body ?? "").trim();
  const hasAttachments = Boolean((body as Record<string, unknown>).hasAttachments);
  const messageBody = rawBody || (hasAttachments ? "[Attachment]" : "");

  if (!isValidUuid(conversationId)) {
    return jsonError("Invalid conversation id.", 400);
  }

  if (!messageBody) {
    return jsonError("Message cannot be empty.", 400);
  }

  if (messageBody.length > MAX_MESSAGE_LENGTH) {
    return jsonError("Message is too long.", 400);
  }

  const { data: senderMembership, error: senderMembershipError } = await supabase
    .from("private_conversation_members")
    .select("conversation_id, user_id, deleted_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (senderMembershipError) {
    return jsonError(senderMembershipError.message, 500);
  }

  if (!senderMembership) {
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
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (membersError) {
    return jsonError(membersError.message, 500);
  }

  const otherMembers = ((members ?? []) as { user_id: string }[]).filter(
    (member) => member.user_id !== user.id
  );

  if (otherMembers.length !== 1) {
    return jsonError("Messages currently support one-to-one conversations only.", 400);
  }

  const recipientId = otherMembers[0].user_id;

  let serviceSupabaseForSafety;

  try {
    serviceSupabaseForSafety = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const [{ data: recipientBase }, { data: recipientSensitive }, { data: senderProfile }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("account_status, enforcement_reason, suspended_until")
        .eq("id", recipientId)
        .maybeSingle(),
      serviceSupabaseForSafety
        .from("profile_sensitive")
        .select("age_band, teen_safety_mode, guardian_required")
        .eq("id", recipientId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, username")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const recipientProfile: ProfileAccess = {
    account_status: recipientBase?.account_status ?? null,
    enforcement_reason: recipientBase?.enforcement_reason ?? null,
    suspended_until: recipientBase?.suspended_until ?? null,
    age_band: recipientSensitive?.age_band ?? null,
    teen_safety_mode: recipientSensitive?.teen_safety_mode ?? null,
    guardian_required: recipientSensitive?.guardian_required ?? null,
  };

  const recipientEnforcement = getAccountEnforcementResult(
    (recipientProfile ?? null) as ProfileAccess | null
  );

  if (!recipientEnforcement.allowed) {
    return jsonError("You cannot message this member.", 403);
  }

  const blocked = await hasBlockRelationship(supabase, user.id, recipientId);

  if (blocked) {
    return jsonError("You cannot message this member.", 403);
  }

  const recipientAgeRestriction = getMessagingAgeRestriction(
    recipientProfile as ProfileAccess | null,
    "recipient"
  );

  if (recipientAgeRestriction) {
    return jsonError(
      recipientAgeRestriction.message,
      403,
      recipientAgeRestriction.code
    );
  }

  const teenMessagingContext = getTeenMessagingContext(
    currentProfile as ProfileAccess | null,
    recipientProfile as ProfileAccess | null
  );

  if (rawBody) {
    const safetyDecision = await reviewLoombusSafety({
      userId: user.id,
      content: rawBody,
      mode: "private_message",
      targetId: conversationId,
      metadata: {
        ...teenMessagingContext,
        recipient_id: recipientId,
      },
    });

    if (!safetyDecision.allowed) {
      return NextResponse.json(
        {
          error:
            safetyDecision.message ??
            "This message appears to violate Loombus safety rules. Please revise it before sending.",
          code: safetyDecision.code ?? "message_safety_blocked",
          category: safetyDecision.category,
          provider: safetyDecision.provider,
        },
        { status: 400 }
      );
    }
  }

  const cooldownSince = new Date(Date.now() - SEND_COOLDOWN_SECONDS * 1000).toISOString();

  const { data: recentAction } = await supabase
    .from("action_rate_events")
    .select("id")
    .eq("user_id", user.id)
    .eq("action_key", "message_send")
    .gte("created_at", cooldownSince)
    .limit(1)
    .maybeSingle();

  if (recentAction) {
    return jsonError("Please wait before sending another message.", 429);
  }

  let serviceSupabase;

  try {
    serviceSupabase = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  await serviceSupabase.from("action_rate_events").insert({
    user_id: user.id,
    action_key: "message_send",
    target_id: conversationId,
  });

  const now = new Date().toISOString();

  const { data: message, error: messageError } = await serviceSupabase
    .from("private_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_type: "text",
      body: messageBody,
      created_at: now,
    })
    .select("id, conversation_id, sender_id, message_type, body, created_at, edited_at, deleted_by_sender, read_by_recipient_at")
    .single();

  if (messageError || !message) {
    return jsonError(messageError?.message ?? "Unable to send message.", 500);
  }

  const { error: conversationUpdateError } = await serviceSupabase
    .from("private_conversations")
    .update({
      updated_at: now,
      last_message_at: now,
    })
    .eq("id", conversationId);

  if (conversationUpdateError) {
    console.error("Private message conversation timestamp update failed:", conversationUpdateError.message);
  }

  await serviceSupabase
    .from("private_conversation_members")
    .update({
      deleted_at: null,
      archived_at: null,
    })
    .eq("conversation_id", conversationId)
    .in("user_id", [user.id, recipientId]);

  const senderName =
    senderProfile?.full_name?.trim() ||
    senderProfile?.username?.trim() ||
    "Someone";

  const { data: recipientMembership } = await serviceSupabase
    .from("private_conversation_members")
    .select("muted_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", recipientId)
    .maybeSingle();

  if (!recipientMembership?.muted_at) {
    const { error: notificationError } = await createNotification({
      user_id: recipientId,
      actor_id: user.id,
      type: conversation.last_message_at ? "message_reply" : "new_message",
      target_type: "conversation",
      target_id: conversationId,
      message: `${senderName} sent you a message.`,
    });

    if (notificationError) {
      console.error("Private message notification failed:", notificationError.message);
    }
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "message.sent",
    target_type: "message",
    target_id: message.id,
    metadata: {
      conversation_id: conversationId,
      recipient_id: recipientId,
      private_message_safety_checked: Boolean(rawBody),
      teen_safety_checked: true,
      ...teenMessagingContext,
    },
  });

  return NextResponse.json({
    success: true,
    message: {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      messageType: message.message_type,
      body: message.body,
      createdAt: message.created_at,
      editedAt: message.edited_at,
      deletedBySender: message.deleted_by_sender,
      readByRecipientAt: message.read_by_recipient_at,
    },
  });
}
