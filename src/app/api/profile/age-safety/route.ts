import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseForRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: authorization ? { Authorization: authorization } : {} },
    }
  );
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service configuration.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: NextRequest) {
  const auth = getSupabaseForRequest(request);
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let service;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const [{ data: sensitive }, { data: settings }, { data: corrections }] =
    await Promise.all([
      service
        .from("profile_sensitive")
        .select("age_band, teen_safety_mode, guardian_required")
        .eq("id", user.id)
        .maybeSingle(),
      service
        .from("teen_safety_settings")
        .select(
          "future_discussion_audience, allow_unsolicited_adult_contact, personalized_recommendations_enabled, commerce_discovery_enabled, defaults_applied_at, age_transitioned_at"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      service
        .from("age_correction_requests")
        .select("id, requested_age_band, reason, status, created_at, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return NextResponse.json(
    {
      ageBand: sensitive?.age_band ?? "unknown",
      teenSafetyMode: Boolean(sensitive?.teen_safety_mode),
      guardianRequired: Boolean(sensitive?.guardian_required),
      defaults: settings ?? null,
      correctionRequests: corrections ?? [],
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
