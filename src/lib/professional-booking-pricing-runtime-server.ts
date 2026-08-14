import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_PRICING_CURRENCY,
  type ProfessionalBookingPriceSnapshot,
  type PublicProfessionalBookingPricingResponse,
} from "@/lib/professional-booking-pricing";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

type Service = ReturnType<typeof createRoomServiceSupabase>;
type Row = Record<string, unknown>;

type ActiveService = {
  serviceId: string;
  providerId: string;
  businessId: string;
};

type ProviderAccess = {
  allowed: boolean;
  resolutionAvailable: boolean;
};

type CurrentQuote = {
  amountCents: number;
  currency: typeof PROFESSIONAL_BOOKING_PRICING_CURRENCY;
  sourceRevision: string;
};

export type ProfessionalBookingPricingRequestViolation = {
  message: string;
  status: number;
  code: string;
};

export type ProfessionalBookingPricingRequestState = {
  snapshot: ProfessionalBookingPriceSnapshot | null;
  violation: ProfessionalBookingPricingRequestViolation | null;
};

function inactivePublicPricing(
  serviceId: string,
): PublicProfessionalBookingPricingResponse {
  return {
    serviceId,
    active: false,
    amountCents: null,
    currency: null,
    sourceRevision: null,
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

function sourceRevision(input: {
  serviceId: string;
  providerId: string;
  amountCents: number;
  currency: string;
  updatedAt: string;
}) {
  return createHash("sha256")
    .update(
      [
        input.serviceId,
        input.providerId,
        String(input.amountCents),
        input.currency,
        input.updatedAt,
      ].join(":"),
    )
    .digest("hex");
}

function normalizeStoredPricing(
  row: Row | null | undefined,
  serviceId: string,
  providerId: string,
): CurrentQuote | null {
  if (!row) return null;

  const amountCents = Number(row.amount_cents);
  const currency = text(row.currency, 10).toLowerCase();
  const updatedAt = text(row.updated_at, 100);
  const updatedAtMs = new Date(updatedAt).getTime();

  if (
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0 ||
    currency !== PROFESSIONAL_BOOKING_PRICING_CURRENCY ||
    !updatedAt ||
    !Number.isFinite(updatedAtMs)
  ) {
    return null;
  }

  return {
    amountCents,
    currency: PROFESSIONAL_BOOKING_PRICING_CURRENCY,
    sourceRevision: sourceRevision({
      serviceId,
      providerId,
      amountCents,
      currency,
      updatedAt,
    }),
  };
}

async function resolveProviderAccess(
  service: Service,
  providerId: string,
): Promise<ProviderAccess> {
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("is_admin")
    .eq("id", providerId)
    .maybeSingle();

  if (profileError) {
    console.error("Professional Booking pricing provider lookup failed:", {
      providerId,
      error: profileError.message,
    });
    return { allowed: false, resolutionAvailable: false };
  }

  if (profile?.is_admin === true) {
    return { allowed: true, resolutionAvailable: true };
  }

  try {
    const subscription = await getResolvedGeneralSubscriptionForUser(providerId);
    return {
      allowed:
        subscription.isAdminOverride ||
        evaluateSubscriptionEntitlement(
          subscription.plan,
          "professional_booking",
        ).allowed,
      resolutionAvailable: true,
    };
  } catch (error) {
    console.error("Professional Booking pricing entitlement resolution failed:", {
      providerId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { allowed: false, resolutionAvailable: false };
  }
}

async function resolveActiveService(
  service: Service,
  rawServiceId: unknown,
): Promise<ActiveService | null> {
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

async function loadCurrentQuote(
  service: Service,
  appointmentService: ActiveService,
) {
  const { data, error } = await service
    .from("professional_booking_service_pricing")
    .select("amount_cents, currency, updated_at")
    .eq("service_id", appointmentService.serviceId)
    .eq("provider_id", appointmentService.providerId)
    .maybeSingle();

  if (error) {
    return { quote: null, error, invalid: false };
  }

  const quote = normalizeStoredPricing(
    (data ?? null) as Row | null,
    appointmentService.serviceId,
    appointmentService.providerId,
  );

  return {
    quote,
    error: null,
    invalid: Boolean(data) && !quote,
  };
}

function changedPriceViolation(): ProfessionalBookingPricingRequestViolation {
  return {
    message:
      "This Professional Booking price changed. Review the current price before sending your appointment request.",
    status: 409,
    code: "professional_booking_price_changed",
  };
}

export async function getPublicProfessionalBookingPricing(
  businessSlug: string,
  rawServiceId: unknown,
): Promise<PublicProfessionalBookingPricingResponse> {
  const serviceId = uuid(rawServiceId) ?? "";
  const inactive = inactivePublicPricing(serviceId);
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

  const access = await resolveProviderAccess(
    service,
    appointmentService.providerId,
  );
  if (!access.resolutionAvailable || !access.allowed) return inactive;

  const result = await loadCurrentQuote(service, appointmentService);
  if (result.error || result.invalid) {
    console.error("Professional Booking public pricing lookup failed:", {
      providerId: appointmentService.providerId,
      serviceId: appointmentService.serviceId,
      error: result.error?.message ?? "invalid stored pricing",
    });
    return inactive;
  }

  if (!result.quote) return inactive;

  return {
    serviceId: appointmentService.serviceId,
    active: true,
    amountCents: result.quote.amountCents,
    currency: result.quote.currency,
    sourceRevision: result.quote.sourceRevision,
  };
}

export async function getProfessionalBookingPricingRequestState(
  request: NextRequest,
  input: Record<string, unknown>,
): Promise<ProfessionalBookingPricingRequestState> {
  const inactive: ProfessionalBookingPricingRequestState = {
    snapshot: null,
    violation: null,
  };

  const serviceId = uuid(input.serviceId);
  if (!serviceId) return inactive;

  const browserRevision = text(
    input.professionalBookingPriceRevision,
    128,
  );

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

  const providerAccess = await resolveProviderAccess(
    service,
    appointmentService.providerId,
  );

  if (!providerAccess.resolutionAvailable) {
    return inactive;
  }

  if (!providerAccess.allowed) {
    return browserRevision
      ? { snapshot: null, violation: changedPriceViolation() }
      : inactive;
  }

  const result = await loadCurrentQuote(service, appointmentService);

  if (result.error) {
    console.error("Professional Booking request pricing lookup failed:", {
      providerId: appointmentService.providerId,
      serviceId: appointmentService.serviceId,
      error: result.error.message,
    });
    return {
      snapshot: null,
      violation: {
        message:
          "This provider's Professional Booking price could not be verified. Try the appointment request again.",
        status: 503,
        code: "professional_booking_pricing_unavailable",
      },
    };
  }

  if (result.invalid) {
    return {
      snapshot: null,
      violation: {
        message:
          "This provider's Professional Booking price is unavailable until its saved pricing is corrected.",
        status: 503,
        code: "professional_booking_pricing_invalid",
      },
    };
  }

  if (!result.quote) {
    return browserRevision
      ? { snapshot: null, violation: changedPriceViolation() }
      : inactive;
  }

  if (browserRevision !== result.quote.sourceRevision) {
    return { snapshot: null, violation: changedPriceViolation() };
  }

  return {
    snapshot: {
      amountCents: result.quote.amountCents,
      currency: result.quote.currency,
      sourceRevision: result.quote.sourceRevision,
      capturedAt: new Date().toISOString(),
    },
    violation: null,
  };
}
