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
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[72rem]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/appointments"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-text)]"
            >
              <ArrowLeft size={16} /> Back to Appointments
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Professional Booking
              </p>
              <span className="rounded-full border border-[color:var(--loombus-gold)]/40 bg-[color:var(--loombus-gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--loombus-gold)]">
                Client intake
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Client intake responses
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Review the exact client-intake questions and answers captured when
              each appointment request was submitted. Historical responses remain
              attached to the request even if you later edit the intake form or
              change subscription plans.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {notice ? (
          <div
            className="mt-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        {loading && responses.length === 0 ? (
          <div className="mt-6 rounded-[1.6rem] border border-dashed border-[color:var(--loombus-border)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
            Loading client intake responses…
          </div>
        ) : null}

        {!loading && responses.length === 0 && !notice ? (
          <div className="mt-6 rounded-[1.6rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center">
            <ClipboardList className="mx-auto h-7 w-7 text-[color:var(--loombus-gold)]" />
            <h2 className="mt-3 font-semibold">No client intake responses yet</h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Responses will appear here after a member submits an appointment
              request while one of your active Professional Booking intake forms
              is enabled.
            </p>
          </div>
        ) : null}

        <div className="mt-6 space-y-5">
          {responses.map((record) => (
            <article
              key={record.requestId}
              className="rounded-[1.6rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[color:var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold capitalize text-[color:var(--loombus-text-muted)]">
                      {record.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold">
                    {record.serviceName}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                    Requested by {record.requesterName}
                  </p>
                </div>
                <div className="flex items-start gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                  <span>{requestTime(record.requestedStart, record.timezone)}</span>
                </div>
              </div>

              {record.note ? (
                <div className="mt-5 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
                    Request note
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                    {record.note}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {record.intake.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
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
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
