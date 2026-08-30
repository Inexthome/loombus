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
  "h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";

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

  async function load(nextPage = 1, append = false, overrides?: Partial<JobFilters>) {
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
      const response = await fetch(`/api/jobs?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "The Jobs Directory could not load.");
        if (!append) setJobs([]);
        return;
      }

      const nextJobs = Array.isArray(payload.jobs) ? (payload.jobs as JobPosting[]) : [];
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
  const activeFilterCount = [query.trim(), category, city.trim(), employmentType, workplaceType].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="border-b border-[color:var(--loombus-border)] pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[color:var(--loombus-gold)]">Opportunities</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Jobs</h1>
              <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Discover approved openings connected to attributable employer profiles. Results are relevance-ranked without sponsored placement or pay-to-rank hiring ads.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
              <Link href="/businesses" className="inline-flex min-h-11 items-center gap-2 border-b border-transparent py-2 transition hover:border-[color:var(--loombus-gold)]">
                <Building2 size={16} className="text-[color:var(--loombus-gold)]" /> Employer profiles
              </Link>
              <Link href="/jobs/manage" className="inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-gold)] py-2 text-[color:var(--loombus-gold)]">
                <BriefcaseBusiness size={16} /> Post or manage a job
              </Link>
            </div>
          </div>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3" aria-label="Jobs overview">
          {[
            ["Approved openings", total],
            ["Verified in view", verifiedCount],
            ["Remote in view", remoteCount],
          ].map(([label, value], index) => (
            <article key={String(label)} className={`py-5 sm:px-5 ${index === 0 ? "sm:pl-0" : "border-t border-[color:var(--loombus-border)] sm:border-l sm:border-t-0"}`}>
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">{label}</span>
              <strong className="mt-2 block text-3xl tracking-[-0.04em]">{value}</strong>
            </article>
          ))}
        </section>

        <div className="grid gap-10 pt-8 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="min-w-0">
            <form onSubmit={submit} className="border-b border-[color:var(--loombus-border)] pb-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end">
                <label className="relative block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Search</span>
                  <Search className="pointer-events-none absolute bottom-4 left-0 h-4 w-4 text-[color:var(--loombus-text-subtle)]" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Job title, employer, skill..." className={`${controlClass} pl-7`} />
                </label>
                <label className="relative block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">Location</span>
                  <MapPin className="pointer-events-none absolute bottom-4 left-0 h-4 w-4 text-[color:var(--loombus-text-subtle)]" />
                  <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City or region" className={`${controlClass} pl-7`} />
                </label>
                <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-4 text-sm font-semibold transition hover:text-[color:var(--loombus-gold)]">
                  Search <ArrowRight size={16} />
                </button>
              </div>
              {activeFilterCount > 0 ? (
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-[color:var(--loombus-text-muted)]">{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span>
                  <button type="button" onClick={clearFilters} className="min-h-11 font-semibold text-[color:var(--loombus-gold)]">Clear filters</button>
                </div>
              ) : null}
            </form>

            <nav className="flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Workplace type">
              <button type="button" onClick={() => chooseWorkplace("")} className={`min-h-12 shrink-0 border-b-2 text-sm font-semibold transition ${workplaceType === "" ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]" : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}>
                Any workplace
              </button>
              {JOB_WORKPLACE_TYPES.map((item) => (
                <button key={item.value} type="button" onClick={() => chooseWorkplace(item.value)} className={`min-h-12 shrink-0 border-b-2 text-sm font-semibold transition ${workplaceType === item.value ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]" : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}>
                  {item.label}
                </button>
              ))}
            </nav>

            {message ? <p className="border-b border-red-500/30 py-4 text-sm text-red-500">{message}</p> : null}

            {!directoryActive ? (
              <section className="border-b border-[color:var(--loombus-border)] py-12">
                <BriefcaseBusiness className="text-[color:var(--loombus-gold)]" size={32} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Jobs Directory activation is pending.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">The application is deployed, but the Jobs migrations still need to be applied before postings can be submitted or discovered.</p>
              </section>
            ) : loading ? (
              <section className="border-b border-[color:var(--loombus-border)] py-12 text-[color:var(--loombus-text-muted)]">
                <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={26} />
                <p className="mt-3">Gathering approved openings…</p>
              </section>
            ) : jobs.length === 0 ? (
              <section className="border-b border-[color:var(--loombus-border)] py-12">
                <BriefcaseBusiness className="text-[color:var(--loombus-gold)]" size={34} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No approved job matches yet.</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Try a broader role, category, workplace type, or location.</p>
              </section>
            ) : (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Approved openings</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{total} job{total === 1 ? "" : "s"}</h2>
                  </div>
                  <p className="text-sm text-[color:var(--loombus-text-muted)]">Showing {jobs.length} of {total}</p>
                </div>

                <div>
                  {jobs.map((job) => {
                    const compensation = jobCompensationLabel(job);
                    const deadline = formatJobDate(job.applicationDeadline);
                    return (
                      <Link key={job.id} href={`/jobs/${encodeURIComponent(job.slug)}`} className="group grid gap-5 border-b border-[color:var(--loombus-border)] py-7 transition hover:border-[color:var(--loombus-gold)] md:grid-cols-[4rem_minmax(0,1fr)]">
                        <span className="flex h-14 w-14 items-center justify-center overflow-hidden border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)]">
                          {job.businessLogoUrl ? <img src={job.businessLogoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 size={24} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.13em] text-[color:var(--loombus-text-subtle)]">
                            <span>{job.category}</span>
                            {job.businessVerificationStatus === "verified" ? <span className="inline-flex items-center gap-1 text-[color:var(--loombus-gold)]"><BadgeCheck size={13} /> Verified employer</span> : null}
                          </div>
                          <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] group-hover:underline">{job.title}</h3>
                          <p className="mt-1 text-sm font-semibold text-[color:var(--loombus-text-muted)]">{job.businessName}</p>
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{job.summary}</p>
                          <div className="mt-4 grid gap-2 text-sm text-[color:var(--loombus-text-muted)] sm:grid-cols-2">
                            <span className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />{jobLocationLabel(job)}</span>
                            <span className="flex items-start gap-2"><BriefcaseBusiness className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />{employmentTypeLabel(job.employmentType)} · {workplaceTypeLabel(job.workplaceType)}</span>
                            {compensation ? <span className="flex items-start gap-2"><DollarSign className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />{compensation}</span> : null}
                            {deadline ? <span className="flex items-start gap-2"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} />Apply by {deadline}</span> : null}
                          </div>
                          {job.skills.length > 0 ? <p className="mt-4 text-xs leading-5 text-[color:var(--loombus-text-subtle)]">{job.skills.slice(0, 5).join(" · ")}{job.skills.length > 5 ? ` · +${job.skills.length - 5} more` : ""}</p> : null}
                          <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)]">Open job posting <ArrowUpRight size={15} /></span>
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {hasMore ? (
                  <div className="border-b border-[color:var(--loombus-border)] py-6">
                    <button type="button" onClick={() => void load(page + 1, true)} disabled={loadingMore} className="inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-gold)] text-sm font-semibold disabled:opacity-50">
                      {loadingMore ? <Loader2 className="animate-spin" size={17} /> : <ArrowRight size={17} />} Load more jobs
                    </button>
                  </div>
                ) : null}
              </section>
            )}
          </section>

          <aside className="divide-y divide-[color:var(--loombus-border)] border-y border-[color:var(--loombus-border)] xl:sticky xl:top-28 xl:self-start">
            <section className="py-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em]">Job filters</p>
                <SlidersHorizontal className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-4">
                <select value={category} onChange={(event) => chooseCategory(event.target.value)} className={controlClass} aria-label="Job category">
                  <option value="">All categories</option>
                  {JOB_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)} className={controlClass} aria-label="Employment type">
                  <option value="">All employment types</option>
                  {JOB_EMPLOYMENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <button type="button" onClick={() => void load(1, false)} className="min-h-11 border-b border-[color:var(--loombus-gold)] text-sm font-semibold text-[color:var(--loombus-gold)]">Apply filters</button>
                  <button type="button" onClick={clearFilters} className="min-h-11 text-sm font-semibold">Clear filters</button>
                </div>
              </div>
            </section>

            <section className="py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]">Opportunity tools</p>
              <nav className="mt-3 divide-y divide-[color:var(--loombus-border)]">
                {[["/jobs/manage", "Post or manage a job"], ["/businesses", "Employer profiles"], ["/local", "Explore Local"], ["/search?q=jobs", "Search all signals"]].map(([href, label]) => (
                  <Link key={href} href={href} className="flex min-h-12 items-center justify-between py-3 text-sm font-semibold">{label} <ArrowRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                ))}
              </nav>
            </section>

            <section className="py-6">
              <ShieldAlert className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              <h3 className="mt-3 font-semibold">Apply at the source</h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not collect résumés in this phase. Apply only through the employer-controlled link or email shown on the posting.</p>
            </section>

            <section className="py-6 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
              Verify the employer, role, compensation, location, and application destination before sharing personal information.
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
