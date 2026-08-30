"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Clock3,
  Edit3,
  MapPin,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { JobPosting } from "@/lib/jobs-directory";
import { jobLocationLabel, jobStatusLabel } from "@/lib/jobs-directory";

type Props = {
  jobs: JobPosting[];
  startEdit: (job: JobPosting) => void;
  runAction: (
    payload: Record<string, unknown>,
    successMessage: string,
  ) => void | Promise<void>;
  working: boolean;
};

const actionClass =
  "inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition-colors hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] disabled:opacity-50";

export function JobListingsPanel({ jobs, startEdit, runAction, working }: Props) {
  return (
    <section>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Employer records</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{jobs.length} job{jobs.length === 1 ? "" : "s"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Review publication state, employer attribution, location, updates, and lifecycle actions.</p>
        </div>
        <BriefcaseBusiness size={20} className="text-[color:var(--loombus-gold)]" />
      </header>

      {jobs.length === 0 ? (
        <div className="border-b border-[color:var(--loombus-border)] py-12 text-center">
          <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
          <h3 className="mt-4 text-xl font-semibold">No job postings yet</h3>
          <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Create an attributable opening from the Editor tab.</p>
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--loombus-border)]">
          {jobs.map((job) => (
            <article key={job.id} className="py-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-gold)]">{jobStatusLabel(job.status)}</span>
                    <span className="font-semibold text-[color:var(--loombus-text-subtle)]">{job.businessName}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{job.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">{job.summary}</p>
                </div>

                <dl className="border-l border-[color:var(--loombus-border)] pl-4 text-xs text-[color:var(--loombus-text-muted)]">
                  <div className="flex items-start gap-2 py-1"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={14} /><span>{jobLocationLabel(job)}</span></div>
                  {job.updatedAt ? <div className="flex items-center gap-2 py-1"><Clock3 className="shrink-0 text-[color:var(--loombus-gold)]" size={14} /><span>Updated {new Date(job.updatedAt).toLocaleDateString()}</span></div> : null}
                </dl>
              </div>

              {job.moderationReason ? (
                <p className="mt-4 border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-300">Review note: {job.moderationReason}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                {job.status === "published" ? (
                  <Link href={`/jobs/${encodeURIComponent(job.slug)}`} className={actionClass}>View <ArrowUpRight size={14} /></Link>
                ) : null}
                <button type="button" onClick={() => startEdit(job)} disabled={working} className={actionClass}><Edit3 size={14} /> Edit</button>
                {["published", "pending", "draft"].includes(job.status) ? (
                  <button type="button" onClick={() => void runAction({ action: "close", jobId: job.id }, "Job posting closed.")} disabled={working} className={actionClass}><XCircle size={14} /> Close</button>
                ) : null}
                {["closed", "expired", "rejected"].includes(job.status) ? (
                  <button type="button" onClick={() => void runAction({ action: "reopen", jobId: job.id }, "Job posting reopened and submitted for review.")} disabled={working} className={actionClass}><RotateCcw size={14} /> Reopen</button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
