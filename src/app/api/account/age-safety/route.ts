import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgeSafetyRecord } from "@/lib/teen-safety-server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function getClients(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) throw new Error("Missing Supabase configuration.");

  const authorization = request.headers.get("authorization") ?? "";
  return {
    requestClient: createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: authorization ? { Authorization: authorization } : {} },
    }),
    service: createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

async function requireUser(request: NextRequest) {
  const clients = getClients(request);
  const { data, error } = await clients.requestClient.auth.getUser();
  return { ...clients, user: error ? null : data.user };
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const now = new Date();
  return (
    Number.isFinite(date.getTime()) &&
    date <= now &&
    date >= new Date(Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate()))
  );
}

export async function GET(request: NextRequest) {
  try {
    const { service, user } = await requireUser(request);
    if (!user) return response({ error: "Unauthorized." }, 401);

    const [ageSafety, correctionResult] = await Promise.all([
      getAgeSafetyRecord(service, user.id),
      service
        .from("age_correction_requests")
        .select(
          "id, current_date_of_birth, requested_date_of_birth, member_reason, status, decision_note, created_at, updated_at, reviewed_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    return response({
      ageSafety,
      correctionRequests: correctionResult.data ?? [],
    });
  } catch {
    return response({ error: "Age Safety is not configured." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { service, user } = await requireUser(request);
    if (!user) return response({ error: "Unauthorized." }, 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "Invalid Age Safety request." }, 400);
    }

    const input = body as Record<string, unknown>;
    const action = String(input.action ?? "request_correction").trim();

    if (action === "cancel_correction") {
      const requestId = String(input.requestId ?? "").trim();
      if (!UUID_PATTERN.test(requestId)) {
        return response({ error: "Invalid correction request." }, 400);
      }

      const { data, error } = await service
        .from("age_correction_requests")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", requestId)
        .eq("user_id", user.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (error) return response({ error: error.message }, 500);
      if (!data) return response({ error: "This request can no longer be cancelled." }, 409);

      await service
        .from("profile_sensitive")
        .update({ age_state: "teen", updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .eq("age_band", "teen");
      await service
        .from("profile_sensitive")
        .update({ age_state: "adult", updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .eq("age_band", "adult");

      return response({ ok: true, cancelled: true });
    }

    if (action !== "request_correction") {
      return response({ error: "Unsupported Age Safety action." }, 400);
    }

    const requestedDateOfBirth = String(input.dateOfBirth ?? "").trim();
    const memberReason = String(input.reason ?? "").trim().slice(0, 2000);
    if (!validDate(requestedDateOfBirth)) {
      return response({ error: "Enter a valid date of birth." }, 400);
    }
    if (memberReason.length < 10) {
      return response(
        { error: "Explain why the recorded date of birth needs correction." },
        400,
      );
    }

    const ageSafety = await getAgeSafetyRecord(service, user.id);
    if (!ageSafety?.date_of_birth) {
      return response(
        { error: "Complete date-of-birth verification before requesting a correction." },
        409,
      );
    }
    if (ageSafety.date_of_birth === requestedDateOfBirth) {
      return response({ error: "That is already the recorded date of birth." }, 409);
    }

    const { data: existing } = await service
      .from("age_correction_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["pending", "reviewing"])
      .maybeSingle();

    if (existing) {
      return response(
        { error: "An age correction request is already under review.", requestId: existing.id },
        409,
      );
    }

    const { data, error } = await service
      .from("age_correction_requests")
      .insert({
        user_id: user.id,
        current_date_of_birth: ageSafety.date_of_birth,
        requested_date_of_birth: requestedDateOfBirth,
        member_reason: memberReason,
        status: "pending",
      })
      .select("id, status, created_at")
      .single();

    if (error) return response({ error: error.message }, 500);

    await service
      .from("profile_sensitive")
      .update({ age_state: "correction_pending", updated_at: new Date().toISOString() })
      .eq("id", user.id);

    return response({ ok: true, request: data }, 201);
  } catch {
    return response({ error: "Age Safety is not configured." }, 500);
  }
}
