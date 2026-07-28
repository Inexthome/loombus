import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminNotifications } from "@/lib/notifications";

function getAuthClient(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  const auth = getAuthClient(request);
  const {
    data: { user },
    error: userError,
  } = await auth.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedDateOfBirth = String(body?.requestedDateOfBirth ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const requestedAgeBand = getAgeBandFromDateOfBirth(requestedDateOfBirth);

  if (!requestedAgeBand) {
    return NextResponse.json(
      { error: "Enter a valid requested date of birth." },
      { status: 400 }
    );
  }

  if (reason.length < 10 || reason.length > 1000) {
    return NextResponse.json(
      { error: "Explain the correction in 10 to 1,000 characters." },
      { status: 400 }
    );
  }

  let service;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: current, error: currentError } = await service
    .from("profile_sensitive")
    .select("age_band, date_of_birth")
    .eq("id", user.id)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: "Unable to verify the current age record." }, { status: 500 });
  }

  if (!current?.date_of_birth) {
    return NextResponse.json(
      { error: "Complete the initial age gate before requesting a correction." },
      { status: 409 }
    );
  }

  if (String(current.date_of_birth).slice(0, 10) === requestedDateOfBirth) {
    return NextResponse.json(
      { error: "The requested date matches the date already on file." },
      { status: 409 }
    );
  }

  const { data: requestRow, error: insertError } = await service
    .from("age_correction_requests")
    .insert({
      user_id: user.id,
      current_age_band: current.age_band ?? "unknown",
      requested_date_of_birth: requestedDateOfBirth,
      requested_age_band: requestedAgeBand,
      reason,
    })
    .select("id, requested_age_band, status, created_at")
    .single();

  if (insertError) {
    const duplicate = insertError.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "You already have an age correction under review."
          : "Unable to submit the age correction request.",
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "age_correction.submitted",
    target_type: "age_correction_request",
    target_id: requestRow.id,
    metadata: {
      current_age_band: current.age_band ?? "unknown",
      requested_age_band: requestedAgeBand,
    },
  });

  await createAdminNotifications({
    actor_id: user.id,
    type: "age_correction_submitted",
    target_type: "age_correction_request",
    target_id: requestRow.id,
    message: "A member submitted an age correction request for review.",
  });

  return NextResponse.json(
    { request: requestRow },
    { status: 201, headers: { "Cache-Control": "private, no-store" } }
  );
}
