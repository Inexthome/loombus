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

function quoteLabel(request: AppointmentRequest) {
  const snapshot = request.professionalBookingPriceSnapshot;
  if (!snapshot) return "";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: snapshot.currency.toUpperCase(),
  }).format(snapshot.amountCents / 100);
}

function QuoteRecord({
  request,
  perspective,
}: {
  request: AppointmentRequest;
  perspective: "provider" | "requester";
}) {
  const snapshot = request.professionalBookingPriceSnapshot;
  if (!snapshot) return null;

  return (
    <article className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
            Saved Professional Booking quote
          </p>
          <h3 className="mt-2 text-lg font-semibold">{request.serviceName}</h3>
          <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
            {perspective === "provider"
              ? `Requested by ${request.requesterName}`
              : request.businessName}
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold capitalize">
          {request.status.replaceAll("_", " ")}
        </span>
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-[-0.03em]">
        {quoteLabel(request)}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        Appointment time: {formatEventDateRange(
          request.requestedStart,
          request.requestedEnd,
          request.timezone,
        )}
      </p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
        Quote captured {new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(snapshot.capturedAt))}. This snapshot does not change if the provider later edits or clears the live price.
      </p>
      <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
        Loombus did not collect or authorize payment from this quote in the 3B.8B booking flow.
      </p>
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
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load saved Professional Booking quotes.");
      }
      setData(payload as ManagePayload);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load saved Professional Booking quotes.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const received = useMemo(
    () =>
      (data?.receivedRequests ?? []).filter(
        (request) => request.professionalBookingPriceSnapshot,
      ),
    [data],
  );
  const sent = useMemo(
    () =>
      (data?.sentRequests ?? []).filter(
        (request) => request.professionalBookingPriceSnapshot,
      ),
    [data],
  );

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            Professional Booking
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">
            Saved price quotes
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Review immutable request-time structured-price quotes for appointments you requested or received. Historical quotes remain available after later price edits, clearing, or subscription downgrade.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {notice ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] p-4 text-sm" role="status">
          {notice}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
          Loading saved quotes…
        </div>
      ) : received.length === 0 && sent.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
          No Professional Booking quote snapshots have been saved for this account yet.
        </div>
      ) : (
        <div className="mt-6 space-y-7">
          {received.length ? (
            <section>
              <h2 className="text-lg font-semibold">Requests sent to your services</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {received.map((request) => (
                  <QuoteRecord key={request.id} request={request} perspective="provider" />
                ))}
              </div>
            </section>
          ) : null}

          {sent.length ? (
            <section>
              <h2 className="text-lg font-semibold">Requests you sent</h2>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {sent.map((request) => (
                  <QuoteRecord key={request.id} request={request} perspective="requester" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </section>
  );
}
