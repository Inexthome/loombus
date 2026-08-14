import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT,
  type ProfessionalBookingIntakeQuestion,
  type ProfessionalBookingIntakeResponse,
  type ProfessionalBookingIntakeService,
} from "@/lib/professional-booking-intake";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import {
  evaluateSubscriptionEntitlement,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import { getMemberAgeSafety } from "@/lib/teen-safety-server";

type Row = Record<string, unknown>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

export class ProfessionalBookingIntakeError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_intake_error",
  ) {
    super(message);
  }
}

function cleanText(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown) {
  const result = cleanText(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)
    ? result
    : null;
}

function normalizeStoredQuestions(value: unknown): ProfessionalBookingIntakeQuestion[] {
  if (!Array.isArray(value)) return [];

  const questions: ProfessionalBookingIntakeQuestion[] = [];
  const ids = new Set<string>();

  for (const rawQuestion of value.slice(0, PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT)) {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      continue;
    }

    const row = rawQuestion as Row;
    const id = cleanText(row.id, 80);
    const label = cleanText(row.label, 200);

    if (!id || !label || ids.has(id)) continue;

    ids.add(id);
    questions.push({
      id,
      label,
      required: row.required === true,
    });
  }

  return questions;
}

function validateQuestions(input: unknown): ProfessionalBookingIntakeQuestion[] {
  if (!Array.isArray(input)) {
    throw new ProfessionalBookingIntakeError(
      "Client intake questions must be a list.",
      400,
      "invalid_professional_booking_intake_questions",
    );
  }

  if (input.length > PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT) {
    throw new ProfessionalBookingIntakeError(
      `Professional Booking supports up to ${PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT} client intake questions per service.`,
      400,
      "professional_booking_intake_question_limit",
    );
  }

  const ids = new Set<string>();

  return input.map((rawQuestion, index) => {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      throw new ProfessionalBookingIntakeError(
        `Client intake question ${index + 1} is invalid.`,
        400,
        "invalid_professional_booking_intake_question",
      );
    }

    const row = rawQuestion as Row;
    const id = cleanText(row.id, 80);
    const label = cleanText(row.label, 200);

    if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || ids.has(id)) {
      throw new ProfessionalBookingIntakeError(
        `Client intake question ${index + 1} has an invalid identifier.`,
        400,
        "invalid_professional_booking_intake_question_id",
      );
    }

    if (label.length < 3) {
      throw new ProfessionalBookingIntakeError(
        `Client intake question ${index + 1} must be at least 3 characters.`,
        400,
        "invalid_professional_booking_intake_question_label",
      );
    }

    if (typeof row.required !== "boolean") {
      throw new ProfessionalBookingIntakeError(
        `Client intake question ${index + 1} must specify whether it is required.`,
        400,
        "invalid_professional_booking_intake_question_required",
      );
    }

    ids.add(id);
    return { id, label, required: row.required };
  });
}

async function resolveViewer(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new ProfessionalBookingIntakeError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }

  return {
    userId: access.user.id,
    isAdmin: access.profile.is_admin === true,
    service: createRoomServiceSupabase(),
  };
}

async function requireAdultProvider(service: Service, userId: string) {
  const ageSafety = await getMemberAgeSafety(service, userId);

  if (!ageSafety.lookupAvailable) {
    throw new ProfessionalBookingIntakeError(
      "Loombus could not verify age-safety eligibility. Try again later.",
      503,
      "age_safety_unavailable",
    );
  }

  if (ageSafety.ageBand === "under_13" || ageSafety.guardianRequired) {
    throw new ProfessionalBookingIntakeError(
      "This account is not eligible to use Loombus.",
      403,
      "under_13_not_allowed",
    );
  }

  if (ageSafety.ageBand === "unknown") {
    throw new ProfessionalBookingIntakeError(
      "Complete age safety before configuring Professional Booking.",
      403,
      "age_gate_required",
    );
  }

  if (ageSafety.ageBand === "teen") {
    throw new ProfessionalBookingIntakeError(
      "Professional Booking configuration is currently limited to adult accounts while Loombus verifies teen-safe commercial controls.",
      403,
      "teen_action_restricted",
    );
  }
}

type ProfessionalBookingAccess = {
  plan: SubscriptionPlanId;
  allowed: boolean;
  resolutionAvailable: boolean;
};

async function resolveProfessionalBookingAccess(
  userId: string,
  isAdmin: boolean,
): Promise<ProfessionalBookingAccess> {
  if (isAdmin) {
    return {
      plan: "free",
      allowed: true,
      resolutionAvailable: true,
    };
  }

  try {
    const subscription = await getResolvedGeneralSubscriptionForUser(userId);

    return {
      plan: subscription.plan,
      allowed:
        subscription.isAdminOverride ||
        evaluateSubscriptionEntitlement(
          subscription.plan,
          "professional_booking",
        ).allowed,
      resolutionAvailable: true,
    };
  } catch (error) {
    console.error("Professional Booking intake subscription resolution failed:", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      plan: "free",
      allowed: false,
      resolutionAvailable: false,
    };
  }
}

async function requireOwnedService(
  service: Service,
  serviceId: string,
  providerId: string,
): Promise<ProfessionalBookingIntakeService> {
  const { data: appointmentService, error } = await service
    .from("business_appointment_services")
    .select("id, business_id, name, status")
    .eq("id", serviceId)
    .eq("owner_id", providerId)
    .maybeSingle();

  if (error) {
    throw new ProfessionalBookingIntakeError(
      "Unable to verify the appointment service.",
      503,
      "professional_booking_intake_service_unavailable",
    );
  }

  if (!appointmentService) {
    throw new ProfessionalBookingIntakeError(
      "Appointment service not found.",
      404,
      "professional_booking_intake_service_not_found",
    );
  }

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("name")
    .eq("id", appointmentService.business_id)
    .eq("owner_id", providerId)
    .maybeSingle();

  if (businessError || !business) {
    throw new ProfessionalBookingIntakeError(
      "Unable to verify the appointment service business.",
      businessError ? 503 : 404,
      "professional_booking_intake_business_unavailable",
    );
  }

  const status = cleanText(appointmentService.status, 30);
  if (!["active", "paused", "archived"].includes(status)) {
    throw new ProfessionalBookingIntakeError(
      "Appointment service status is invalid.",
      409,
      "professional_booking_intake_service_invalid",
    );
  }

  return {
    id: String(appointmentService.id),
    name: cleanText(appointmentService.name, 200) || "Appointment service",
    businessName: cleanText(business.name, 200) || "Business",
    status: status as ProfessionalBookingIntakeService["status"],
  };
}

function throwFormReadError(error: { message?: string } | null) {
  if (
    error &&
    /professional_booking_intake_forms|schema cache/i.test(error.message ?? "")
  ) {
    throw new ProfessionalBookingIntakeError(
      "The Professional Booking intake migration has not been applied.",
      503,
      "professional_booking_intake_schema_unavailable",
    );
  }

  throw new ProfessionalBookingIntakeError(
    "Unable to load the Professional Booking client intake form.",
    503,
    "professional_booking_intake_unavailable",
  );
}

async function buildResponse(
  viewer: Awaited<ReturnType<typeof resolveViewer>>,
  serviceId: string,
): Promise<ProfessionalBookingIntakeResponse> {
  const appointmentService = await requireOwnedService(
    viewer.service,
    serviceId,
    viewer.userId,
  );

  const [access, formResult] = await Promise.all([
    resolveProfessionalBookingAccess(viewer.userId, viewer.isAdmin),
    viewer.service
      .from("professional_booking_intake_forms")
      .select("questions")
      .eq("service_id", serviceId)
      .eq("provider_id", viewer.userId)
      .maybeSingle(),
  ]);

  if (formResult.error) throwFormReadError(formResult.error);

  return {
    subscriptionPlan: access.plan,
    canUseProfessionalBooking: access.allowed,
    subscriptionResolutionAvailable: access.resolutionAvailable,
    hasSavedForm: Boolean(formResult.data),
    service: appointmentService,
    questions: normalizeStoredQuestions(formResult.data?.questions),
  };
}

export async function getProfessionalBookingIntakeForm(
  request: NextRequest,
  rawServiceId: unknown,
): Promise<ProfessionalBookingIntakeResponse> {
  const serviceId = uuid(rawServiceId);
  if (!serviceId) {
    throw new ProfessionalBookingIntakeError(
      "Choose a valid appointment service.",
      400,
      "professional_booking_intake_service_required",
    );
  }

  const viewer = await resolveViewer(request);
  return buildResponse(viewer, serviceId);
}

export async function saveProfessionalBookingIntakeForm(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingIntakeResponse> {
  const serviceId = uuid(input.serviceId);
  if (!serviceId) {
    throw new ProfessionalBookingIntakeError(
      "Choose a valid appointment service.",
      400,
      "professional_booking_intake_service_required",
    );
  }

  const viewer = await resolveViewer(request);
  await requireAdultProvider(viewer.service, viewer.userId);

  const appointmentService = await requireOwnedService(
    viewer.service,
    serviceId,
    viewer.userId,
  );

  if (appointmentService.status === "archived") {
    throw new ProfessionalBookingIntakeError(
      "Archived appointment services cannot change client intake forms.",
      409,
      "professional_booking_intake_service_archived",
    );
  }

  const access = await resolveProfessionalBookingAccess(
    viewer.userId,
    viewer.isAdmin,
  );

  if (!access.resolutionAvailable) {
    throw new ProfessionalBookingIntakeError(
      "Unable to verify Premium Pro Professional Booking access.",
      503,
      "professional_booking_access_unavailable",
    );
  }

  if (!access.allowed) {
    throw new ProfessionalBookingIntakeError(
      "Premium Pro is required to configure Professional Booking client intake forms.",
      403,
      "professional_booking_required",
    );
  }

  const questions = validateQuestions(input.questions);

  if (questions.length === 0) {
    const { error } = await viewer.service
      .from("professional_booking_intake_forms")
      .delete()
      .eq("service_id", serviceId)
      .eq("provider_id", viewer.userId);

    if (error) {
      if (/professional_booking_intake_forms|schema cache/i.test(error.message ?? "")) {
        throwFormReadError(error);
      }
      throw new ProfessionalBookingIntakeError(
        "Unable to clear the Professional Booking client intake form.",
        503,
        "professional_booking_intake_save_failed",
      );
    }
  } else {
    const now = new Date().toISOString();
    const { error } = await viewer.service
      .from("professional_booking_intake_forms")
      .upsert(
        {
          service_id: serviceId,
          provider_id: viewer.userId,
          questions,
          updated_at: now,
        },
        { onConflict: "service_id" },
      );

    if (error) {
      if (/professional_booking_intake_forms|schema cache/i.test(error.message ?? "")) {
        throwFormReadError(error);
      }
      throw new ProfessionalBookingIntakeError(
        "Unable to save the Professional Booking client intake form.",
        503,
        "professional_booking_intake_save_failed",
      );
    }
  }

  return buildResponse(viewer, serviceId);
}
