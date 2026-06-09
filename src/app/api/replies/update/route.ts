import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { reviewLoombusSafety } from "@/lib/moderation/safety-policy";
import { normalizePublicText } from "@/lib/public-text";

const FREE_REPLY_EDIT_WINDOW_MS = 15 * 60 * 1000;
const PREMIUM_REPLY_EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type ExistingReply = {
  id: string;
  user_id: string;
  discussion_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  edit_count: number | null;
};

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function hasPremiumReplyEditAccess(entitlement: AiEntitlement | null) {
  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function getReplyEditWindowLabel(isAdmin: boolean, hasPremiumAccess: boolean) {
  if (isAdmin) return "Admin";
  if (hasPremiumAccess) return "7 days";
  return "15 minutes";
}

function isWithinReplyEditWindow(
  createdAt: string,
  isAdmin: boolean,
  hasPremiumAccess: boolean
) {
  if (isAdmin) {
    return true;
  }

  const createdTime = new Date(createdAt).getTime();
  const editWindow = hasPremiumAccess
    ? PREMIUM_REPLY_EDIT_WINDOW_MS
    : FREE_REPLY_EDIT_WINDOW_MS;

  return Date.now() - createdTime <= editWindow;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return jsonError("Unauthorized.", 401);
    }

    const token = authHeader.replace("Bearer ", "");

    const authSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await authSupabase.auth.getUser(token);

    if (userError || !user) {
      return jsonError("Invalid session.", 401);
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return jsonError("Reply update service is not configured.", 503);
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const body = await request.json().catch(() => null);
    const replyId =
      body && typeof body === "object" && !Array.isArray(body)
        ? String((body as Record<string, unknown>).replyId ?? "").trim()
        : "";
    const content =
      body && typeof body === "object" && !Array.isArray(body)
        ? normalizePublicText(String((body as Record<string, unknown>).body ?? "")).trim()
        : "";

    if (!replyId) {
      return jsonError("Missing reply id.", 400);
    }

    if (!content) {
      return jsonError("Please enter a reply.", 400);
    }

    const safetyDecision = await reviewLoombusSafety({
      userId: user.id,
      content,
      mode: "public_reply",
      targetId: replyId,
    });

    if (!safetyDecision.allowed) {
      return NextResponse.json(
        {
          error:
            safetyDecision.message ??
            "This content appears to violate Loombus safety rules. Please revise before posting.",
          code: safetyDecision.code ?? "content_safety_blocked",
          category: safetyDecision.category,
          provider: safetyDecision.provider,
        },
        { status: 400 }
      );
    }

    const [{ data: profile }, { data: entitlement }, { data: reply }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin, account_status, enforcement_reason, suspended_until")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("replies")
          .select("id, user_id, discussion_id, body, created_at, deleted_at, edit_count")
          .eq("id", replyId)
          .maybeSingle(),
      ]);

    const profileAccess = (profile ?? null) as ProfileAccess | null;
    const enforcement = getAccountEnforcementResult(profileAccess);

    if (!enforcement.allowed) {
      return NextResponse.json(
        {
          error: enforcement.errorMessage,
          code: enforcement.code,
        },
        { status: 403 }
      );
    }

    const existingReply = reply as ExistingReply | null;

    if (!existingReply || existingReply.deleted_at) {
      return jsonError("Reply not found.", 404);
    }

    const isOwner = existingReply.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);

    if (!isOwner && !isAdmin) {
      return jsonError("You do not have permission to edit this reply.", 403);
    }

    const hasPremiumAccess = hasPremiumReplyEditAccess(
      (entitlement ?? null) as AiEntitlement | null
    );

    if (
      !isWithinReplyEditWindow(
        existingReply.created_at,
        isAdmin,
        hasPremiumAccess
      )
    ) {
      return NextResponse.json(
        {
          error: `This reply is outside your edit window. Your current reply edit window is ${getReplyEditWindowLabel(isAdmin, hasPremiumAccess)}.`,
          code: "reply_edit_window_expired",
        },
        { status: 403 }
      );
    }

    const editedAt = new Date().toISOString();

    const { data: updatedReply, error: updateError } = await supabase
      .from("replies")
      .update({
        body: content,
        updated_at: editedAt,
        edited_at: editedAt,
        edited_by: user.id,
        edit_count: (existingReply.edit_count ?? 0) + 1,
      })
      .eq("id", replyId)
      .is("deleted_at", null)
      .select("id, user_id, discussion_id, body, created_at, updated_at, edited_at, edited_by, edit_count")
      .single();

    if (updateError) {
      return jsonError(updateError.message || "Unable to update reply.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "reply.updated",
      target_type: "reply",
      target_id: replyId,
      metadata: {
        discussion_id: existingReply.discussion_id,
        previous_body: existingReply.body,
        next_body: content,
        edit_window: getReplyEditWindowLabel(isAdmin, hasPremiumAccess),
        edited_as_admin: isAdmin && !isOwner,
      },
    });

    return NextResponse.json({
      reply: updatedReply,
    });
  } catch (error) {
    console.error(error);

    return jsonError("Unexpected server error.", 500);
  }
}
