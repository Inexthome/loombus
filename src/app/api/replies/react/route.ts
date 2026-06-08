import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";
import { validatePublicProfileName } from "@/lib/profile-name-quality";

const ALLOWED_REACTION_TYPES = new Set([
  "helpful",
  "insightful",
  "well_reasoned",
  "changed_my_view",
  "needs_evidence",
]);

type ProfileAccess = {
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
  full_name: string | null;
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

    const supabase = createClient(
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
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid session." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const replyId = String(body.replyId ?? body.reply_id ?? "").trim();
    const reactionType = String(body.reactionType ?? body.reaction_type ?? "").trim();

    if (!replyId) {
      return NextResponse.json(
        { error: "Missing reply." },
        { status: 400 }
      );
    }

    if (!ALLOWED_REACTION_TYPES.has(reactionType)) {
      return NextResponse.json(
        { error: "Choose a valid reaction." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, account_status, enforcement_reason, suspended_until, full_name")
      .eq("id", user.id)
      .maybeSingle();

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

    const profileNameGate = validatePublicProfileName(profileAccess?.full_name ?? null);
    if (!profileAccess?.is_admin && !profileNameGate.ok) {
      return NextResponse.json(
        {
          error: profileNameGate.message,
          code: profileNameGate.code,
        },
        { status: 403 }
      );
    }

    const { data: reply } = await supabase
      .from("replies")
      .select("id, user_id, deleted_at")
      .eq("id", replyId)
      .maybeSingle();

    if (!reply || reply.deleted_at) {
      return NextResponse.json(
        { error: "Reply not found." },
        { status: 404 }
      );
    }

    if (reply.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot react to your own reply." },
        { status: 400 }
      );
    }

    const { data: existingReaction } = await supabase
      .from("reply_reactions")
      .select("id")
      .eq("reply_id", replyId)
      .eq("user_id", user.id)
      .eq("reaction_type", reactionType)
      .maybeSingle();

    let reacted = false;

    if (existingReaction) {
      const { error: deleteError } = await supabase
        .from("reply_reactions")
        .delete()
        .eq("id", existingReaction.id);

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message || "Unable to remove reaction." },
          { status: 400 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("reply_reactions")
        .insert({
          reply_id: replyId,
          user_id: user.id,
          reaction_type: reactionType,
        });

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message || "Unable to save reaction." },
          { status: 400 }
        );
      }

      reacted = true;
    }

    const { data: reactionRows, error: countError } = await supabase
      .from("reply_reactions")
      .select("reaction_type")
      .eq("reply_id", replyId);

    if (countError) {
      return NextResponse.json(
        { error: "Reaction updated, but counts could not be refreshed." },
        { status: 400 }
      );
    }

    const counts = (reactionRows ?? []).reduce<Record<string, number>>(
      (accumulator, row) => {
        const type = String(row.reaction_type ?? "");
        accumulator[type] = (accumulator[type] ?? 0) + 1;
        return accumulator;
      },
      {}
    );

    return NextResponse.json({
      reacted,
      replyId,
      reactionType,
      counts,
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
