import "server-only";

import type { NextRequest } from "next/server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  createMemberPayoutDashboardLink,
  createMemberPayoutOnboarding,
  getMemberPayoutIdentity,
  MemberPayoutIdentityError,
  refreshMemberPayoutAccount,
} from "@/lib/member-payout-account-server";
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

export class ProfessionalBookingPayoutError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "professional_booking_payout_error"
  ) {
    super(message);
  }
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

export async function getProfessionalBookingPayout(request: NextRequest) {
  const context = await viewer(request);
  const [subscription, hasProviderService, age, identity] = await Promise.all([
    subscriptionAccess(context.userId, context.isAdmin),
    providerHasService(context.service, context.userId),
    ageEligibility(context.service, context.userId),
    getMemberPayoutIdentity(context.userId),
  ]);

  return {
    subscriptionPlan: subscription.plan,
    subscriptionResolutionAvailable: subscription.available,
    canUseProfessionalBooking: subscription.allowed,
    hasProviderService,
    ageSafetyAvailable: age.available,
    adultProviderEligible: age.adult,
    hasPayoutIdentity: Boolean(identity),
    payout: payoutPayload(identity),
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

export async function startProfessionalBookingPayoutOnboarding(request: NextRequest) {
  const context = await requirePayoutAction(request);
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
