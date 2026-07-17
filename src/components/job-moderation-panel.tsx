"use client";

import {
  CheckCircle2,
  CircleAlert,
  Flag,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import type { JobReport, JobPosting } from "@/lib/jobs-directory";
import { jobStatusLabel } from "@/lib/jobs-directory";

type Props = {
  pendingJobs: JobPosting[];
  openReports: JobReport[];
  moderate: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => void | Promise<void>;
  working: boolean;
};

export function JobModerationPanel({
  pendingJobs,
  openReports,
  moderate,
  working,
}: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  function noteFor(key: string) {
    return notes[key] ?? "";
  }

  function updateNote(key: string, value: string) {
    setNotes((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={22} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            Administrator queue
          </p>
          <h2 className="mt-1 text-2xl font-semibold">
            Jobs moderation and reports
          </h2>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <CircleAlert size={18} /> Listing review ({pendingJobs.length})
          </h3>

          <div className="mt-4 grid gap-4">
            {pendingJobs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">
                No job postings require review.
              </p>
            ) : (
              pendingJobs.map((job) => {
                const key = `job:${job.id}`;
                return (
                  <article
                    key={job.id}
                    className="rounded-[1.3rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs font-semibold">
                        {jobStatusLabel(job.status)}
                      </span>
                      <span className="text-xs text-[var(--loombus-text-subtle)]">
                        {job.businessName}
                      </span>
                    </div>
                    <h4 className="mt-2 text-lg font-semibold">{job.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {job.summary}
                    </p>

                    <textarea
                      value={noteFor(key)}
                      onChange={(event) => updateNote(key, event.target.value)}
                      placeholder="Optional moderation note"
                      rows={3}
                      className="mt-4 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void moderate(
                            {
                              action: "moderate",
                              jobId: job.id,
                              decision: "approve",
                              note: noteFor(key),
                            },
                            "Job posting approved and published."
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void moderate(
                            {
                              action: "moderate",
                              jobId: job.id,
                              decision: "reject",
                              note: noteFor(key),
                            },
                            "Changes requested from the employer."
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        <XCircle size={15} /> Request changes
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void moderate(
                            {
                              action: "moderate",
                              jobId: job.id,
                              decision: "suspend",
                              note: noteFor(key),
                            },
                            "Job posting suspended."
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-500 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Flag size={18} /> Open reports ({openReports.length})
          </h3>

          <div className="mt-4 grid gap-4">
            {openReports.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">
                No job reports are open.
              </p>
            ) : (
              openReports.map((report) => {
                const key = `report:${report.id}`;
                return (
                  <article
                    key={report.id}
                    className="rounded-[1.3rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                      {report.businessName}
                    </p>
                    <h4 className="mt-2 text-lg font-semibold">
                      {report.jobTitle}
                    </h4>
                    <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {report.details}
                    </p>

                    <textarea
                      value={noteFor(key)}
                      onChange={(event) => updateNote(key, event.target.value)}
                      placeholder="Optional review note"
                      rows={3}
                      className="mt-4 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none"
                    />

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void moderate(
                            {
                              action: "review_report",
                              reportId: report.id,
                              decision: "resolve",
                              note: noteFor(key),
                            },
                            "Job report resolved."
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} /> Resolve
                      </button>
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void moderate(
                            {
                              action: "review_report",
                              reportId: report.id,
                              decision: "dismiss",
                              note: noteFor(key),
                            },
                            "Job report dismissed."
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
