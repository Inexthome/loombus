import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PushTokenPayload = {
  token?: unknown;
  platform?: unknown;
  tokenType?: unknown;
  deviceId?: unknown;
  appVersion?: unknown;
};

const ALLOWED_PLATFORMS = new Set(["ios", "android", "web", "unknown"]);
const ALLOWED_TOKEN_TYPES = new Set(["apns", "fcm", "webpush", "unknown"]);

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

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  if (!cleaned) {
    return null;
  }

  return cleaned.slice(0, maxLength);
}

function normalizePushTokenPayload(body: PushTokenPayload) {
  const token = cleanOptionalText(body.token, 4096);

  if (!token || token.length < 16) {
    return { error: "Invalid push token." as const };
  }

  const platformCandidate = cleanOptionalText(body.platform, 20) ?? "ios";
  const tokenTypeCandidate = cleanOptionalText(body.tokenType, 20) ?? "apns";

  const platform = ALLOWED_PLATFORMS.has(platformCandidate)
    ? platformCandidate
    : "unknown";

  const tokenType = ALLOWED_TOKEN_TYPES.has(tokenTypeCandidate)
    ? tokenTypeCandidate
    : "unknown";

  return {
    token,
    platform,
    tokenType,
    deviceId: cleanOptionalText(body.deviceId, 160),
    appVersion: cleanOptionalText(body.appVersion, 80),
  };
}

async function getCurrentUser(request: NextRequest) {
  let supabase;

  try {
    supabase = getSupabaseForRequest(request);
  } catch {
    return { userId: null, error: jsonError("Server configuration error.", 500) };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { userId: null, error: jsonError("Unauthorized.", 401) };
  }

  return { userId: user.id, error: null };
}

export async function POST(request: NextRequest) {
  const { userId, error } = await getCurrentUser(request);

  if (error || !userId) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const serviceSupabase = getSupabaseServiceClient();

  if (!serviceSupabase) {
    return jsonError("Push token service is not configured.", 503);
  }

  const body = (await request.json().catch(() => null)) as PushTokenPayload | null;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid push token payload.", 400);
  }

  const normalized = normalizePushTokenPayload(body);

  if ("error" in normalized) {
    return jsonError(normalized.error ?? "Invalid push token.", 400);
  }

  const now = new Date().toISOString();

  const { error: upsertError } = await (serviceSupabase
    .from("user_push_device_tokens") as any)
    .upsert(
      {
        user_id: userId,
        platform: normalized.platform,
        token_type: normalized.tokenType,
        token: normalized.token,
        device_id: normalized.deviceId,
        app_version: normalized.appVersion,
        enabled: true,
        last_registered_at: now,
        last_seen_at: now,
        updated_at: now,
      },
      {
        onConflict: "token",
      }
    );

  if (upsertError) {
    console.error("Push token registration failed:", upsertError.message);
    return jsonError("Unable to register push token.", 400);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { userId, error } = await getCurrentUser(request);

  if (error || !userId) {
    return error ?? jsonError("Unauthorized.", 401);
  }

  const serviceSupabase = getSupabaseServiceClient();

  if (!serviceSupabase) {
    return jsonError("Push token service is not configured.", 503);
  }

  const body = (await request.json().catch(() => null)) as PushTokenPayload | null;
  const token = body && typeof body === "object" ? cleanOptionalText(body.token, 4096) : null;

  if (!token) {
    return jsonError("Invalid push token.", 400);
  }

  const { error: updateError } = await serviceSupabase
    .from("user_push_device_tokens")
    .update({
      enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("token", token);

  if (updateError) {
    console.error("Push token disable failed:", updateError.message);
    return jsonError("Unable to disable push token.", 400);
  }

  return NextResponse.json({ ok: true });
}
