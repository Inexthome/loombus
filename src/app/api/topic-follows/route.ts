import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const authorization = request.headers.get("authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

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

function normalizeRequestedTopics(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedTopics = new Set<string>(DISCUSSION_TOPICS);

  return [
    ...new Set(
      value
        .map((topic) => String(topic ?? "").trim())
        .filter((topic) => allowedTopics.has(topic))
    ),
  ];
}

async function getCurrentUser(supabase: any) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const user = await getCurrentUser(supabase);

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const { data, error } = await supabase
    .from("user_topic_follows")
    .select("topic, enabled")
    .eq("user_id", user.id)
    .order("topic", { ascending: true });

  if (error) {
    console.error("Basic topic follow load failed:", error.message);
    return jsonError("Unable to load followed topics.", 400);
  }

  return NextResponse.json({
    topics: DISCUSSION_TOPICS,
    selectedTopics: ((data ?? []) as { topic: string; enabled: boolean }[])
      .filter((row) => row.enabled)
      .map((row) => row.topic),
  });
}

export async function POST(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const user = await getCurrentUser(supabase);

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => ({}));
  const selectedTopics = normalizeRequestedTopics(body.topics);
  const selectedTopicSet = new Set(selectedTopics);
  const now = new Date().toISOString();

  const rows = DISCUSSION_TOPICS.map((topic) => ({
    user_id: user.id,
    topic,
    enabled: selectedTopicSet.has(topic),
    updated_at: now,
  }));

  const { error } = await (supabase.from("user_topic_follows") as any).upsert(
    rows,
    {
      onConflict: "user_id,topic",
    }
  );

  if (error) {
    console.error("Basic topic follow save failed:", error.message);
    return jsonError("Unable to save followed topics.", 400);
  }

  return NextResponse.json({
    selectedTopics,
  });
}
