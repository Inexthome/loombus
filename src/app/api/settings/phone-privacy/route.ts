import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const DEFAULTS = {
  phoneDiscoverable: false,
  contactMatchingEnabled: false,
  securitySmsEnabled: false,
};

type PreferenceRow = {
  phone_discoverable: boolean | null;
  contact_matching_enabled: boolean | null;
  security_sms_enabled: boolean | null;
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
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••• ••• ${digits.slice(-4)}`;
}

function normalize(row: PreferenceRow | null) {
  return {
    phoneDiscoverable: row?.phone_discoverable ?? DEFAULTS.phoneDiscoverable,
    contactMatchingEnabled:
      row?.contact_matching_enabled ?? DEFAULTS.contactMatchingEnabled,
    securitySmsEnabled: row?.security_sms_enabled ?? DEFAULTS.securitySmsEnabled,
  };
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

  if (userError || !user) return jsonError("Unauthorized.", 401);

  const { data, error } = await supabase
    .from("phone_privacy_preferences")
    .select(
      "phone_discoverable, contact_matching_enabled, security_sms_enabled"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return jsonError("Unable to load phone privacy settings.", 400);

  return NextResponse.json({
    phone: {
      masked: maskPhone(user.phone),
      verified: Boolean(user.phone && user.phone_confirmed_at),
    },
    preferences: normalize((data ?? null) as PreferenceRow | null),
    capabilities: {
      phoneAuth: true,
      contactMatching: false,
      securitySmsDelivery: false,
    },
  });
}

export async function PATCH(request: NextRequest) {
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

  if (userError || !user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid phone privacy settings payload.", 400);
  }

  const source = body as Record<string, unknown>;
  const phoneDiscoverable =
    typeof source.phoneDiscoverable === "boolean"
      ? source.phoneDiscoverable
      : DEFAULTS.phoneDiscoverable;

  // Keep provider-dependent controls off until the corresponding delivery/matching
  // services are implemented. This avoids storing consent that cannot yet be honored.
  const contactMatchingEnabled = false;
  const securitySmsEnabled = false;

  if (phoneDiscoverable && !(user.phone && user.phone_confirmed_at)) {
    return jsonError("Verify a mobile number before enabling phone discovery.", 400);
  }

  const { error } = await supabase.from("phone_privacy_preferences").upsert({
    user_id: user.id,
    phone_discoverable: phoneDiscoverable,
    contact_matching_enabled: contactMatchingEnabled,
    security_sms_enabled: securitySmsEnabled,
    updated_at: new Date().toISOString(),
  });

  if (error) return jsonError("Unable to save phone privacy settings.", 400);

  return NextResponse.json({
    preferences: {
      phoneDiscoverable,
      contactMatchingEnabled,
      securitySmsEnabled,
    },
  });
}
