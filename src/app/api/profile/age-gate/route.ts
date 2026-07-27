import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { declareMemberAge } from "@/lib/teen-safety-server";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

function getSupabaseForRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase request configuration.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: authorization ? { Authorization: authorization } : {} },
  });
}

function getSupabaseServiceRole() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service role configuration.");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: NextRequest) {
  let authSupabase;
  let serviceSupabase;

  try {
    authSupabase = getSupabaseForRequest(request);
    serviceSupabase = getSupabaseServiceRole();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const {
    data: { user },
    error: userError,
  } = await authSupabase.auth.getUser();

  if (userError || !user) return jsonError("Unauthorized.", 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Invalid age verification payload.", 400);
  }

  const dateOfBirth = String(
    (body as Record<string, unknown>).dateOfBirth ?? "",
  ).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    return jsonError("Enter a valid date of birth.", 400, "invalid_date_of_birth");
  }

  const declaration = await declareMemberAge(
    serviceSupabase,
    user.id,
    dateOfBirth,
  );

  if (declaration.error) {
    if (declaration.code === "account_not_eligible") {
      return jsonError(
        "This account is not eligible to use Loombus.",
        403,
        declaration.code,
      );
    }

    if (declaration.code === "age_correction_required") {
      return jsonError(
        "Your date of birth is already recorded. Use Age Safety to request a correction.",
        409,
        declaration.code,
      );
    }

    return jsonError(
      declaration.code === "invalid_date_of_birth"
        ? "Enter a valid date of birth."
        : "Unable to save age verification.",
      declaration.code === "invalid_date_of_birth" ? 400 : 500,
      declaration.code ?? undefined,
    );
  }

  return NextResponse.json(
    { ok: true, ageSafety: declaration.data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
