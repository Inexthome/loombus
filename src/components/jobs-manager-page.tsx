"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type {
  JobEmployerOption,
  JobsManageResponse,
  JobPosting,
} from "@/lib/jobs-directory";
import { supabase } from "@/lib/supabase/client";
import { JobListingEditor } from "@/components/job-listing-editor";
import { JobListingsPanel } from "@/components/job-listings-panel";
import { JobModerationPanel } from "@/components/job-moderation-panel";
import {
  type JobDraft,
  EMPTY_JOB_DRAFT,
  draftFromJob,
} from "@/components/job-manager-model";

function commaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function employerFromJob(job: JobPosting): JobEmployerOption {
  return {
    id: job.businessId,
    name: job.businessName,
    slug: job.businessSlug,
    logoUrl: job.businessLogoUrl,
    verificationStatus: job.businessVerificationStatus,
    status: job.businessStatus,
    ownerId: null,
  };
}

export default function JobsManagerPage() {
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] = useState<JobsManageResponse | null>(null);
  const [employers, setEmployers] = useState<JobEmployerOption[]>([]);
  const [employerSearch, setEmployerSearch] = useState("");
  const [searchingEmployers, setSearchingEmployers] = useState(false);
  const [draft, setDraft] = useState<JobDraft>(EMPTY_JOB_DRAFT);
  const [editingId, setEditingId] = useState("");
  const [formOpen, setFormOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editingJob = useMemo(
    () => data?.jobs.find((job) => job.id === editingId) ?? null,
    [data?.jobs, editingId]
  );

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        window.location.href = `/login?next=${encodeURIComponent(
          "/jobs/manage"
        )}`;
        return;
      }
      setAccessToken(token);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void Promise.all([load(), loadEmployers("")]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !data?.isAdmin) return;
    const timer = window.setTimeout(
      () => void loadEmployers(employerSearch),
      250
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, data?.isAdmin, employerSearch]);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/jobs?manage=1", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Unable to load job management.");
        return;
      }

      setData(payload as JobsManageResponse);
    } catch {
      setError("Unable to load job management. Refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployers(query: string) {
    if (!accessToken) return;
    setSearchingEmployers(true);

    try {
      const params = new URLSearchParams({ employers: "1" });
      if (query.trim()) params.set("q", query.trim());
      const response = await fetch(`/api/jobs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error ?? "Unable to load employer profiles.");
        return;
      }

      const next = Array.isArray(payload.employers)
        ? (payload.employers as JobEmployerOption[])
        : [];
      setEmployers((current) => {
        const required = editingJob ? employerFromJob(editingJob) : null;
        const selected =
          current.find((employer) => employer.id === draft.businessId) ?? null;
        const combined = [required, selected, ...next].filter(
          (employer): employer is JobEmployerOption => Boolean(employer)
        );
        const deduped = new Map<string, JobEmployerOption>();
        for (const employer of combined) deduped.set(employer.id, employer);
        return [...deduped.values()];
      });
    } catch {
      setError("Unable to load employer profiles.");
    } finally {
      setSearchingEmployers(false);
    }
  }

  async function action(payload: Record<string, unknown>) {
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error ?? "Unable to complete the request.");
    }
    return result;
  }

  function updateDraft<K extends keyof JobDraft>(
    key: K,
    value: JobDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    setEditingId("");
    setDraft({
      ...EMPTY_JOB_DRAFT,
      businessId: employers.length === 1 ? employers[0].id : "",
    });
    setFormOpen(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(job: JobPosting) {
    setEditingId(job.id);
    setDraft(draftFromJob(job));
    setEmployers((current) => {
      if (current.some((employer) => employer.id === job.businessId)) {
        return current;
      }
      return [employerFromJob(job), ...current];
    });
    setFormOpen(true);
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;

    setWorking(true);
    setMessage("");
    setError("");

    try {
      await action({
        action: editingId ? "update" : "create",
        jobId: editingId || undefined,
        ...draft,
        skills: commaList(draft.skills),
        benefits: commaList(draft.benefits),
      });

      setMessage(
        data?.isAdmin && draft.publishNow
          ? "Job posting saved and published."
          : "Job posting submitted for administrator review."
      );
      setEditingId("");
      setDraft({
        ...EMPTY_JOB_DRAFT,
        businessId: employers.length === 1 ? employers[0].id : "",
      });
      setFormOpen(false);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save the job posting."
      );
    } finally {
      setWorking(false);
    }
  }

  async function runAction(
    payload: Record<string, unknown>,
    successMessage: string
  ) {
    if (working) return;

    setWorking(true);
    setMessage("");
    setError("");

    try {
      await action(payload);
      setMessage(successMessage);
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the Jobs queue."
      );
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) {
    return (
      <main className="loombus-shell-with-right-rail flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="animate-spin" size={28} />
      </main>
    );
  }

  return (
    <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"
        >
          <ArrowLeft size={16} /> Jobs Directory
        </Link>

        <section className="mt-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--loombus-text-subtle)]">
                Employer workspace
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                Publish attributable opportunities.
              </h1>
              <p className="mt-3 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                Connect each opening to a business profile, publish structured job
                facts, and direct applicants to an employer-controlled application
                source. New and materially edited postings enter review.
              </p>
            </div>

            <button
              type="button"
              onClick={startNew}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-primary-text)]"
            >
              <Plus size={16} /> New job
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <Building2 size={19} />
              <h2 className="mt-2 font-semibold">Employer identity</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                Posting control follows the connected business profile.
              </p>
            </article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <BriefcaseBusiness size={19} />
              <h2 className="mt-2 font-semibold">Structured jobs</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                Role, location, compensation, skills, and deadlines are searchable.
              </p>
            </article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <ShieldCheck size={19} />
              <h2 className="mt-2 font-semibold">Source applications</h2>
              <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                Applicants leave Loombus for the employer’s application source.
              </p>
            </article>
          </div>
        </section>

        {message ? (
          <p className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {error}
          </p>
        ) : null}

        {!data?.isAdmin && employers.length === 0 && !searchingEmployers ? (
          <section className="mt-5 rounded-[1.5rem] border border-amber-500/30 bg-amber-500/10 p-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 shrink-0" size={20} />
              <div>
                <h2 className="font-semibold">
                  A business profile is required.
                </h2>
                <p className="mt-1 text-sm leading-6">
                  Create or claim a Local Business profile before submitting a job.
                </p>
                <Link
                  href="/businesses/manage"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-current px-4 py-2 text-sm font-semibold"
                >
                  Open business workspace
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <JobListingEditor
          editingJob={editingJob}
          formOpen={formOpen}
          toggleForm={() => setFormOpen((open) => !open)}
          submit={submit}
          draft={draft}
          updateDraft={updateDraft}
          employers={employers}
          employerSearch={employerSearch}
          onEmployerSearchChange={setEmployerSearch}
          searchingEmployers={searchingEmployers}
          isAdmin={Boolean(data?.isAdmin)}
          working={working}
          editingId={editingId}
          startNew={startNew}
        />

        <JobListingsPanel
          jobs={data?.jobs ?? []}
          startEdit={startEdit}
          runAction={runAction}
          working={working}
        />

        {data?.isAdmin ? (
          <JobModerationPanel
            pendingJobs={data.moderation.pendingJobs}
            openReports={data.moderation.openReports}
            moderate={runAction}
            working={working}
          />
        ) : null}
      </div>
    </main>
  );
}
