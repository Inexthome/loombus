import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTeenSafetyFlags } from "@/lib/age-safety";

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
    return jsonError("Invalid age verification payload.", 400);
  }

  const dateOfBirth =
    typeof (body as Record<string, unknown>).dateOfBirth === "string"
      ? String((body as Record<string, unknown>).dateOfBirth)
      : "";

  const safetyFlags = getTeenSafetyFlags(dateOfBirth);

  if (!safetyFlags) {
    return jsonError("Enter a valid date of birth.", 400);
  }

  if (safetyFlags.ageBand === "under_13") {
    return jsonError("Loombus is not available to children under 13.", 403);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    date_of_birth: dateOfBirth,
    age_band: safetyFlags.ageBand,
    teen_safety_mode: safetyFlags.teenSafetyMode,
    guardian_required: safetyFlags.guardianRequired,
  });

  if (profileError) {
    return jsonError(profileError.message || "Unable to save age verification.", 400);
  }

  return NextResponse.json({
    ok: true,
    dateOfBirth,
    ageBand: safetyFlags.ageBand,
    teenSafetyMode: safetyFlags.teenSafetyMode,
  });
}
