import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { logAuditEvent } from "@/lib/audit-log";

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const replyId = String(body.replyId ?? "").trim();

    if (!replyId) {
      return NextResponse.json(
        { error: "Missing reply id." },
        { status: 400 }
      );
    }

    const [{ data: reply, error: replyError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase
          .from("replies")
          .select("id, user_id, discussion_id")
          .eq("id", replyId)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("profiles")
          .select("is_admin, account_status, enforcement_reason, suspended_until")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    if (profileError) {
      return NextResponse.json(
        { error: "Unable to verify account access." },
        { status: 503 }
      );
    }

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

    if (replyError || !reply) {
      return NextResponse.json(
        { error: "Reply not found." },
        { status: 404 }
      );
    }

    const isOwner = reply.user_id === user.id;
    const isAdmin = Boolean(profileAccess?.is_admin);

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to delete this reply." },
        { status: 403 }
      );
    }

    const deletedAt = new Date().toISOString();

    const { data: deletedReply, error: deleteError } = await adminSupabase
      .from("replies")
      .update({
        deleted_at: deletedAt,
        deleted_by: user.id,
      })
      .eq("id", replyId)
      .is("deleted_at", null)
      .select("id, deleted_at, deleted_by")
      .maybeSingle();

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    if (!deletedReply) {
      return NextResponse.json(
        { error: "Reply could not be deleted. It may already be deleted." },
        { status: 409 }
      );
    }

    await logAuditEvent({
      actor_id: user.id,
      action: "reply.soft_deleted",
      target_type: "reply",
      target_id: replyId,
      metadata: {
        discussion_id: reply.discussion_id,
        deleted_as_admin: isAdmin && !isOwner,
      },
    });

    return NextResponse.json({
      deleted: true,
      replyId,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
