import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type EntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
};

type ProfileRow = {
  is_admin: boolean | null;
};

type PreferenceRow = {
  replies_enabled: boolean | null;
  follows_enabled: boolean | null;
  mentions_enabled: boolean | null;
  followed_discussions_enabled: boolean | null;
  followed_replies_enabled: boolean | null;
  email_digest_enabled: boolean | null;
  email_digest_frequency: string | null;
  push_messages_enabled: boolean | null;
  push_replies_enabled: boolean | null;
  push_follows_enabled: boolean | null;
  push_admin_reports_enabled: boolean | null;
};

const DEFAULT_PREFERENCES = {
  repliesEnabled: true,
  followsEnabled: true,
  mentionsEnabled: true,
  followedDiscussionsEnabled: true,
  followedRepliesEnabled: false,
  emailDigestEnabled: false,
  emailDigestFrequency: "weekly" as "daily" | "weekly",
  pushMessagesEnabled: true,
  pushRepliesEnabled: true,
  pushFollowsEnabled: true,
  pushAdminReportsEnabled: true,
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

function hasPremiumDigestAccess(
  entitlement: EntitlementRow | null,
  isAdmin: boolean
) {
  if (isAdmin) return true;

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function normalizeStoredPreferences(row: PreferenceRow | null, isAdmin: boolean) {
  return {
    repliesEnabled: row?.replies_enabled ?? DEFAULT_PREFERENCES.repliesEnabled,
    followsEnabled: row?.follows_enabled ?? DEFAULT_PREFERENCES.followsEnabled,
    mentionsEnabled: row?.mentions_enabled ?? DEFAULT_PREFERENCES.mentionsEnabled,
    followedDiscussionsEnabled:
      row?.followed_discussions_enabled ??
      DEFAULT_PREFERENCES.followedDiscussionsEnabled,
    followedRepliesEnabled:
      row?.followed_replies_enabled ??
      DEFAULT_PREFERENCES.followedRepliesEnabled,
    emailDigestEnabled:
      row?.email_digest_enabled ?? DEFAULT_PREFERENCES.emailDigestEnabled,
    emailDigestFrequency:
      row?.email_digest_frequency === "daily" ? "daily" : "weekly",
    pushMessagesEnabled:
      row?.push_messages_enabled ?? DEFAULT_PREFERENCES.pushMessagesEnabled,
    pushRepliesEnabled:
      row?.push_replies_enabled ?? DEFAULT_PREFERENCES.pushRepliesEnabled,
    pushFollowsEnabled:
      row?.push_follows_enabled ?? DEFAULT_PREFERENCES.pushFollowsEnabled,
    pushAdminReportsEnabled: isAdmin
      ? row?.push_admin_reports_enabled ??
        DEFAULT_PREFERENCES.pushAdminReportsEnabled
      : false,
  };
}

function readBoolean(
  source: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  return typeof source[key] === "boolean" ? (source[key] as boolean) : fallback;
}

async function getCurrentUserContext(supabase: ReturnType<typeof createClient>) {
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
    supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("user_ai_entitlements")
      .select("tier, ai_assisted_enabled")
      .eq("user_id", user.id)
      .maybeSingle<EntitlementRow>(),
  ]);

  return {
    user,
    isAdmin: Boolean(profile?.is_admin),
    entitlement: entitlement ?? null,
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

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(
      "replies_enabled, follows_enabled, mentions_enabled, followed_discussions_enabled, followed_replies_enabled, email_digest_enabled, email_digest_frequency, push_messages_enabled, push_replies_enabled, push_follows_enabled, push_admin_reports_enabled"
    )
    .eq("user_id", user.id)
    .maybeSingle<PreferenceRow>();

  if (error) {
    return jsonError("Unable to load Signal preferences.", 400);
  }

  return NextResponse.json({
    preferences: normalizeStoredPreferences(data ?? null, isAdmin),
    canUseEmailDigest: hasPremiumDigestAccess(entitlement, isAdmin),
    isAdmin,
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

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid Signal preference payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const canUseEmailDigest = hasPremiumDigestAccess(entitlement, isAdmin);
  const normalized = {
    repliesEnabled: readBoolean(
      source,
      "repliesEnabled",
      DEFAULT_PREFERENCES.repliesEnabled
    ),
    followsEnabled: readBoolean(
      source,
      "followsEnabled",
      DEFAULT_PREFERENCES.followsEnabled
    ),
    mentionsEnabled: readBoolean(
      source,
      "mentionsEnabled",
      DEFAULT_PREFERENCES.mentionsEnabled
    ),
    followedDiscussionsEnabled: readBoolean(
      source,
      "followedDiscussionsEnabled",
      DEFAULT_PREFERENCES.followedDiscussionsEnabled
    ),
    followedRepliesEnabled: readBoolean(
      source,
      "followedRepliesEnabled",
      DEFAULT_PREFERENCES.followedRepliesEnabled
    ),
    emailDigestEnabled:
      canUseEmailDigest &&
      readBoolean(
        source,
        "emailDigestEnabled",
        DEFAULT_PREFERENCES.emailDigestEnabled
      ),
    emailDigestFrequency:
      source.emailDigestFrequency === "daily" ? "daily" : "weekly",
    pushMessagesEnabled: readBoolean(
      source,
      "pushMessagesEnabled",
      DEFAULT_PREFERENCES.pushMessagesEnabled
    ),
    pushRepliesEnabled: readBoolean(
      source,
      "pushRepliesEnabled",
      DEFAULT_PREFERENCES.pushRepliesEnabled
    ),
    pushFollowsEnabled: readBoolean(
      source,
      "pushFollowsEnabled",
      DEFAULT_PREFERENCES.pushFollowsEnabled
    ),
    pushAdminReportsEnabled:
      isAdmin &&
      readBoolean(
        source,
        "pushAdminReportsEnabled",
        DEFAULT_PREFERENCES.pushAdminReportsEnabled
      ),
  };

  const { error } = await supabase.from("notification_preferences").upsert({
    user_id: user.id,
    replies_enabled: normalized.repliesEnabled,
    follows_enabled: normalized.followsEnabled,
    mentions_enabled: normalized.mentionsEnabled,
    followed_discussions_enabled: normalized.followedDiscussionsEnabled,
    followed_replies_enabled: normalized.followedRepliesEnabled,
    email_digest_enabled: normalized.emailDigestEnabled,
    email_digest_frequency: normalized.emailDigestFrequency,
    push_messages_enabled: normalized.pushMessagesEnabled,
    push_replies_enabled: normalized.pushRepliesEnabled,
    push_follows_enabled: normalized.pushFollowsEnabled,
    push_admin_reports_enabled: normalized.pushAdminReportsEnabled,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return jsonError(
      error.message || "Unable to save Signal preferences.",
      400
    );
  }

  return NextResponse.json({
    preferences: normalized,
    canUseEmailDigest,
    isAdmin,
  });
}
