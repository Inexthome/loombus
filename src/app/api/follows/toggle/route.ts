import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const targetUserId = body.targetUserId;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Missing target user id." },
        { status: 400 }
      );
    }

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

    if (user.id === targetUserId) {
      return NextResponse.json(
        { error: "You cannot follow yourself." },
        { status: 400 }
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

    await supabase.from("follows").insert({
      follower_id: user.id,
      following_id: targetUserId,
    });

    const { error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: targetUserId,
        actor_id: user.id,
        type: "follow",
        target_type: "profile",
        target_id: user.id,
        message: "Someone followed you.",
      });

    if (notificationError) {
      return NextResponse.json(
        {
          error: `Follow created, but notification failed: ${notificationError.message}`,
        },
        { status: 500 }
      );
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
