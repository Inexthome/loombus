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
      <div className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
        Loading Professional Booking payments…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#b45309]">
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
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
              New authorizations
            </span>
            <strong className="mt-2 block text-lg">
              {data?.paymentsEnabled ? "Enabled" : "Disabled"}
            </strong>
          </div>
          <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
              Live-money capture
            </span>
            <strong className="mt-2 block text-lg">
              {data?.livePaymentsAllowed ? "Explicitly enabled" : "Blocked by safety switch"}
            </strong>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm" role="status">
          {notice}
        </div>
      ) : null}

      {(data?.payments.length ?? 0) === 0 ? (
        <div className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
          No Professional Booking payment records yet.
        </div>
      ) : (
        <section className="space-y-3">
          {data?.payments.map((payment) => (
            <article
              key={payment.id}
              className="rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold">
                      {payment.role === "requester" ? "You requested" : "You provide"}
                    </span>
                    <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold">
                      {paymentStatusLabel(payment.paymentStatus)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{payment.serviceName}</h3>
                  <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                    Appointment status: {payment.appointmentStatus.replaceAll("_", " ")}
                  </p>
                  <div className="mt-4 grid gap-2 text-sm text-[color:var(--loombus-text-muted)] sm:grid-cols-2">
                    <span>Requester price: <strong className="text-[color:var(--loombus-text)]">{professionalBookingPaymentAmountLabel(payment.grossAmountCents)}</strong></span>
                    <span>Loombus fee: {professionalBookingPaymentAmountLabel(payment.platformFeeCents)} ({(payment.platformFeeBps / 100).toFixed(2).replace(/\.00$/, "")}%)</span>
                    <span>Provider amount before processing: {professionalBookingPaymentAmountLabel(payment.providerNetBeforeProcessingCents)}</span>
                    <span>Fee schedule: {payment.feeScheduleVersion}</span>
                  </div>
                  {payment.authorizationExpiresAt ? (
                    <p className="mt-3 text-xs text-[color:var(--loombus-text-muted)]">
                      Authorization capture deadline: {dateLabel(payment.authorizationExpiresAt)}
                    </p>
                  ) : null}
                  <p className="mt-3 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                    Provider amount shown here is before Stripe processing, taxes, disputes, and other settlement adjustments.
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {payment.canCheckout ? (
                    <button
                      type="button"
                      onClick={() => void action(payment, "checkout")}
                      disabled={Boolean(working)}
                      className="rounded-full bg-[color:var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-primary-text)] disabled:opacity-50"
                    >
                      Authorize payment
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void action(payment, "refresh")}
                    disabled={Boolean(working)}
                    className="rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
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
