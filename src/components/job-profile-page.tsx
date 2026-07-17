"use client";

import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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

function DetailBlock({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  if (!text) return null;

  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">
        {text}
      </div>
    </section>
  );
}

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
      window.location.href = `/login?next=${encodeURIComponent(
        window.location.pathname
      )}`;
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
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit the report.");
      }

      setReportOpen(false);
      setReportReason("");
      setReportDetails("");
      setMessage("The job report was submitted for administrator review.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit the report."
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="loombus-shell-with-right-rail flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  if (!job) {
    return (
      <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] px-4 py-12 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-2xl rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
          <BriefcaseBusiness className="mx-auto" size={30} />
          <h1 className="mt-3 text-2xl font-semibold">Job posting unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {message ||
              "This job may be under review, closed, expired, or no longer public."}
          </p>
          <Link
            href="/jobs"
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
          >
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
    <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"
        >
          <ArrowLeft size={16} /> Jobs Directory
        </Link>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                  {job.category}
                </span>
                {job.businessVerificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-xs font-semibold">
                    <BadgeCheck size={14} /> Verified employer
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                {job.title}
              </h1>
              <p className="mt-3 text-lg font-semibold text-[var(--loombus-text-muted)]">
                {job.businessName}
              </p>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                {job.summary}
              </p>

              <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                <span className="flex items-start gap-2 rounded-2xl bg-[var(--loombus-page-bg)] p-4">
                  <MapPin className="mt-0.5 shrink-0" size={17} />
                  {jobLocationLabel(job)}
                </span>
                <span className="flex items-start gap-2 rounded-2xl bg-[var(--loombus-page-bg)] p-4">
                  <BriefcaseBusiness className="mt-0.5 shrink-0" size={17} />
                  {employmentTypeLabel(job.employmentType)} ·{" "}
                  {workplaceTypeLabel(job.workplaceType)}
                </span>
                <span className="flex items-start gap-2 rounded-2xl bg-[var(--loombus-page-bg)] p-4">
                  <GraduationCap className="mt-0.5 shrink-0" size={17} />
                  {experienceLevelLabel(job.experienceLevel)}
                </span>
                {compensation ? (
                  <span className="flex items-start gap-2 rounded-2xl bg-[var(--loombus-page-bg)] p-4">
                    <DollarSign className="mt-0.5 shrink-0" size={17} />
                    {compensation}
                  </span>
                ) : null}
                {deadline ? (
                  <span className="flex items-start gap-2 rounded-2xl bg-[var(--loombus-page-bg)] p-4">
                    <CalendarDays className="mt-0.5 shrink-0" size={17} />
                    Apply by {deadline}
                  </span>
                ) : null}
                {expiration ? (
                  <span className="flex items-start gap-2 rounded-2xl bg-[var(--loombus-page-bg)] p-4">
                    <Clock3 className="mt-0.5 shrink-0" size={17} />
                    Posting expires {expiration}
                  </span>
                ) : null}
              </div>
            </div>

            <aside className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
                  {job.businessLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={job.businessLogoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Building2 size={22} />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{job.businessName}</p>
                  <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                    Employer source
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {job.applicationUrl ? (
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-4 py-3 font-semibold text-[var(--loombus-primary-text)]"
                  >
                    Apply at employer site <ExternalLink size={16} />
                  </a>
                ) : null}
                {job.applicationEmail ? (
                  <a
                    href={`mailto:${job.applicationEmail}?subject=${encodeURIComponent(
                      `Application: ${job.title}`
                    )}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
                  >
                    Email employer <Mail size={16} />
                  </a>
                ) : null}
                {job.businessSlug ? (
                  <Link
                    href={`/businesses/${encodeURIComponent(job.businessSlug)}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-3 font-semibold"
                  >
                    Employer profile <Building2 size={16} />
                  </Link>
                ) : null}
              </div>

              <p className="mt-4 text-xs leading-5 text-[var(--loombus-text-subtle)]">
                Loombus does not process this application or make hiring decisions.
                Confirm the employer and never pay money merely to apply.
              </p>
            </aside>
          </div>
        </section>

        <DetailBlock title="About the opportunity" text={job.description} />
        <DetailBlock title="Responsibilities" text={job.responsibilities} />
        <DetailBlock title="Qualifications" text={job.qualifications} />

        {job.skills.length > 0 || job.benefits.length > 0 ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            {job.skills.length > 0 ? (
              <article className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
                <h2 className="flex items-center gap-2 text-xl font-semibold">
                  <CheckCircle2 size={20} /> Skills
                </h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-sm text-[var(--loombus-text-muted)]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}

            {job.benefits.length > 0 ? (
              <article className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
                <h2 className="text-xl font-semibold">Benefits and support</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {job.benefits.map((benefit) => (
                    <span
                      key={benefit}
                      className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-sm text-[var(--loombus-text-muted)]"
                    >
                      {benefit}
                    </span>
                  ))}
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">
            {message}
          </p>
        ) : null}

        <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <ShieldAlert size={20} /> Posting accountability
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Report misleading employer identity, discriminatory or unsafe content,
                payment requests, expired openings, or other material concerns.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReportOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
            >
              <Flag size={16} /> Report job
            </button>
          </div>

          {reportOpen ? (
            <form
              onSubmit={submitReport}
              className="mt-5 grid gap-4 border-t border-[var(--loombus-border)] pt-5"
            >
              <input
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                placeholder="Reason for report"
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 outline-none"
              />
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                placeholder="Explain the concern"
                rows={4}
                className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 outline-none"
              />
              <button
                type="submit"
                disabled={working}
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-5 py-3 font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
              >
                {working ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : (
                  <Flag size={17} />
                )}
                Submit report
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}
