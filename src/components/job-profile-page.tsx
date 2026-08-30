"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  ExternalLink,
  Flag,
  GraduationCap,
  Loader2,
  Mail,
  MapPin,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { JobPosting } from "@/lib/jobs-directory";
import {
  employmentTypeLabel,
  experienceLevelLabel,
  formatJobDate,
  jobCompensationLabel,
  jobLocationLabel,
  workplaceTypeLabel,
} from "@/lib/jobs-directory";
import { supabase } from "@/lib/supabase/client";

const inputClass =
  "w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-0 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-0 text-sm font-semibold text-[color:var(--loombus-gold)] transition hover:text-[color:var(--loombus-text)] disabled:opacity-50";

export default function JobProfilePage() {
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [working, setWorking] = useState(false);

  const pathname = usePathname();
  const slug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] ?? "");
  }, [pathname]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/jobs?slug=${encodeURIComponent(slug)}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok || !payload.job) {
          setMessage(payload.error ?? "Job not found.");
          return;
        }
        setJob(payload.job as JobPosting);
      } catch {
        if (!cancelled) setMessage("Unable to load this job posting.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    if (!job || working) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "report",
          jobId: job.id,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to submit the report.");
      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
      setMessage("The job report was submitted for administrator review.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit the report.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[84rem] border-y border-[color:var(--loombus-border)] py-16">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading job posting
          </span>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl border-y border-[color:var(--loombus-border)] py-12">
          <BriefcaseBusiness className="text-[color:var(--loombus-gold)]" size={36} />
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Job posting unavailable</h1>
          <p className="mt-3 text-[color:var(--loombus-text-muted)]">{message || "This job may be under review, closed, expired, or no longer public."}</p>
          <Link href="/jobs" className={`${secondaryButton} mt-6`}>
            <ArrowLeft size={16} /> Back to Jobs
          </Link>
        </section>
      </main>
    );
  }

  const compensation = jobCompensationLabel(job);
  const deadline = formatJobDate(job.applicationDeadline);
  const expiration = formatJobDate(job.expiresAt);

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[84rem]">
        <Link href="/jobs" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
          <ArrowLeft size={16} /> Jobs
        </Link>

        <header className="mt-3 border-b border-[color:var(--loombus-border)] pb-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">
            <span>{job.category}</span>
            {job.businessVerificationStatus === "verified" ? (
              <span className="inline-flex items-center gap-1.5 text-[color:var(--loombus-gold)]">
                <BadgeCheck size={14} /> Verified employer
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{job.title}</h1>
          <p className="mt-3 text-lg font-semibold text-[color:var(--loombus-text-muted)]">{job.businessName}</p>
          <p className="mt-4 max-w-4xl text-base leading-7 text-[color:var(--loombus-text-muted)]">{job.summary}</p>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Job facts">
          <Fact icon={<MapPin size={18} />} label="Location" value={jobLocationLabel(job)} />
          <Fact icon={<BriefcaseBusiness size={18} />} label="Work arrangement" value={`${employmentTypeLabel(job.employmentType)} · ${workplaceTypeLabel(job.workplaceType)}`} />
          <Fact icon={<GraduationCap size={18} />} label="Experience" value={experienceLevelLabel(job.experienceLevel)} />
          <Fact icon={<DollarSign size={18} />} label="Compensation" value={compensation || "Not stated"} />
        </section>

        {message ? (
          <p className="border-b border-[color:var(--loombus-border)] py-4 text-sm" role="status">{message}</p>
        ) : null}

        <div className="grid gap-10 pt-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0 divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)]">
            <DetailBlock eyebrow="Opportunity" title="About the opportunity" text={job.description} />
            <DetailBlock eyebrow="Role expectations" title="Responsibilities" text={job.responsibilities} />
            <DetailBlock eyebrow="Candidate profile" title="Qualifications" text={job.qualifications} />

            {job.skills.length > 0 || job.benefits.length > 0 ? (
              <section className="grid gap-8 py-8 lg:grid-cols-2">
                {job.skills.length > 0 ? (
                  <article>
                    <div className="flex items-center gap-2"><CheckCircle2 className="text-[color:var(--loombus-gold)]" size={19} /><h2 className="text-xl font-semibold">Skills</h2></div>
                    <ul className="mt-4 divide-y divide-[color:var(--loombus-border)] text-sm text-[color:var(--loombus-text-muted)]">
                      {job.skills.map((skill) => <li key={skill} className="py-2.5">{skill}</li>)}
                    </ul>
                  </article>
                ) : null}
                {job.benefits.length > 0 ? (
                  <article>
                    <h2 className="text-xl font-semibold">Benefits and support</h2>
                    <ul className="mt-4 divide-y divide-[color:var(--loombus-border)] text-sm text-[color:var(--loombus-text-muted)]">
                      {job.benefits.map((benefit) => <li key={benefit} className="py-2.5">{benefit}</li>)}
                    </ul>
                  </article>
                ) : null}
              </section>
            ) : null}

            {reportOpen ? (
              <form onSubmit={submitReport} className="py-8">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-600 dark:text-red-400">Accountability report</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Report this job posting</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Report misleading employer identity, discriminatory or unsafe content, payment requests, expired openings, or other material concerns.</p>
                <div className="mt-5 grid gap-5">
                  <label>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">Reason</span>
                    <input value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Reason for report" className={inputClass} />
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-text-muted)]">Details</span>
                    <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Explain the concern" rows={5} className={inputClass} />
                  </label>
                  <div className="flex flex-wrap gap-5">
                    <button type="submit" disabled={working} className="inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-red-600 px-0 text-sm font-semibold text-red-600 disabled:opacity-50 dark:text-red-400">
                      {working ? <Loader2 className="animate-spin" size={16} /> : <Flag size={16} />} Submit report
                    </button>
                    <button type="button" onClick={() => setReportOpen(false)} className={secondaryButton}>Cancel</button>
                  </div>
                </div>
              </form>
            ) : null}
          </section>

          <aside className="divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)] xl:sticky xl:top-28 xl:self-start">
            <section className="py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">Employer source</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)]">
                  {job.businessLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={job.businessLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : <Building2 size={22} />}
                </span>
                <div className="min-w-0">
                  <strong className="block truncate">{job.businessName}</strong>
                  <span className="mt-1 block text-xs text-[color:var(--loombus-text-muted)]">Original employer attribution</span>
                </div>
              </div>
              {job.businessSlug ? (
                <Link href={`/businesses/${encodeURIComponent(job.businessSlug)}`} className="mt-4 flex min-h-11 items-center justify-between border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
                  Employer profile <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              ) : null}
            </section>

            <section className="py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">Apply through source</p>
              <div className="mt-4 flex flex-col items-start gap-3">
                {job.applicationUrl ? (
                  <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>Apply at employer site <ExternalLink size={16} /></a>
                ) : null}
                {job.applicationEmail ? (
                  <a href={`mailto:${job.applicationEmail}?subject=${encodeURIComponent(`Application: ${job.title}`)}`} className={secondaryButton}><Mail size={16} /> Email employer</a>
                ) : null}
                {!job.applicationUrl && !job.applicationEmail ? (
                  <span className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">No application destination is currently listed.</span>
                ) : null}
              </div>
            </section>

            <section className="py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">Posting dates</p>
              <div className="mt-4 divide-y divide-[color:var(--loombus-border)] text-sm">
                {deadline ? <span className="flex items-start gap-3 py-3"><CalendarDays className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span><strong className="block">Application deadline</strong><span className="text-[color:var(--loombus-text-muted)]">{deadline}</span></span></span> : null}
                {expiration ? <span className="flex items-start gap-3 py-3"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span><strong className="block">Posting expires</strong><span className="text-[color:var(--loombus-text-muted)]">{expiration}</span></span></span> : null}
              </div>
            </section>

            <section className="py-6">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Application boundary</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process this application or make hiring decisions. Confirm the employer and never pay money merely to apply.</p>
                  <button type="button" onClick={() => setReportOpen((open) => !open)} className="mt-4 inline-flex min-h-11 items-center gap-2 border-b border-transparent text-sm font-semibold text-red-600 transition hover:border-red-600 dark:text-red-400"><ShieldAlert size={16} /> Report job</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <article className="border-t border-[color:var(--loombus-border)] py-5 sm:px-5 sm:first:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0 lg:first:pl-0">
      <span className="text-[color:var(--loombus-gold)]">{icon}</span>
      <strong className="mt-3 block text-xs uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</strong>
      <span className="mt-1 block text-sm font-semibold leading-6">{value}</span>
    </article>
  );
}

function DetailBlock({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  if (!text) return null;
  return (
    <section className="py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--loombus-text-muted)]">{text}</div>
    </section>
  );
}
