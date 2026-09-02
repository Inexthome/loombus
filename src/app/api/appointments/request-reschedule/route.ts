import { NextResponse, type NextRequest } from "next/server";
import { createNotification } from "@/lib/notifications";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(request: NextRequest) {
  try {
    const account = await verifyRequestAccountAccess(createRequestSupabase(request));
    if (!account.ok) {
      return json({ error: account.error, code: account.code }, account.status);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid reschedule request.", code: "invalid_payload" }, 400);
    }

    const input = body as Row;
    const requestId = text(input.requestId, 60);
    const proposedStartRaw = text(input.proposedStart, 100);
    if (!validUuid(requestId)) {
      return json({ error: "Invalid appointment request id.", code: "invalid_request_id" }, 400);
    }

    const proposedStartDate = new Date(proposedStartRaw);
    if (!proposedStartRaw || !Number.isFinite(proposedStartDate.getTime())) {
      return json({ error: "Choose a valid proposed appointment time.", code: "invalid_proposed_start" }, 400);
    }
    if (proposedStartDate.getTime() < Date.now() + 30 * 60_000) {
      return json(
        { error: "Choose a proposed time at least 30 minutes in the future.", code: "appointment_too_soon" },
        400,
      );
    }

    const service = createRoomServiceSupabase();
    const { data: appointment, error: appointmentError } = await service
      .from("business_appointment_requests")
      .select("id, provider_id, requester_id, requested_start, requested_end, status")
      .eq("id", requestId)
      .eq("requester_id", account.user.id)
      .maybeSingle();

    if (appointmentError) {
      return json({ error: "Unable to verify the appointment.", code: "appointment_access_unavailable" }, 503);
    }
    if (!appointment) {
      return json({ error: "Appointment request not found.", code: "appointment_not_found" }, 404);
    }
    if (appointment.status !== "accepted") {
      return json(
        { error: "Only an accepted appointment can be rescheduled by the customer.", code: "appointment_accepted_required" },
        409,
      );
    }

    const currentStart = new Date(String(appointment.requested_start)).getTime();
    const currentEnd = new Date(String(appointment.requested_end)).getTime();
    const durationMs = currentEnd - currentStart;
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return json({ error: "The appointment schedule is invalid.", code: "appointment_schedule_invalid" }, 409);
    }

    const proposedStart = proposedStartDate.toISOString();
    const proposedEnd = new Date(proposedStartDate.getTime() + durationMs).toISOString();
    const { data: updated, error: updateError } = await service
      .from("business_appointment_requests")
      .update({
        status: "pending",
        requested_start: proposedStart,
        requested_end: proposedEnd,
        proposed_start: null,
        proposed_end: null,
        acted_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .eq("requester_id", account.user.id)
      .eq("status", "accepted")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return json({ error: "Unable to request a new appointment time.", code: "appointment_reschedule_failed" }, 503);
    }
    if (!updated) {
      return json(
        {
          error: "This appointment changed before the reschedule request was saved. Refresh and review its current status.",
          code: "appointment_status_changed",
        },
        409,
      );
    }

    await createNotification({
      user_id: String(appointment.provider_id),
      actor_id: account.user.id,
      type: "appointment_status",
      target_type: "appointment_request",
      target_id: requestId,
      message: "A customer requested a new appointment time.",
    });

    return json({
      updated: true,
      status: "pending",
      requestedStart: proposedStart,
      requestedEnd: proposedEnd,
    });
  } catch (error) {
    console.error("Appointment requester reschedule failed:", error);
    return json(
      { error: "Unable to request a new appointment time.", code: "appointment_reschedule_failed" },
      500,
    );
  }
}
