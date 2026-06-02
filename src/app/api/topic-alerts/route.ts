import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";

type EntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
};

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

function hasPremiumTopicAlertAccess(
  entitlement: EntitlementRow | null,
  isAdmin: boolean
) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
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

async function getCurrentUserContext(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      user: null,
      isAdmin: false,
      entitlement: null as EntitlementRow | null,
    };
  }

  const [{ data: profile }, { data: entitlement }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return {
    user,
    isAdmin: Boolean((profile as { is_admin?: boolean | null } | null)?.is_admin),
    entitlement: (entitlement ?? null) as EntitlementRow | null,
  };
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { user, isAdmin, entitlement } = await getCurrentUserContext(supabase);

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const canUseTopicAlerts = hasPremiumTopicAlertAccess(entitlement, isAdmin);

  const { data, error } = await supabase
    .from("user_topic_alerts")
    .select("topic, enabled")
    .eq("user_id", user.id)
    .order("topic", { ascending: true });

  if (error) {
    console.error("Topic alert load failed:", error.message);
    return jsonError("Unable to load topic alerts.", 400);
  }

  return NextResponse.json({
    canUseTopicAlerts,
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

  const { user, isAdmin, entitlement } = await getCurrentUserContext(supabase);

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  if (!hasPremiumTopicAlertAccess(entitlement, isAdmin)) {
    return jsonError("Topic alerts require Premium access.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const selectedTopics = normalizeRequestedTopics(body.topics);
  const selectedTopicSet = new Set(selectedTopics);

  const rows = DISCUSSION_TOPICS.map((topic) => ({
    user_id: user.id,
    topic,
    enabled: selectedTopicSet.has(topic),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await (supabase.from("user_topic_alerts") as any).upsert(
    rows,
    {
      onConflict: "user_id,topic",
    }
  );

  if (error) {
    console.error("Topic alert save failed:", error.message);
    return jsonError("Unable to save topic alerts.", 400);
  }

  return NextResponse.json({
    selectedTopics,
  });
}
