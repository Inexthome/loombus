import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getMemberSettingsForUser } from "@/lib/member-settings-server";

function getRequestClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase configuration.");

  const authorization = request.headers.get("authorization") ?? "";
  if (authorization) {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Data export is read-only; refreshed auth cookies are handled by the app proxy.
      },
    },
  });
}

export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = getRequestClient(request);
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const [
    profile,
    sensitive,
    notificationPreferences,
    memberPrivacy,
    discussionAudience,
    topicAlerts,
    blocks,
    memberSettings,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("profile_sensitive").select("age_band, teen_safety_mode, guardian_required, age_assurance_method, age_assurance_updated_at").eq("id", user.id).maybeSingle(),
    supabase.from("notification_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("member_privacy_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("discussion_audience_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_topic_alerts").select("*").eq("user_id", user.id),
    supabase.from("user_blocks").select("blocked_id, created_at").eq("blocker_id", user.id),
    getMemberSettingsForUser(user.id),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    account: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      identities: (user.identities ?? []).map((identity) => ({
        id: identity.id,
        provider: identity.provider,
        createdAt: identity.created_at ?? null,
        lastSignInAt: identity.last_sign_in_at ?? null,
      })),
    },
    profile: profile.data ?? null,
    ageSafety: sensitive.data ?? null,
    settings: memberSettings,
    notificationPreferences: notificationPreferences.data ?? null,
    memberPrivacy: memberPrivacy.data ?? null,
    discussionAudienceDefaults: discussionAudience.data ?? null,
    topicAlerts: topicAlerts.data ?? [],
    blockedMembers: blocks.data ?? [],
    notes: [
      "This self-service export contains private account/settings data available through the Settings workspace.",
      "Private-message content, billing processor records, moderation evidence, and some operational/audit records are excluded from this immediate export and remain subject to applicable retention, safety, legal, and support processes.",
    ],
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="loombus-member-data-${date}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
