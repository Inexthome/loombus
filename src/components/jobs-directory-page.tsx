"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Clock3,
  DollarSign,
  Loader2,
  MapPin,
  Search,
  ShieldAlert,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  JOB_CATEGORIES,
  JOB_EMPLOYMENT_TYPES,
  JOB_WORKPLACE_TYPES,
  type JobPosting,
  employmentTypeLabel,
  formatJobDate,
  jobCompensationLabel,
  jobLocationLabel,
  workplaceTypeLabel,
} from "@/lib/jobs-directory";

export default function JobsDirectoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [workplaceType, setWorkplaceType] = useState("");
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [directoryActive, setDirectoryActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState("");

  async function load(nextPage = 1, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setMessage("");

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (city.trim()) params.set("city", city.trim());
    if (employmentType) params.set("employmentType", employmentType);
    if (workplaceType) params.set("workplaceType", workplaceType);
    params.set("page", String(nextPage));
    params.set("pageSize", "24");

    try {
      const response = await fetch(`/api/jobs?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "The Jobs Directory could not load.");
        if (!append) setJobs([]);
        return;
      }

      const nextJobs = Array.isArray(payload.jobs)
        ? (payload.jobs as JobPosting[])
        : [];
      setJobs((current) => (append ? [...current, ...nextJobs] : nextJobs));
      setTotal(Number(payload.total) || 0);
      setPage(nextPage);
      setDirectoryActive(payload.directoryActive !== false);
    } catch {
      setMessage("The Jobs Directory could not load. Refresh and try again.");
      if (!append) setJobs([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void load(1, false);
  }

  const hasMore = jobs.length < total;

  return (
    <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--loombus-text-subtle)]">
                Jobs Directory
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
                Find the opportunity. Verify the employer. Apply at the source.
              </h1>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                Discover approved job postings connected to attributable Loombus
                business profiles. Results are relevance-ranked without sponsored
                placement or pay-to-rank hiring ads.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 shrink-0" size={22} />
                <div>
                  <p className="font-semibold">Apply outside Loombus</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                    Loombus does not collect résumés in this phase. Apply only through
                    the employer-controlled link or email shown on the posting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="mt-8 grid gap-3 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3 xl:grid-cols-[minmax(0,1fr)_13rem_12rem_12rem_12rem_auto]"
          >
            <label className="flex items-center gap-2 rounded-xl bg-[var(--loombus-surface)] px-4">
              <Search size={18} className="text-[var(--loombus-text-subtle)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Job title, employer, skill..."
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
              />
            </label>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              aria-label="Job category"
            >
              <option value="">All categories</option>
              {JOB_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <select
              value={employmentType}
              onChange={(event) => setEmploymentType(event.target.value)}
              className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              aria-label="Employment type"
            >
              <option value="">All job types</option>
              {JOB_EMPLOYMENT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <select
              value={workplaceType}
              onChange={(event) => setWorkplaceType(event.target.value)}
              className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              aria-label="Workplace type"
            >
              <option value="">Any workplace</option>
              {JOB_WORKPLACE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City or region"
              className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
            />

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-5 py-3 font-semibold text-[var(--loombus-primary-text)]"
            >
              Search <ArrowRight size={17} />
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/jobs/manage"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
            >
              <BriefcaseBusiness size={16} /> Post or manage a job
            </Link>
            <Link
              href="/businesses"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
            >
              <Building2 size={16} /> Browse employer profiles
            </Link>
            <Link
              href="/search?q=jobs"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
            >
              Search all Loombus signals <ArrowRight size={15} />
            </Link>
          </div>
        </section>

        {message ? (
          <p className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            {message}
          </p>
        ) : null}

        {!directoryActive ? (
          <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <h2 className="text-xl font-semibold">
              Jobs Directory activation is pending.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              The application is deployed, but the Jobs migrations still need to be
              applied before postings can be submitted or discovered.
            </p>
          </section>
        ) : loading ? (
          <div className="mt-5 flex min-h-60 items-center justify-center rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
            <Loader2 className="animate-spin" size={25} />
          </div>
        ) : jobs.length === 0 ? (
          <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <BriefcaseBusiness className="mx-auto" size={30} />
            <h2 className="mt-3 text-xl font-semibold">
              No approved job matches yet.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Try a broader role, category, or location. Approved business owners can
              submit openings from the employer workspace.
            </p>
          </section>
        ) : (
          <section className="mt-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                  Approved openings
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {total} job{total === 1 ? "" : "s"}
                </h2>
              </div>
              <p className="text-sm text-[var(--loombus-text-muted)]">
                Showing {jobs.length} of {total}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {jobs.map((job) => {
                const compensation = jobCompensationLabel(job);
                const deadline = formatJobDate(job.applicationDeadline);

                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${encodeURIComponent(job.slug)}`}
                    className="group rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--loombus-text-subtle)] hover:shadow-lg"
                  >
                    <div className="flex gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
                        {job.businessLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={job.businessLogoUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Building2 size={24} />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[var(--loombus-text-subtle)]">
                            {job.category}
                          </span>
                          {job.businessVerificationStatus === "verified" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-[0.7rem] font-semibold">
                              <BadgeCheck size={13} /> Verified employer
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                          {job.title}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-[var(--loombus-text-muted)]">
                          {job.businessName}
                        </p>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                          {job.summary}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-[var(--loombus-text-muted)] sm:grid-cols-2">
                      <span className="flex items-start gap-2">
                        <MapPin className="mt-0.5 shrink-0" size={15} />
                        {jobLocationLabel(job)}
                      </span>
                      <span className="flex items-start gap-2">
                        <BriefcaseBusiness className="mt-0.5 shrink-0" size={15} />
                        {employmentTypeLabel(job.employmentType)} ·{" "}
                        {workplaceTypeLabel(job.workplaceType)}
                      </span>
                      {compensation ? (
                        <span className="flex items-start gap-2">
                          <DollarSign className="mt-0.5 shrink-0" size={15} />
                          {compensation}
                        </span>
                      ) : null}
                      {deadline ? (
                        <span className="flex items-start gap-2">
                          <Clock3 className="mt-0.5 shrink-0" size={15} />
                          Apply by {deadline}
                        </span>
                      ) : null}
                    </div>

                    {job.skills.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {job.skills.slice(0, 5).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)]"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 5 ? (
                          <span className="rounded-full px-3 py-1.5 text-xs text-[var(--loombus-text-subtle)]">
                            +{job.skills.length - 5} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                      Open job posting
                      <ArrowRight
                        size={16}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                );
              })}
            </div>

            {hasMore ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => void load(page + 1, true)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-5 py-3 font-semibold disabled:opacity-50"
                >
                  {loadingMore ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <ArrowRight size={17} />
                  )}
                  Load more jobs
                </button>
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
