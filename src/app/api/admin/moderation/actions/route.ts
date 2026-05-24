import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";

type AdminProfileRow = {
  is_admin: boolean | null;
};

type ModerationAction =
  | "restore_discussion"
  | "restore_reply"
  | "soft_delete_discussion"
  | "set_report_reviewing"
  | "dismiss_report"
  | "mark_report_actioned";

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

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

async function requireAdmin(supabase: ReturnType<typeof getSupabaseForRequest>) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, error: jsonError("Unauthorized.", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single<AdminProfileRow>();

  if (profileError || !profile?.is_admin) {
    return { user: null, error: jsonError("Admin access required.", 403) };
  }

  return { user, error: null };
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { user, error: adminError } = await requireAdmin(supabase);

  if (adminError || !user) {
    return adminError;
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  if (!action) {
    return jsonError("Missing moderation action.", 400);
  }

  if (action === "restore_discussion") {
    const discussionId = body?.discussionId;

    if (!isValidUuid(discussionId)) {
      return jsonError("Invalid discussion id.", 400);
    }

    const { error } = await supabase
      .from("discussions")
      .update({
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null,
      })
      .eq("id", discussionId);

    if (error) {
      return jsonError(error.message || "Unable to restore discussion.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.restored",
      target_type: "discussion",
      target_id: discussionId,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "restore_reply") {
    const replyId = body?.replyId;

    if (!isValidUuid(replyId)) {
      return jsonError("Invalid reply id.", 400);
    }

    const { error } = await supabase
      .from("replies")
      .update({
        deleted_at: null,
        deleted_by: null,
      })
      .eq("id", replyId);

    if (error) {
      return jsonError(error.message || "Unable to restore reply.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "reply.restored",
      target_type: "reply",
      target_id: replyId,
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "soft_delete_discussion") {
    const discussionId = body?.discussionId;
    const reason = "Admin moderation action";

    if (!isValidUuid(discussionId)) {
      return jsonError("Invalid discussion id.", 400);
    }

    const deletedAt = new Date().toISOString();

    const { error } = await supabase
      .from("discussions")
      .update({
        deleted_at: deletedAt,
        deleted_by: user.id,
        deletion_reason: reason,
      })
      .eq("id", discussionId);

    if (error) {
      return jsonError(error.message || "Unable to soft delete discussion.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "discussion.soft_deleted",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        reason,
      },
    });

    return NextResponse.json({ ok: true, deletedAt });
  }

  if (
    action === "set_report_reviewing" ||
    action === "dismiss_report" ||
    action === "mark_report_actioned"
  ) {
    const reportId = body?.reportId;
    const resolutionNote =
      typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : "";

    if (!isValidUuid(reportId)) {
      return jsonError("Invalid report id.", 400);
    }

    if (resolutionNote.length > 2000) {
      return jsonError("Resolution note is too long.", 400);
    }

    const now = new Date().toISOString();

    const status =
      action === "set_report_reviewing"
        ? "reviewing"
        : action === "dismiss_report"
          ? "dismissed"
          : "actioned";

    const updatePayload: Record<string, string | null> = {
      status,
      status_updated_by: user.id,
      status_updated_at: now,
      resolution_note: resolutionNote || null,
    };

    if (status === "dismissed") {
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = now;
    }

    if (status === "actioned") {
      updatePayload.reviewed_by = user.id;
      updatePayload.reviewed_at = now;
      updatePayload.actioned_by = user.id;
      updatePayload.actioned_at = now;
    }

    const { error } = await supabase
      .from("reports")
      .update(updatePayload)
      .eq("id", reportId);

    if (error) {
      return jsonError(error.message || "Unable to update report status.", 400);
    }

    await logAuditEvent({
      actor_id: user.id,
      action:
        status === "reviewing"
          ? "report.reviewing"
          : status === "dismissed"
            ? "report.dismissed"
            : "report.actioned",
      target_type: "report",
      target_id: reportId,
      metadata: {
        status,
        has_resolution_note: Boolean(resolutionNote),
      },
    });

    return NextResponse.json({
      ok: true,
      status,
      statusUpdatedBy: user.id,
      statusUpdatedAt: now,
      reviewedBy: status === "reviewing" ? null : user.id,
      reviewedAt: status === "reviewing" ? null : now,
      actionedBy: status === "actioned" ? user.id : null,
      actionedAt: status === "actioned" ? now : null,
      resolutionNote: resolutionNote || null,
    });
  }

  const _exhaustive: ModerationAction | string = action;
  void _exhaustive;

  return jsonError("Unsupported moderation action.", 400);
}
