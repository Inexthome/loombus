import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

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

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

const PERSPECTIVE_MARKERS = new Set([
  "Lived experience",
  "Professional experience",
  "Research-based",
  "Builder / operator",
  "Student / learner",
  "Question / exploring",
]);

function isValidOptionalUrl(value: string) {
  if (!value) {
    return true;
  }

  return /^https?:\/\//i.test(value);
}

function hasCreatorToolsAccess(entitlement: EntitlementRow | null, isAdmin: boolean) {
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

  const accountAccess = await verifyRequestAccountAccess(supabase);

  if (!accountAccess.ok) {
    return jsonError(
      accountAccess.error,
      accountAccess.status,
      accountAccess.code
    );
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid profile payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const completionGate = validatePublicProfileCompletion({
    fullName: cleanOptionalText(source.fullName, 80),
    username: cleanOptionalText(source.username, 30),
    bio: typeof source.bio === "string" ? source.bio : "",
  });

  if (!completionGate.ok) {
    return jsonError(completionGate.message, 400, completionGate.code);
  }

  const fullName = completionGate.normalizedName;
  const username = completionGate.normalizedUsername;
  const bio = completionGate.normalizedBio;
  const perspectiveMarker =
    typeof source.perspectiveMarker === "string" &&
    PERSPECTIVE_MARKERS.has(source.perspectiveMarker)
      ? source.perspectiveMarker
      : null;
  const avatarUrl =
    typeof source.avatarUrl === "string" && source.avatarUrl.trim()
      ? source.avatarUrl.trim()
      : null;
  const creatorWebsiteUrl = cleanOptionalText(source.creatorWebsiteUrl, 240);
  const creatorSupportUrl = cleanOptionalText(source.creatorSupportUrl, 240);
  const creatorSupportLabel = cleanOptionalText(source.creatorSupportLabel, 40);

  if (!isValidOptionalUrl(creatorWebsiteUrl)) {
    return jsonError(
      "Creator website URL must start with http:// or https://.",
      400
    );
  }

  if (!isValidOptionalUrl(creatorSupportUrl)) {
    return jsonError("Support URL must start with http:// or https://.", 400);
  }

  const { data: existingUsername, error: usernameError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", accountAccess.user.id)
    .maybeSingle();

  if (usernameError) {
    return jsonError("Unable to verify username availability.", 503);
  }

  if (existingUsername) {
    return jsonError(
      "That username is already taken. Please choose another one.",
      409
    );
  }

  const { data: entitlement, error: entitlementError } = await supabase
    .from("user_ai_entitlements")
    .select("tier, ai_assisted_enabled, monthly_summary_limit")
    .eq("user_id", accountAccess.user.id)
    .maybeSingle<EntitlementRow>();

  if (entitlementError) {
    return jsonError("Unable to verify profile feature access.", 503);
  }

  const isAdmin = Boolean(accountAccess.profile.is_admin);
  const hasCreatorFields =
    Boolean(creatorWebsiteUrl) ||
    Boolean(creatorSupportUrl) ||
    Boolean(creatorSupportLabel);

  if (
    hasCreatorFields &&
    !hasCreatorToolsAccess(entitlement ?? null, isAdmin)
  ) {
    return jsonError(
      "Creator/supporter profile tools require Premium Plus access. Clear those fields to save your basic profile.",
      403
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: accountAccess.user.id,
    full_name: fullName,
    username,
    bio,
    perspective_marker: perspectiveMarker,
    avatar_url: avatarUrl,
    creator_website_url: creatorWebsiteUrl || null,
    creator_support_url: creatorSupportUrl || null,
    creator_support_label: creatorSupportLabel || null,
  });

  if (profileError) {
    if (profileError.code === "23505") {
      return jsonError(
        "That username is already taken. Please choose another one.",
        409
      );
    }

    return jsonError(profileError.message || "Unable to save profile.", 400);
  }

  return NextResponse.json({
    ok: true,
    profile: {
      id: accountAccess.user.id,
      full_name: fullName,
      username,
      bio,
      perspective_marker: perspectiveMarker,
      avatar_url: avatarUrl,
      creator_website_url: creatorWebsiteUrl || null,
      creator_support_url: creatorSupportUrl || null,
      creator_support_label: creatorSupportLabel || null,
    },
  });
}
