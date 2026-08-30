"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CircleAlert,
  ClipboardList,
  Loader2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { JobEmployerOption, JobsManageResponse, JobPosting } from "@/lib/jobs-directory";
import { supabase } from "@/lib/supabase/client";
import { JobListingEditor } from "@/components/job-listing-editor";
import { JobListingsPanel } from "@/components/job-listings-panel";
import { JobModerationPanel } from "@/components/job-moderation-panel";
import { type JobDraft, EMPTY_JOB_DRAFT, draftFromJob } from "@/components/job-manager-model";

type WorkspaceTab = "records" | "editor" | "review";

function commaList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("records");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const editingJob = useMemo(
    () => data?.jobs.find((job) => job.id === editingId) ?? null,
    [data?.jobs, editingId],
  );
  const publishedCount = useMemo(
    () => data?.jobs.filter((job) => job.status === "published").length ?? 0,
    [data?.jobs],
  );
  const closedCount = useMemo(
    () => data?.jobs.filter((job) => ["closed", "expired"].includes(job.status)).length ?? 0,
    [data?.jobs],
  );
  const reviewCount = useMemo(
    () => (data?.moderation.pendingJobs.length ?? 0) + (data?.moderation.openReports.length ?? 0),
    [data?.moderation],
  );

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        window.location.href = `/login?next=${encodeURIComponent("/jobs/manage")}`;
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
    const timer = window.setTimeout(() => void loadEmployers(employerSearch), 250);
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
      const next = Array.isArray(payload.employers) ? (payload.employers as JobEmployerOption[]) : [];
      setEmployers((current) => {
        const required = editingJob ? employerFromJob(editingJob) : null;
        const selected = current.find((employer) => employer.id === draft.businessId) ?? null;
        const combined = [required, selected, ...next].filter(
          (employer): employer is JobEmployerOption => Boolean(employer),
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
    if (!response.ok) throw new Error(result.error ?? "Unable to complete the request.");
    return result;
  }

  function updateDraft<K extends keyof JobDraft>(key: K, value: JobDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startNew() {
    setEditingId("");
    setDraft({ ...EMPTY_JOB_DRAFT, businessId: employers.length === 1 ? employers[0].id : "" });
    setFormOpen(true);
    setActiveTab("editor");
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(job: JobPosting) {
    setEditingId(job.id);
    setDraft(draftFromJob(job));
    setEmployers((current) => {
      if (current.some((employer) => employer.id === job.businessId)) return current;
      return [employerFromJob(job), ...current];
    });
    setFormOpen(true);
    setActiveTab("editor");
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
          : "Job posting submitted for administrator review.",
      );
      setEditingId("");
      setDraft({ ...EMPTY_JOB_DRAFT, businessId: employers.length === 1 ? employers[0].id : "" });
      setFormOpen(false);
      setActiveTab("records");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the job posting.");
    } finally {
      setWorking(false);
    }
  }

  async function runAction(payload: Record<string, unknown>, successMessage: string) {
    if (working) return;
    setWorking(true);
    setMessage("");
    setError("");
    try {
      await action(payload);
      setMessage(successMessage);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the Jobs queue.");
    } finally {
      setWorking(false);
    }
  }

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
        <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={28} />
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceTab; label: string; count?: number }> = [
    { key: "records", label: "Job postings", count: data?.jobs.length ?? 0 },
    { key: "editor", label: editingId ? "Edit posting" : "Create posting" },
    ...(data?.isAdmin ? [{ key: "review" as const, label: "Admin review", count: reviewCount }] : []),
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <Link
          href="/jobs"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] transition-colors hover:text-[color:var(--loombus-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)]"
        >
          <ArrowLeft size={16} /> Jobs Directory
        </Link>

        <header className="mt-5 border-b border-[color:var(--loombus-border)] pb-7 lg:flex lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Employer workspace</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Manage Jobs</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Publish attributable opportunities, maintain employer-controlled application sources, and manage posting lifecycle and review status from one workspace.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 lg:mt-0">
            <Link
              href="/businesses/manage"
              className="inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-border)] text-sm font-semibold transition-colors hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)]"
            >
              <Building2 size={16} /> Manage Businesses
            </Link>
            <button
              type="button"
              onClick={startNew}
              className="inline-flex min-h-11 items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] text-sm font-semibold text-[color:var(--loombus-gold)] transition-opacity hover:opacity-80"
            >
              <Plus size={16} /> New job
            </button>
          </div>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Jobs management summary">
          {[
            ["Job records", data?.jobs.length ?? 0],
            ["Published", publishedCount],
            ["Closed or expired", closedCount],
            ["Employer profiles", employers.length],
          ].map(([label, value], index) => (
            <div key={String(label)} className={`py-5 ${index > 0 ? "sm:border-l sm:border-[color:var(--loombus-border)] sm:pl-5" : ""}`}>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">{label}</span>
              <strong className="mt-1 block text-3xl font-semibold tracking-[-0.04em]">{value}</strong>
            </div>
          ))}
        </section>

        <nav className="flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Jobs management workspace">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-1 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] ${active ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]" : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}
              >
                {tab.label}
                {typeof tab.count === "number" ? <span className="text-xs tabular-nums text-[color:var(--loombus-gold)]">{tab.count}</span> : null}
              </button>
            );
          })}
        </nav>

        {message ? <p className="border-b border-emerald-500/30 py-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
        {error ? <p className="border-b border-red-500/30 py-4 text-sm text-red-600 dark:text-red-300">{error}</p> : null}

        {!data?.isAdmin && employers.length === 0 && !searchingEmployers ? (
          <section className="border-b border-amber-500/30 py-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 shrink-0 text-amber-600" size={20} />
              <div>
                <h2 className="font-semibold">A business profile is required</h2>
                <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Create or claim a Business profile before submitting a job.</p>
                <Link href="/businesses/manage" className="mt-3 inline-flex min-h-11 items-center border-b border-current text-sm font-semibold">Open Business workspace</Link>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-8 pt-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            {activeTab === "records" ? <JobListingsPanel jobs={data?.jobs ?? []} startEdit={startEdit} runAction={runAction} working={working} /> : null}
            {activeTab === "editor" ? (
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
            ) : null}
            {activeTab === "review" && data?.isAdmin ? (
              <JobModerationPanel pendingJobs={data.moderation.pendingJobs} openReports={data.moderation.openReports} moderate={runAction} working={working} />
            ) : null}
          </section>

          <aside className="border-t border-[color:var(--loombus-border)] pt-6 xl:sticky xl:top-28 xl:self-start xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Workspace guide</p>
                <BriefcaseBusiness className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <dl className="mt-4 divide-y divide-[color:var(--loombus-border)] text-sm leading-6">
                <div className="py-3"><dt className="font-semibold">Postings</dt><dd className="text-[color:var(--loombus-text-muted)]">Review status, location, employer attribution, updates, and lifecycle actions.</dd></div>
                <div className="py-3"><dt className="font-semibold">Editor</dt><dd className="text-[color:var(--loombus-text-muted)]">Publish role facts, compensation context, qualifications, deadlines, and the original application source.</dd></div>
                {data?.isAdmin ? <div className="py-3"><dt className="font-semibold">Admin review</dt><dd className="text-[color:var(--loombus-text-muted)]">Approve, return, suspend, resolve, or dismiss through the existing moderation contracts.</dd></div> : null}
              </dl>
            </section>

            <section className="border-b border-[color:var(--loombus-border)] py-6">
              <p className="text-xs font-bold uppercase tracking-[0.22em]">Job destinations</p>
              <div className="mt-3 divide-y divide-[color:var(--loombus-border)]">
                {[["Jobs Directory", "/jobs"], ["Manage Businesses", "/businesses/manage"], ["Manage Local area", "/local/manage"]].map(([label, href]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center justify-between text-sm font-semibold transition-colors hover:text-[color:var(--loombus-gold)]">
                    {label} <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="border-b border-[color:var(--loombus-border)] py-6">
              <div className="flex gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Application boundary</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Applicants leave Loombus for the employer-controlled source. Loombus does not guarantee the employer, role, hiring decision, compensation, or application outcome.</p>
                </div>
              </div>
            </section>

            {data?.isAdmin ? (
              <section className="pt-6">
                <div className="flex items-center gap-2"><ClipboardList size={17} className="text-[color:var(--loombus-gold)]" /><strong>Admin attention</strong></div>
                <p className="mt-2 text-3xl font-semibold">{reviewCount}</p>
                <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">Postings and reports awaiting a decision.</p>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
