import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTeenSafetyFlags } from "@/lib/age-safety";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, { status });
}

function getSupabaseForRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    }
  );
}

function getSupabaseServiceRole() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase service role configuration.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: NextRequest) {
  const authSupabase = getSupabaseForRequest(request);

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid age safety payload.", 400);
  }

  const dateOfBirth = String(
    (body as Record<string, unknown>).dateOfBirth ?? ""
  ).trim();

  const flags = getTeenSafetyFlags(dateOfBirth);

  if (!flags) {
    return jsonError("Enter a valid date of birth.", 400, "invalid_date_of_birth");
  }

  if (flags.ageBand === "under_13") {
    return jsonError(
      "Loombus is not available to children under 13.",
      403,
      "under_13_not_allowed"
    );
  }

  let serviceSupabase;

  try {
    serviceSupabase = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { error: updateError } = await serviceSupabase
    .from("profiles")
    .update({
      date_of_birth: dateOfBirth,
      age_band: flags.ageBand,
      teen_safety_mode: flags.teenSafetyMode,
      guardian_required: flags.guardianRequired,
    })
    .eq("id", user.id);

  if (updateError) {
    return jsonError(updateError.message || "Unable to save age safety settings.", 500);
  }

  return NextResponse.json({
    ok: true,
    ageBand: flags.ageBand,
    teenSafetyMode: flags.teenSafetyMode,
    guardianRequired: flags.guardianRequired,
  });
}
