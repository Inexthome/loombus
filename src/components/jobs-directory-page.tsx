"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Clock3,
  DollarSign,
  Loader2,
  MapPin,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
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

type JobFilters = {
  query: string;
  category: string;
  city: string;
  employmentType: string;
  workplaceType: string;
};

const controlClass =
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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

  function currentFilters(overrides?: Partial<JobFilters>): JobFilters {
    return {
      query: overrides?.query ?? query,
      category: overrides?.category ?? category,
      city: overrides?.city ?? city,
      employmentType: overrides?.employmentType ?? employmentType,
      workplaceType: overrides?.workplaceType ?? workplaceType,
    };
  }

  async function load(
    nextPage = 1,
    append = false,
    overrides?: Partial<JobFilters>,
  ) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setMessage("");

    const filters = currentFilters(overrides);
    const params = new URLSearchParams();
    if (filters.query.trim()) params.set("q", filters.query.trim());
    if (filters.category) params.set("category", filters.category);
    if (filters.city.trim()) params.set("city", filters.city.trim());
    if (filters.employmentType) params.set("employmentType", filters.employmentType);
    if (filters.workplaceType) params.set("workplaceType", filters.workplaceType);
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

  function chooseCategory(nextCategory: string) {
    setCategory(nextCategory);
    void load(1, false, { category: nextCategory });
  }

  function chooseWorkplace(nextWorkplace: string) {
    setWorkplaceType(nextWorkplace);
    void load(1, false, { workplaceType: nextWorkplace });
  }

  function clearFilters() {
    setQuery("");
    setCategory("");
    setCity("");
    setEmploymentType("");
    setWorkplaceType("");
    void load(1, false, {
      query: "",
      category: "",
      city: "",
      employmentType: "",
      workplaceType: "",
    });
  }

  const hasMore = jobs.length < total;
  const verifiedCount = useMemo(
    () => jobs.filter((job) => job.businessVerificationStatus === "verified").length,
    [jobs],
  );
  const remoteCount = useMemo(
    () => jobs.filter((job) => job.workplaceType === "remote").length,
    [jobs],
  );
  const activeFilterCount = [
    query.trim(),
    category,
    city.trim(),
    employmentType,
    workplaceType,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Jobs</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Discover approved openings connected to attributable employer profiles. Results are relevance-ranked without sponsored placement or pay-to-rank hiring ads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/businesses"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <Building2 size={16} className="text-[color:var(--loombus-gold)]" /> Employer profiles
            </Link>
            <Link
              href="/jobs/manage"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <BriefcaseBusiness size={16} /> Post or manage a job
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Approved openings</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{total}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Verified in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{verifiedCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Remote in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{remoteCount}</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <form
              onSubmit={submit}
              className="mb-4 rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-3 shadow-sm"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
                <label className="relative block">
                  <span className="sr-only">Search jobs</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Job title, employer, skill..."
                    className={`${controlClass} pl-11`}
                  />
                </label>
                <label className="relative block">
                  <span className="sr-only">Job location</span>
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="City or region"
                    className={`${controlClass} pl-11`}
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
                >
                  Search <ArrowRight size={16} />
                </button>
              </div>
              {activeFilterCount > 0 ? (
                <div className="mt-3 flex items-center justify-between border-t border-[color:var(--loombus-border-muted)] px-1 pt-3 text-sm">
                  <span className="text-[color:var(--loombus-text-muted)]">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
                  <button type="button" onClick={clearFilters} className="font-semibold text-[color:var(--loombus-gold)]">Clear filters</button>
                </div>
              ) : null}
            </form>

            <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Workplace type">
              <button
                type="button"
                onClick={() => chooseWorkplace("")}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  workplaceType === ""
                    ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                    : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                }`}
              >
                Any workplace
              </button>
              {JOB_WORKPLACE_TYPES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => chooseWorkplace(item.value)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                    workplaceType === item.value
                      ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                      : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {message ? (
              <p className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{message}</p>
            ) : null}

            {!directoryActive ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={38} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Jobs Directory activation is pending.</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  The application is deployed, but the Jobs migrations still need to be applied before postings can be submitted or discovered.
                </p>
              </section>
            ) : loading ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
                <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
                <p className="mt-3">Gathering approved openings…</p>
              </section>
            ) : jobs.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={40} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No approved job matches yet.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Try a broader role, category, workplace type, or location.
                </p>
              </section>
            ) : (
              <section>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Approved openings</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{total} job{total === 1 ? "" : "s"}</h2>
                  </div>
                  <p className="text-sm text-[color:var(--loombus-text-muted)]">Showing {jobs.length} of {total}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {jobs.map((job) => {
                    const compensation = jobCompensationLabel(job);
                    const deadline = formatJobDate(job.applicationDeadline);
                    return (
                      <Link
                        key={job.id}
                        href={`/jobs/${encodeURIComponent(job.slug)}`}
                        className="group flex min-h-[360px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl"
                      >
                        <div className="flex gap-4">
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                            {job.businessLogoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={job.businessLogoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Building2 size={24} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[color:var(--loombus-text-subtle)]">{job.category}</span>
                              {job.businessVerificationStatus === "verified" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--loombus-cream)] px-2.5 py-1 text-[0.7rem] font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"><BadgeCheck size={13} /> Verified employer</span>
                              ) : null}
                            </div>
                            <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em] group-hover:underline">{job.title}</h3>
                            <p className="mt-1 text-sm font-semibold text-[color:var(--loombus-text-muted)]">{job.businessName}</p>
                            <p className="mt-3 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{job.summary}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 text-sm text-[color:var(--loombus-text-muted)] sm:grid-cols-2">
                          <span className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />{jobLocationLabel(job)}</span>
                          <span className="flex items-start gap-2"><BriefcaseBusiness className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />{employmentTypeLabel(job.employmentType)} · {workplaceTypeLabel(job.workplaceType)}</span>
                          {compensation ? <span className="flex items-start gap-2"><DollarSign className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />{compensation}</span> : null}
                          {deadline ? <span className="flex items-start gap-2"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />Apply by {deadline}</span> : null}
                        </div>

                        {job.skills.length > 0 ? (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {job.skills.slice(0, 5).map((skill) => <span key={skill} className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 text-xs text-[color:var(--loombus-text-muted)]">{skill}</span>)}
                            {job.skills.length > 5 ? <span className="rounded-full px-3 py-1.5 text-xs text-[color:var(--loombus-text-subtle)]">+{job.skills.length - 5} more</span> : null}
                          </div>
                        ) : null}

                        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[color:var(--loombus-gold)]">Open job posting <ArrowUpRight size={15} /></span>
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
                      className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />}
                      Load more jobs
                    </button>
                  </div>
                ) : null}
              </section>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Job filters</p>
                <SlidersHorizontal className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-3">
                <select value={category} onChange={(event) => chooseCategory(event.target.value)} className={controlClass} aria-label="Job category">
                  <option value="">All categories</option>
                  {JOB_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} className={controlClass} aria-label="Employment type">
                  <option value="">All employment types</option>
                  {JOB_EMPLOYMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <button type="button" onClick={() => void load(1, false)} className="w-full rounded-full bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90">Apply filters</button>
                <button type="button" onClick={clearFilters} className="w-full rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">Clear filters</button>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Opportunity tools</p>
              <div className="mt-4 space-y-2">
                <Link href="/jobs/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Post or manage a job <ArrowRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/businesses" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Employer profiles <ArrowRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/local" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Explore Local <ArrowRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                <Link href="/search?q=jobs" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Search all signals <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]"><ShieldAlert className="h-5 w-5" /></span>
                <div>
                  <h3 className="font-semibold">Apply at the source</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not collect résumés in this phase. Apply only through the employer-controlled link or email shown on the posting.</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" /><p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">Verify the employer, role, compensation, location, and application destination before sharing personal information.</p></div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
