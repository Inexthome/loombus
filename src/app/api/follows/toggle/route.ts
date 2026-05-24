import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications";
import { getAccountEnforcementResult } from "@/lib/account-enforcement";

type ProfileAccess = {
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

const ACTION_COOLDOWN_SECONDS = 5;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: request.headers.get("Authorization") ?? "",
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
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
      return NextResponse.json(
        {
          error: enforcement.errorMessage,
          code: enforcement.code,
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const targetUserId = String(body.targetUserId ?? "").trim();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Missing target user id." },
        { status: 400 }
      );
    }

    if (!UUID_PATTERN.test(targetUserId)) {
      return NextResponse.json(
        { error: "Invalid target user id." },
        { status: 400 }
      );
    }

    if (user.id === targetUserId) {
      return NextResponse.json(
        { error: "You cannot follow yourself." },
        { status: 400 }
      );
    }

    const cooldownSince = new Date(
      Date.now() - ACTION_COOLDOWN_SECONDS * 1000
    ).toISOString();

    const { data: recentAction } = await supabase
      .from("action_rate_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("action_key", "follow_toggle")
      .gte("created_at", cooldownSince)
      .limit(1)
      .maybeSingle();

    if (recentAction) {
      return NextResponse.json(
        { error: "Please wait before changing follow status again." },
        { status: 429 }
      );
    }

    await supabase.from("action_rate_events").insert({
      user_id: user.id,
      action_key: "follow_toggle",
      target_id: targetUserId,
    });


    const { data: viewerBlock } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
      .maybeSingle();

    if (viewerBlock) {
      return NextResponse.json(
        { error: "Unblock this member before following them." },
        { status: 403 }
      );
    }

    const { data: targetBlock } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", targetUserId)
      .eq("blocked_id", user.id)
      .maybeSingle();

    if (targetBlock) {
      return NextResponse.json(
        { error: "You cannot follow this member." },
        { status: 403 }
      );
    }

    const { data: existingFollow } = await supabase
      .from("follows")
      .select("*")
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId)
      .maybeSingle();

    if (existingFollow) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", targetUserId);

      return NextResponse.json({
        following: false,
      });
    }

    const { error: followError } = await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

    if (followError) {
      return NextResponse.json(
        { error: followError.message },
        { status: 500 }
      );
    }

    const { data: preferences } = await supabase
      .from("notification_preferences")
      .select("follows_enabled")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const followsEnabled = preferences?.follows_enabled ?? true;

    if (followsEnabled) {
      const { error: notificationError } = await createNotification({
        user_id: targetUserId,
        actor_id: user.id,
        type: "follow",
        target_type: "profile",
        target_id: user.id,
        message: "Someone followed you.",
      });

      if (notificationError) {
        console.error("Follow notification failed:", notificationError.message);
      }
    }

    return NextResponse.json({
      following: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
