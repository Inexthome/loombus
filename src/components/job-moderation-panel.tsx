"use client";

import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2, Flag, MapPin, ShieldCheck, XCircle } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import {
  employmentTypeLabel,
  jobCompensationLabel,
  jobLocationLabel,
  jobStatusLabel,
  workplaceTypeLabel,
  type JobReport,
  type JobPosting,
} from "@/lib/jobs-directory";
import {
  AdminActionButton,
  AdminMetricCard,
  AdminQueueSection,
  AdminStatusBadge,
} from "@/app/admin/platform/admin-platform-foundation";

type Props = {
  pendingJobs: JobPosting[];
  openReports: JobReport[];
  moderate: (payload: Record<string, unknown>, successMessage: string) => void | Promise<void>;
  working: boolean;
};

const textareaClass = "mt-3 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--loombus-gold)] focus:ring-2 focus:ring-[var(--loombus-gold-soft)]";
const emptyClass = "rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-7 text-center text-sm text-[var(--loombus-text-muted)]";

export function JobModerationPanel({ pendingJobs, openReports, moderate, working }: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const noteFor = (key: string) => notes[key] ?? "";
  const updateNote = (key: string, value: string) => setNotes((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard label="Attention queue" value={pendingJobs.length + openReports.length} description="Posting decisions plus open reports." icon={<ShieldCheck size={20} />} featured />
        <AdminMetricCard label="Posting decisions" value={pendingJobs.length} description="Job records requiring publication review." icon={<BriefcaseBusiness size={20} />} />
        <AdminMetricCard label="Open reports" value={openReports.length} description="Member reports still awaiting an outcome." icon={<Flag size={20} />} />
      </div>

      <AdminQueueSection eyebrow="Jobs review" title="Posting decisions" description="Review employer attribution, workplace, location, compensation, application route, and administrator notes before changing publication state." action={<AdminStatusBadge status={pendingJobs.length ? "attention" : "ready"}>{pendingJobs.length ? `${pendingJobs.length} waiting` : "Queue clear"}</AdminStatusBadge>}>
        <div className="grid gap-4">
          {pendingJobs.map((job) => {
            const key = `job:${job.id}`;
            const compensation = jobCompensationLabel(job);
            return (
              <article key={job.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><AdminStatusBadge status="attention">{jobStatusLabel(job.status)}</AdminStatusBadge><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{job.category}</span></div><h3 className="mt-3 text-xl font-semibold">{job.title}</h3><p className="mt-1 text-sm font-semibold text-[var(--loombus-text-muted)]">{job.businessName}</p><p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--loombus-text-muted)]">{job.summary}</p></div>
                  <Link href={`/jobs/${job.slug}`} className="text-sm font-semibold text-[var(--loombus-gold)]">Open public record</Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--loombus-text-muted)]"><span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-1.5"><MapPin size={13} /> {jobLocationLabel(job)}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{employmentTypeLabel(job.employmentType)}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{workplaceTypeLabel(job.workplaceType)}</span>{compensation ? <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{compensation}</span> : null}</div>
                <label className="mt-5 block text-sm font-semibold" htmlFor={`job-note-${job.id}`}>Administrator note</label>
                <textarea id={`job-note-${job.id}`} rows={3} value={noteFor(key)} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateNote(key, event.target.value)} placeholder="Record the decision reason or requested correction." className={textareaClass} />
                <div className="mt-4 flex flex-wrap gap-2"><AdminActionButton type="button" primary disabled={working} onClick={() => void moderate({ action: "moderate", jobId: job.id, decision: "approve", note: noteFor(key) }, "Job posting approved and published.")}><CheckCircle2 size={15} /> Approve</AdminActionButton><AdminActionButton type="button" disabled={working} onClick={() => void moderate({ action: "moderate", jobId: job.id, decision: "reject", note: noteFor(key) }, "Changes requested from the employer.")}><XCircle size={15} /> Request changes</AdminActionButton><button type="button" disabled={working} onClick={() => void moderate({ action: "moderate", jobId: job.id, decision: "suspend", note: noteFor(key) }, "Job posting suspended.")} className="min-h-11 rounded-full border border-red-500/30 px-4 text-sm font-semibold text-red-700 disabled:opacity-50 dark:text-red-300">Suspend</button></div>
              </article>
            );
          })}
          {pendingJobs.length === 0 ? <p className={emptyClass}>No job postings require administrator review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection eyebrow="Trust and safety" title="Open job reports" description="Resolve the report after the concern has been handled, or dismiss it when no action is required." action={<AdminStatusBadge status={openReports.length ? "attention" : "ready"}>{openReports.length ? `${openReports.length} open` : "Queue clear"}</AdminStatusBadge>}>
        <div className="grid gap-4 xl:grid-cols-2">
          {openReports.map((report) => {
            const key = `report:${report.id}`;
            return <article key={report.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]"><Flag size={15} /> Job report</p><h3 className="mt-2 text-lg font-semibold">{report.jobTitle}</h3><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{report.businessName}</p><p className="mt-3 text-sm font-semibold">{report.reason}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{report.details}</p><label className="mt-5 block text-sm font-semibold" htmlFor={`job-report-note-${report.id}`}>Decision note</label><textarea id={`job-report-note-${report.id}`} rows={3} value={noteFor(key)} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateNote(key, event.target.value)} placeholder="Record the outcome or supporting context." className={textareaClass} /><div className="mt-4 flex gap-2"><AdminActionButton type="button" primary disabled={working} onClick={() => void moderate({ action: "review_report", reportId: report.id, decision: "resolve", note: noteFor(key) }, "Job report resolved.")}>Resolve</AdminActionButton><AdminActionButton type="button" disabled={working} onClick={() => void moderate({ action: "review_report", reportId: report.id, decision: "dismiss", note: noteFor(key) }, "Job report dismissed.")}>Dismiss</AdminActionButton></div></article>;
          })}
          {openReports.length === 0 ? <p className={emptyClass}>No job reports are open.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}
