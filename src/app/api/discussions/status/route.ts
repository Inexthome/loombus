import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

type DiscussionStatus = "open" | "resolved";

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
  discussion_status: DiscussionStatus | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeDiscussionStatus(value: unknown): DiscussionStatus | null {
  if (value === "open" || value === "resolved") {
    return value;
  }

  return null;
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
      return jsonError("Discussion status service is not configured.", 503);
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
    const nextStatus =
      body && typeof body === "object" && !Array.isArray(body)
        ? normalizeDiscussionStatus((body as Record<string, unknown>).status)
        : null;

    if (!discussionId) {
      return jsonError("Missing discussion id.", 400);
    }

    if (!nextStatus) {
      return jsonError("Invalid discussion status.", 400);
    }

    const [{ data: profile }, { data: discussion }] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_admin, account_status, enforcement_reason, suspended_until")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("discussions")
        .select("id, user_id, deleted_at, discussion_status")
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
      return jsonError("You do not have permission to update this discussion status.", 403);
    }

    const now = new Date().toISOString();
    const previousStatus = existingDiscussion.discussion_status ?? "open";

    const updateValues =
      nextStatus === "resolved"
        ? {
            discussion_status: "resolved",
            resolved_at: now,
            resolved_by: user.id,
          }
        : {
            discussion_status: "open",
            resolved_at: null,
            resolved_by: null,
          };

    const { data: updatedDiscussion, error: updateError } = await supabase
      .from("discussions")
      .update(updateValues)
      .eq("id", discussionId)
      .is("deleted_at", null)
      .select("id, user_id, discussion_status, resolved_at, resolved_by")
      .single();

    if (updateError) {
      return jsonError(updateError.message || "Unable to update discussion status.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action:
        nextStatus === "resolved"
          ? "discussion.resolved"
          : "discussion.reopened",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        previous_status: previousStatus,
        next_status: nextStatus,
        changed_as_admin: isAdmin && !isOwner,
      },
    });

    return NextResponse.json({
      discussion: updatedDiscussion,
      status: nextStatus,
    });
  } catch (error) {
    console.error(error);

    return jsonError("Unexpected server error.", 500);
  }
}
