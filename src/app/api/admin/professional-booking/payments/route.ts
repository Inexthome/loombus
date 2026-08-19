import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  professionalBookingLivePaymentsAllowed,
  professionalBookingPaymentsEnabled,
} from "@/lib/professional-booking-payment-server";
import { verifyRequestAccountAccess } from "@/lib/request-account-access";

const PAYMENT_LIMIT = 200;
const ATTEMPT_LIMIT = 500;
const DISPUTE_LIMIT = 200;
const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;
const ATTENTION_STATUSES = new Set([
  "capture_pending",
  "cancel_pending",
  "refund_pending",
]);

type PaymentRow = {
  id: string;
  appointment_request_id: string;
  service_id: string;
  requester_id: string;
  provider_id: string;
  status: string;
  gross_amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  provider_net_before_processing_cents: number;
  authorization_expires_at: string | null;
  authorized_at: string | null;
  captured_at: string | null;
  canceled_at: string | null;
  refunded_at: string | null;
  latest_error_code: string | null;
  updated_at: string | null;
};

type AttemptRow = {
  payment_id: string;
  status: string | null;
  livemode: boolean | null;
  created_at: string | null;
};

type DisputeRow = {
  id: string;
  payment_id: string;
  amount_cents: number;
  currency: string;
  reason: string;
  status: string;
  evidence_due_at: string | null;
  evidence_past_due: boolean | null;
  stripe_created_at: string | null;
  last_synced_at: string | null;
  resolved_at: string | null;
};

type NamedRow = { id: string; name: string | null };
type AppointmentRow = { id: string; status: string | null };
type ProfileRow = {
  id: string;
  username: string | null;
  full_name: string | null;
};

function getSupabaseForRequest(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment configuration.");
  }

  const authorization = request.headers.get("authorization") ?? "";
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}

function getAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Admin Supabase configuration.");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(code ? { error: message, code } : { error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function isExpiringSoon(payment: PaymentRow, now: number) {
  if (payment.status !== "authorized" || !payment.authorization_expires_at) {
    return false;
  }
  const expiry = new Date(payment.authorization_expires_at).getTime();
  return Number.isFinite(expiry) && expiry >= now && expiry - now <= EXPIRING_SOON_MS;
}

function needsAttention(payment: PaymentRow) {
  return ATTENTION_STATUSES.has(payment.status) || Boolean(payment.latest_error_code);
}

function displayName(profile: ProfileRow | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Unknown member";
}

export async function GET(request: NextRequest) {
  let supabase;
  let adminSupabase;

  try {
    supabase = getSupabaseForRequest(request);
    adminSupabase = getAdminSupabase();
  } catch {
    return jsonError("Server configuration error.", 500);
  }

  const accountAccess = await verifyRequestAccountAccess(supabase);
  if (!accountAccess.ok) {
    return jsonError(accountAccess.error, accountAccess.status, accountAccess.code);
  }
  if (!accountAccess.profile.is_admin) {
    return jsonError("Admin access required.", 403);
  }

  const [paymentsResult, attemptsResult, disputesResult] = await Promise.all([
    adminSupabase
      .from("professional_booking_payments")
      .select(
        "id,appointment_request_id,service_id,requester_id,provider_id,status,gross_amount_cents,currency,platform_fee_cents,provider_net_before_processing_cents,authorization_expires_at,authorized_at,captured_at,canceled_at,refunded_at,latest_error_code,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(PAYMENT_LIMIT),
    adminSupabase
      .from("professional_booking_payment_attempts")
      .select("payment_id,status,livemode,created_at")
      .order("created_at", { ascending: false })
      .limit(ATTEMPT_LIMIT),
    adminSupabase
      .from("professional_booking_payment_disputes")
      .select(
        "id,payment_id,amount_cents,currency,reason,status,evidence_due_at,evidence_past_due,stripe_created_at,last_synced_at,resolved_at",
      )
      .order("stripe_created_at", { ascending: false })
      .limit(DISPUTE_LIMIT),
  ]);

  if (paymentsResult.error) {
    return jsonError(
      paymentsResult.error.message || "Unable to load Professional Booking payments.",
      500,
    );
  }
  if (attemptsResult.error) {
    return jsonError(
      attemptsResult.error.message || "Unable to load Professional Booking payment attempts.",
      500,
    );
  }
  if (disputesResult.error) {
    return jsonError(
      disputesResult.error.message || "Unable to load Professional Booking disputes.",
      500,
    );
  }

  const payments = (paymentsResult.data ?? []) as PaymentRow[];
  const attempts = (attemptsResult.data ?? []) as AttemptRow[];
  const disputes = (disputesResult.data ?? []) as DisputeRow[];

  const requestIds = [...new Set(payments.map((row) => row.appointment_request_id))];
  const serviceIds = [...new Set(payments.map((row) => row.service_id))];
  const userIds = [
    ...new Set(payments.flatMap((row) => [row.requester_id, row.provider_id])),
  ];

  const [appointmentsResult, servicesResult, profilesResult] = await Promise.all([
    requestIds.length
      ? adminSupabase
          .from("business_appointment_requests")
          .select("id,status")
          .in("id", requestIds)
      : Promise.resolve({ data: [], error: null }),
    serviceIds.length
      ? adminSupabase
          .from("business_appointment_services")
          .select("id,name")
          .in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? adminSupabase
          .from("profiles")
          .select("id,username,full_name")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (appointmentsResult.error || servicesResult.error || profilesResult.error) {
    return jsonError("Unable to load Professional Booking payment context.", 500);
  }

  const appointments = new Map(
    ((appointmentsResult.data ?? []) as AppointmentRow[]).map((row) => [row.id, row]),
  );
  const services = new Map(
    ((servicesResult.data ?? []) as NamedRow[]).map((row) => [row.id, row]),
  );
  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, row]),
  );

  const latestAttempts = new Map<string, AttemptRow>();
  for (const attempt of attempts) {
    if (!latestAttempts.has(attempt.payment_id)) {
      latestAttempts.set(attempt.payment_id, attempt);
    }
  }

  const now = Date.now();
  const paymentItems = payments.map((payment) => {
    const latestAttempt = latestAttempts.get(payment.id);
    return {
      id: payment.id,
      appointmentRequestId: payment.appointment_request_id,
      serviceName: services.get(payment.service_id)?.name?.trim() || "Professional Booking",
      requesterName: displayName(profiles.get(payment.requester_id)),
      requesterHandle: profiles.get(payment.requester_id)?.username || null,
      providerName: displayName(profiles.get(payment.provider_id)),
      providerHandle: profiles.get(payment.provider_id)?.username || null,
      appointmentStatus: appointments.get(payment.appointment_request_id)?.status || "unknown",
      paymentStatus: payment.status,
      grossAmountCents: payment.gross_amount_cents,
      currency: payment.currency,
      platformFeeCents: payment.platform_fee_cents,
      providerNetBeforeProcessingCents: payment.provider_net_before_processing_cents,
      authorizationExpiresAt: payment.authorization_expires_at,
      authorizedAt: payment.authorized_at,
      capturedAt: payment.captured_at,
      canceledAt: payment.canceled_at,
      refundedAt: payment.refunded_at,
      updatedAt: payment.updated_at,
      latestErrorCode: payment.latest_error_code,
      latestAttemptStatus: latestAttempt?.status ?? null,
      livemode: latestAttempt?.livemode ?? null,
      expiringSoon: isExpiringSoon(payment, now),
      needsAttention: needsAttention(payment),
    };
  });

  const summary = {
    total: payments.length,
    authorized: payments.filter((row) => row.status === "authorized").length,
    expiringSoon: payments.filter((row) => isExpiringSoon(row, now)).length,
    attention: payments.filter(needsAttention).length,
    captured: payments.filter((row) => row.status === "captured").length,
    refunded: payments.filter((row) => row.status === "refunded").length,
    authorizationExpired: payments.filter(
      (row) => row.status === "authorization_expired",
    ).length,
    openDisputes: disputes.filter((row) => !row.resolved_at).length,
  };

  return NextResponse.json(
    {
      currentAdminId: accountAccess.user.id,
      generatedAt: new Date().toISOString(),
      limits: {
        payments: PAYMENT_LIMIT,
        attempts: ATTEMPT_LIMIT,
        disputes: DISPUTE_LIMIT,
      },
      runtime: {
        paymentsEnabled: professionalBookingPaymentsEnabled(),
        livePaymentsAllowed: professionalBookingLivePaymentsAllowed(),
      },
      summary,
      payments: paymentItems,
      disputes: disputes.map((dispute) => ({
        id: dispute.id,
        paymentId: dispute.payment_id,
        amountCents: dispute.amount_cents,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        evidenceDueAt: dispute.evidence_due_at,
        evidencePastDue: dispute.evidence_past_due,
        stripeCreatedAt: dispute.stripe_created_at,
        lastSyncedAt: dispute.last_synced_at,
        resolvedAt: dispute.resolved_at,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
