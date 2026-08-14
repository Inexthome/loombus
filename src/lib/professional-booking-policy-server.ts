import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS,
  PROFESSIONAL_BOOKING_POLICY_TEXT_MAX,
  type ProfessionalBookingPolicy,
  type ProfessionalBookingPolicyResponse,
  type ProfessionalBookingPolicyService,
} from "@/lib/professional-booking-policy";
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

type Service = ReturnType<typeof createRoomServiceSupabase>;

export class ProfessionalBookingPolicyError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_policy_error",
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

function normalizeStoredPolicy(value: {
  policy_text?: unknown;
  cancellation_notice_hours?: unknown;
} | null | undefined): ProfessionalBookingPolicy {
  const rawHours = value?.cancellation_notice_hours;
  const cancellationNoticeHours =
    typeof rawHours === "number" &&
    Number.isInteger(rawHours) &&
    rawHours >= 0 &&
    rawHours <= PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS
      ? rawHours
      : 0;

  return {
    policyText: cleanText(value?.policy_text, PROFESSIONAL_BOOKING_POLICY_TEXT_MAX),
    cancellationNoticeHours,
  };
}

function validatePolicy(input: Record<string, unknown>): ProfessionalBookingPolicy {
  if (typeof input.policyText !== "string") {
    throw new ProfessionalBookingPolicyError(
      "Booking policy text must be text.",
      400,
      "invalid_professional_booking_policy_text",
    );
  }

  const policyText = input.policyText.trim();
  if (policyText.length > PROFESSIONAL_BOOKING_POLICY_TEXT_MAX) {
    throw new ProfessionalBookingPolicyError(
      `Booking policy text cannot exceed ${PROFESSIONAL_BOOKING_POLICY_TEXT_MAX} characters.`,
      400,
      "professional_booking_policy_text_too_long",
    );
  }

  const cancellationNoticeHours = input.cancellationNoticeHours;
  if (
    typeof cancellationNoticeHours !== "number" ||
    !Number.isInteger(cancellationNoticeHours) ||
    cancellationNoticeHours < 0 ||
    cancellationNoticeHours > PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS
  ) {
    throw new ProfessionalBookingPolicyError(
      `Cancellation notice must be a whole number from 0 to ${PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS} hours.`,
      400,
      "invalid_professional_booking_cancellation_notice",
    );
  }

  return { policyText, cancellationNoticeHours };
}

async function resolveViewer(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new ProfessionalBookingPolicyError(
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
    throw new ProfessionalBookingPolicyError(
      "Loombus could not verify age-safety eligibility. Try again later.",
      503,
      "age_safety_unavailable",
    );
  }

  if (ageSafety.ageBand === "under_13" || ageSafety.guardianRequired) {
    throw new ProfessionalBookingPolicyError(
      "This account is not eligible to use Loombus.",
      403,
      "under_13_not_allowed",
    );
  }

  if (ageSafety.ageBand === "unknown") {
    throw new ProfessionalBookingPolicyError(
      "Complete age safety before configuring Professional Booking.",
      403,
      "age_gate_required",
    );
  }

  if (ageSafety.ageBand === "teen") {
    throw new ProfessionalBookingPolicyError(
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
    console.error("Professional Booking policy subscription resolution failed:", {
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
): Promise<ProfessionalBookingPolicyService> {
  const { data: appointmentService, error } = await service
    .from("business_appointment_services")
    .select("id, business_id, name, status")
    .eq("id", serviceId)
    .eq("owner_id", providerId)
    .maybeSingle();

  if (error) {
    throw new ProfessionalBookingPolicyError(
      "Unable to verify the appointment service.",
      503,
      "professional_booking_policy_service_unavailable",
    );
  }

  if (!appointmentService) {
    throw new ProfessionalBookingPolicyError(
      "Appointment service not found.",
      404,
      "professional_booking_policy_service_not_found",
    );
  }

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("name")
    .eq("id", appointmentService.business_id)
    .eq("owner_id", providerId)
    .maybeSingle();

  if (businessError || !business) {
    throw new ProfessionalBookingPolicyError(
      "Unable to verify the appointment service business.",
      businessError ? 503 : 404,
      "professional_booking_policy_business_unavailable",
    );
  }

  const status = cleanText(appointmentService.status, 30);
  if (!["active", "paused", "archived"].includes(status)) {
    throw new ProfessionalBookingPolicyError(
      "Appointment service status is invalid.",
      409,
      "professional_booking_policy_service_invalid",
    );
  }

  return {
    id: String(appointmentService.id),
    name: cleanText(appointmentService.name, 200) || "Appointment service",
    businessName: cleanText(business.name, 200) || "Business",
    status: status as ProfessionalBookingPolicyService["status"],
  };
}

function throwPolicyReadError(error: { message?: string } | null) {
  if (
    error &&
    /professional_booking_policies|schema cache/i.test(error.message ?? "")
  ) {
    throw new ProfessionalBookingPolicyError(
      "The Professional Booking policy migration has not been applied.",
      503,
      "professional_booking_policy_schema_unavailable",
    );
  }

  throw new ProfessionalBookingPolicyError(
    "Unable to load the Professional Booking policy.",
    503,
    "professional_booking_policy_unavailable",
  );
}

async function buildResponse(
  viewer: Awaited<ReturnType<typeof resolveViewer>>,
  serviceId: string,
): Promise<ProfessionalBookingPolicyResponse> {
  const appointmentService = await requireOwnedService(
    viewer.service,
    serviceId,
    viewer.userId,
  );

  const [access, policyResult] = await Promise.all([
    resolveProfessionalBookingAccess(viewer.userId, viewer.isAdmin),
    viewer.service
      .from("professional_booking_policies")
      .select("policy_text, cancellation_notice_hours")
      .eq("service_id", serviceId)
      .eq("provider_id", viewer.userId)
      .maybeSingle(),
  ]);

  if (policyResult.error) throwPolicyReadError(policyResult.error);

  return {
    subscriptionPlan: access.plan,
    canUseProfessionalBooking: access.allowed,
    subscriptionResolutionAvailable: access.resolutionAvailable,
    hasSavedPolicy: Boolean(policyResult.data),
    service: appointmentService,
    policy: normalizeStoredPolicy(policyResult.data),
  };
}

export async function getProfessionalBookingPolicy(
  request: NextRequest,
  rawServiceId: unknown,
): Promise<ProfessionalBookingPolicyResponse> {
  const serviceId = uuid(rawServiceId);
  if (!serviceId) {
    throw new ProfessionalBookingPolicyError(
      "Choose a valid appointment service.",
      400,
      "professional_booking_policy_service_required",
    );
  }

  const viewer = await resolveViewer(request);
  return buildResponse(viewer, serviceId);
}

export async function saveProfessionalBookingPolicy(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingPolicyResponse> {
  const serviceId = uuid(input.serviceId);
  if (!serviceId) {
    throw new ProfessionalBookingPolicyError(
      "Choose a valid appointment service.",
      400,
      "professional_booking_policy_service_required",
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
    throw new ProfessionalBookingPolicyError(
      "Archived appointment services cannot change booking policies.",
      409,
      "professional_booking_policy_service_archived",
    );
  }

  const access = await resolveProfessionalBookingAccess(
    viewer.userId,
    viewer.isAdmin,
  );

  if (!access.resolutionAvailable) {
    throw new ProfessionalBookingPolicyError(
      "Unable to verify Premium Pro Professional Booking access.",
      503,
      "professional_booking_access_unavailable",
    );
  }

  if (!access.allowed) {
    throw new ProfessionalBookingPolicyError(
      "Premium Pro is required to configure Professional Booking policies.",
      403,
      "professional_booking_required",
    );
  }

  const policy = validatePolicy(input);
  const shouldClear =
    policy.policyText.length === 0 && policy.cancellationNoticeHours === 0;

  if (shouldClear) {
    const { error } = await viewer.service
      .from("professional_booking_policies")
      .delete()
      .eq("service_id", serviceId)
      .eq("provider_id", viewer.userId);

    if (error) {
      if (/professional_booking_policies|schema cache/i.test(error.message ?? "")) {
        throwPolicyReadError(error);
      }
      throw new ProfessionalBookingPolicyError(
        "Unable to clear the Professional Booking policy.",
        503,
        "professional_booking_policy_save_failed",
      );
    }
  } else {
    const now = new Date().toISOString();
    const { error } = await viewer.service
      .from("professional_booking_policies")
      .upsert(
        {
          service_id: serviceId,
          provider_id: viewer.userId,
          policy_text: policy.policyText,
          cancellation_notice_hours: policy.cancellationNoticeHours,
          updated_at: now,
        },
        { onConflict: "service_id" },
      );

    if (error) {
      if (/professional_booking_policies|schema cache/i.test(error.message ?? "")) {
        throwPolicyReadError(error);
      }
      throw new ProfessionalBookingPolicyError(
        "Unable to save the Professional Booking policy.",
        503,
        "professional_booking_policy_save_failed",
      );
    }
  }

  return buildResponse(viewer, serviceId);
}
