"use client";

import { RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  professionalBookingPaymentAmountLabel,
  type ProfessionalBookingPaymentListResponse,
  type ProfessionalBookingPaymentSummary,
} from "@/lib/professional-booking-payment";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

function paymentStatusLabel(status: string) {
  switch (status) {
    case "checkout_pending":
      return "Payment authorization pending";
    case "authorized":
      return "Authorized, awaiting acceptance";
    case "authorization_expired":
      return "Authorization expired";
    case "capture_pending":
      return "Capture in progress";
    case "captured":
      return "Paid";
    case "cancel_pending":
      return "Authorization release pending";
    case "canceled":
      return "Authorization released";
    case "refund_pending":
      return "Refund pending";
    case "refunded":
      return "Refunded";
    default:
      return "Payment needs attention";
  }
}

function dateLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ProfessionalBookingPaymentCenter() {
  const [data, setData] = useState<ProfessionalBookingPaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-payment",
        { cache: "no-store" },
        "/appointments/professional-payment",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load Professional Booking payments.");
      }
      setData(payload as ProfessionalBookingPaymentListResponse);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load Professional Booking payments.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(
    payment: ProfessionalBookingPaymentSummary,
    actionName: "checkout" | "refresh",
  ) {
    if (working) return;
    setWorking(`${actionName}:${payment.id}`);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-payment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: actionName, paymentId: payment.id }),
        },
        "/appointments/professional-payment",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update the payment.");
      }
      if (actionName === "checkout" && !payload.checkoutUrl) {
        setNotice("This payment is already authorized or no longer needs a new checkout.");
      }
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the payment.");
    } finally {
      setWorking("");
    }
  }

  if (loading && !data) {
    return (
      <div
        data-professional-booking-payments-editorial="loading"
        className="border-y border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]"
      >
        Loading Professional Booking payments…
      </div>
    );
  }

  return (
    <div data-professional-booking-payments-editorial="center" className="space-y-8">
      <section className="border-b border-[color:var(--loombus-border)] pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[color:var(--loombus-gold)]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">
                Controlled Professional Booking payments
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
              Payment authorization and settlement
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Paid Professional Booking uses the exact saved service quote. Stripe authorizes the requester&apos;s card when the request is submitted, and Loombus captures the payment only when the appointment is accepted. Declined or cancelled requests release an uncaptured authorization. A cancellation after capture receives a full refund.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)] disabled:opacity-50 motion-reduce:transition-none"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <dl className="mt-6 grid border-t border-[color:var(--loombus-border)] sm:grid-cols-2">
          <div className="border-b border-[color:var(--loombus-border)] py-4 sm:border-b-0 sm:border-r sm:pr-6">
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
              New authorizations
            </dt>
            <dd className="mt-2 text-lg font-semibold">
              {data?.paymentsEnabled ? "Enabled" : "Disabled"}
            </dd>
          </div>
          <div className="py-4 sm:pl-6">
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
              Live-money capture
            </dt>
            <dd className="mt-2 text-lg font-semibold">
              {data?.livePaymentsAllowed ? "Explicitly enabled" : "Blocked by safety switch"}
            </dd>
          </div>
        </dl>
      </section>

      {notice ? (
        <div className="border-y border-[color:var(--loombus-border)] py-4 text-sm" role="status">
          {notice}
        </div>
      ) : null}

      {(data?.payments.length ?? 0) === 0 ? (
        <div className="border-y border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">
          No Professional Booking payment records yet.
        </div>
      ) : (
        <section aria-label="Professional Booking payment records" className="border-t border-[color:var(--loombus-border)]">
          {data?.payments.map((payment) => (
            <article key={payment.id} className="border-b border-[color:var(--loombus-border)] py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
                    <span className="text-[color:var(--loombus-gold)]">
                      {payment.role === "requester" ? "You requested" : "You provide"}
                    </span>
                    <span className="text-[color:var(--loombus-text-muted)]">
                      {paymentStatusLabel(payment.paymentStatus)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{payment.serviceName}</h3>
                  <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                    Appointment status: {payment.appointmentStatus.replaceAll("_", " ")}
                  </p>

                  <dl className="mt-5 grid border-t border-[color:var(--loombus-border)] text-sm sm:grid-cols-2">
                    <div className="border-b border-[color:var(--loombus-border)] py-3 sm:border-r sm:pr-5">
                      <dt className="text-[color:var(--loombus-text-muted)]">Requester price</dt>
                      <dd className="mt-1 font-semibold text-[color:var(--loombus-text)]">
                        {professionalBookingPaymentAmountLabel(payment.grossAmountCents)}
                      </dd>
                    </div>
                    <div className="border-b border-[color:var(--loombus-border)] py-3 sm:pl-5">
                      <dt className="text-[color:var(--loombus-text-muted)]">Loombus fee</dt>
                      <dd className="mt-1 font-semibold text-[color:var(--loombus-text)]">
                        {professionalBookingPaymentAmountLabel(payment.platformFeeCents)} ({(payment.platformFeeBps / 100).toFixed(2).replace(/\.00$/, "")}%)
                      </dd>
                    </div>
                    <div className="border-b border-[color:var(--loombus-border)] py-3 sm:border-b-0 sm:border-r sm:pr-5">
                      <dt className="text-[color:var(--loombus-text-muted)]">Provider amount before processing</dt>
                      <dd className="mt-1 font-semibold text-[color:var(--loombus-text)]">
                        {professionalBookingPaymentAmountLabel(payment.providerNetBeforeProcessingCents)}
                      </dd>
                    </div>
                    <div className="py-3 sm:pl-5">
                      <dt className="text-[color:var(--loombus-text-muted)]">Fee schedule</dt>
                      <dd className="mt-1 font-semibold text-[color:var(--loombus-text)]">{payment.feeScheduleVersion}</dd>
                    </div>
                  </dl>

                  {payment.authorizationExpiresAt ? (
                    <p className="mt-4 text-xs text-[color:var(--loombus-text-muted)]">
                      Authorization capture deadline: {dateLabel(payment.authorizationExpiresAt)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                    Provider amount shown here is before Stripe processing, taxes, disputes, and other settlement adjustments.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-x-5 gap-y-2 lg:max-w-56 lg:flex-col lg:items-stretch">
                  {payment.canCheckout ? (
                    <button
                      type="button"
                      onClick={() => void action(payment, "checkout")}
                      disabled={Boolean(working)}
                      className="inline-flex min-h-11 items-center justify-center border-b border-[color:var(--loombus-gold)] py-2 text-sm font-semibold text-[color:var(--loombus-gold)] transition hover:text-[color:var(--loombus-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)] disabled:opacity-50 motion-reduce:transition-none"
                    >
                      Authorize payment
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void action(payment, "refresh")}
                    disabled={Boolean(working)}
                    className="inline-flex min-h-11 items-center justify-center border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)] disabled:opacity-50 motion-reduce:transition-none"
                  >
                    Refresh status
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
