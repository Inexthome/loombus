import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateContent } from "@/lib/moderation/content";

const REPLY_COOLDOWN_MS = 10000;

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

    const discussionId = String(body.discussionId ?? "").trim();
    const content = String(body.body ?? "").trim();

    if (!discussionId) {
      return NextResponse.json(
        { error: "Missing discussion." },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Please enter a reply." },
        { status: 400 }
      );
    }

    const moderationError = validateContent(content);

    if (moderationError) {
      return NextResponse.json(
        { error: moderationError },
        { status: 400 }
      );
    }

    const cooldownSince = new Date(
      Date.now() - REPLY_COOLDOWN_MS
    ).toISOString();

    const { data: recentReply } = await supabase
      .from("replies")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", cooldownSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentReply) {
      return NextResponse.json(
        { error: "Please wait before replying again." },
        { status: 429 }
      );
    }

    const { data: reply, error } = await supabase
      .from("replies")
      .insert({
        discussion_id: discussionId,
        user_id: user.id,
        body: content,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
