import "server-only";

import Stripe from "stripe";
import { syncProfessionalBookingPaymentStripeEvent } from "@/lib/professional-booking-payment-server";
import { createRoomServiceSupabase } from "@/lib/room-operations";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const ACTIVE_PAYMENT_STATUSES = [
  "checkout_pending",
  "authorized",
  "capture_pending",
  "cancel_pending",
  "refund_pending",
] as const;
const TERMINAL_APPOINTMENT_STATUSES = ["declined", "cancelled"] as const;
const ACTIVE_LIMIT = 100;
const ERROR_LIMIT = 50;
const TERMINAL_LIMIT = 100;

type Row = Record<string, any>;

type ReconciliationFailure = {
  paymentId: string;
  code: string;
};

export type ProfessionalBookingReconciliationResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  scanned: number;
  reconciled: number;
  skipped: number;
  failed: number;
  failures: ReconciliationFailure[];
};

function getStripe() {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("Professional Booking Stripe reconciliation is not configured.");
  }
  return new Stripe(STRIPE_SECRET_KEY);
}

function reconciliationEvent(
  type: Stripe.Event.Type,
  object: Stripe.Event.Data.Object,
  livemode: boolean,
): Stripe.Event {
  return {
    id: `evt_reconcile_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    object: "event",
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    data: { object },
    livemode,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

function paymentIntentEventType(status: Stripe.PaymentIntent.Status): Stripe.Event.Type {
  if (status === "succeeded") return "payment_intent.succeeded";
  if (status === "canceled") return "payment_intent.canceled";
  if (status === "requires_payment_method") return "payment_intent.payment_failed";
  return "payment_intent.amount_capturable_updated";
}

function addRows(target: Map<string, Row>, rows: Row[]) {
  for (const row of rows) {
    if (row?.id) target.set(String(row.id), row);
  }
}

async function loadCandidatePayments(service: ReturnType<typeof createRoomServiceSupabase>) {
  const candidates = new Map<string, Row>();

  const [activeResult, errorResult, terminalAppointmentsResult] = await Promise.all([
    service
      .from("professional_booking_payments")
      .select("id,appointment_request_id,status,latest_error_code,updated_at")
      .in("status", [...ACTIVE_PAYMENT_STATUSES])
      .order("updated_at", { ascending: true })
      .limit(ACTIVE_LIMIT),
    service
      .from("professional_booking_payments")
      .select("id,appointment_request_id,status,latest_error_code,updated_at")
      .not("latest_error_code", "is", null)
      .order("updated_at", { ascending: true })
      .limit(ERROR_LIMIT),
    service
      .from("business_appointment_requests")
      .select("id")
      .in("status", [...TERMINAL_APPOINTMENT_STATUSES])
      .order("acted_at", { ascending: false })
      .limit(TERMINAL_LIMIT),
  ]);

  if (activeResult.error) throw activeResult.error;
  if (errorResult.error) throw errorResult.error;
  if (terminalAppointmentsResult.error) throw terminalAppointmentsResult.error;

  addRows(candidates, (activeResult.data ?? []) as Row[]);
  addRows(candidates, (errorResult.data ?? []) as Row[]);

  const terminalRequestIds = ((terminalAppointmentsResult.data ?? []) as Row[])
    .map((row) => String(row.id))
    .filter(Boolean);

  if (terminalRequestIds.length) {
    const terminalPaymentsResult = await service
      .from("professional_booking_payments")
      .select("id,appointment_request_id,status,latest_error_code,updated_at")
      .in("appointment_request_id", terminalRequestIds)
      .in("status", [
        "checkout_pending",
        "authorized",
        "capture_pending",
        "cancel_pending",
        "captured",
        "refund_pending",
      ]);
    if (terminalPaymentsResult.error) throw terminalPaymentsResult.error;
    addRows(candidates, (terminalPaymentsResult.data ?? []) as Row[]);
  }

  return [...candidates.values()];
}

async function loadLatestAttempts(
  service: ReturnType<typeof createRoomServiceSupabase>,
  paymentIds: string[],
) {
  const attempts = new Map<string, Row>();
  if (!paymentIds.length) return attempts;

  const { data, error } = await service
    .from("professional_booking_payment_attempts")
    .select(
      "id,payment_id,status,stripe_checkout_session_id,stripe_payment_intent_id,livemode,created_at",
    )
    .in("payment_id", paymentIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(paymentIds.length * 3, 100));

  if (error) throw error;
  for (const attempt of (data ?? []) as Row[]) {
    const paymentId = String(attempt.payment_id ?? "");
    if (paymentId && !attempts.has(paymentId)) attempts.set(paymentId, attempt);
  }
  return attempts;
}

async function reconcileOne(
  stripe: Stripe,
  payment: Row,
  attempt: Row | undefined,
) {
  if (!attempt) return false;

  const intentId = String(attempt.stripe_payment_intent_id ?? "").trim();
  if (intentId) {
    const intent = await stripe.paymentIntents.retrieve(intentId, {
      expand: ["latest_charge"],
    });
    return syncProfessionalBookingPaymentStripeEvent(
      reconciliationEvent(
        paymentIntentEventType(intent.status),
        intent,
        intent.livemode,
      ),
    );
  }

  const sessionId = String(attempt.stripe_checkout_session_id ?? "").trim();
  if (!sessionId) return false;

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.status === "open") return false;

  return syncProfessionalBookingPaymentStripeEvent(
    reconciliationEvent(
      session.status === "expired"
        ? "checkout.session.expired"
        : "checkout.session.completed",
      session,
      session.livemode,
    ),
  );
}

function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = String((error as { code?: unknown }).code ?? "").trim();
    if (code) return code.slice(0, 120);
  }
  return "professional_booking_reconciliation_failed";
}

export async function runProfessionalBookingPaymentReconciliation(): Promise<ProfessionalBookingReconciliationResult> {
  const startedAt = new Date().toISOString();
  const service = createRoomServiceSupabase();
  const stripe = getStripe();
  const payments = await loadCandidatePayments(service);
  const attempts = await loadLatestAttempts(
    service,
    payments.map((payment) => String(payment.id)),
  );

  let reconciled = 0;
  let skipped = 0;
  const failures: ReconciliationFailure[] = [];

  for (const payment of payments) {
    const paymentId = String(payment.id);
    try {
      const handled = await reconcileOne(stripe, payment, attempts.get(paymentId));
      if (handled) reconciled += 1;
      else skipped += 1;
    } catch (error) {
      failures.push({ paymentId, code: errorCode(error) });
      console.error("Professional Booking automated reconciliation failed:", {
        paymentId,
        code: errorCode(error),
      });
    }
  }

  return {
    ok: failures.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    scanned: payments.length,
    reconciled,
    skipped,
    failed: failures.length,
    failures: failures.slice(0, 20),
  };
}
