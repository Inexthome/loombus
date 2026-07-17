"use client";

import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Edit3,
  MapPin,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { JobPosting } from "@/lib/jobs-directory";
import {
  jobLocationLabel,
  jobStatusLabel,
} from "@/lib/jobs-directory";

type Props = {
  jobs: JobPosting[];
  startEdit: (job: JobPosting) => void;
  runAction: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => void | Promise<void>;
  working: boolean;
};

export function JobListingsPanel({
  jobs,
  startEdit,
  runAction,
  working,
}: Props) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
          Your postings
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          {jobs.length} job{jobs.length === 1 ? "" : "s"}
        </h2>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-5 rounded-[1.3rem] border border-dashed border-[var(--loombus-border)] p-8 text-center">
          <BriefcaseBusiness className="mx-auto" size={28} />
          <p className="mt-3 font-semibold">No job postings yet.</p>
          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
            Create an attributable opening from the form above.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-[1.3rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs font-semibold">
                      {jobStatusLabel(job.status)}
                    </span>
                    <span className="text-xs text-[var(--loombus-text-subtle)]">
                      {job.businessName}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xl font-semibold">{job.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {job.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--loombus-text-subtle)]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} /> {jobLocationLabel(job)}
                    </span>
                    {job.updatedAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock3 size={13} /> Updated{" "}
                        {new Date(job.updatedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {job.status === "published" ? (
                    <Link
                      href={`/jobs/${encodeURIComponent(job.slug)}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      View <ArrowRight size={15} />
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(job)}
                    disabled={working}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <Edit3 size={15} /> Edit
                  </button>
                  {["published", "pending", "draft"].includes(job.status) ? (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          { action: "close", jobId: job.id },
                          "Job posting closed."
                        )
                      }
                      disabled={working}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      <XCircle size={15} /> Close
                    </button>
                  ) : null}
                  {["closed", "expired", "rejected"].includes(job.status) ? (
                    <button
                      type="button"
                      onClick={() =>
                        void runAction(
                          { action: "reopen", jobId: job.id },
                          "Job posting reopened and submitted for review."
                        )
                      }
                      disabled={working}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      <RotateCcw size={15} /> Reopen
                    </button>
                  ) : null}
                </div>
              </div>

              {job.moderationReason ? (
                <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  Review note: {job.moderationReason}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
