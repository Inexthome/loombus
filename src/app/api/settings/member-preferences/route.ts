import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MEMBER_SETTINGS,
  mergeMemberSettings,
  normalizeMemberSettings,
} from "@/lib/member-settings";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function getSupabaseForRequest(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase configuration.");

  const authorization = request.headers.get("authorization") ?? "";
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

async function requireUser(request: NextRequest) {
  const supabase = getSupabaseForRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { supabase, user: error ? null : user };
}

async function loadSettings(supabase: ReturnType<typeof getSupabaseForRequest>, userId: string) {
  const { data, error } = await supabase
    .from("member_settings")
    .select("preferences, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return {
    preferences: normalizeMemberSettings(data?.preferences ?? DEFAULT_MEMBER_SETTINGS),
    updatedAt: data?.updated_at ?? null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser(request);
    if (!user) return response({ error: "Unauthorized." }, 401);

    const [stored, profileResult] = await Promise.all([
      loadSettings(supabase, user.id),
      supabase
        .from("profiles")
        .select(
          "full_name, username, identity_verification_status, identity_verification_provider, identity_verified_at, legal_name_verified"
        )
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const identities = (user.identities ?? []).map((identity) => ({
      id: identity.id,
      provider: identity.provider,
      createdAt: identity.created_at ?? null,
      lastSignInAt: identity.last_sign_in_at ?? null,
      email:
        typeof identity.identity_data?.email === "string"
          ? identity.identity_data.email
          : null,
    }));

    return response({
      ...stored,
      account: {
        email: user.email ?? null,
        phone: user.phone ?? null,
        createdAt: user.created_at ?? null,
        lastSignInAt: user.last_sign_in_at ?? null,
        identities,
      },
      profile: profileResult.data ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load member settings.";
    return response({ error: message }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser(request);
    if (!user) return response({ error: "Unauthorized." }, 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "Invalid member settings payload." }, 400);
    }

    const current = await loadSettings(supabase, user.id);
    const next = mergeMemberSettings(current.preferences, body);
    const now = new Date().toISOString();

    const { error } = await supabase.from("member_settings").upsert(
      {
        user_id: user.id,
        preferences: next,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

    if (error) return response({ error: error.message }, 500);

    return response({ preferences: next, updatedAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save member settings.";
    return response({ error: message }, 500);
  }
}
