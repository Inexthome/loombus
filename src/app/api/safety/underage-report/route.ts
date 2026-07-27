import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminNotifications } from "@/lib/notifications";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

function response(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function clients(request: NextRequest) {
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

export async function POST(request: NextRequest) {
  try {
    const { requestClient, service } = clients(request);
    const { data, error } = await requestClient.auth.getUser();
    if (error || !data.user) return response({ error: "Unauthorized." }, 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "Invalid underage-account report." }, 400);
    }

    const input = body as Record<string, unknown>;
    const providedId = String(input.reportedUserId ?? "").trim();
    const username = String(input.reportedUsername ?? "")
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();
    const details = String(input.details ?? "").trim().slice(0, 2000);

    if (details.length < 10) {
      return response(
        { error: "Provide enough context for Loombus to review the account safely." },
        400,
      );
    }

    let targetQuery = service.from("profiles").select("id, username");
    if (UUID_PATTERN.test(providedId)) {
      targetQuery = targetQuery.eq("id", providedId);
    } else if (USERNAME_PATTERN.test(username)) {
      targetQuery = targetQuery.eq("username", username);
    } else {
      return response({ error: "Enter a valid Loombus username or member ID." }, 400);
    }

    const { data: target } = await targetQuery.maybeSingle();
    if (!target) return response({ error: "Member account not found." }, 404);
    const reportedUserId = target.id;
    if (reportedUserId === data.user.id) {
      return response({ error: "Use Age Safety to correct your own age information." }, 400);
    }

    const { data: existing } = await service
      .from("underage_account_reports")
      .select("id, status")
      .eq("reporter_id", data.user.id)
      .eq("reported_user_id", reportedUserId)
      .in("status", ["new", "reviewing"])
      .maybeSingle();

    if (existing) {
      return response(
        { ok: true, reportId: existing.id, alreadyReported: true },
        200,
      );
    }

    const { data: report, error: insertError } = await service
      .from("underage_account_reports")
      .insert({
        reporter_id: data.user.id,
        reported_user_id: reportedUserId,
        details,
        status: "new",
      })
      .select("id, created_at")
      .single();

    if (insertError) return response({ error: "Unable to submit this report." }, 500);

    await createAdminNotifications({
      actor_id: data.user.id,
      type: "underage_account_report",
      target_type: "profile",
      target_id: reportedUserId,
      message: "A possible underage account needs Teen Safety review.",
    }).catch(() => null);

    return response({ ok: true, reportId: report.id }, 201);
  } catch {
    return response({ error: "Teen Safety reporting is not configured." }, 500);
  }
}
