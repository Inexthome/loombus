import { NextResponse, type NextRequest } from "next/server";
import { createFloorRequestSupabase, hasActiveFloorAccess } from "@/lib/floor-operations";
import { FLOOR_POST_BODY_MAX, FLOOR_POST_TITLE_MAX } from "@/lib/floor-shared";
import { reviewLoombusSafety } from "@/lib/moderation/safety-policy";

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

function asUuid(value: unknown) {
  const candidate = asString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

export async function POST(request: NextRequest) {
  const supabase = createFloorRequestSupabase(request);
  const { data: auth, error: authError } = await supabase.auth.getUser();

  if (authError || !auth.user) {
    return jsonError("Sign in to start a discussion.", 401);
  }
  if (!(await hasActiveFloorAccess(supabase, auth.user.id))) {
    return jsonError("An active Floor membership is required.", 403);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return jsonError("Invalid request body.", 400);
  }
  const payload = body as Record<string, unknown>;

  const title = asString(payload.title).slice(0, FLOOR_POST_TITLE_MAX) || null;
  const postBody = asString(payload.body).slice(0, FLOOR_POST_BODY_MAX);
  const pulseEventId = asUuid(payload.pulse_event_id);

  if (!postBody) {
    return jsonError("Say something before posting.", 400);
  }

  const safety = await reviewLoombusSafety({
    userId: auth.user.id,
    content: [title, postBody].filter(Boolean).join("\n\n"),
    mode: "public_content",
    targetId: null,
    maxLength: FLOOR_POST_BODY_MAX,
  });

  if (!safety.allowed) {
    return jsonError(
      safety.message ?? "This content appears to violate Loombus safety rules.",
      400
    );
  }

  const { data, error } = await supabase
    .from("floor_posts")
    .insert({
      author_id: auth.user.id,
      title,
      body: postBody,
      pulse_event_id: pulseEventId,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" && pulseEventId) {
      const { data: existing } = await supabase
        .from("floor_posts")
        .select("id")
        .eq("pulse_event_id", pulseEventId)
        .maybeSingle();
      return json(
        {
          error: "A discussion has already started for this Floor update.",
          discussion_id: existing?.id ?? null,
        },
        409
      );
    }
    if (error.code === "42501") {
      return jsonError(
        "You need to be a verified adult member in good standing to post on The Floor.",
        403
      );
    }
    return jsonError(error.message || "Unable to post your discussion.", 400);
  }

  return json({ id: data.id }, 201);
}
