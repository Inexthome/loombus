import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        { error: "You cannot block yourself." },
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
      .eq("action_key", "block_toggle")
      .gte("created_at", cooldownSince)
      .limit(1)
      .maybeSingle();

    if (recentAction) {
      return NextResponse.json(
        { error: "Please wait before changing block status again." },
        { status: 429 }
      );
    }

    await supabase.from("action_rate_events").insert({
      user_id: user.id,
      action_key: "block_toggle",
      target_id: targetUserId,
    });


    const { data: existingBlock } = await supabase
      .from("user_blocks")
      .select("id")
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId)
      .maybeSingle();

    if (existingBlock) {
      const { error: deleteError } = await supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetUserId);

      if (deleteError) {
        return NextResponse.json(
          { error: deleteError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        blocked: false,
      });
    }

    const { error: blockError } = await supabase.from("user_blocks").insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    });

    if (blockError) {
      return NextResponse.json(
        { error: blockError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);

    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", targetUserId)
      .eq("following_id", user.id);

    return NextResponse.json({
      blocked: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
