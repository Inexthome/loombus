"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppointmentRequest } from "@/lib/events";
import { formatEventDateRange } from "@/lib/events";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

type ManagePayload = {
  receivedRequests?: AppointmentRequest[];
  sentRequests?: AppointmentRequest[];
};

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

function quoteLabel(request: AppointmentRequest) {
  const snapshot = request.professionalBookingPriceSnapshot;
  if (!snapshot) return "";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: snapshot.currency.toUpperCase(),
  }).format(snapshot.amountCents / 100);
}

function QuoteRecord({ request, perspective }: { request: AppointmentRequest; perspective: "provider" | "requester" }) {
  const snapshot = request.professionalBookingPriceSnapshot;
  if (!snapshot) return null;

  return (
    <article className="grid gap-4 border-b border-[color:var(--loombus-border)] py-6 md:grid-cols-[minmax(0,1fr)_12rem] md:gap-8">
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">
          <span className="text-[color:var(--loombus-gold)]">Saved Professional Booking quote</span>
          <span>{request.status.replaceAll("_", " ")}</span>
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{request.serviceName}</h3>
        <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
          {perspective === "provider" ? `Requested by ${request.requesterName}` : request.businessName}
        </p>
        <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          Appointment time: {formatEventDateRange(request.requestedStart, request.requestedEnd, request.timezone)}
        </p>
        <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
          Quote captured {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.capturedAt))}. This snapshot does not change if the provider later edits or clears the live price.
        </p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">
          Loombus did not collect or authorize payment from this quote in the 3B.8B booking flow.
        </p>
      </div>
      <div className="md:text-right">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">Captured quote</p>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{quoteLabel(request)}</p>
      </div>
    </article>
  );
}

export default function ProfessionalBookingPriceHistoryCard() {
  const [data, setData] = useState<ManagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments?manage=1",
        { cache: "no-store" },
        "/appointments/professional-pricing-history",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load saved Professional Booking quotes.");
      setData(payload as ManagePayload);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load saved Professional Booking quotes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const received = useMemo(
    () => (data?.receivedRequests ?? []).filter((request) => request.professionalBookingPriceSnapshot),
    [data],
  );
  const sent = useMemo(
    () => (data?.sentRequests ?? []).filter((request) => request.professionalBookingPriceSnapshot),
    [data],
  );

  return (
    <section data-professional-booking-price-history-editorial="root">
      <header className="flex flex-col gap-5 border-b border-[color:var(--loombus-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Professional Booking</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Saved price quotes</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Review immutable request-time structured-price quotes for appointments you requested or received. Historical quotes remain available after later price edits, clearing, or subscription downgrade.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className={actionClass}>
          <RefreshCw size={15} className={loading ? "animate-spin motion-reduce:animate-none" : ""} /> Refresh
        </button>
      </header>

      {notice ? <div className="border-b border-[color:var(--loombus-border)] py-4 text-sm text-[color:var(--loombus-text-muted)]" role="status">{notice}</div> : null}

      {loading && !data ? (
        <div className="border-b border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">Loading saved quotes…</div>
      ) : received.length === 0 && sent.length === 0 ? (
        <div className="border-b border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No Professional Booking quote snapshots have been saved for this account yet.</div>
      ) : (
        <div className="divide-y divide-[color:var(--loombus-border)]">
          {received.length ? (
            <section className="py-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Provider history</p>
              <h2 className="mt-2 text-xl font-semibold">Requests sent to your services</h2>
              <div className="mt-3">{received.map((request) => <QuoteRecord key={request.id} request={request} perspective="provider" />)}</div>
            </section>
          ) : null}
          {sent.length ? (
            <section className="py-7">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Requester history</p>
              <h2 className="mt-2 text-xl font-semibold">Requests you sent</h2>
              <div className="mt-3">{sent.map((request) => <QuoteRecord key={request.id} request={request} perspective="requester" />)}</div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
