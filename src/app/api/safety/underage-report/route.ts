import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { createAdminNotifications } from "@/lib/notifications";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASONS = new Set([
  "appears_under_13",
  "self_disclosed_under_13",
  "guardian_report",
  "other",
]);

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
  const reportedUserId = String(body?.reportedUserId ?? "").trim();
  const reason = String(body?.reason ?? "").trim();
  const context = String(body?.context ?? "").trim();

  if (!UUID_PATTERN.test(reportedUserId) || reportedUserId === user.id) {
    return NextResponse.json({ error: "Choose another valid member account." }, { status: 400 });
  }

  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Choose a valid underage-account reason." }, { status: 400 });
  }

  if (context.length > 2000) {
    return NextResponse.json({ error: "Context is limited to 2,000 characters." }, { status: 400 });
  }

  let service;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { data: target } = await service
    .from("profiles")
    .select("id")
    .eq("id", reportedUserId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const { data: report, error: insertError } = await service
    .from("underage_account_reports")
    .insert({
      reporter_id: user.id,
      reported_user_id: reportedUserId,
      reason,
      context: context || null,
    })
    .select("id, status, created_at")
    .single();

  if (insertError) {
    const duplicate = insertError.code === "23505";
    return NextResponse.json(
      {
        error: duplicate
          ? "You already have an open underage-account report for this member."
          : "Unable to submit the underage-account report.",
      },
      { status: duplicate ? 409 : 500 }
    );
  }

  await logAuditEvent({
    actor_id: user.id,
    action: "underage_account_report.submitted",
    target_type: "underage_account_report",
    target_id: report.id,
    metadata: { reported_user_id: reportedUserId, reason },
  });

  await createAdminNotifications({
    actor_id: user.id,
    type: "underage_account_report",
    target_type: "underage_account_report",
    target_id: report.id,
    message: "A member submitted an underage-account safety report.",
  });

  return NextResponse.json(
    { report },
    { status: 201, headers: { "Cache-Control": "private, no-store" } }
  );
}
