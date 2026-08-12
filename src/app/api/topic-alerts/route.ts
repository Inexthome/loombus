import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  evaluateSubscriptionEntitlement,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";

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
  plan: SubscriptionPlanId,
  isAdmin: boolean
) {
  if (isAdmin) {
    return true;
  }

  return evaluateSubscriptionEntitlement(plan, "advanced_alerts").allowed;
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
      plan: "free" as SubscriptionPlanId,
    };
  }

  const [{ data: profile }, subscription] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
    getResolvedGeneralSubscriptionForUser(user.id),
  ]);

  return {
    user,
    isAdmin: Boolean((profile as { is_admin?: boolean | null } | null)?.is_admin),
    plan: subscription.plan,
  };
}

export async function GET(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  let context;
  try {
    context = await getCurrentUserContext(supabase);
  } catch {
    return jsonError("Unable to resolve subscription access.", 503);
  }

  const { user, isAdmin, plan } = context;

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  const canUseTopicAlerts = hasPremiumTopicAlertAccess(plan, isAdmin);

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

  let context;
  try {
    context = await getCurrentUserContext(supabase);
  } catch {
    return jsonError("Unable to resolve subscription access.", 503);
  }

  const { user, isAdmin, plan } = context;

  if (!user) {
    return jsonError("Unauthorized.", 401);
  }

  if (!hasPremiumTopicAlertAccess(plan, isAdmin)) {
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
