import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_FEATURE_KEYS = new Set([
  "thread_summary",
  "key_takeaways",
  "what_changed",
  "disagreement_map",
  "conversation_map",
  "related_ideas",
]);

const ALLOWED_RATINGS = new Set(["helpful", "not_helpful"]);

type AiOutputRatingRow = {
  feature_key: string;
  rating: "helpful" | "not_helpful";
};

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

function cleanUuid(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)
    ? trimmed
    : "";
}

function cleanFeatureKey(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const featureKey = value.trim();

  return ALLOWED_FEATURE_KEYS.has(featureKey) ? featureKey : "";
}

function cleanRating(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return "";
  }

  const rating = value.trim();

  return ALLOWED_RATINGS.has(rating) ? rating : "";
}

function cleanOptionalHash(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return /^[a-f0-9]{32,128}$/i.test(trimmed) ? trimmed : null;
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const discussionId = cleanUuid(request.nextUrl.searchParams.get("discussionId"));

  if (!discussionId) {
    return jsonError("A valid discussionId is required.", 400);
  }

  const { data, error } = await supabase
    .from("ai_output_ratings")
    .select("feature_key, rating")
    .eq("user_id", user.id)
    .eq("discussion_id", discussionId);

  if (error) {
    console.error("AI output rating load failed:", error.message);
    return jsonError("Unable to load AI output ratings.", 400);
  }

  const ratings: Record<string, "helpful" | "not_helpful"> = {};

  for (const row of (data ?? []) as AiOutputRatingRow[]) {
    ratings[row.feature_key] = row.rating;
  }

  return NextResponse.json({
    ok: true,
    ratings,
  });
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid AI output rating payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const discussionId = cleanUuid(source.discussionId);
  const featureKey = cleanFeatureKey(source.featureKey);
  const rating = cleanRating(source.rating);
  const sourceContentHash = cleanOptionalHash(source.sourceContentHash);

  if (!discussionId) {
    return jsonError("A valid discussionId is required.", 400);
  }

  if (!featureKey) {
    return jsonError("A valid AI feature key is required.", 400);
  }

  if (rating === "") {
    return jsonError("Rating must be helpful, not_helpful, or null.", 400);
  }

  if (rating === null) {
    const { error } = await supabase
      .from("ai_output_ratings")
      .delete()
      .eq("user_id", user.id)
      .eq("discussion_id", discussionId)
      .eq("feature_key", featureKey);

    if (error) {
      console.error("AI output rating clear failed:", error.message);
      return jsonError("Unable to clear AI output rating.", 400);
    }

    return NextResponse.json({
      ok: true,
      featureKey,
      rating: null,
    });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_output_ratings")
    .upsert(
      {
        user_id: user.id,
        discussion_id: discussionId,
        feature_key: featureKey,
        rating,
        source_content_hash: sourceContentHash,
        updated_at: now,
      },
      {
        onConflict: "user_id,discussion_id,feature_key",
      }
    )
    .select("feature_key, rating")
    .single<AiOutputRatingRow>();

  if (error) {
    console.error("AI output rating save failed:", error.message);
    return jsonError("Unable to save AI output rating.", 400);
  }

  return NextResponse.json({
    ok: true,
    featureKey: data.feature_key,
    rating: data.rating,
  });
}
