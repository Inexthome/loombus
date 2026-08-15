import "server-only";

import type { NextRequest } from "next/server";
import Stripe from "stripe";
import {
  AppointmentsError,
  type AppointmentInput,
} from "@/lib/appointments-server";
import { getResolvedGeneralSubscriptionForUser } from "@/lib/general-subscriptions";
import {
  PROFESSIONAL_BOOKING_PAYMENT_PRODUCT,
  PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION,
  type ProfessionalBookingPaymentListResponse,
  type ProfessionalBookingPaymentStatus,
  type ProfessionalBookingPaymentSummary,
} from "@/lib/professional-booking-payment";
import { normalizeProfessionalBookingPriceSnapshot } from "@/lib/professional-booking-pricing";
import {
  getProfessionalBookingProviderPaymentReviewState,
  ProfessionalBookingProviderPaymentReviewError,
} from "@/lib/professional-booking-provider-payment-review-server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";
import {
  createRequestSupabase,
  createRoomServiceSupabase,
} from "@/lib/room-operations";
import { calculateServiceTransactionFee } from "@/lib/service-transaction-fees";
import { evaluateSubscriptionEntitlement } from "@/lib/subscription-entitlements";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const PAYMENT_MINIMUM_CENTS = 50;
const PAYMENT_MAXIMUM_CENTS = 99_999_999;
const TERMINAL_APPOINTMENT_STATUSES = new Set(["declined", "cancelled"]);
const AUTHORIZATION_OPEN_APPOINTMENT_STATUSES = new Set([
  "pending",
  "reschedule_proposed",
]);

type Service = ReturnType<typeof createRoomServiceSupabase>;
type Row = Record<string, any>;
type CoreOperation<T> = () => Promise<T>;

type CheckoutResult = {
  paymentId: string;
  checkoutUrl: string | null;
  paymentRequired: true;
};

type CapturedForAcceptance = {
  payment: Row;
  capturedByThisCall: boolean;
};

type ProviderPaymentTerms = {
  version: typeof PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION;
  acceptedAt: string;
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

function isSchemaUnavailable(error: { message?: string | null } | null | undefined) {
  return /professional_booking_payments|professional_booking_payment_attempts|professional_booking_payment_provider_terms|professional_booking_payment_disputes|schema cache|relation .* does not exist/i.test(
    error?.message ?? "",
  );
}

function isUniqueViolation(error: { code?: string | null } | null | undefined) {
  return error?.code === "23505";
}

export function professionalBookingPaymentsEnabled() {
  return process.env.PROFESSIONAL_BOOKING_PAYMENTS_ENABLED === "true";
}

export function professionalBookingLivePaymentsAllowed() {
  return process.env.PROFESSIONAL_BOOKING_PAYMENTS_ALLOW_LIVE === "true";
}

function stripeKeyLooksLive() {
  return /^(sk|rk)_live_/.test(STRIPE_SECRET_KEY ?? "");
}

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new AppointmentsError(
      "Professional Booking payment processing is not configured.",
      503,
      "professional_booking_payment_not_configured",
    );
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

function getStripeForNewMoney() {
  const stripe = getStripe();
  if (stripeKeyLooksLive() && !professionalBookingLivePaymentsAllowed()) {
    throw new AppointmentsError(
      "Live Professional Booking payments are not enabled.",
      503,
      "professional_booking_live_payments_disabled",
    );
  }
  return stripe;
}

async function requireViewer(request: NextRequest) {
  const access = await verifyRequestAccountAccess(createRequestSupabase(request));
  if (!access.ok) {
    throw new AppointmentsError(
      access.error,
      access.status,
      access.code ?? "account_access_denied",
    );
  }
  return {
    user: access.user,
    profile: access.profile,
    service: createRoomServiceSupabase(),
  };
}

async function loadPaymentByRequestId(
  service: Service,
  appointmentRequestId: string,
): Promise<Row | null> {
  const { data, error } = await service
    .from("professional_booking_payments")
    .select("*")
    .eq("appointment_request_id", appointmentRequestId)
    .maybeSingle();

  if (error) {
    if (isSchemaUnavailable(error)) return null;
    throw new AppointmentsError(
      "Unable to verify this Professional Booking payment.",
      503,
      "professional_booking_payment_unavailable",
    );
  }
  return (data ?? null) as Row | null;
}

async function loadPaymentById(service: Service, paymentId: string): Promise<Row> {
  const { data, error } = await service
    .from("professional_booking_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error || !data) {
    throw new AppointmentsError(
      "Professional Booking payment not found.",
      error ? 503 : 404,
      error
        ? "professional_booking_payment_unavailable"
        : "professional_booking_payment_not_found",
    );
  }
  return data as Row;
}

async function loadAppointment(service: Service, requestId: string): Promise<Row> {
  const { data, error } = await service
    .from("business_appointment_requests")
    .select(
      "id, service_id, provider_id, requester_id, status, professional_booking_price_snapshot",
    )
    .eq("id", requestId)
    .maybeSingle();
  if (error || !data) {
    throw new AppointmentsError(
      "Appointment request not found.",
      error ? 503 : 404,
      error ? "appointment_access_unavailable" : "appointment_not_found",
    );
  }
  return data as Row;
}

async function latestAttempt(service: Service, paymentId: string): Promise<Row | null> {
  const { data, error } = await service
    .from("professional_booking_payment_attempts")
    .select("*")
    .eq("payment_id", paymentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new AppointmentsError(
      "Unable to verify the current payment authorization.",
      503,
      "professional_booking_payment_attempt_unavailable",
    );
  }
  return (data ?? null) as Row | null;
}

async function requireCurrentProviderPaymentTerms(
  service: Service,
  providerId: string,
): Promise<ProviderPaymentTerms> {
  const { data, error } = await service
    .from("professional_booking_payment_provider_terms")
    .select("terms_version, accepted_at")
    .eq("provider_id", providerId)
    .eq("terms_version", PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION)
    .maybeSingle();

  if (error) {
    throw new AppointmentsError(
      isSchemaUnavailable(error)
        ? "Professional Booking payment terms storage is not available yet."
        : "The provider's Professional Booking payment terms could not be verified.",
      503,
      isSchemaUnavailable(error)
        ? "professional_booking_payment_terms_schema_unavailable"
        : "professional_booking_payment_terms_unavailable",
    );
  }
  if (!data?.accepted_at) {
    throw new AppointmentsError(
      "This provider must accept the current Professional Booking payment terms before collecting payment.",
      409,
      "professional_booking_payment_terms_required",
    );
  }

  return {
    version: PROFESSIONAL_BOOKING_PAYMENT_TERMS_VERSION,
    acceptedAt: String(data.accepted_at),
  };
}

function paymentIntentId(value: Stripe.Checkout.Session["payment_intent"]) {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function latestCharge(paymentIntent: Stripe.PaymentIntent) {
  const charge = paymentIntent.latest_charge;
  return charge && typeof charge !== "string" ? charge : null;
}

function captureBeforeIso(charge: Stripe.Charge | null) {
  const captureBefore = Number((charge as any)?.payment_method_details?.card?.capture_before);
  return Number.isFinite(captureBefore) && captureBefore > 0
    ? new Date(captureBefore * 1000).toISOString()
    : null;
}

function validateStripeContract(payment: Row, intent: Stripe.PaymentIntent) {
  const destination =
    typeof intent.transfer_data?.destination === "string"
      ? intent.transfer_data.destination
      : intent.transfer_data?.destination?.id ?? null;

  if (
    intent.amount !== Number(payment.gross_amount_cents) ||
    intent.currency !== "usd" ||
    Number(intent.application_fee_amount ?? -1) !== Number(payment.platform_fee_cents) ||
    destination !== String(payment.stripe_destination_account_id) ||
    intent.metadata?.product !== PROFESSIONAL_BOOKING_PAYMENT_PRODUCT ||
    intent.metadata?.payment_id !== String(payment.id) ||
    intent.metadata?.appointment_request_id !== String(payment.appointment_request_id) ||
    intent.metadata?.provider_payment_terms_version !==
      String(payment.provider_payment_terms_version)
  ) {
    throw new AppointmentsError(
      "The Stripe authorization does not match the saved Professional Booking payment contract.",
      503,
      "professional_booking_payment_contract_mismatch",
    );
  }
}

async function updateAttemptFromStripe(
  service: Service,
  attempt: Row,
  input: {
    sessionId?: string | null;
    paymentIntentId?: string | null;
    status?: string;
    livemode?: boolean;
    authorizationExpiresAt?: string | null;
  },
) {
  const values: Row = { updated_at: new Date().toISOString() };
  if (input.sessionId) values.stripe_checkout_session_id = input.sessionId;
  if (input.paymentIntentId) values.stripe_payment_intent_id = input.paymentIntentId;
  if (input.status) values.status = input.status;
  if (typeof input.livemode === "boolean") values.livemode = input.livemode;
  if (input.authorizationExpiresAt !== undefined) {
    values.authorization_expires_at = input.authorizationExpiresAt;
  }
  const { error } = await service
    .from("professional_booking_payment_attempts")
    .update(values)
    .eq("id", attempt.id);
  if (error) {
    throw new AppointmentsError(
      "Unable to save the Stripe payment attempt state.",
      503,
      "professional_booking_payment_attempt_update_failed",
    );
  }
}

async function markAttemptFailed(service: Service, attemptId: string) {
  await service
    .from("professional_booking_payment_attempts")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId);
}

async function updatePaymentStatus(
  service: Service,
  payment: Row,
  status: ProfessionalBookingPaymentStatus,
  extra: Row = {},
) {
  const values: Row = {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  };
  const { error } = await service
    .from("professional_booking_payments")
    .update(values)
    .eq("id", payment.id);
  if (error) {
    throw new AppointmentsError(
      "Unable to save the Professional Booking payment state.",
      503,
      "professional_booking_payment_update_failed",
    );
  }
  return { ...payment, ...values } as Row;
}

async function cancelAppointmentForExpiredAuthorization(
  service: Service,
  payment: Row,
) {
  const requestId = String(payment.appointment_request_id);
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("business_appointment_requests")
    .update({ status: "cancelled", acted_at: now })
    .eq("id", requestId)
    .in("status", [...AUTHORIZATION_OPEN_APPOINTMENT_STATUSES])
    .select("id")
    .maybeSingle();

  if (error) {
    throw new AppointmentsError(
      "The expired payment authorization could not close the appointment request.",
      503,
      "professional_booking_payment_expiry_cancel_failed",
    );
  }
  if (data) return;

  const appointment = await loadAppointment(service, requestId);
  if (TERMINAL_APPOINTMENT_STATUSES.has(String(appointment.status))) return;

  throw new AppointmentsError(
    "The appointment changed while its payment authorization expired. Payment reconciliation stopped for review.",
    409,
    "professional_booking_payment_expiry_state_conflict",
  );
}

async function syncProfessionalBookingPayment(
  service: Service,
  rawPayment: Row,
): Promise<Row> {
  let payment = rawPayment;
  let attempt = await latestAttempt(service, String(payment.id));
  if (!attempt) return payment;

  const stripe = getStripe();
  let session: Stripe.Checkout.Session | null = null;
  const sessionId = text(attempt.stripe_checkout_session_id, 255);
  if (sessionId) {
    session = await stripe.checkout.sessions.retrieve(sessionId);
    const discoveredIntentId = paymentIntentId(session.payment_intent);
    if (discoveredIntentId && !attempt.stripe_payment_intent_id) {
      await updateAttemptFromStripe(service, attempt, {
        paymentIntentId: discoveredIntentId,
        livemode: session.livemode,
      });
      attempt = { ...attempt, stripe_payment_intent_id: discoveredIntentId };
    }
  }

  const intentId = text(attempt.stripe_payment_intent_id, 255);
  if (!intentId) {
    if (session?.status === "expired") {
      await cancelAppointmentForExpiredAuthorization(service, payment);
      await updateAttemptFromStripe(service, attempt, { status: "expired" });
      payment = await updatePaymentStatus(service, payment, "authorization_expired", {
        latest_error_code: null,
      });
    }
    return payment;
  }

  const intent = await stripe.paymentIntents.retrieve(intentId, {
    expand: ["latest_charge"],
  });
  validateStripeContract(payment, intent);
  const charge = latestCharge(intent);
  const authorizationExpiresAt = captureBeforeIso(charge);
  const fullyRefunded = Boolean(
    charge &&
      Number(charge.amount_refunded ?? 0) >= Number(payment.gross_amount_cents),
  );

  if (fullyRefunded) {
    await updateAttemptFromStripe(service, attempt, {
      status: "captured",
      authorizationExpiresAt,
      livemode: intent.livemode,
    });
    return updatePaymentStatus(service, payment, "refunded", {
      refunded_at: payment.refunded_at ?? new Date().toISOString(),
      authorization_expires_at: authorizationExpiresAt,
      latest_error_code: null,
    });
  }

  if (intent.status === "requires_capture") {
    await updateAttemptFromStripe(service, attempt, {
      status: "authorized",
      authorizationExpiresAt,
      livemode: intent.livemode,
    });
    const aggregateStatus: ProfessionalBookingPaymentStatus = [
      "capture_pending",
      "cancel_pending",
    ].includes(String(payment.status))
      ? (payment.status as ProfessionalBookingPaymentStatus)
      : "authorized";
    return updatePaymentStatus(service, payment, aggregateStatus, {
      authorized_at: payment.authorized_at ?? new Date().toISOString(),
      authorization_expires_at: authorizationExpiresAt,
      latest_error_code: null,
    });
  }

  if (intent.status === "succeeded") {
    await updateAttemptFromStripe(service, attempt, {
      status: "captured",
      authorizationExpiresAt,
      livemode: intent.livemode,
    });
    const aggregateStatus: ProfessionalBookingPaymentStatus =
      payment.status === "refund_pending" ? "refund_pending" : "captured";
    return updatePaymentStatus(service, payment, aggregateStatus, {
      captured_at: payment.captured_at ?? new Date().toISOString(),
      authorization_expires_at: authorizationExpiresAt,
      latest_error_code: null,
    });
  }

  if (intent.status === "canceled") {
    const appointment = await loadAppointment(
      service,
      String(payment.appointment_request_id),
    ).catch(() => null);
    const terminal =
      appointment && TERMINAL_APPOINTMENT_STATUSES.has(String(appointment.status));
    if (!terminal) {
      await cancelAppointmentForExpiredAuthorization(service, payment);
    }
    await updateAttemptFromStripe(service, attempt, {
      status: terminal ? "canceled" : "expired",
      authorizationExpiresAt,
      livemode: intent.livemode,
    });
    return updatePaymentStatus(
      service,
      payment,
      terminal ? "canceled" : "authorization_expired",
      {
        canceled_at: terminal
          ? payment.canceled_at ?? new Date().toISOString()
          : payment.canceled_at,
        authorization_expires_at: authorizationExpiresAt,
        latest_error_code: null,
      },
    );
  }

  if (session?.status === "expired") {
    await cancelAppointmentForExpiredAuthorization(service, payment);
    await updateAttemptFromStripe(service, attempt, {
      status: "expired",
      authorizationExpiresAt,
      livemode: intent.livemode,
    });
    return updatePaymentStatus(service, payment, "authorization_expired", {
      authorization_expires_at: authorizationExpiresAt,
      latest_error_code: null,
    });
  }

  return payment;
}

async function existingOpenCheckoutResult(
  service: Service,
  paymentId: string,
  attempt: Row | null,
): Promise<CheckoutResult | null> {
  if (!attempt?.stripe_checkout_session_id) return null;
  try {
    const existingSession = await getStripe().checkout.sessions.retrieve(
      String(attempt.stripe_checkout_session_id),
    );
    if (existingSession.status === "open" && existingSession.url) {
      return {
        paymentId,
        checkoutUrl: existingSession.url,
        paymentRequired: true,
      };
    }
  } catch (error) {
    console.warn("Professional Booking existing Checkout Session lookup failed:", {
      paymentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return null;
}

async function createCheckoutAttempt(
  request: NextRequest,
  service: Service,
  rawPayment: Row,
  requesterEmail: string | null | undefined,
): Promise<CheckoutResult> {
  let payment = await syncProfessionalBookingPayment(service, rawPayment);
  const appointment = await loadAppointment(
    service,
    String(payment.appointment_request_id),
  );
  if (!AUTHORIZATION_OPEN_APPOINTMENT_STATUSES.has(String(appointment.status))) {
    throw new AppointmentsError(
      "Payment authorization is no longer available for this appointment request.",
      409,
      "professional_booking_payment_checkout_closed",
    );
  }

  if (["authorized", "capture_pending", "captured"].includes(String(payment.status))) {
    return {
      paymentId: String(payment.id),
      checkoutUrl: null,
      paymentRequired: true,
    };
  }
  if (payment.status !== "checkout_pending") {
    throw new AppointmentsError(
      "This Professional Booking payment authorization is closed. Submit a new booking request if you still want the appointment.",
      409,
      "professional_booking_payment_checkout_closed",
    );
  }

  const previousAttempt = await latestAttempt(service, String(payment.id));
  const previousCheckout = await existingOpenCheckoutResult(
    service,
    String(payment.id),
    previousAttempt,
  );
  if (previousCheckout) return previousCheckout;

  const { data: attempt, error: attemptError } = await service
    .from("professional_booking_payment_attempts")
    .insert({
      payment_id: payment.id,
      status: "checkout_pending",
    })
    .select("id")
    .single();
  if (attemptError || !attempt?.id) {
    if (isUniqueViolation(attemptError)) {
      const activeAttempt = await latestAttempt(service, String(payment.id));
      const activeCheckout = await existingOpenCheckoutResult(
        service,
        String(payment.id),
        activeAttempt,
      );
      if (activeCheckout) return activeCheckout;
      throw new AppointmentsError(
        "This Professional Booking payment authorization is already being prepared. Refresh before trying again.",
        409,
        "professional_booking_payment_checkout_in_progress",
      );
    }
    throw new AppointmentsError(
      "Unable to prepare the Professional Booking payment authorization.",
      503,
      "professional_booking_payment_attempt_create_failed",
    );
  }

  const attemptId = String(attempt.id);
  const { data: appointmentService, error: serviceError } = await service
    .from("business_appointment_services")
    .select("name")
    .eq("id", payment.service_id)
    .maybeSingle();
  if (serviceError) {
    await markAttemptFailed(service, attemptId).catch(() => null);
    throw new AppointmentsError(
      "Unable to prepare the Professional Booking payment description.",
      503,
      "professional_booking_payment_service_unavailable",
    );
  }

  const stripe = getStripeForNewMoney();
  const origin = new URL(request.url).origin;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        client_reference_id: String(payment.requester_id),
        customer_email: requesterEmail || undefined,
        submit_type: "book",
        success_url: `${origin}/appointments/professional-payment?checkout=authorized`,
        cancel_url: `${origin}/appointments/professional-payment?checkout=cancelled`,
        metadata: {
          product: PROFESSIONAL_BOOKING_PAYMENT_PRODUCT,
          payment_id: String(payment.id),
          payment_attempt_id: attemptId,
          appointment_request_id: String(payment.appointment_request_id),
          provider_payment_terms_version: String(
            payment.provider_payment_terms_version,
          ),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: Number(payment.gross_amount_cents),
              product_data: {
                name: `Professional Booking: ${text(appointmentService?.name, 120) || "Appointment"}`,
              },
            },
          },
        ],
        payment_intent_data: {
          capture_method: "manual",
          application_fee_amount: Number(payment.platform_fee_cents),
          transfer_data: {
            destination: String(payment.stripe_destination_account_id),
          },
          metadata: {
            product: PROFESSIONAL_BOOKING_PAYMENT_PRODUCT,
            payment_id: String(payment.id),
            payment_attempt_id: attemptId,
            appointment_request_id: String(payment.appointment_request_id),
            requester_id: String(payment.requester_id),
            provider_id: String(payment.provider_id),
            provider_payment_terms_version: String(
              payment.provider_payment_terms_version,
            ),
          },
        },
      },
      {
        idempotencyKey: `professional-booking-checkout:${payment.id}:${attemptId}`,
      },
    );
  } catch (error) {
    await markAttemptFailed(service, attemptId).catch(() => null);
    throw new AppointmentsError(
      "Stripe could not start the Professional Booking payment authorization.",
      503,
      "professional_booking_payment_checkout_failed",
    );
  }

  if (!session.url) {
    await markAttemptFailed(service, attemptId).catch(() => null);
    throw new AppointmentsError(
      "Stripe did not return a payment authorization page.",
      503,
      "professional_booking_payment_checkout_url_missing",
    );
  }

  try {
    await updateAttemptFromStripe(
      service,
      { id: attemptId },
      {
        sessionId: session.id,
        paymentIntentId: paymentIntentId(session.payment_intent),
        status: "checkout_pending",
        livemode: session.livemode,
      },
    );
  } catch (error) {
    try {
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(session.id);
      }
    } catch (cleanupError) {
      console.error("Unable to expire orphaned Professional Booking Checkout Session:", {
        paymentId: payment.id,
        sessionId: session.id,
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
      });
    }
    await markAttemptFailed(service, attemptId).catch(() => null);
    throw error;
  }

  payment = await updatePaymentStatus(service, payment, "checkout_pending", {
    latest_error_code: null,
  });

  return {
    paymentId: String(payment.id),
    checkoutUrl: session.url,
    paymentRequired: true,
  };
}

async function cancelNewAppointmentShell(
  service: Service,
  requestId: string,
  requesterId: string,
) {
  const { error } = await service
    .from("business_appointment_requests")
    .update({ status: "cancelled", acted_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("requester_id", requesterId)
    .eq("status", "pending");
  if (error) {
    console.error("Unable to cancel failed paid appointment shell:", {
      requestId,
      error: error.message,
    });
  }
}

export async function prepareProfessionalBookingPaymentForNewRequest(
  request: NextRequest,
  appointmentRequestId: string,
): Promise<CheckoutResult | null> {
  if (!professionalBookingPaymentsEnabled()) return null;

  const viewer = await requireViewer(request);
  const service = viewer.service;
  const appointment = await loadAppointment(service, appointmentRequestId);
  if (String(appointment.requester_id) !== viewer.user.id) {
    throw new AppointmentsError(
      "Appointment request not found.",
      404,
      "appointment_not_found",
    );
  }

  const priceSnapshot = normalizeProfessionalBookingPriceSnapshot(
    appointment.professional_booking_price_snapshot,
  );
  if (!priceSnapshot) return null;

  try {
    if (
      priceSnapshot.amountCents < PAYMENT_MINIMUM_CENTS ||
      priceSnapshot.amountCents > PAYMENT_MAXIMUM_CENTS
    ) {
      throw new AppointmentsError(
        `Online Professional Booking payments must be between $0.50 and $999,999.99.`,
        409,
        "professional_booking_payment_amount_unsupported",
      );
    }

    const providerId = String(appointment.provider_id);
    let subscription;
    try {
      subscription = await getResolvedGeneralSubscriptionForUser(providerId);
    } catch {
      throw new AppointmentsError(
        "The provider's Professional Booking subscription could not be verified for payment.",
        503,
        "professional_booking_payment_subscription_unavailable",
      );
    }

    const providerPlan = subscription.isAdminOverride ? "pro" : subscription.plan;
    if (
      !subscription.isAdminOverride &&
      !evaluateSubscriptionEntitlement(
        providerPlan,
        "professional_booking",
      ).allowed
    ) {
      throw new AppointmentsError(
        "This provider is no longer eligible to collect a Professional Booking payment.",
        409,
        "professional_booking_payment_provider_ineligible",
      );
    }

    let paymentReview;
    try {
      paymentReview =
        await getProfessionalBookingProviderPaymentReviewState(
          service,
          providerId,
        );
    } catch (error) {
      if (error instanceof ProfessionalBookingProviderPaymentReviewError) {
        throw new AppointmentsError(
          error.message,
          error.status,
          error.code,
        );
      }
      throw error;
    }

    if (!paymentReview.paymentEligible) {
      throw new AppointmentsError(
        "This provider's current Professional Booking payment eligibility is not approved.",
        409,
        "professional_booking_payment_provider_review_required",
      );
    }

    const providerPaymentTerms = await requireCurrentProviderPaymentTerms(
      service,
      providerId,
    );

    const { data: payout, error: payoutError } = await service
      .from("member_payout_accounts")
      .select(
        "stripe_account_id, details_submitted, charges_enabled, payouts_enabled",
      )
      .eq("member_id", providerId)
      .maybeSingle();
    if (payoutError) {
      throw new AppointmentsError(
        "The provider's payout account could not be verified.",
        503,
        "professional_booking_payment_payout_unavailable",
      );
    }
    if (
      !payout?.stripe_account_id ||
      payout.details_submitted !== true ||
      payout.charges_enabled !== true ||
      payout.payouts_enabled !== true
    ) {
      throw new AppointmentsError(
        "This provider has not finished Professional Booking payout setup yet.",
        409,
        "professional_booking_payment_provider_not_ready",
      );
    }

    const fee = calculateServiceTransactionFee({
      grossAmountCents: priceSnapshot.amountCents,
      providerPlan,
    });
    const { data: payment, error: paymentError } = await service
      .from("professional_booking_payments")
      .insert({
        appointment_request_id: appointmentRequestId,
        service_id: appointment.service_id,
        provider_id: providerId,
        requester_id: viewer.user.id,
        status: "checkout_pending",
        gross_amount_cents: fee.grossAmountCents,
        currency: fee.currency,
        fee_schedule_version: fee.feeScheduleVersion,
        platform_fee_bps: fee.platformFeeBps,
        platform_fee_cents: fee.platformFeeCents,
        provider_net_before_processing_cents:
          fee.providerNetBeforeProcessingCents,
        provider_plan: fee.providerPlan,
        reduced_service_fee_applied: fee.reducedServiceFeeApplied,
        provider_payment_terms_version: providerPaymentTerms.version,
        provider_payment_terms_accepted_at: providerPaymentTerms.acceptedAt,
        stripe_destination_account_id: payout.stripe_account_id,
      })
      .select("*")
      .single();
    if (paymentError || !payment) {
      throw new AppointmentsError(
        isSchemaUnavailable(paymentError)
          ? "Professional Booking payment storage is not available yet."
          : "Unable to save the Professional Booking payment contract.",
        503,
        isSchemaUnavailable(paymentError)
          ? "professional_booking_payment_schema_unavailable"
          : "professional_booking_payment_create_failed",
      );
    }

    return await createCheckoutAttempt(
      request,
      service,
      payment as Row,
      viewer.user.email,
    );
  } catch (error) {
    await cancelNewAppointmentShell(
      service,
      appointmentRequestId,
      viewer.user.id,
    );
    throw error;
  }
}

async function requireCurrentIntent(
  service: Service,
  payment: Row,
): Promise<{ attempt: Row; intent: Stripe.PaymentIntent }> {
  const attempt = await latestAttempt(service, String(payment.id));
  const intentId = text(attempt?.stripe_payment_intent_id, 255);
  if (!attempt || !intentId) {
    throw new AppointmentsError(
      "The requester must authorize payment before this appointment can be accepted.",
      409,
      "professional_booking_payment_authorization_required",
    );
  }
  const intent = await getStripe().paymentIntents.retrieve(intentId, {
    expand: ["latest_charge"],
  });
  validateStripeContract(payment, intent);
  return { attempt, intent };
}

async function ensureCapturedForAcceptance(
  service: Service,
  rawPayment: Row,
): Promise<CapturedForAcceptance> {
  let payment = await syncProfessionalBookingPayment(service, rawPayment);
  if (payment.status === "captured") {
    return { payment, capturedByThisCall: false };
  }

  const { intent } = await requireCurrentIntent(service, payment);
  if (intent.status === "succeeded") {
    payment = await syncProfessionalBookingPayment(service, payment);
    if (payment.status === "captured") {
      return { payment, capturedByThisCall: false };
    }
  }

  if (intent.status !== "requires_capture") {
    if (intent.status === "canceled") {
      throw new AppointmentsError(
        "This payment authorization expired or was released, so the appointment request was cancelled. Submit a new booking request to continue.",
        409,
        "professional_booking_payment_authorization_expired",
      );
    }
    throw new AppointmentsError(
      "The requester must finish payment authorization before this appointment can be accepted.",
      409,
      "professional_booking_payment_authorization_required",
    );
  }

  if (intent.livemode && !professionalBookingLivePaymentsAllowed()) {
    throw new AppointmentsError(
      "Live Professional Booking payment capture is not enabled.",
      503,
      "professional_booking_live_payments_disabled",
    );
  }

  if (payment.status === "capture_pending") {
    const refreshed = await syncProfessionalBookingPayment(
      service,
      await loadPaymentById(service, String(payment.id)),
    );
    if (refreshed.status === "captured") {
      return { payment: refreshed, capturedByThisCall: false };
    }
    throw new AppointmentsError(
      "This Professional Booking payment is already being captured. Refresh the appointment before trying again.",
      409,
      "professional_booking_payment_capture_in_progress",
    );
  }

  const { data: claimed, error: claimError } = await service
    .from("professional_booking_payments")
    .update({
      status: "capture_pending",
      updated_at: new Date().toISOString(),
      latest_error_code: null,
    })
    .eq("id", payment.id)
    .eq("status", "authorized")
    .select("id")
    .maybeSingle();
  if (claimError) {
    throw new AppointmentsError(
      "Unable to lock this payment for capture.",
      503,
      "professional_booking_payment_capture_lock_failed",
    );
  }
  if (!claimed) {
    payment = await syncProfessionalBookingPayment(
      service,
      await loadPaymentById(service, String(payment.id)),
    );
    if (payment.status === "captured") {
      return { payment, capturedByThisCall: false };
    }
    if (payment.status === "capture_pending") {
      throw new AppointmentsError(
        "This Professional Booking payment is already being captured. Refresh the appointment before trying again.",
        409,
        "professional_booking_payment_capture_in_progress",
      );
    }
    throw new AppointmentsError(
      "This payment authorization changed before it could be captured. Refresh and try again.",
      409,
      "professional_booking_payment_state_changed",
    );
  }

  payment = { ...payment, status: "capture_pending" };
  try {
    await getStripe().paymentIntents.capture(
      intent.id,
      {},
      { idempotencyKey: `professional-booking-capture:${payment.id}` },
    );
  } catch (error) {
    const refreshed = await syncProfessionalBookingPayment(
      service,
      await loadPaymentById(service, String(payment.id)),
    ).catch(() => null);
    if (refreshed?.status === "captured") {
      return { payment: refreshed, capturedByThisCall: true };
    }
    await updatePaymentStatus(service, payment, "authorized", {
      latest_error_code: "professional_booking_payment_capture_failed",
    }).catch(() => null);
    throw new AppointmentsError(
      "The payment authorization could not be captured. The appointment was not accepted.",
      503,
      "professional_booking_payment_capture_failed",
    );
  }

  payment = await syncProfessionalBookingPayment(
    service,
    await loadPaymentById(service, String(payment.id)),
  );
  if (payment.status !== "captured") {
    throw new AppointmentsError(
      "Stripe did not confirm capture. The appointment was not accepted.",
      503,
      "professional_booking_payment_capture_unconfirmed",
    );
  }
  return { payment, capturedByThisCall: true };
}

async function expireOpenCheckout(service: Service, payment: Row) {
  const attempt = await latestAttempt(service, String(payment.id));
  const sessionId = text(attempt?.stripe_checkout_session_id, 255);
  if (!attempt || !sessionId) return;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.status === "open") {
      await getStripe().checkout.sessions.expire(
        session.id,
        {},
        { idempotencyKey: `professional-booking-expire:${attempt.id}` },
      );
    }
  } catch (error) {
    console.warn("Unable to expire Professional Booking Checkout Session:", {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function cancelAuthorization(
  service: Service,
  rawPayment: Row,
): Promise<Row> {
  let payment = await syncProfessionalBookingPayment(service, rawPayment);
  if (["canceled", "authorization_expired", "refunded"].includes(String(payment.status))) {
    return payment;
  }
  if (payment.status === "captured" || payment.status === "refund_pending") {
    return refundCapturedPayment(service, payment);
  }

  await updatePaymentStatus(service, payment, "cancel_pending").catch(() => null);
  await expireOpenCheckout(service, payment);
  const attempt = await latestAttempt(service, String(payment.id));
  const intentId = text(attempt?.stripe_payment_intent_id, 255);
  if (intentId) {
    try {
      const intent = await getStripe().paymentIntents.retrieve(intentId);
      if (intent.status === "succeeded") {
        payment = await syncProfessionalBookingPayment(service, payment);
        return refundCapturedPayment(service, payment);
      }
      if (intent.status !== "canceled") {
        await getStripe().paymentIntents.cancel(
          intent.id,
          {},
          { idempotencyKey: `professional-booking-cancel:${payment.id}` },
        );
      }
    } catch (error) {
      console.error("Unable to release Professional Booking authorization:", {
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
      await updatePaymentStatus(service, payment, "cancel_pending", {
        latest_error_code: "professional_booking_payment_cancel_failed",
      }).catch(() => null);
      return payment;
    }
  }

  if (attempt) {
    await updateAttemptFromStripe(service, attempt, { status: "canceled" }).catch(() => null);
  }
  return updatePaymentStatus(service, payment, "canceled", {
    canceled_at: payment.canceled_at ?? new Date().toISOString(),
    latest_error_code: null,
  });
}

async function refundCapturedPayment(
  service: Service,
  rawPayment: Row,
): Promise<Row> {
  let payment = await syncProfessionalBookingPayment(service, rawPayment);
  if (payment.status === "refunded") return payment;
  if (payment.status !== "captured" && payment.status !== "refund_pending") {
    return cancelAuthorization(service, payment);
  }

  const { intent } = await requireCurrentIntent(service, payment);
  if (intent.status !== "succeeded") {
    payment = await syncProfessionalBookingPayment(service, payment);
    if (payment.status === "refunded") return payment;
    throw new AppointmentsError(
      "The captured payment could not be verified for refund.",
      503,
      "professional_booking_payment_refund_unavailable",
    );
  }

  payment = await updatePaymentStatus(service, payment, "refund_pending");
  try {
    const refund = await getStripe().refunds.create(
      {
        payment_intent: intent.id,
        reverse_transfer: true,
        refund_application_fee: true,
        metadata: {
          product: PROFESSIONAL_BOOKING_PAYMENT_PRODUCT,
          payment_id: String(payment.id),
          appointment_request_id: String(payment.appointment_request_id),
        },
      },
      { idempotencyKey: `professional-booking-refund:${payment.id}` },
    );
    return updatePaymentStatus(
      service,
      payment,
      refund.status === "succeeded" ? "refunded" : "refund_pending",
      {
        stripe_refund_id: refund.id,
        refunded_at:
          refund.status === "succeeded"
            ? payment.refunded_at ?? new Date().toISOString()
            : payment.refunded_at,
        latest_error_code: null,
      },
    );
  } catch (error) {
    console.error("Professional Booking full refund failed:", {
      paymentId: payment.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return updatePaymentStatus(service, payment, "refund_pending", {
      latest_error_code: "professional_booking_payment_refund_failed",
    });
  }
}

async function settleTerminalPaymentByRequestId(
  service: Service,
  requestId: string,
) {
  const payment = await loadPaymentByRequestId(service, requestId);
  if (!payment) return;
  try {
    const synced = await syncProfessionalBookingPayment(service, payment);
    if (["captured", "refund_pending"].includes(String(synced.status))) {
      await refundCapturedPayment(service, synced);
      return;
    }
    await cancelAuthorization(service, synced);
  } catch (error) {
    console.error("Professional Booking terminal payment reconciliation failed:", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function compensateFailedAcceptance(
  service: Service,
  payment: Row,
  requestId: string,
) {
  try {
    const appointment = await loadAppointment(service, requestId).catch(() => null);
    if (appointment?.status === "accepted") {
      return;
    }
    await refundCapturedPayment(service, payment);
  } catch (error) {
    console.error("Professional Booking failed-acceptance refund reconciliation failed:", {
      paymentId: payment.id,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function assertPricedAcceptanceHasPayment(
  service: Service,
  requestId: string,
  viewerId: string,
  viewerRole: "provider" | "requester",
) {
  const appointment = await loadAppointment(service, requestId);
  const expectedViewerId =
    viewerRole === "provider"
      ? String(appointment.provider_id)
      : String(appointment.requester_id);

  if (expectedViewerId !== viewerId) return;

  const priceSnapshot = normalizeProfessionalBookingPriceSnapshot(
    appointment.professional_booking_price_snapshot,
  );
  if (!priceSnapshot) return;

  throw new AppointmentsError(
    "This paid Professional Booking request has no payment authorization. Submit a new booking request after payments are enabled.",
    409,
    "professional_booking_payment_authorization_required",
  );
}

export async function runProviderResponseWithProfessionalBookingPayment<T>(
  request: NextRequest,
  input: AppointmentInput,
  operation: CoreOperation<T>,
): Promise<T> {
  const requestId = uuid(input.requestId);
  if (!requestId) return operation();
  const viewer = await requireViewer(request);
  const decision = text(input.decision, 40);
  const payment = await loadPaymentByRequestId(viewer.service, requestId);

  if (!payment) {
    if (decision === "accept") {
      await assertPricedAcceptanceHasPayment(
        viewer.service,
        requestId,
        viewer.user.id,
        "provider",
      );
    }
    return operation();
  }

  if (String(payment.provider_id) !== viewer.user.id) return operation();

  if (decision === "accept") {
    const capture = await ensureCapturedForAcceptance(viewer.service, payment);
    try {
      return await operation();
    } catch (error) {
      if (capture.capturedByThisCall) {
        await compensateFailedAcceptance(
          viewer.service,
          capture.payment,
          requestId,
        );
      }
      throw error;
    }
  }

  const result = await operation();
  if (decision === "decline" || decision === "cancel") {
    await settleTerminalPaymentByRequestId(viewer.service, requestId);
  }
  return result;
}

export async function runRequesterActionWithProfessionalBookingPayment<T>(
  request: NextRequest,
  input: AppointmentInput,
  operation: CoreOperation<T>,
): Promise<T> {
  const requestId = uuid(input.requestId);
  if (!requestId) return operation();
  const viewer = await requireViewer(request);
  const action = text(input.requestAction, 40);
  const payment = await loadPaymentByRequestId(viewer.service, requestId);

  if (!payment) {
    if (action === "accept_reschedule") {
      await assertPricedAcceptanceHasPayment(
        viewer.service,
        requestId,
        viewer.user.id,
        "requester",
      );
    }
    return operation();
  }

  if (String(payment.requester_id) !== viewer.user.id) return operation();

  if (action === "accept_reschedule") {
    const capture = await ensureCapturedForAcceptance(viewer.service, payment);
    try {
      return await operation();
    } catch (error) {
      if (capture.capturedByThisCall) {
        await compensateFailedAcceptance(
          viewer.service,
          capture.payment,
          requestId,
        );
      }
      throw error;
    }
  }

  const result = await operation();
  if (action === "cancel") {
    await settleTerminalPaymentByRequestId(viewer.service, requestId);
  }
  return result;
}

function toPaymentSummary(
  payment: Row,
  appointment: Row,
  serviceName: string,
  userId: string,
): ProfessionalBookingPaymentSummary {
  const requester = String(payment.requester_id) === userId;
  const appointmentStatus = String(appointment.status ?? "unknown");
  const paymentStatus = String(payment.status) as ProfessionalBookingPaymentStatus;
  return {
    id: String(payment.id),
    appointmentRequestId: String(payment.appointment_request_id),
    role: requester ? "requester" : "provider",
    serviceName,
    appointmentStatus,
    paymentStatus,
    grossAmountCents: Number(payment.gross_amount_cents),
    currency: "usd",
    feeScheduleVersion: String(payment.fee_schedule_version),
    platformFeeBps: Number(payment.platform_fee_bps),
    platformFeeCents: Number(payment.platform_fee_cents),
    providerNetBeforeProcessingCents: Number(
      payment.provider_net_before_processing_cents,
    ),
    providerPlan: payment.provider_plan,
    reducedServiceFeeApplied: payment.reduced_service_fee_applied === true,
    authorizationExpiresAt: payment.authorization_expires_at
      ? String(payment.authorization_expires_at)
      : null,
    authorizedAt: payment.authorized_at ? String(payment.authorized_at) : null,
    capturedAt: payment.captured_at ? String(payment.captured_at) : null,
    canceledAt: payment.canceled_at ? String(payment.canceled_at) : null,
    refundedAt: payment.refunded_at ? String(payment.refunded_at) : null,
    canCheckout:
      requester &&
      AUTHORIZATION_OPEN_APPOINTMENT_STATUSES.has(appointmentStatus) &&
      paymentStatus === "checkout_pending",
    canRefresh: true,
  };
}

export async function listProfessionalBookingPayments(
  request: NextRequest,
): Promise<ProfessionalBookingPaymentListResponse> {
  const viewer = await requireViewer(request);
  const { data, error } = await viewer.service
    .from("professional_booking_payments")
    .select("*")
    .or(`requester_id.eq.${viewer.user.id},provider_id.eq.${viewer.user.id}`)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    if (isSchemaUnavailable(error)) {
      return {
        paymentsEnabled: professionalBookingPaymentsEnabled(),
        livePaymentsAllowed: professionalBookingLivePaymentsAllowed(),
        payments: [],
      };
    }
    throw new AppointmentsError(
      "Unable to load Professional Booking payments.",
      503,
      "professional_booking_payments_unavailable",
    );
  }

  const payments = (data ?? []) as Row[];
  const requestIds = payments.map((row) => String(row.appointment_request_id));
  const serviceIds = payments.map((row) => String(row.service_id));
  const [appointmentsResult, servicesResult] = await Promise.all([
    requestIds.length
      ? viewer.service
          .from("business_appointment_requests")
          .select("id, status")
          .in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? viewer.service
          .from("business_appointment_services")
          .select("id, name")
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (appointmentsResult.error || servicesResult.error) {
    throw new AppointmentsError(
      "Unable to load Professional Booking payment details.",
      503,
      "professional_booking_payment_details_unavailable",
    );
  }
  const appointments = new Map(
    ((appointmentsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );
  const services = new Map(
    ((servicesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
  );

  return {
    paymentsEnabled: professionalBookingPaymentsEnabled(),
    livePaymentsAllowed: professionalBookingLivePaymentsAllowed(),
    payments: payments
      .map((payment) => {
        const appointment = appointments.get(String(payment.appointment_request_id));
        if (!appointment) return null;
        return toPaymentSummary(
          payment,
          appointment,
          text(services.get(String(payment.service_id))?.name, 200) || "Professional Booking",
          viewer.user.id,
        );
      })
      .filter((item): item is ProfessionalBookingPaymentSummary => Boolean(item)),
  };
}

export async function startProfessionalBookingPaymentCheckout(
  request: NextRequest,
  rawPaymentId: unknown,
) {
  if (!professionalBookingPaymentsEnabled()) {
    throw new AppointmentsError(
      "New Professional Booking payment authorizations are not enabled.",
      503,
      "professional_booking_payments_disabled",
    );
  }
  const paymentId = uuid(rawPaymentId);
  if (!paymentId) {
    throw new AppointmentsError(
      "Invalid Professional Booking payment id.",
      400,
      "invalid_professional_booking_payment_id",
    );
  }
  const viewer = await requireViewer(request);
  const payment = await loadPaymentById(viewer.service, paymentId);
  if (String(payment.requester_id) !== viewer.user.id) {
    throw new AppointmentsError(
      "Professional Booking payment not found.",
      404,
      "professional_booking_payment_not_found",
    );
  }
  return createCheckoutAttempt(
    request,
    viewer.service,
    payment,
    viewer.user.email,
  );
}

export async function refreshProfessionalBookingPayment(
  request: NextRequest,
  rawPaymentId: unknown,
) {
  const paymentId = uuid(rawPaymentId);
  if (!paymentId) {
    throw new AppointmentsError(
      "Invalid Professional Booking payment id.",
      400,
      "invalid_professional_booking_payment_id",
    );
  }
  const viewer = await requireViewer(request);
  let payment = await loadPaymentById(viewer.service, paymentId);
  if (
    String(payment.requester_id) !== viewer.user.id &&
    String(payment.provider_id) !== viewer.user.id
  ) {
    throw new AppointmentsError(
      "Professional Booking payment not found.",
      404,
      "professional_booking_payment_not_found",
    );
  }
  payment = await syncProfessionalBookingPayment(viewer.service, payment);
  const appointment = await loadAppointment(
    viewer.service,
    String(payment.appointment_request_id),
  );
  if (TERMINAL_APPOINTMENT_STATUSES.has(String(appointment.status))) {
    await settleTerminalPaymentByRequestId(
      viewer.service,
      String(payment.appointment_request_id),
    );
    payment = await loadPaymentById(viewer.service, paymentId);
  }
  const { data: serviceRow } = await viewer.service
    .from("business_appointment_services")
    .select("name")
    .eq("id", payment.service_id)
    .maybeSingle();
  return toPaymentSummary(
    payment,
    appointment,
    text(serviceRow?.name, 200) || "Professional Booking",
    viewer.user.id,
  );
}

const RESOLVED_PROFESSIONAL_BOOKING_DISPUTE_STATUSES =
  new Set<Stripe.Dispute.Status>([
    "lost",
    "prevented",
    "warning_closed",
    "won",
  ]);

const PROFESSIONAL_BOOKING_DISPUTE_STATUS_ORDER:
  Record<Stripe.Dispute.Status, number> = {
    warning_needs_response: 10,
    needs_response: 10,
    warning_under_review: 20,
    under_review: 20,
    warning_closed: 30,
    prevented: 30,
    won: 30,
    lost: 30,
  };

function stripeResourceId(
  value: string | { id: string } | null | undefined,
) {
  return typeof value === "string"
    ? value
    : value?.id ?? null;
}

function stripeTimestamp(seconds: number) {
  return new Date(seconds * 1000).toISOString();
}

async function professionalBookingDisputeAssociation(
  service: Service,
  dispute: Stripe.Dispute,
): Promise<{
  paymentId: string;
  paymentIntentId: string;
  chargeId: string;
  attemptLivemode: boolean | null;
} | null> {
  const chargeId = stripeResourceId(dispute.charge);
  if (!chargeId) return null;

  let intentId = stripeResourceId(dispute.payment_intent);

  if (!intentId) {
    const charge =
      typeof dispute.charge === "string"
        ? await getStripe().charges.retrieve(dispute.charge)
        : dispute.charge;

    intentId = stripeResourceId(charge?.payment_intent);
  }

  if (!intentId) return null;

  const { data, error } = await service
    .from("professional_booking_payment_attempts")
    .select("payment_id,livemode")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (error) {
    if (isSchemaUnavailable(error)) return null;
    throw error;
  }

  const paymentId = uuid(data?.payment_id);
  if (!paymentId) return null;

  return {
    paymentId,
    paymentIntentId: intentId,
    chargeId,
    attemptLivemode:
      typeof data?.livemode === "boolean"
        ? data.livemode
        : null,
  };
}

async function syncProfessionalBookingDisputeEvent(
  service: Service,
  event: Stripe.Event,
  dispute: Stripe.Dispute,
): Promise<boolean> {
  const association =
    await professionalBookingDisputeAssociation(service, dispute);

  if (!association) return false;

  const payment = await loadPaymentById(
    service,
    association.paymentId,
  );

  const currency = text(dispute.currency, 10).toLowerCase();
  const paymentCurrency = text(payment.currency, 10).toLowerCase();

  if (
    currency !== "usd" ||
    paymentCurrency !== currency ||
    !Number.isSafeInteger(dispute.amount) ||
    dispute.amount <= 0
  ) {
    throw new AppointmentsError(
      "The Stripe dispute does not match the Professional Booking payment contract.",
      503,
      "professional_booking_dispute_contract_mismatch",
    );
  }

  if (
    association.attemptLivemode !== null &&
    association.attemptLivemode !== dispute.livemode
  ) {
    throw new AppointmentsError(
      "The Stripe dispute live mode does not match the Professional Booking payment attempt.",
      503,
      "professional_booking_dispute_livemode_mismatch",
    );
  }

  const reason = text(dispute.reason, 200);
  if (!reason) {
    throw new AppointmentsError(
      "The Stripe dispute reason is unavailable.",
      503,
      "professional_booking_dispute_contract_mismatch",
    );
  }

  const eventCreatedAt = stripeTimestamp(event.created);
  const stripeCreatedAt = stripeTimestamp(dispute.created);
  const evidenceDueAt =
    dispute.evidence_details.due_by &&
    dispute.evidence_details.due_by > 0
      ? stripeTimestamp(dispute.evidence_details.due_by)
      : null;
  const incomingResolved =
    RESOLVED_PROFESSIONAL_BOOKING_DISPUTE_STATUSES.has(
      dispute.status,
    );

  const { data: existing, error: existingError } = await service
    .from("professional_booking_payment_disputes")
    .select(
      "id,payment_id,stripe_dispute_id,stripe_charge_id,stripe_payment_intent_id,livemode,stripe_created_at,status,last_stripe_event_id,last_event_created_at,resolved_at",
    )
    .eq("stripe_dispute_id", dispute.id)
    .maybeSingle();

  if (existingError) {
    throw new AppointmentsError(
      isSchemaUnavailable(existingError)
        ? "Professional Booking dispute storage is not available yet."
        : "Unable to load the Professional Booking dispute.",
      503,
      isSchemaUnavailable(existingError)
        ? "professional_booking_dispute_schema_unavailable"
        : "professional_booking_dispute_unavailable",
    );
  }

  if (existing) {
    if (
      String(existing.payment_id) !== association.paymentId ||
      String(existing.stripe_charge_id) !== association.chargeId ||
      String(existing.stripe_payment_intent_id) !==
        association.paymentIntentId ||
      existing.livemode !== dispute.livemode ||
      new Date(String(existing.stripe_created_at)).getTime() !==
        dispute.created * 1000
    ) {
      throw new AppointmentsError(
        "The Stripe dispute identity does not match its stored Professional Booking dispute.",
        503,
        "professional_booking_dispute_identity_mismatch",
      );
    }

    const existingEventMs =
      new Date(String(existing.last_event_created_at)).getTime();
    const incomingEventMs = event.created * 1000;

    if (
      Number.isFinite(existingEventMs) &&
      incomingEventMs < existingEventMs
    ) {
      return true;
    }

    if (
      incomingEventMs === existingEventMs &&
      String(existing.last_stripe_event_id) === event.id
    ) {
      return true;
    }

    const existingStatus =
      text(existing.status, 40) as Stripe.Dispute.Status;
    const existingResolved =
      RESOLVED_PROFESSIONAL_BOOKING_DISPUTE_STATUSES.has(
        existingStatus,
      );

    if (existingResolved && !incomingResolved) {
      return true;
    }

    if (
      incomingEventMs === existingEventMs &&
      PROFESSIONAL_BOOKING_DISPUTE_STATUS_ORDER[dispute.status] <
        PROFESSIONAL_BOOKING_DISPUTE_STATUS_ORDER[existingStatus]
    ) {
      return true;
    }

    const { error: updateError } = await service
      .from("professional_booking_payment_disputes")
      .update({
        amount_cents: dispute.amount,
        currency,
        reason,
        status: dispute.status,
        is_charge_refundable: dispute.is_charge_refundable,
        evidence_due_at: evidenceDueAt,
        evidence_has_evidence:
          dispute.evidence_details.has_evidence,
        evidence_past_due:
          dispute.evidence_details.past_due,
        evidence_submission_count:
          dispute.evidence_details.submission_count,
        last_stripe_event_id: event.id,
        last_event_created_at: eventCreatedAt,
        last_synced_at: new Date().toISOString(),
        resolved_at: incomingResolved
          ? existing.resolved_at ?? eventCreatedAt
          : null,
      })
      .eq("id", existing.id);

    if (updateError) {
      throw new AppointmentsError(
        "Unable to update the Professional Booking dispute.",
        503,
        "professional_booking_dispute_update_failed",
      );
    }

    return true;
  }

  const { error: insertError } = await service
    .from("professional_booking_payment_disputes")
    .insert({
      payment_id: association.paymentId,
      stripe_dispute_id: dispute.id,
      stripe_charge_id: association.chargeId,
      stripe_payment_intent_id: association.paymentIntentId,
      livemode: dispute.livemode,
      amount_cents: dispute.amount,
      currency,
      reason,
      status: dispute.status,
      is_charge_refundable: dispute.is_charge_refundable,
      evidence_due_at: evidenceDueAt,
      evidence_has_evidence:
        dispute.evidence_details.has_evidence,
      evidence_past_due:
        dispute.evidence_details.past_due,
      evidence_submission_count:
        dispute.evidence_details.submission_count,
      stripe_created_at: stripeCreatedAt,
      last_stripe_event_id: event.id,
      last_event_created_at: eventCreatedAt,
      last_synced_at: new Date().toISOString(),
      resolved_at: incomingResolved
        ? eventCreatedAt
        : null,
    });

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      return syncProfessionalBookingDisputeEvent(
        service,
        event,
        dispute,
      );
    }

    throw new AppointmentsError(
      isSchemaUnavailable(insertError)
        ? "Professional Booking dispute storage is not available yet."
        : "Unable to save the Professional Booking dispute.",
      503,
      isSchemaUnavailable(insertError)
        ? "professional_booking_dispute_schema_unavailable"
        : "professional_booking_dispute_create_failed",
    );
  }

  return true;
}

async function paymentIdFromStripeEvent(
  service: Service,
  event: Stripe.Event,
): Promise<string | null> {
  const object: any = event.data.object;
  const metadataPaymentId = uuid(object?.metadata?.payment_id);
  if (metadataPaymentId) return metadataPaymentId;

  let intentId: string | null = null;
  if (object?.object === "charge") {
    intentId =
      typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.payment_intent?.id ?? null;
  } else if (object?.object === "refund") {
    intentId =
      typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.payment_intent?.id ?? null;
  }
  if (!intentId) return null;

  const { data, error } = await service
    .from("professional_booking_payment_attempts")
    .select("payment_id")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();
  if (error) {
    if (isSchemaUnavailable(error)) return null;
    throw error;
  }
  return uuid(data?.payment_id);
}

export async function syncProfessionalBookingPaymentStripeEvent(
  event: Stripe.Event,
): Promise<boolean> {
  const disputeTypes = new Set([
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
  ]);

  if (disputeTypes.has(event.type)) {
    return syncProfessionalBookingDisputeEvent(
      createRoomServiceSupabase(),
      event,
      event.data.object as Stripe.Dispute,
    );
  }

  const supported = new Set([
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.amount_capturable_updated",
    "payment_intent.succeeded",
    "payment_intent.canceled",
    "payment_intent.payment_failed",
    "charge.refunded",
    "refund.created",
    "refund.updated",
    "refund.failed",
  ]);
  if (!supported.has(event.type)) return false;

  const object: any = event.data.object;
  const explicitlyProfessional =
    object?.metadata?.product === PROFESSIONAL_BOOKING_PAYMENT_PRODUCT;
  const service = createRoomServiceSupabase();
  const paymentId = await paymentIdFromStripeEvent(service, event);
  if (!paymentId) return false;
  if (
    !explicitlyProfessional &&
    ![
      "charge.refunded",
      "refund.created",
      "refund.updated",
      "refund.failed",
    ].includes(event.type)
  ) {
    return false;
  }

  let payment = await loadPaymentById(service, paymentId);
  payment = await syncProfessionalBookingPayment(service, payment);
  const appointment = await loadAppointment(
    service,
    String(payment.appointment_request_id),
  ).catch(() => null);
  if (appointment && TERMINAL_APPOINTMENT_STATUSES.has(String(appointment.status))) {
    await settleTerminalPaymentByRequestId(
      service,
      String(payment.appointment_request_id),
    );
  }
  return true;
}
