import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH,
  PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT,
  type ProfessionalBookingIntakeAnswerInput,
  type ProfessionalBookingIntakeQuestion,
  type ProfessionalBookingIntakeSnapshotItem,
  type PublicProfessionalBookingIntakeResponse,
} from "@/lib/professional-booking-intake";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

type Row = Record<string, unknown>;
type Service = ReturnType<typeof createRoomServiceSupabase>;

export type ProfessionalBookingIntakeRequestViolation = {
  message: string;
  status: number;
  code: string;
};

export type ProfessionalBookingIntakeRequestState = {
  snapshot: ProfessionalBookingIntakeSnapshotItem[] | null;
  violation: ProfessionalBookingIntakeRequestViolation | null;
};

const INACTIVE_PUBLIC_INTAKE: PublicProfessionalBookingIntakeResponse = {
  active: false,
  questions: [],
};

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown) {
  const result = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)
    ? result
    : null;
}

function normalizeStoredQuestions(
  value: unknown,
): ProfessionalBookingIntakeQuestion[] | null {
  if (!Array.isArray(value) || value.length > PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT) {
    return null;
  }

  const questions: ProfessionalBookingIntakeQuestion[] = [];
  const ids = new Set<string>();

  for (const rawQuestion of value) {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) {
      return null;
    }

    const row = rawQuestion as Row;
    const id = text(row.id, 80);
    const label = text(row.label, 200);

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
    questions.push({
      id,
      label,
      required: row.required,
    });
  }

  return questions;
}

async function providerCanUseProfessionalBooking(
  service: Service,
  providerId: string,
) {
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", providerId)
    .maybeSingle();

  if (profileError) {
    console.error("Professional Booking intake provider lookup failed:", {
      providerId,
      error: profileError.message,
    });
    return false;
  }

  if (profile?.is_admin === true) return true;

  try {
    const subscription = await getResolvedGeneralSubscriptionForUser(providerId);

    return (
      subscription.isAdminOverride ||
      evaluateSubscriptionEntitlement(
        subscription.plan,
        "professional_booking",
      ).allowed
    );
  } catch (error) {
    console.error("Professional Booking intake entitlement resolution failed:", {
      providerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function resolveActiveService(
  service: Service,
  rawServiceId: unknown,
) {
  const serviceId = uuid(rawServiceId);
  if (!serviceId) return null;

  const { data, error } = await service
    .from("business_appointment_services")
    .select("id, business_id, owner_id")
    .eq("id", serviceId)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return null;

  const providerId = uuid(data.owner_id);
  const businessId = uuid(data.business_id);
  if (!providerId || !businessId) return null;

  return { serviceId, providerId, businessId };
}

async function loadCurrentQuestions(
  service: Service,
  serviceId: string,
  providerId: string,
) {
  const { data, error } = await service
    .from("professional_booking_intake_forms")
    .select("questions")
    .eq("service_id", serviceId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) {
    return { questions: null, error };
  }

  if (!data) return { questions: [] as ProfessionalBookingIntakeQuestion[], error: null };

  return {
    questions: normalizeStoredQuestions(data.questions),
    error: null,
  };
}

function parseAnswers(
  value: unknown,
): {
  answers: Map<string, string> | null;
  violation: ProfessionalBookingIntakeRequestViolation | null;
} {
  if (value === undefined || value === null) {
    return { answers: new Map(), violation: null };
  }

  if (!Array.isArray(value) || value.length > PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT) {
    return {
      answers: null,
      violation: {
        message: "Client intake answers are invalid.",
        status: 400,
        code: "invalid_professional_booking_intake_answers",
      },
    };
  }

  const answers = new Map<string, string>();

  for (const rawAnswer of value) {
    if (!rawAnswer || typeof rawAnswer !== "object" || Array.isArray(rawAnswer)) {
      return {
        answers: null,
        violation: {
          message: "Client intake answers are invalid.",
          status: 400,
          code: "invalid_professional_booking_intake_answers",
        },
      };
    }

    const row = rawAnswer as Row;
    const id = text(row.id, 80);
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || answers.has(id)) {
      return {
        answers: null,
        violation: {
          message: "Client intake answers are invalid.",
          status: 400,
          code: "invalid_professional_booking_intake_answers",
        },
      };
    }

    if (typeof row.answer !== "string") {
      return {
        answers: null,
        violation: {
          message: "Client intake answers are invalid.",
          status: 400,
          code: "invalid_professional_booking_intake_answers",
        },
      };
    }

    if (row.answer.length > PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH) {
      return {
        answers: null,
        violation: {
          message: `Client intake answers can be up to ${PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH} characters each.`,
          status: 400,
          code: "professional_booking_intake_answer_too_long",
        },
      };
    }

    answers.set(id, row.answer.trim());
  }

  return { answers, violation: null };
}

export async function getPublicProfessionalBookingIntake(
  businessSlug: string,
  rawServiceId: unknown,
): Promise<PublicProfessionalBookingIntakeResponse> {
  const slug = text(businessSlug, 120);
  if (!slug) return INACTIVE_PUBLIC_INTAKE;

  let service: Service;
  try {
    service = createRoomServiceSupabase();
  } catch {
    return INACTIVE_PUBLIC_INTAKE;
  }

  const appointmentService = await resolveActiveService(service, rawServiceId);
  if (!appointmentService) return INACTIVE_PUBLIC_INTAKE;

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("id")
    .eq("id", appointmentService.businessId)
    .eq("owner_id", appointmentService.providerId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (businessError || !business) return INACTIVE_PUBLIC_INTAKE;

  if (!(await providerCanUseProfessionalBooking(service, appointmentService.providerId))) {
    return INACTIVE_PUBLIC_INTAKE;
  }

  const form = await loadCurrentQuestions(
    service,
    appointmentService.serviceId,
    appointmentService.providerId,
  );

  if (form.error) {
    console.error("Professional Booking public intake lookup failed:", {
      providerId: appointmentService.providerId,
      serviceId: appointmentService.serviceId,
      error: form.error.message,
    });
    return INACTIVE_PUBLIC_INTAKE;
  }

  if (!form.questions || form.questions.length === 0) {
    return INACTIVE_PUBLIC_INTAKE;
  }

  return {
    active: true,
    questions: form.questions,
  };
}

export async function getProfessionalBookingIntakeRequestState(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingIntakeRequestState> {
  const inactive: ProfessionalBookingIntakeRequestState = {
    snapshot: null,
    violation: null,
  };

  const serviceId = uuid(input.serviceId);
  if (!serviceId) return inactive;

  let access;
  let service: Service;

  try {
    access = await verifyRequestAccountAccess(createRequestSupabase(request));
    service = createRoomServiceSupabase();
  } catch {
    return inactive;
  }

  if (!access.ok) return inactive;

  const appointmentService = await resolveActiveService(service, serviceId);
  if (!appointmentService || appointmentService.providerId === access.user.id) {
    return inactive;
  }

  if (!(await providerCanUseProfessionalBooking(service, appointmentService.providerId))) {
    return inactive;
  }

  const form = await loadCurrentQuestions(
    service,
    appointmentService.serviceId,
    appointmentService.providerId,
  );

  if (form.error) {
    console.error("Professional Booking request intake lookup failed:", {
      providerId: appointmentService.providerId,
      serviceId: appointmentService.serviceId,
      error: form.error.message,
    });

    return {
      snapshot: null,
      violation: {
        message:
          "This provider's client intake form could not be verified. Try the appointment request again.",
        status: 503,
        code: "professional_booking_intake_unavailable",
      },
    };
  }

  if (!form.questions || form.questions.length === 0) return inactive;

  const parsed = parseAnswers(input.intakeAnswers);
  if (parsed.violation || !parsed.answers) {
    return {
      snapshot: null,
      violation: parsed.violation,
    };
  }

  const snapshot: ProfessionalBookingIntakeSnapshotItem[] = [];

  for (const question of form.questions) {
    const answer = parsed.answers.get(question.id) ?? "";

    if (question.required && !answer) {
      return {
        snapshot: null,
        violation: {
          message: `Complete the required client intake question: ${question.label}`,
          status: 400,
          code: "professional_booking_intake_required",
        },
      };
    }

    snapshot.push({
      ...question,
      answer,
    });
  }

  return {
    snapshot,
    violation: null,
  };
}

export function professionalBookingIntakeAnswersForPayload(
  answers: Record<string, string>,
  questions: ProfessionalBookingIntakeQuestion[],
): ProfessionalBookingIntakeAnswerInput[] {
  return questions.map((question) => ({
    id: question.id,
    answer: answers[question.id] ?? "",
  }));
}
