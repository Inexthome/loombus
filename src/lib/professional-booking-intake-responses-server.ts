import "server-only";

import type { NextRequest } from "next/server";
import {
  PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH,
  PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT,
  type ProfessionalBookingIntakeSnapshotItem,
} from "@/lib/professional-booking-intake";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";

type Row = Record<string, unknown>;

export type ProfessionalBookingIntakeResponseRecord = {
  requestId: string;
  serviceId: string;
  serviceName: string;
  requesterId: string;
  requesterName: string;
  requestedStart: string;
  timezone: string;
  status: string;
  note: string | null;
  createdAt: string;
  intake: ProfessionalBookingIntakeSnapshotItem[];
};

export class ProfessionalBookingIntakeResponsesError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_intake_responses_error",
  ) {
    super(message);
  }
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeSnapshot(value: unknown): ProfessionalBookingIntakeSnapshotItem[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT
  ) {
    return null;
  }

  const result: ProfessionalBookingIntakeSnapshotItem[] = [];
  const ids = new Set<string>();

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
      return null;
    }

    const row = rawItem as Row;
    const id = text(row.id, 80);
    const label = text(row.label, 200);
    const answer = text(
      row.answer,
      PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH,
    );

    if (
      !id ||
      !/^[A-Za-z0-9_-]+$/.test(id) ||
      ids.has(id) ||
      label.length < 3 ||
      typeof row.required !== "boolean"
    ) {
      return null;
    }

    ids.add(id);
    result.push({
      id,
      label,
      required: row.required,
      answer,
    });
  }

  return result;
}

export async function getProfessionalBookingIntakeResponses(
  request: NextRequest,
) {
  const access = await verifyRequestAccountAccess(
    createRequestSupabase(request),
  );

  if (!access.ok) {
    throw new ProfessionalBookingIntakeResponsesError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  const service = createRoomServiceSupabase();
  const { data: requestRows, error } = await service
    .from("business_appointment_requests")
    .select(
      "id, service_id, requester_id, requested_start, timezone, status, note, professional_booking_intake_snapshot, created_at",
    )
    .eq("provider_id", access.user.id)
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) {
    if (
      /professional_booking_intake_snapshot|schema cache/i.test(
        error.message ?? "",
      )
    ) {
      throw new ProfessionalBookingIntakeResponsesError(
        "The Professional Booking intake-response migration has not been applied.",
        503,
        "professional_booking_intake_schema_unavailable",
      );
    }

    throw new ProfessionalBookingIntakeResponsesError(
      "Unable to load Professional Booking client intake responses.",
      503,
      "professional_booking_intake_responses_unavailable",
    );
  }

  const rows = ((requestRows ?? []) as Row[])
    .map((row) => ({
      row,
      intake: normalizeSnapshot(row.professional_booking_intake_snapshot),
    }))
    .filter(
      (
        item,
      ): item is { row: Row; intake: ProfessionalBookingIntakeSnapshotItem[] } =>
        Boolean(item.intake),
    );

  const serviceIds = [
    ...new Set(rows.map(({ row }) => text(row.service_id, 60)).filter(Boolean)),
  ];
  const requesterIds = [
    ...new Set(rows.map(({ row }) => text(row.requester_id, 60)).filter(Boolean)),
  ];

  const [servicesResult, profilesResult] = await Promise.all([
    serviceIds.length
      ? service
          .from("business_appointment_services")
          .select("id, name")
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    requesterIds.length
      ? service
          .from("profiles")
          .select("id, full_name, username")
          .in("id", requesterIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (servicesResult.error || profilesResult.error) {
    throw new ProfessionalBookingIntakeResponsesError(
      "Unable to load Professional Booking client intake response details.",
      503,
      "professional_booking_intake_response_details_unavailable",
    );
  }

  const services = new Map<string, Row>(
    ((servicesResult.data ?? []) as Row[]).map((row) => [text(row.id, 60), row]),
  );
  const profiles = new Map<string, Row>(
    ((profilesResult.data ?? []) as Row[]).map((row) => [text(row.id, 60), row]),
  );

  const responses: ProfessionalBookingIntakeResponseRecord[] = rows.map(
    ({ row, intake }) => {
      const serviceId = text(row.service_id, 60);
      const requesterId = text(row.requester_id, 60);
      const appointmentService = services.get(serviceId);
      const requester = profiles.get(requesterId);

      return {
        requestId: text(row.id, 60),
        serviceId,
        serviceName: text(appointmentService?.name, 200) || "Appointment",
        requesterId,
        requesterName:
          text(requester?.full_name, 200) ||
          text(requester?.username, 100) ||
          "Loombus member",
        requestedStart: String(row.requested_start),
        timezone: text(row.timezone, 100) || "UTC",
        status: text(row.status, 40),
        note: text(row.note, 3000) || null,
        createdAt: String(row.created_at),
        intake,
      };
    },
  );

  return { responses };
}
