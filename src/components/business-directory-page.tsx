"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  BUSINESS_CATEGORIES,
  type BusinessProfile,
  businessLocationLabel,
  businessServiceAreaLabel,
} from "@/lib/business-directory";

const inputClass =
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

export default function BusinessDirectoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [directoryActive, setDirectoryActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load(filters?: { query?: string; category?: string; city?: string }) {
    setLoading(true);
    setMessage("");
    const nextQuery = filters?.query ?? query;
    const nextCategory = filters?.category ?? category;
    const nextCity = filters?.city ?? city;
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextCategory) params.set("category", nextCategory);
    if (nextCity.trim()) params.set("city", nextCity.trim());
    params.set("limit", "60");

    try {
      const response = await fetch(`/api/businesses?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error ?? "The business directory could not load.");
        setBusinesses([]);
        return;
      }
      setBusinesses(Array.isArray(payload.businesses) ? payload.businesses : []);
      setDirectoryActive(payload.directoryActive !== false);
    } catch {
      setMessage("The business directory could not load. Refresh and try again.");
      setBusinesses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const verifiedCount = useMemo(
    () => businesses.filter((business) => business.verificationStatus === "verified").length,
    [businesses],
  );

  const serviceCount = useMemo(
    () => businesses.reduce((total, business) => total + business.services.length, 0),
    [businesses],
  );

  const activeFilterCount = [query.trim(), category, city.trim()].filter(Boolean).length;

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  function resetFilters() {
    setQuery("");
    setCategory("");
    setCity("");
    void load({ query: "", category: "", city: "" });
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Businesses</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Discover approved businesses, service areas, and current offerings without sponsored placement or pay-to-rank results.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/local"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <MapPin size={16} className="text-[color:var(--loombus-gold)]" /> Explore Local
            </Link>
            <Link
              href="/businesses/manage"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <Building2 size={16} /> Add or manage business
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Approved businesses</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{businesses.length}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Verified in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{verifiedCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Listed services</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{serviceCount}</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <form
              onSubmit={submit}
              className="mb-6 rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-3 shadow-sm"
            >
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
                <label className="relative block">
                  <span className="sr-only">Search businesses</span>
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Roofing, dentist, electrician, business name..."
                    className={`${inputClass} pl-11`}
                  />
                </label>
                <label className="relative block">
                  <span className="sr-only">City or service area</span>
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="City or service area"
                    className={`${inputClass} pl-11`}
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
                  <button type="button" onClick={resetFilters} className="font-semibold text-[color:var(--loombus-gold)]">Clear filters</button>
                </div>
              ) : null}
            </form>

            {message ? (
              <p className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">{message}</p>
            ) : null}

            {!directoryActive ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                <Building2 className="mx-auto text-[color:var(--loombus-gold)]" size={36} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">Directory activation is pending.</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  The application is deployed, but the Local Business migrations still need to be applied before listings can be submitted or discovered.
                </p>
              </section>
            ) : loading ? (
              <div className="flex min-h-64 items-center justify-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={28} />
              </div>
            ) : businesses.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                <Building2 className="mx-auto text-[color:var(--loombus-gold)]" size={38} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No approved listing matches yet.</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Try a broader category or location. Business owners can submit a listing for review from the management workspace.
                </p>
                <Link
                  href="/businesses/manage"
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
                >
                  Submit a business <ArrowRight size={16} />
                </Link>
              </section>
            ) : (
              <section>
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Approved directory</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    {businesses.length} business{businesses.length === 1 ? "" : "es"}
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {businesses.map((business) => {
                    const location = businessLocationLabel(business);
                    const area = businessServiceAreaLabel(business);
                    return (
                      <Link
                        key={business.id}
                        href={`/businesses/${encodeURIComponent(business.slug)}`}
                        className="group flex min-h-[330px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl"
                      >
                        <div className="flex gap-4">
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                            {business.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={business.logoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Building2 size={24} />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[color:var(--loombus-text-subtle)]">
                                {business.category}
                              </span>
                              {business.verificationStatus === "verified" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--loombus-cream)] px-2.5 py-1 text-[0.7rem] font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                                  <BadgeCheck size={13} /> Verified
                                </span>
                              ) : null}
                            </div>
                            <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em] group-hover:underline">{business.name}</h3>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{business.description}</p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                          {location ? (
                            <span className="flex items-start gap-2"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} /> {location}</span>
                          ) : null}
                          <span className="flex items-start gap-2"><Wrench className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={15} /> {area}</span>
                        </div>

                        {business.services.length > 0 ? (
                          <div className="mt-5 flex flex-wrap gap-2">
                            {business.services.slice(0, 4).map((service) => (
                              <span key={service.id} className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1.5 text-xs text-[color:var(--loombus-text-muted)]">
                                {service.name}
                              </span>
                            ))}
                            {business.services.length > 4 ? (
                              <span className="rounded-full px-3 py-1.5 text-xs text-[color:var(--loombus-text-subtle)]">+{business.services.length - 4} more</span>
                            ) : null}
                          </div>
                        ) : null}

                        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-[color:var(--loombus-gold)]">
                          Open business profile <ArrowUpRight size={15} />
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Browse categories</p>
                <Sparkles className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                    category === ""
                      ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                      : "bg-[color:var(--loombus-page-bg)] hover:bg-[color:var(--loombus-surface-muted)]"
                  }`}
                >
                  All businesses <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </button>
                {BUSINESS_CATEGORIES.slice(0, 8).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                      category === item
                        ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                        : "bg-[color:var(--loombus-page-bg)] hover:bg-[color:var(--loombus-surface-muted)]"
                    }`}
                  >
                    <span className="truncate">{item}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                  </button>
                ))}
              </div>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={`${inputClass} mt-4`}
                aria-label="All business categories"
              >
                <option value="">All categories</option>
                {BUSINESS_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Business actions</p>
              <div className="mt-4 space-y-2">
                <Link href="/businesses/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Manage businesses <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/services" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Browse Services <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/search?q=local%20services" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Search all signals <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Signal-first directory</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Ownership, verification, claims, and reports are reviewed separately. Approval does not replace your own qualification checks.
                  </p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
