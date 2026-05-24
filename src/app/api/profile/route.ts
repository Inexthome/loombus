import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  is_admin: boolean | null;
};

type EntitlementRow = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
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

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isValidOptionalUrl(value: string) {
  if (!value) {
    return true;
  }

  return /^https?:\/\//i.test(value);
}

function hasCreatorToolsAccess(
  entitlement: EntitlementRow | null,
  isAdmin: boolean
) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
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
    return jsonError("Invalid profile payload.", 400);
  }

  const source = body as Record<string, unknown>;

  const fullName = cleanOptionalText(source.fullName, 80);
  const username = cleanOptionalText(source.username, 30)
    .replace(/^@+/, "")
    .toLowerCase();
  const bio = typeof source.bio === "string" ? source.bio.trim().slice(0, 1000) : "";
  const avatarUrl =
    typeof source.avatarUrl === "string" && source.avatarUrl.trim()
      ? source.avatarUrl.trim()
      : null;
  const creatorWebsiteUrl = cleanOptionalText(source.creatorWebsiteUrl, 240);
  const creatorSupportUrl = cleanOptionalText(source.creatorSupportUrl, 240);
  const creatorSupportLabel = cleanOptionalText(source.creatorSupportLabel, 40);

  const repliesEnabled =
    typeof source.repliesEnabled === "boolean" ? source.repliesEnabled : true;
  const followsEnabled =
    typeof source.followsEnabled === "boolean" ? source.followsEnabled : true;
  const mentionsEnabled =
    typeof source.mentionsEnabled === "boolean" ? source.mentionsEnabled : true;
  const followedDiscussionsEnabled =
    typeof source.followedDiscussionsEnabled === "boolean"
      ? source.followedDiscussionsEnabled
      : true;
  const followedRepliesEnabled =
    typeof source.followedRepliesEnabled === "boolean"
      ? source.followedRepliesEnabled
      : false;
  const emailDigestEnabled =
    typeof source.emailDigestEnabled === "boolean" ? source.emailDigestEnabled : false;
  const emailDigestFrequency =
    source.emailDigestFrequency === "daily" ? "daily" : "weekly";

  if (!/^[a-z0-9_]{2,30}$/.test(username)) {
    return jsonError(
      "Username must be 2-30 characters and can only use letters, numbers, and underscores.",
      400
    );
  }

  if (!isValidOptionalUrl(creatorWebsiteUrl)) {
    return jsonError("Creator website URL must start with http:// or https://.", 400);
  }

  if (!isValidOptionalUrl(creatorSupportUrl)) {
    return jsonError("Support URL must start with http:// or https://.", 400);
  }

  const { data: existingUsername } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existingUsername) {
    return jsonError("That username is already taken. Please choose another one.", 409);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_admin")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  const { data: entitlement } = await supabase
    .from("user_ai_entitlements")
    .select("tier, ai_assisted_enabled, monthly_summary_limit")
    .eq("user_id", user.id)
    .maybeSingle<EntitlementRow>();

  const isAdmin = Boolean(profile?.is_admin);
  const hasCreatorFields =
    Boolean(creatorWebsiteUrl) ||
    Boolean(creatorSupportUrl) ||
    Boolean(creatorSupportLabel);

  if (hasCreatorFields && !hasCreatorToolsAccess(entitlement ?? null, isAdmin)) {
    return jsonError(
      "Creator/supporter profile tools require Premium Plus or Admin access. Clear those fields to save your basic profile.",
      403
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName,
    username,
    bio,
    avatar_url: avatarUrl,
    creator_website_url: creatorWebsiteUrl || null,
    creator_support_url: creatorSupportUrl || null,
    creator_support_label: creatorSupportLabel || null,
  });

  if (profileError) {
    if (profileError.code === "23505") {
      return jsonError("That username is already taken. Please choose another one.", 409);
    }

    return jsonError(profileError.message || "Unable to save profile.", 400);
  }

  const { error: preferencesError } = await supabase
    .from("notification_preferences")
    .upsert({
      user_id: user.id,
      replies_enabled: repliesEnabled,
      follows_enabled: followsEnabled,
      mentions_enabled: mentionsEnabled,
      followed_discussions_enabled: followedDiscussionsEnabled,
      followed_replies_enabled: followedRepliesEnabled,
      email_digest_enabled: emailDigestEnabled,
      email_digest_frequency: emailDigestFrequency,
      updated_at: new Date().toISOString(),
    });

  if (preferencesError) {
    return jsonError(
      preferencesError.message || "Profile saved, but notification settings failed.",
      400
    );
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: user.id,
      full_name: fullName,
      username,
      bio,
      avatar_url: avatarUrl,
      creator_website_url: creatorWebsiteUrl || null,
      creator_support_url: creatorSupportUrl || null,
      creator_support_label: creatorSupportLabel || null,
    },
  });
}
