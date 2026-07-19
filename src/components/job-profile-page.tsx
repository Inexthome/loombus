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
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

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
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-64 max-w-[84rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading job posting
          </span>
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6">
        <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
          <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[84rem]">
        <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition hover:text-[color:var(--loombus-gold)]">
          <ArrowLeft size={16} /> Jobs
        </Link>

        <header className="mt-5 border-b border-[color:var(--loombus-border-muted)] pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">{job.category}</span>
            {job.businessVerificationStatus === "verified" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--loombus-cream)] px-3 py-1.5 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                <BadgeCheck size={14} /> Verified employer
              </span>
            ) : null}
          </div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{job.title}</h1>
          <p className="mt-3 text-lg font-semibold text-[color:var(--loombus-text-muted)]">{job.businessName}</p>
          <p className="mt-4 max-w-4xl text-base leading-7 text-[color:var(--loombus-text-muted)]">{job.summary}</p>
        </header>

        <section className="my-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<MapPin size={18} />} label="Location" value={jobLocationLabel(job)} featured />
          <Fact icon={<BriefcaseBusiness size={18} />} label="Work arrangement" value={`${employmentTypeLabel(job.employmentType)} · ${workplaceTypeLabel(job.workplaceType)}`} />
          <Fact icon={<GraduationCap size={18} />} label="Experience" value={experienceLevelLabel(job.experienceLevel)} />
          <Fact icon={<DollarSign size={18} />} label="Compensation" value={compensation || "Not stated"} />
        </section>

        {message ? (
          <p className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">{message}</p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0 space-y-5">
            <DetailBlock eyebrow="Opportunity" title="About the opportunity" text={job.description} />
            <DetailBlock eyebrow="Role expectations" title="Responsibilities" text={job.responsibilities} />
            <DetailBlock eyebrow="Candidate profile" title="Qualifications" text={job.qualifications} />

            {job.skills.length > 0 || job.benefits.length > 0 ? (
              <section className="grid gap-5 lg:grid-cols-2">
                {job.skills.length > 0 ? (
                  <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10">
                    <div className="flex items-center gap-2"><CheckCircle2 className="text-[color:var(--loombus-gold)]" size={19} /><h2 className="text-xl font-semibold">Skills</h2></div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.skills.map((skill) => <span key={skill} className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2 text-sm text-[color:var(--loombus-text-muted)]">{skill}</span>)}
                    </div>
                  </article>
                ) : null}
                {job.benefits.length > 0 ? (
                  <article className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10">
                    <h2 className="text-xl font-semibold">Benefits and support</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.benefits.map((benefit) => <span key={benefit} className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2 text-sm text-[color:var(--loombus-text-muted)]">{benefit}</span>)}
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}

            {reportOpen ? (
              <form onSubmit={submitReport} className="rounded-[1.75rem] border border-red-500/30 bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-600 dark:text-red-400">Accountability report</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Report this job posting</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Report misleading employer identity, discriminatory or unsafe content, payment requests, expired openings, or other material concerns.</p>
                <div className="mt-5 grid gap-4">
                  <input value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="Reason for report" className={inputClass} />
                  <textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Explain the concern" rows={5} className={inputClass} />
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={working} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
                      {working ? <Loader2 className="animate-spin" size={16} /> : <Flag size={16} />} Submit report
                    </button>
                    <button type="button" onClick={() => setReportOpen(false)} className={secondaryButton}>Cancel</button>
                  </div>
                </div>
              </form>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Employer source</p>
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
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
                <Link href={`/businesses/${encodeURIComponent(job.businessSlug)}`} className="mt-4 flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Employer profile <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              ) : null}
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Apply through source</p>
              <div className="mt-4 grid gap-2">
                {job.applicationUrl ? (
                  <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>Apply at employer site <ExternalLink size={16} /></a>
                ) : null}
                {job.applicationEmail ? (
                  <a href={`mailto:${job.applicationEmail}?subject=${encodeURIComponent(`Application: ${job.title}`)}`} className={secondaryButton}><Mail size={16} /> Email employer</a>
                ) : null}
                {!job.applicationUrl && !job.applicationEmail ? (
                  <span className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm text-[color:var(--loombus-text-muted)]">No application destination is currently listed.</span>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Posting dates</p>
              <div className="mt-4 space-y-3 text-sm">
                {deadline ? <span className="flex items-start gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4"><CalendarDays className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span><strong className="block">Application deadline</strong><span className="text-[color:var(--loombus-text-muted)]">{deadline}</span></span></span> : null}
                {expiration ? <span className="flex items-start gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span><strong className="block">Posting expires</strong><span className="text-[color:var(--loombus-text-muted)]">{expiration}</span></span></span> : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Application boundary</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process this application or make hiring decisions. Confirm the employer and never pay money merely to apply.</p>
                  <button type="button" onClick={() => setReportOpen((open) => !open)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400"><ShieldAlert size={16} /> Report job</button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function Fact({
  icon,
  label,
  value,
  featured = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  featured?: boolean;
}) {
  return (
    <article className={`rounded-[1.4rem] border p-4 shadow-sm ${featured ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]" : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)]"}`}>
      <span className="text-[color:var(--loombus-gold)]">{icon}</span>
      <strong className="mt-3 block text-xs uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</strong>
      <span className="mt-1 block text-sm font-semibold leading-6">{value}</span>
    </article>
  );
}

function DetailBlock({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  if (!text) return null;
  return (
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
      <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[color:var(--loombus-text-muted)]">{text}</div>
    </section>
  );
}
