import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function requireAdmin(request: NextRequest) {
  const auth = getAuthClient(request);
  const {
    data: { user },
    error,
  } = await auth.auth.getUser();

  if (error || !user) return { user: null, response: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };

  const { data: profile } = await auth
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return { user: null, response: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }

  return { user, response: null };
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.user) return admin.response!;

  let service;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const [{ data: corrections, error: correctionError }, { data: reports, error: reportError }] =
    await Promise.all([
      service
        .from("age_correction_requests")
        .select("id, user_id, current_age_band, requested_date_of_birth, requested_age_band, reason, status, reviewed_by, reviewed_at, resolution_note, created_at, updated_at")
        .order("created_at", { ascending: false }),
      service
        .from("underage_account_reports")
        .select("id, reporter_id, reported_user_id, reason, context, status, reviewed_by, reviewed_at, resolution_note, created_at, updated_at")
        .order("created_at", { ascending: false }),
    ]);

  if (correctionError || reportError) {
    return NextResponse.json(
      { error: correctionError?.message ?? reportError?.message ?? "Unable to load age-safety reviews." },
      { status: 500 }
    );
  }

  const profileIds = [
    ...(corrections ?? []).flatMap((row) => [row.user_id, row.reviewed_by]),
    ...(reports ?? []).flatMap((row) => [row.reporter_id, row.reported_user_id, row.reviewed_by]),
  ].filter((value): value is string => Boolean(value));

  const uniqueProfileIds = [...new Set(profileIds)];
  const { data: profiles } = uniqueProfileIds.length
    ? await service
        .from("profiles")
        .select("id, username, full_name, avatar_url, account_status")
        .in("id", uniqueProfileIds)
    : { data: [] };

  return NextResponse.json(
    { corrections: corrections ?? [], underageReports: reports ?? [], profiles: profiles ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin.user) return admin.response!;

  const body = await request.json().catch(() => null);
  const workflow = String(body?.workflow ?? "");
  const action = String(body?.action ?? "");
  const id = String(body?.id ?? "");
  const resolutionNote = String(body?.resolutionNote ?? "").trim();

  if (!UUID_PATTERN.test(id) || resolutionNote.length > 2000) {
    return NextResponse.json({ error: "Invalid review payload." }, { status: 400 });
  }

  let service;
  try {
    service = getServiceClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const now = new Date().toISOString();

  if (workflow === "correction") {
    const { data: correction } = await service
      .from("age_correction_requests")
      .select("id, user_id, requested_date_of_birth, requested_age_band, status")
      .eq("id", id)
      .maybeSingle();

    if (!correction) return NextResponse.json({ error: "Correction request not found." }, { status: 404 });

    if (action === "review") {
      await service
        .from("age_correction_requests")
        .update({ status: "reviewing", reviewed_by: admin.user.id, reviewed_at: now })
        .eq("id", id);
    } else if (action === "approve") {
      const { error: ageError } = await service
        .from("profile_sensitive")
        .update({ date_of_birth: correction.requested_date_of_birth })
        .eq("id", correction.user_id);

      if (ageError) return NextResponse.json({ error: ageError.message }, { status: 500 });

      await service
        .from("age_correction_requests")
        .update({
          status: "approved",
          reviewed_by: admin.user.id,
          reviewed_at: now,
          resolution_note: resolutionNote || null,
        })
        .eq("id", id);
    } else if (action === "deny") {
      await service
        .from("age_correction_requests")
        .update({
          status: "denied",
          reviewed_by: admin.user.id,
          reviewed_at: now,
          resolution_note: resolutionNote || null,
        })
        .eq("id", id);
    } else {
      return NextResponse.json({ error: "Unsupported correction action." }, { status: 400 });
    }

    await logAuditEvent({
      actor_id: admin.user.id,
      action: `age_correction.${action}`,
      target_type: "age_correction_request",
      target_id: id,
      metadata: { requested_age_band: correction.requested_age_band },
    });

    await createNotification({
      user_id: correction.user_id,
      actor_id: admin.user.id,
      type: "age_correction_status",
      target_type: "age_correction_request",
      target_id: id,
      message:
        action === "approve"
          ? "Your age correction was approved. Teen protections and privacy defaults were recalculated without making your account public."
          : action === "deny"
            ? "Your age correction was reviewed and was not approved."
            : "Your age correction is under review.",
    });

    return NextResponse.json({ ok: true, status: action === "review" ? "reviewing" : action === "approve" ? "approved" : "denied" });
  }

  if (workflow === "underage_report") {
    const status = action === "review" ? "reviewing" : action === "actioned" ? "actioned" : action === "dismiss" ? "dismissed" : null;
    if (!status) return NextResponse.json({ error: "Unsupported report action." }, { status: 400 });

    const { data: report } = await service
      .from("underage_account_reports")
      .select("id, reporter_id, reported_user_id")
      .eq("id", id)
      .maybeSingle();

    if (!report) return NextResponse.json({ error: "Underage-account report not found." }, { status: 404 });

    await service
      .from("underage_account_reports")
      .update({
        status,
        reviewed_by: admin.user.id,
        reviewed_at: now,
        resolution_note: resolutionNote || null,
      })
      .eq("id", id);

    await logAuditEvent({
      actor_id: admin.user.id,
      action: `underage_account_report.${status}`,
      target_type: "underage_account_report",
      target_id: id,
      metadata: { reported_user_id: report.reported_user_id },
    });

    await createNotification({
      user_id: report.reporter_id,
      actor_id: admin.user.id,
      type: "underage_account_report_status",
      target_type: "underage_account_report",
      target_id: id,
      message:
        status === "reviewing"
          ? "Your underage-account report is under review."
          : "Your underage-account report was reviewed. Privacy limits what Loombus can disclose about another account.",
    });

    return NextResponse.json({ ok: true, status });
  }

  return NextResponse.json({ error: "Unsupported age-safety workflow." }, { status: 400 });
}
