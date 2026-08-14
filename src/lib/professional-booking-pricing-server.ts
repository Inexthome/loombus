import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_PRICING_CURRENCY,
  type ProfessionalBookingPricing,
  type ProfessionalBookingPricingResponse,
  type ProfessionalBookingPricingService,
} from "@/lib/professional-booking-pricing";
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

type StoredPricing = {
  amount_cents?: unknown;
  currency?: unknown;
} | null;

export class ProfessionalBookingPricingError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_pricing_error",
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

function normalizeStoredPricing(value: StoredPricing): ProfessionalBookingPricing | null {
  if (!value) return null;

  const amountCents = Number(value.amount_cents);
  const currency = cleanText(value.currency, 10).toLowerCase();

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    currency !== PROFESSIONAL_BOOKING_PRICING_CURRENCY
  ) {
    return null;
  }

  return {
    amountCents,
    currency: PROFESSIONAL_BOOKING_PRICING_CURRENCY,
  };
}

function validateAmountCents(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    throw new ProfessionalBookingPricingError(
      "Enter a valid fixed service price greater than zero.",
      400,
      "invalid_professional_booking_price",
    );
  }

  return value;
}

async function resolveViewer(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));

  if (!access.ok) {
    throw new ProfessionalBookingPricingError(
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
    throw new ProfessionalBookingPricingError(
      "Loombus could not verify age-safety eligibility. Try again later.",
      503,
      "age_safety_unavailable",
    );
  }

  if (ageSafety.ageBand === "under_13" || ageSafety.guardianRequired) {
    throw new ProfessionalBookingPricingError(
      "This account is not eligible to use Loombus.",
      403,
      "under_13_not_allowed",
    );
  }

  if (ageSafety.ageBand === "unknown") {
    throw new ProfessionalBookingPricingError(
      "Complete age safety before configuring Professional Booking.",
      403,
      "age_gate_required",
    );
  }

  if (ageSafety.ageBand === "teen") {
    throw new ProfessionalBookingPricingError(
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
    console.error("Professional Booking pricing subscription resolution failed:", {
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
): Promise<ProfessionalBookingPricingService> {
  const { data: appointmentService, error } = await service
    .from("business_appointment_services")
    .select("id, business_id, name, status")
    .eq("id", serviceId)
    .eq("owner_id", providerId)
    .maybeSingle();

  if (error) {
    throw new ProfessionalBookingPricingError(
      "Unable to verify the appointment service.",
      503,
      "professional_booking_pricing_service_unavailable",
    );
  }

  if (!appointmentService) {
    throw new ProfessionalBookingPricingError(
      "Appointment service not found.",
      404,
      "professional_booking_pricing_service_not_found",
    );
  }

  const { data: business, error: businessError } = await service
    .from("businesses")
    .select("name")
    .eq("id", appointmentService.business_id)
    .eq("owner_id", providerId)
    .maybeSingle();

  if (businessError || !business) {
    throw new ProfessionalBookingPricingError(
      "Unable to verify the appointment service business.",
      businessError ? 503 : 404,
      "professional_booking_pricing_business_unavailable",
    );
  }

  const status = cleanText(appointmentService.status, 30);
  if (!["active", "paused", "archived"].includes(status)) {
    throw new ProfessionalBookingPricingError(
      "Appointment service status is invalid.",
      409,
      "professional_booking_pricing_service_invalid",
    );
  }

  return {
    id: String(appointmentService.id),
    name: cleanText(appointmentService.name, 200) || "Appointment service",
    businessName: cleanText(business.name, 200) || "Business",
    status: status as ProfessionalBookingPricingService["status"],
  };
}

function throwPricingReadError(error: { message?: string } | null) {
  if (
    error &&
    /professional_booking_service_pricing|schema cache/i.test(error.message ?? "")
  ) {
    throw new ProfessionalBookingPricingError(
      "The Professional Booking pricing migration has not been applied.",
      503,
      "professional_booking_pricing_schema_unavailable",
    );
  }

  throw new ProfessionalBookingPricingError(
    "Unable to load Professional Booking pricing.",
    503,
    "professional_booking_pricing_unavailable",
  );
}

async function buildResponse(
  viewer: Awaited<ReturnType<typeof resolveViewer>>,
  serviceId: string,
): Promise<ProfessionalBookingPricingResponse> {
  const appointmentService = await requireOwnedService(
    viewer.service,
    serviceId,
    viewer.userId,
  );

  const [access, pricingResult] = await Promise.all([
    resolveProfessionalBookingAccess(viewer.userId, viewer.isAdmin),
    viewer.service
      .from("professional_booking_service_pricing")
      .select("amount_cents, currency")
      .eq("service_id", serviceId)
      .eq("provider_id", viewer.userId)
      .maybeSingle(),
  ]);

  if (pricingResult.error) throwPricingReadError(pricingResult.error);

  const pricing = normalizeStoredPricing(pricingResult.data as StoredPricing);
  if (pricingResult.data && !pricing) {
    throw new ProfessionalBookingPricingError(
      "Saved Professional Booking pricing is invalid and cannot be used.",
      503,
      "professional_booking_pricing_invalid",
    );
  }

  return {
    subscriptionPlan: access.plan,
    canUseProfessionalBooking: access.allowed,
    subscriptionResolutionAvailable: access.resolutionAvailable,
    hasSavedPricing: Boolean(pricingResult.data),
    service: appointmentService,
    pricing,
  };
}

export async function getProfessionalBookingPricing(
  request: NextRequest,
  rawServiceId: unknown,
): Promise<ProfessionalBookingPricingResponse> {
  const serviceId = uuid(rawServiceId);
  if (!serviceId) {
    throw new ProfessionalBookingPricingError(
      "Choose a valid appointment service.",
      400,
      "professional_booking_pricing_service_required",
    );
  }

  const viewer = await resolveViewer(request);
  return buildResponse(viewer, serviceId);
}

export async function saveProfessionalBookingPricing(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingPricingResponse> {
  const serviceId = uuid(input.serviceId);
  if (!serviceId) {
    throw new ProfessionalBookingPricingError(
      "Choose a valid appointment service.",
      400,
      "professional_booking_pricing_service_required",
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
    throw new ProfessionalBookingPricingError(
      "Archived appointment services cannot change structured pricing.",
      409,
      "professional_booking_pricing_service_archived",
    );
  }

  const access = await resolveProfessionalBookingAccess(
    viewer.userId,
    viewer.isAdmin,
  );

  if (!access.resolutionAvailable) {
    throw new ProfessionalBookingPricingError(
      "Unable to verify Premium Pro Professional Booking access.",
      503,
      "professional_booking_access_unavailable",
    );
  }

  if (!access.allowed) {
    throw new ProfessionalBookingPricingError(
      "Premium Pro is required to configure structured Professional Booking pricing.",
      403,
      "professional_booking_required",
    );
  }

  if (input.clear === true) {
    const { error } = await viewer.service
      .from("professional_booking_service_pricing")
      .delete()
      .eq("service_id", serviceId)
      .eq("provider_id", viewer.userId);

    if (error) {
      if (/professional_booking_service_pricing|schema cache/i.test(error.message ?? "")) {
        throwPricingReadError(error);
      }
      throw new ProfessionalBookingPricingError(
        "Unable to clear Professional Booking pricing.",
        503,
        "professional_booking_pricing_save_failed",
      );
    }

    return buildResponse(viewer, serviceId);
  }

  const amountCents = validateAmountCents(input.amountCents);
  const now = new Date().toISOString();
  const { error } = await viewer.service
    .from("professional_booking_service_pricing")
    .upsert(
      {
        service_id: serviceId,
        provider_id: viewer.userId,
        amount_cents: amountCents,
        currency: PROFESSIONAL_BOOKING_PRICING_CURRENCY,
        updated_at: now,
      },
      { onConflict: "service_id" },
    );

  if (error) {
    if (/professional_booking_service_pricing|schema cache/i.test(error.message ?? "")) {
      throwPricingReadError(error);
    }
    throw new ProfessionalBookingPricingError(
      "Unable to save Professional Booking pricing.",
      503,
      "professional_booking_pricing_save_failed",
    );
  }

  return buildResponse(viewer, serviceId);
}
