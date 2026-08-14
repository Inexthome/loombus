import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS,
  PROFESSIONAL_BOOKING_POLICY_TEXT_MAX,
  type ProfessionalBookingPolicy,
  type ProfessionalBookingPolicySnapshot,
  type PublicProfessionalBookingPolicyResponse,
} from "@/lib/professional-booking-policy";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

type Service = ReturnType<typeof createRoomServiceSupabase>;
type Row = Record<string, unknown>;

export type ProfessionalBookingPolicyRequestViolation = {
  message: string;
  status: number;
  code: string;
};

export type ProfessionalBookingPolicyRequestState = {
  snapshot: ProfessionalBookingPolicySnapshot | null;
  violation: ProfessionalBookingPolicyRequestViolation | null;
};

function inactivePublicPolicy(
  serviceId: string,
): PublicProfessionalBookingPolicyResponse {
  return {
    serviceId,
    active: false,
    policyText: "",
    cancellationNoticeHours: 0,
  };
}

function text(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function uuid(value: unknown) {
  const result = text(value, 60);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)
    ? result
    : null;
}

function normalizeStoredPolicy(
  value: Row | null | undefined,
): ProfessionalBookingPolicy | null {
  if (!value) return null;

  if (typeof value.policy_text !== "string") return null;
  if (
    typeof value.cancellation_notice_hours !== "number" ||
    !Number.isInteger(value.cancellation_notice_hours) ||
    value.cancellation_notice_hours < 0 ||
    value.cancellation_notice_hours >
      PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_MAX_HOURS
  ) {
    return null;
  }
  if (value.policy_text.length > PROFESSIONAL_BOOKING_POLICY_TEXT_MAX) {
    return null;
  }

  const policyText = value.policy_text.trim();
  const cancellationNoticeHours = value.cancellation_notice_hours;
  if (!policyText && cancellationNoticeHours === 0) return null;

  return { policyText, cancellationNoticeHours };
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
    console.error("Professional Booking policy provider lookup failed:", {
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
    console.error("Professional Booking policy entitlement resolution failed:", {
      providerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

async function resolveActiveService(service: Service, rawServiceId: unknown) {
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

async function loadCurrentPolicy(
  service: Service,
  serviceId: string,
  providerId: string,
) {
  const { data, error } = await service
    .from("professional_booking_policies")
    .select("policy_text, cancellation_notice_hours")
    .eq("service_id", serviceId)
    .eq("provider_id", providerId)
    .maybeSingle();

  if (error) return { policy: null, error };
  return {
    policy: normalizeStoredPolicy((data ?? null) as Row | null),
    error: null,
  };
}

export async function getPublicProfessionalBookingPolicy(
  businessSlug: string,
  rawServiceId: unknown,
): Promise<PublicProfessionalBookingPolicyResponse> {
  const serviceId = uuid(rawServiceId) ?? "";
  const inactive = inactivePublicPolicy(serviceId);
  const slug = text(businessSlug, 120);
  if (!slug || !serviceId) return inactive;

  let service: Service;
  try {
    service = createRoomServiceSupabase();
  } catch {
    return inactive;
  }

  const appointmentService = await resolveActiveService(service, serviceId);
  if (!appointmentService) return inactive;

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("id")
    .eq("id", appointmentService.businessId)
    .eq("owner_id", appointmentService.providerId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (businessError || !business) return inactive;

  if (!(await providerCanUseProfessionalBooking(service, appointmentService.providerId))) {
    return inactive;
  }

  const result = await loadCurrentPolicy(
    service,
    appointmentService.serviceId,
    appointmentService.providerId,
  );

  if (result.error) {
    console.error("Professional Booking public policy lookup failed:", {
      providerId: appointmentService.providerId,
      serviceId: appointmentService.serviceId,
      error: result.error.message,
    });
    return inactive;
  }

  if (!result.policy) return inactive;

  return {
    serviceId: appointmentService.serviceId,
    active: true,
    policyText: result.policy.policyText,
    cancellationNoticeHours: result.policy.cancellationNoticeHours,
  };
}

export async function getProfessionalBookingPolicyRequestState(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingPolicyRequestState> {
  const inactive: ProfessionalBookingPolicyRequestState = {
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

  const result = await loadCurrentPolicy(
    service,
    appointmentService.serviceId,
    appointmentService.providerId,
  );

  if (result.error) {
    console.error("Professional Booking request policy lookup failed:", {
      providerId: appointmentService.providerId,
      serviceId: appointmentService.serviceId,
      error: result.error.message,
    });
    return {
      snapshot: null,
      violation: {
        message:
          "This provider's booking policy could not be verified. Try the appointment request again.",
        status: 503,
        code: "professional_booking_policy_unavailable",
      },
    };
  }

  if (!result.policy) return inactive;

  if (input.policyAcknowledged !== true) {
    return {
      snapshot: null,
      violation: {
        message: "Read and acknowledge the provider's booking policy before sending this appointment request.",
        status: 400,
        code: "professional_booking_policy_acknowledgment_required",
      },
    };
  }

  return {
    snapshot: {
      ...result.policy,
      acknowledgedAt: new Date().toISOString(),
    },
    violation: null,
  };
}
