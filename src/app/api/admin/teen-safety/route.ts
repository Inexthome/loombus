import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { logAuditEvent } from "@/lib/audit-log";
import { createNotification } from "@/lib/notifications";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MINIMUM_AGE_REASON = "Account does not meet the Loombus minimum age";

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

async function requireAdmin(request: NextRequest) {
  const clients = getClients(request);
  const { data, error } = await clients.requestClient.auth.getUser();
  if (error || !data.user) return { ...clients, user: null };

  const { data: profile } = await clients.service
    .from("profiles")
    .select("id, is_admin, account_status")
    .eq("id", data.user.id)
    .maybeSingle();

  return {
    ...clients,
    user: profile?.is_admin ? data.user : null,
  };
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function loadProfileMap(service: ReturnType<typeof createClient>, ids: string[]) {
  const userIds = [...new Set(ids.filter(Boolean))];
  if (!userIds.length) return {};
  const [{ data: profiles }, { data: sensitive }] = await Promise.all([
    service
      .from("profiles")
      .select("id, full_name, username, avatar_url, account_status, enforcement_reason")
      .in("id", userIds),
    service
      .from("profile_sensitive")
      .select("id, age_band, age_state, teen_safety_mode, guardian_required, turns_18_at")
      .in("id", userIds),
  ]);

  const sensitiveMap = new Map((sensitive ?? []).map((row) => [row.id, row]));
  return Object.fromEntries(
    (profiles ?? []).map((profile) => [
      profile.id,
      { ...profile, ageSafety: sensitiveMap.get(profile.id) ?? null },
    ]),
  );
}

export async function GET(request: NextRequest) {
  try {
    const { service, user } = await requireAdmin(request);
    if (!user) return response({ error: "Admin access required." }, 403);

    const [correctionsResult, underageResult, reviewResult] = await Promise.all([
      service
        .from("age_correction_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
      service
        .from("underage_account_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
      service
        .from("teen_safety_review_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    const firstError =
      correctionsResult.error ?? underageResult.error ?? reviewResult.error;
    if (firstError) return response({ error: firstError.message }, 500);

    const corrections = correctionsResult.data ?? [];
    const underageReports = underageResult.data ?? [];
    const reviewItems = reviewResult.data ?? [];
    const profileIds = [
      ...corrections.flatMap((row) => [row.user_id, row.reviewed_by]),
      ...underageReports.flatMap((row) => [
        row.reporter_id,
        row.reported_user_id,
        row.reviewed_by,
      ]),
      ...reviewItems.flatMap((row) => [row.user_id, row.reviewed_by]),
    ].filter((id): id is string => Boolean(id));

    return response({
      generatedAt: new Date().toISOString(),
      currentAdminId: user.id,
      corrections,
      underageReports,
      reviewItems,
      profiles: await loadProfileMap(service, profileIds),
    });
  } catch {
    return response({ error: "Teen Safety review is not configured." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { service, user } = await requireAdmin(request);
    if (!user) return response({ error: "Admin access required." }, 403);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return response({ error: "Invalid Teen Safety action." }, 400);
    }

    const input = body as Record<string, unknown>;
    const action = cleanText(input.action, 80);
    const recordId = cleanText(input.recordId, 80);
    const note = cleanText(input.note, 4000);
    if (!UUID_PATTERN.test(recordId)) {
      return response({ error: "Invalid Teen Safety record." }, 400);
    }

    const now = new Date().toISOString();

    if (["start_correction", "approve_correction", "deny_correction"].includes(action)) {
      const { data: correction } = await service
        .from("age_correction_requests")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!correction) return response({ error: "Age correction request not found." }, 404);

      if (action === "start_correction") {
        const { error } = await service
          .from("age_correction_requests")
          .update({ status: "reviewing", reviewed_by: user.id, updated_at: now })
          .eq("id", recordId)
          .in("status", ["pending", "reviewing"]);
        if (error) return response({ error: error.message }, 500);
      } else if (action === "deny_correction") {
        if (note.length < 5) return response({ error: "Add a decision note." }, 400);
        const { error } = await service
          .from("age_correction_requests")
          .update({
            status: "denied",
            reviewed_by: user.id,
            reviewed_at: now,
            decision_note: note,
            updated_at: now,
          })
          .eq("id", recordId)
          .in("status", ["pending", "reviewing"]);
        if (error) return response({ error: error.message }, 500);

        const { data: sensitive } = await service
          .from("profile_sensitive")
          .select("age_band")
          .eq("id", correction.user_id)
          .maybeSingle();
        await service
          .from("profile_sensitive")
          .update({
            age_state: sensitive?.age_band === "teen" ? "teen" : "adult",
            updated_at: now,
          })
          .eq("id", correction.user_id);
      } else {
        if (note.length < 5) return response({ error: "Add an approval note." }, 400);
        const requestedDob = String(correction.requested_date_of_birth ?? "");
        const nextBand = getAgeBandFromDateOfBirth(requestedDob);
        if (!nextBand) return response({ error: "The requested date is invalid." }, 400);

        const { error: ageError } = await service
          .from("profile_sensitive")
          .update({
            date_of_birth: requestedDob,
            age_last_confirmed_at: now,
            updated_at: now,
          })
          .eq("id", correction.user_id);
        if (ageError) return response({ error: ageError.message }, 500);

        if (nextBand === "under_13") {
          await service
            .from("profiles")
            .update({
              account_status: "deactivated",
              enforcement_reason: MINIMUM_AGE_REASON,
              enforcement_note: "Confirmed through approved age correction review.",
              enforced_at: now,
              suspended_until: null,
            })
            .eq("id", correction.user_id);
        } else {
          const { data: targetProfile } = await service
            .from("profiles")
            .select("account_status, enforcement_reason")
            .eq("id", correction.user_id)
            .maybeSingle();
          if (
            targetProfile?.account_status === "deactivated" &&
            targetProfile?.enforcement_reason === MINIMUM_AGE_REASON
          ) {
            await service
              .from("profiles")
              .update({
                account_status: "active",
                enforcement_reason: null,
                enforcement_note: null,
                enforced_at: now,
                suspended_until: null,
              })
              .eq("id", correction.user_id);
          }
        }

        const { error } = await service
          .from("age_correction_requests")
          .update({
            status: "approved",
            reviewed_by: user.id,
            reviewed_at: now,
            decision_note: note,
            updated_at: now,
          })
          .eq("id", recordId)
          .in("status", ["pending", "reviewing"]);
        if (error) return response({ error: error.message }, 500);

        await createNotification({
          user_id: correction.user_id,
          actor_id: user.id,
          type: "age_correction_decided",
          target_type: "age_correction",
          target_id: correction.id,
          message:
            nextBand === "under_13"
              ? "Your Age Safety review is complete. This account does not meet the Loombus minimum age."
              : "Your date-of-birth correction was approved.",
        }).catch(() => null);
      }

      await logAuditEvent({
        actor_id: user.id,
        action: `teen_safety.${action}`,
        target_type: "age_correction",
        target_id: recordId,
        metadata: { subject_user_id: correction.user_id },
      });
      return response({ ok: true });
    }

    if (["start_underage", "confirm_underage", "dismiss_underage"].includes(action)) {
      const { data: report } = await service
        .from("underage_account_reports")
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      if (!report) return response({ error: "Underage-account report not found." }, 404);

      if (action === "start_underage") {
        await service
          .from("underage_account_reports")
          .update({ status: "reviewing", reviewed_by: user.id, updated_at: now })
          .eq("id", recordId)
          .in("status", ["new", "reviewing"]);
      } else {
        if (note.length < 5) return response({ error: "Add a resolution note." }, 400);
        const confirmed = action === "confirm_underage";
        const { error } = await service
          .from("underage_account_reports")
          .update({
            status: confirmed ? "confirmed" : "not_confirmed",
            reviewed_by: user.id,
            reviewed_at: now,
            resolution_note: note,
            updated_at: now,
          })
          .eq("id", recordId)
          .in("status", ["new", "reviewing"]);
        if (error) return response({ error: error.message }, 500);

        if (confirmed) {
          await service.from("profile_sensitive").upsert({
            id: report.reported_user_id,
            age_band: "under_13",
            age_state: "ineligible",
            teen_safety_mode: true,
            guardian_required: true,
            updated_at: now,
          });
          await service
            .from("profiles")
            .update({
              account_status: "deactivated",
              enforcement_reason: MINIMUM_AGE_REASON,
              enforcement_note: "Confirmed through underage-account safety review.",
              enforced_at: now,
              suspended_until: null,
            })
            .eq("id", report.reported_user_id);
        }
      }

      await logAuditEvent({
        actor_id: user.id,
        action: `teen_safety.${action}`,
        target_type: "underage_account_report",
        target_id: recordId,
        metadata: { subject_user_id: report.reported_user_id },
      });
      return response({ ok: true });
    }

    if (["resolve_review_item", "dismiss_review_item"].includes(action)) {
      if (note.length < 5) return response({ error: "Add a resolution note." }, 400);
      const { data, error } = await service
        .from("teen_safety_review_items")
        .update({
          status: action === "resolve_review_item" ? "resolved" : "dismissed",
          reviewed_by: user.id,
          reviewed_at: now,
          resolution_note: note,
          updated_at: now,
        })
        .eq("id", recordId)
        .in("status", ["open", "reviewing"])
        .select("id, user_id")
        .maybeSingle();
      if (error) return response({ error: error.message }, 500);
      if (!data) return response({ error: "Review item not found." }, 404);
      await logAuditEvent({
        actor_id: user.id,
        action: `teen_safety.${action}`,
        target_type: "teen_safety_review_item",
        target_id: recordId,
        metadata: { subject_user_id: data.user_id },
      });
      return response({ ok: true });
    }

    return response({ error: "Unsupported Teen Safety action." }, 400);
  } catch (error) {
    console.error("Teen Safety Admin action failed:", error);
    return response({ error: "Teen Safety review is not configured." }, 500);
  }
}
