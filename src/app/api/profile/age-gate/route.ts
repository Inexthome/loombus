import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTeenSafetyFlags } from "@/lib/age-safety";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
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
    return jsonError("Invalid age verification payload.", 400);
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
      "This account is not eligible to use Loombus.",
      403,
      "account_not_eligible"
    );
  }

  let serviceSupabase;

  try {
    serviceSupabase = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const { data: existingAge, error: existingAgeError } = await serviceSupabase
    .from("profile_sensitive")
    .select("date_of_birth, age_band")
    .eq("id", user.id)
    .maybeSingle();

  if (existingAgeError) {
    return jsonError("Unable to verify the current age record.", 500);
  }

  if (existingAge?.date_of_birth) {
    const storedDateOfBirth = String(existingAge.date_of_birth).slice(0, 10);

    if (storedDateOfBirth !== dateOfBirth) {
      return jsonError(
        "Your date of birth is already on file. Use the protected correction request instead of replacing it here.",
        409,
        "age_correction_required"
      );
    }

    return NextResponse.json(
      { ok: true, ageBand: existingAge.age_band, alreadyRecorded: true },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { error: upsertError } = await serviceSupabase
    .from("profile_sensitive")
    .upsert({
      id: user.id,
      date_of_birth: dateOfBirth,
      age_band: flags.ageBand,
      teen_safety_mode: flags.teenSafetyMode,
      guardian_required: flags.guardianRequired,
    });

  if (upsertError) {
    return jsonError("Unable to save age verification.", 500);
  }

  return NextResponse.json(
    { ok: true, ageBand: flags.ageBand, alreadyRecorded: false },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
