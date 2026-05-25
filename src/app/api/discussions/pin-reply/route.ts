import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type ExistingDiscussion = {
  id: string;
  user_id: string;
  deleted_at: string | null;
  pinned_reply_id: string | null;
};

type ExistingReply = {
  id: string;
  user_id: string;
  discussion_id: string;
  deleted_at: string | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
      return jsonError("Pinned reply service is not configured.", 503);
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
    const discussionId =
      body && typeof body === "object" && !Array.isArray(body)
        ? String((body as Record<string, unknown>).discussionId ?? "").trim()
        : "";
    const replyId =
      body && typeof body === "object" && !Array.isArray(body)
        ? String((body as Record<string, unknown>).replyId ?? "").trim()
        : "";
    const shouldUnpin =
      body && typeof body === "object" && !Array.isArray(body)
        ? Boolean((body as Record<string, unknown>).unpin)
        : false;

    if (!discussionId) {
      return jsonError("Missing discussion id.", 400);
    }

    if (!shouldUnpin && !replyId) {
      return jsonError("Missing reply id.", 400);
    }

    const [{ data: profile }, { data: discussion }] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, account_status, enforcement_reason, suspended_until")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("discussions")
        .select("id, user_id, deleted_at, pinned_reply_id")
        .eq("id", discussionId)
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

    const existingDiscussion = discussion as ExistingDiscussion | null;

    if (!existingDiscussion || existingDiscussion.deleted_at) {
      return jsonError("Discussion not found.", 404);
    }

    const isOwner = existingDiscussion.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);

    if (!isOwner && !isAdmin) {
      return jsonError("You do not have permission to pin replies in this discussion.", 403);
    }

    if (shouldUnpin) {
      const { data: updatedDiscussion, error: updateError } = await supabase
        .from("discussions")
        .update({
          pinned_reply_id: null,
          pinned_at: null,
          pinned_by: null,
        })
        .eq("id", discussionId)
        .is("deleted_at", null)
        .select("id, pinned_reply_id, pinned_at, pinned_by")
        .single();

      if (updateError) {
        return jsonError(updateError.message || "Unable to unpin reply.", 400);
      }

      await logAuditEvent({
        actor_id: user.id,
        action: "discussion.reply_unpinned",
        target_type: "discussion",
        target_id: discussionId,
        metadata: {
          previous_pinned_reply_id: existingDiscussion.pinned_reply_id,
          changed_as_admin: isAdmin && !isOwner,
        },
      });

      return NextResponse.json({
        discussion: updatedDiscussion,
        pinned: false,
      });
    }

    const { data: reply } = await supabase
      .from("replies")
      .select("id, user_id, discussion_id, deleted_at")
      .eq("id", replyId)
      .maybeSingle();

    const existingReply = reply as ExistingReply | null;

    if (!existingReply || existingReply.deleted_at) {
      return jsonError("Reply not found.", 404);
    }

    if (existingReply.discussion_id !== discussionId) {
      return jsonError("That reply does not belong to this discussion.", 400);
    }

    const pinnedAt = new Date().toISOString();

    const { data: updatedDiscussion, error: updateError } = await supabase
      .from("discussions")
      .update({
        pinned_reply_id: replyId,
        pinned_at: pinnedAt,
        pinned_by: user.id,
      })
      .eq("id", discussionId)
      .is("deleted_at", null)
      .select("id, pinned_reply_id, pinned_at, pinned_by")
      .single();

    if (updateError) {
      return jsonError(updateError.message || "Unable to pin reply.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.reply_pinned",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        reply_id: replyId,
        previous_pinned_reply_id: existingDiscussion.pinned_reply_id,
        changed_as_admin: isAdmin && !isOwner,
      },
    });

    return NextResponse.json({
      discussion: updatedDiscussion,
      pinned: true,
    });
  } catch (error) {
    console.error(error);

    return jsonError("Unexpected server error.", 500);
  }
}
