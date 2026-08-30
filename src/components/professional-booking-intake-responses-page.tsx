"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Clock3,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ProfessionalBookingIntakeSnapshotItem } from "@/lib/professional-booking-intake";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

type IntakeResponseRecord = {
  requestId: string;
  serviceId: string;
  serviceName: string;
  requesterId: string;
  requesterName: string;
  requestedStart: string;
  timezone: string;
  status: string;
  note: string | null;
  createdAt: string;
  intake: ProfessionalBookingIntakeSnapshotItem[];
};

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

function requestTime(value: string, timezone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Appointment time unavailable";

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default function ProfessionalBookingIntakeResponsesPage() {
  const [responses, setResponses] = useState<IntakeResponseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-intake-responses",
        { cache: "no-store" },
        "/appointments/professional-intake-responses",
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ?? "Unable to load client intake responses.",
        );
      }

      setResponses(
        Array.isArray(payload.responses)
          ? (payload.responses as IntakeResponseRecord[])
          : [],
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load client intake responses.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial remote synchronization intentionally starts on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main
      data-professional-booking-intake-responses-editorial="root"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[72rem]">
        <nav className="mb-7 border-b border-[color:var(--loombus-border)] pb-4" aria-label="Client intake responses">
          <Link href="/appointments" className={actionClass}>
            <ArrowLeft size={16} /> Back to Appointments
          </Link>
        </nav>

        <header className="flex flex-col gap-5 border-b border-[color:var(--loombus-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Professional Booking
              </p>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
                Client intake
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Client intake responses
            </h1>
            <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Review the exact client-intake questions and answers captured when
              each appointment request was submitted. Historical responses remain
              attached to the request even if you later edit the intake form or
              change subscription plans.
            </p>
          </div>

          <button type="button" onClick={() => void load()} disabled={loading} className={actionClass}>
            <RefreshCw size={15} className={loading ? "animate-spin motion-reduce:animate-none" : ""} />
            Refresh
          </button>
        </header>

        {notice ? (
          <div className="border-b border-[color:var(--loombus-border)] py-4 text-sm" role="status">
            {notice}
          </div>
        ) : null}

        {loading && responses.length === 0 ? (
          <div className="border-b border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">
            Loading client intake responses…
          </div>
        ) : null}

        {!loading && responses.length === 0 && !notice ? (
          <section className="grid gap-3 border-b border-[color:var(--loombus-border)] py-10 text-center">
            <ClipboardList className="mx-auto h-7 w-7 text-[color:var(--loombus-gold)]" aria-hidden="true" />
            <h2 className="font-semibold">No client intake responses yet</h2>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Responses will appear here after a member submits an appointment
              request while one of your active Professional Booking intake forms
              is enabled.
            </p>
          </section>
        ) : null}

        <div>
          {responses.map((record) => (
            <article
              key={record.requestId}
              className="grid gap-6 border-b border-[color:var(--loombus-border)] py-7 lg:grid-cols-[minmax(0,1fr)_16rem]"
            >
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">
                  <span className="text-[color:var(--loombus-gold)]">{record.status.replaceAll("_", " ")}</span>
                  <span>Requested by {record.requesterName}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
                  {record.serviceName}
                </h2>

                {record.note ? (
                  <section className="mt-6 border-l-2 border-[color:var(--loombus-gold)] pl-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
                      Request note
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {record.note}
                    </p>
                  </section>
                ) : null}

                <div className="mt-6 divide-y divide-[color:var(--loombus-border)] border-t border-[color:var(--loombus-border)]">
                  {record.intake.map((item) => (
                    <section key={item.id} className="py-5">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-sm font-semibold">{item.label}</p>
                        {item.required ? (
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">
                            Required
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                        {item.answer || "No answer provided."}
                      </p>
                    </section>
                  ))}
                </div>
              </div>

              <aside className="border-t border-[color:var(--loombus-border)] pt-5 text-sm text-[color:var(--loombus-text-muted)] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="flex items-start gap-2">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
                  <span>{requestTime(record.requestedStart, record.timezone)}</span>
                </div>
              </aside>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
