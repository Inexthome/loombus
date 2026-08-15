import "server-only";

import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  createMemberPayoutDashboardLink,
  createMemberPayoutOnboarding,
  getMemberPayoutIdentity,
  MemberPayoutIdentityError,
  refreshMemberPayoutAccount,
} from "@/lib/member-payout-account-server";
import { PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION } from "@/lib/professional-booking-payment";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { SERVICE_TRANSACTION_FEE_SCHEDULE } from "@/lib/service-transaction-fees";
import {
  evaluateSubscriptionEntitlement,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import { getMemberAgeSafety } from "@/lib/teen-safety-server";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export class ProfessionalBookingPayoutError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_payout_error"
  ) {
    super(message);
  }
}

export function professionalBookingPayoutOnboardingEnabled() {
  return process.env.PROFESSIONAL_BOOKING_PAYOUT_ONBOARDING_ENABLED === "true";
}

export function professionalBookingPayoutOnboardingLiveAllowed() {
  return process.env.PROFESSIONAL_BOOKING_PAYOUT_ONBOARDING_ALLOW_LIVE === "true";
}

function stripeKeyLooksLive() {
  return /^(sk|rk)_live_/.test(STRIPE_SECRET_KEY ?? "");
}

async function viewer(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!access.ok) {
    throw new ProfessionalBookingPayoutError(
      access.error,
      access.status,
      access.code ?? "account_access_denied"
    );
  }
  return {
    userId: access.user.id,
    isAdmin: access.profile.is_admin === true,
    service: createRoomServiceSupabase(),
  };
}

async function subscriptionAccess(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return { plan: "free" as SubscriptionPlanId, allowed: true, available: true };
  }
  try {
    const subscription = await getResolvedGeneralSubscriptionForUser(userId);
    return {
      plan: subscription.plan,
      allowed:
        subscription.isAdminOverride ||
        evaluateSubscriptionEntitlement(subscription.plan, "professional_booking").allowed,
      available: true,
    };
  } catch (error) {
    console.error("Professional Booking payout subscription resolution failed:", error);
    return { plan: "free" as SubscriptionPlanId, allowed: false, available: false };
  }
}

async function providerHasService(service: ReturnType<typeof createRoomServiceSupabase>, userId: string) {
  const { data, error } = await service
    .from("business_appointment_services")
    .select("id")
    .eq("owner_id", userId)
    .in("status", ["active", "paused"])
    .limit(1);
  if (error) {
    throw new ProfessionalBookingPayoutError(
      "Unable to verify Professional Booking services.",
      503,
      "professional_booking_payout_service_unavailable"
    );
  }
  return Boolean(data?.length);
}

async function ageEligibility(service: ReturnType<typeof createRoomServiceSupabase>, userId: string) {
  const age = await getMemberAgeSafety(service, userId);
  return {
    available: age.lookupAvailable,
    adult: age.lookupAvailable && age.ageBand === "adult" && !age.guardianRequired,
    ageBand: age.ageBand,
    guardianRequired: age.guardianRequired,
  };
}

function payoutPayload(identity: Awaited<ReturnType<typeof getMemberPayoutIdentity>>) {
  if (!identity) return null;
  return {
    detailsSubmitted: identity.details_submitted,
    chargesEnabled: identity.charges_enabled,
    payoutsEnabled: identity.payouts_enabled,
    requirementsDue: identity.requirements_due,
    country: identity.country,
    defaultCurrency: identity.default_currency,
    updatedAt: identity.updated_at,
  };
}

function termsSchemaUnavailable(message: string | null | undefined) {
  return /professional_booking_payment_provider_terms|schema cache|relation .* does not exist/i.test(
    message ?? "",
  );
}

async function paymentTermsState(
  service: ReturnType<typeof createRoomServiceSupabase>,
  providerId: string,
) {
  const { data, error } = await service
    .from("professional_booking_payment_provider_terms")
    .select("accepted_at")
    .eq("provider_id", providerId)
    .eq("terms_version", PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION)
    .maybeSingle();

  if (error) {
    if (termsSchemaUnavailable(error.message)) {
      return { available: false, accepted: false, acceptedAt: null as string | null };
    }
    throw new ProfessionalBookingPayoutError(
      "Unable to verify Professional Booking payment terms.",
      503,
      "professional_booking_payment_terms_unavailable",
    );
  }

  return {
    available: true,
    accepted: Boolean(data?.accepted_at),
    acceptedAt: data?.accepted_at ? String(data.accepted_at) : null,
  };
}

function requestIp(request: NextRequest) {
  const candidates = [
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    request.headers.get("x-real-ip")?.trim(),
  ];
  for (const candidate of candidates) {
    if (candidate && isIP(candidate)) return candidate;
  }
  return null;
}

export async function getProfessionalBookingPayout(request: NextRequest) {
  const context = await viewer(request);
  const [subscription, hasProviderService, age, identity, terms] = await Promise.all([
    subscriptionAccess(context.userId, context.isAdmin),
    providerHasService(context.service, context.userId),
    ageEligibility(context.service, context.userId),
    getMemberPayoutIdentity(context.userId),
    paymentTermsState(context.service, context.userId),
  ]);

  return {
    subscriptionPlan: subscription.plan,
    subscriptionResolutionAvailable: subscription.available,
    canUseProfessionalBooking: subscription.allowed,
    hasProviderService,
    ageSafetyAvailable: age.available,
    adultProviderEligible: age.adult,
    payoutOnboardingEnabled: professionalBookingPayoutOnboardingEnabled(),
    hasPayoutIdentity: Boolean(identity),
    payout: payoutPayload(identity),
    paymentTermsStorageAvailable: terms.available,
    paymentTermsVersion: PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION,
    paymentTermsAccepted: terms.accepted,
    paymentTermsAcceptedAt: terms.acceptedAt,
    paymentPlatformFeeBps: SERVICE_TRANSACTION_FEE_SCHEDULE.proReducedFeeBps,
  };
}

async function requirePayoutAction(request: NextRequest) {
  const context = await viewer(request);
  const subscription = await subscriptionAccess(context.userId, context.isAdmin);
  if (!subscription.available) {
    throw new ProfessionalBookingPayoutError(
      "Loombus cannot verify Premium Pro access right now.",
      503,
      "professional_booking_payout_subscription_unavailable"
    );
  }
  if (!subscription.allowed) {
    throw new ProfessionalBookingPayoutError(
      "Premium Pro is required to manage Professional Booking payout setup.",
      403,
      "professional_booking_payout_requires_pro"
    );
  }
  if (!(await providerHasService(context.service, context.userId))) {
    throw new ProfessionalBookingPayoutError(
      "Create an active or paused appointment service before connecting Stripe for Professional Booking.",
      409,
      "professional_booking_payout_service_required"
    );
  }

  const age = await ageEligibility(context.service, context.userId);
  if (!age.available) {
    throw new ProfessionalBookingPayoutError(
      "Loombus could not verify age-safety eligibility. Try again later.",
      503,
      "age_safety_unavailable"
    );
  }
  if (!age.adult) {
    throw new ProfessionalBookingPayoutError(
      "Professional Booking payout setup is currently limited to adult accounts.",
      403,
      age.ageBand === "teen" ? "teen_action_restricted" : "age_gate_required"
    );
  }

  return context;
}

function origin(request: NextRequest) {
  return request.headers.get("origin") ?? request.nextUrl.origin;
}

function translatePayoutError(error: unknown): never {
  if (error instanceof MemberPayoutIdentityError) {
    throw new ProfessionalBookingPayoutError(error.message, error.status, error.code);
  }
  throw error;
}

export async function acceptProfessionalBookingPaymentTerms(
  request: NextRequest,
  explicitlyAccepted: unknown,
) {
  if (explicitlyAccepted !== true) {
    throw new ProfessionalBookingPayoutError(
      "You must explicitly accept the Professional Booking payment terms.",
      400,
      "professional_booking_payment_terms_acceptance_required",
    );
  }

  const context = await requirePayoutAction(request);
  const existing = await paymentTermsState(context.service, context.userId);
  if (!existing.available) {
    throw new ProfessionalBookingPayoutError(
      "Professional Booking payment terms storage is not available yet.",
      503,
      "professional_booking_payment_terms_schema_unavailable",
    );
  }
  if (!existing.accepted) {
    const { error } = await context.service
      .from("professional_booking_payment_provider_terms")
      .insert({
        provider_id: context.userId,
        terms_version: PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION,
        accepted_ip: requestIp(request),
      });

    if (error && error.code !== "23505") {
      throw new ProfessionalBookingPayoutError(
        "Unable to save Professional Booking payment terms acceptance.",
        503,
        "professional_booking_payment_terms_save_failed",
      );
    }
  }

  const confirmed = await paymentTermsState(context.service, context.userId);
  if (!confirmed.accepted) {
    throw new ProfessionalBookingPayoutError(
      "Professional Booking payment terms acceptance could not be confirmed.",
      503,
      "professional_booking_payment_terms_confirmation_failed",
    );
  }
  return getProfessionalBookingPayout(request);
}

export async function startProfessionalBookingPayoutOnboarding(request: NextRequest) {
  const context = await requirePayoutAction(request);
  if (!professionalBookingPayoutOnboardingEnabled()) {
    throw new ProfessionalBookingPayoutError(
      "Professional Booking Stripe payout onboarding is not enabled.",
      503,
      "professional_booking_payout_onboarding_disabled",
    );
  }
  if (stripeKeyLooksLive() && !professionalBookingPayoutOnboardingLiveAllowed()) {
    throw new ProfessionalBookingPayoutError(
      "Live Professional Booking Stripe payout onboarding is not enabled.",
      503,
      "professional_booking_payout_onboarding_live_disabled",
    );
  }
  try {
    return await createMemberPayoutOnboarding({
      memberId: context.userId,
      origin: origin(request),
    });
  } catch (error) {
    translatePayoutError(error);
  }
}

export async function refreshProfessionalBookingPayout(request: NextRequest) {
  const context = await requirePayoutAction(request);
  try {
    await refreshMemberPayoutAccount(context.userId);
    return getProfessionalBookingPayout(request);
  } catch (error) {
    translatePayoutError(error);
  }
}

export async function openProfessionalBookingPayoutDashboard(request: NextRequest) {
  const context = await requirePayoutAction(request);
  try {
    return await createMemberPayoutDashboardLink(context.userId);
  } catch (error) {
    translatePayoutError(error);
  }
}
