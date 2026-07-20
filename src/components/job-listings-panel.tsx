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
import {
  jobLocationLabel,
  jobStatusLabel,
} from "@/lib/jobs-directory";

type Props = {
  jobs: JobPosting[];
  startEdit: (job: JobPosting) => void;
  runAction: (
    payload: Record<string, unknown>,
    successMessage: string,
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
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Employer records</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{jobs.length} job{jobs.length === 1 ? "" : "s"}</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Review publication state, employer attribution, location, updates, and lifecycle actions.</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><BriefcaseBusiness size={20} /></span>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-5 rounded-[1.4rem] border border-dashed border-[color:var(--loombus-border)] p-10 text-center">
          <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={38} />
          <h3 className="mt-4 text-xl font-semibold">No job postings yet</h3>
          <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Create an attributable opening from the Editor tab.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {jobs.map((job) => (
            <article key={job.id} className="flex min-h-[300px] flex-col rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5 transition hover:border-[color:var(--loombus-gold)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1 text-xs font-semibold">{jobStatusLabel(job.status)}</span>
                  <span className="text-xs font-semibold text-[color:var(--loombus-text-subtle)]">{job.businessName}</span>
                </div>
                <BriefcaseBusiness size={18} className="text-[color:var(--loombus-gold)]" />
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em]">{job.title}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{job.summary}</p>
              <div className="mt-4 grid gap-2 rounded-2xl bg-[color:var(--loombus-surface)] p-4 text-xs text-[color:var(--loombus-text-muted)]">
                <span className="inline-flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={14} /> {jobLocationLabel(job)}</span>
                {job.updatedAt ? <span className="inline-flex items-center gap-2"><Clock3 className="text-[color:var(--loombus-gold)]" size={14} /> Updated {new Date(job.updatedAt).toLocaleDateString()}</span> : null}
              </div>

              {job.moderationReason ? (
                <p className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Review note: {job.moderationReason}</p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {job.status === "published" ? (
                  <Link href={`/jobs/${encodeURIComponent(job.slug)}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">View <ArrowUpRight size={14} /></Link>
                ) : null}
                <button type="button" onClick={() => startEdit(job)} disabled={working} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"><Edit3 size={14} /> Edit</button>
                {["published", "pending", "draft"].includes(job.status) ? (
                  <button type="button" onClick={() => void runAction({ action: "close", jobId: job.id }, "Job posting closed.")} disabled={working} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"><XCircle size={14} /> Close</button>
                ) : null}
                {["closed", "expired", "rejected"].includes(job.status) ? (
                  <button type="button" onClick={() => void runAction({ action: "reopen", jobId: job.id }, "Job posting reopened and submitted for review.")} disabled={working} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"><RotateCcw size={14} /> Reopen</button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
