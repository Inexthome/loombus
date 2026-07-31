import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase } from "@/lib/floor-operations";
import { FLOOR_REPLY_BODY_MAX } from "@/lib/floor-shared";
import { reviewLoombusSafety } from "@/lib/moderation/safety-policy";

type RouteContext = { params: Promise<{ postId: string }> };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function jsonError(message: string, status: number) {
  return json({ error: message }, status);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { postId } = await context.params;
  const supabase = createFloorRequestSupabase(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return jsonError("Sign in to reply.", 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }
  const payload = body as Record<string, unknown>;
  const replyBody = asString(payload.body).slice(0, FLOOR_REPLY_BODY_MAX);

  if (!replyBody) {
    return jsonError("Say something before replying.", 400);
  }

  const safety = await reviewLoombusSafety({
    userId: auth.user.id,
    content: replyBody,
    mode: "public_reply",
    targetId: postId,
    maxLength: FLOOR_REPLY_BODY_MAX,
  });

  if (!safety.allowed) {
    return jsonError(
      safety.message ?? "This content appears to violate Loombus safety rules.",
      400
    );
  }

  const { data, error } = await supabase
    .from("floor_post_replies")
    .insert({
      post_id: postId,
      author_id: auth.user.id,
      body: replyBody,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "42501") {
      return jsonError(
        "You need to be a verified adult member in good standing to reply on The Floor.",
        403
      );
    }
    return jsonError(error.message || "Unable to post your reply.", 400);
  }

  return json({ id: data.id }, 201);
}
