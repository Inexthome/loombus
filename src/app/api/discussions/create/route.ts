import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateContent } from "@/lib/moderation/content";

const CREATE_COOLDOWN_MS = 30000;

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

    const title = String(body.title ?? "").trim();
    const topic = String(body.topic ?? "").trim();
    const content = String(body.body ?? "").trim();

    if (!title) {
      return NextResponse.json(
        { error: "Please enter a discussion title." },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { error: "Please enter discussion content." },
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
      Date.now() - CREATE_COOLDOWN_MS
    ).toISOString();

    const { data: recentPost } = await supabase
      .from("discussions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .gte("created_at", cooldownSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPost) {
      return NextResponse.json(
        { error: "Please wait before creating another discussion." },
        { status: 429 }
      );
    }

    const { data: discussion, error } = await supabase
      .from("discussions")
      .insert({
        user_id: user.id,
        title,
        topic,
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

    return NextResponse.json({ discussion });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
