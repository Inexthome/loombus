"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  BUSINESS_CATEGORIES,
  type BusinessProfile,
  businessLocationLabel,
  businessServiceAreaLabel,
} from "@/lib/business-directory";

export default function BusinessDirectoryPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [directoryActive, setDirectoryActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category) params.set("category", category);
    if (city.trim()) params.set("city", city.trim());
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

  function submit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  return (
    <main className="loombus-shell-with-right-rail min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-9">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--loombus-text-subtle)]">
                Local Business and Services
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
                Find the business. See the service. Follow the signal.
              </h1>
              <p className="mt-4 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
                Discover approved local businesses, service areas, contact details,
                and current offerings without sponsored placement or pay-to-rank results.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck size={22} />
                <div>
                  <p className="font-semibold">Signal-first directory</p>
                  <p className="mt-1 text-sm leading-5 text-[var(--loombus-text-muted)]">
                    Ownership, verification, claims, and reports are reviewed separately.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="mt-8 grid gap-3 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_auto]"
          >
            <label className="flex items-center gap-2 rounded-xl bg-[var(--loombus-surface)] px-4">
              <Search size={18} className="text-[var(--loombus-text-subtle)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Roofing, dentist, electrician, business name..."
                className="min-w-0 flex-1 bg-transparent py-3 outline-none"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
              aria-label="Business category"
            >
              <option value="">All categories</option>
              {BUSINESS_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City or service area"
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
              href="/businesses/manage"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
            >
              <Building2 size={16} /> Add or manage a business
            </Link>
            <Link
              href="/search?q=local%20services"
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
            <h2 className="text-xl font-semibold">Directory activation is pending.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              The application is deployed, but the Local Business migrations still need
              to be applied before listings can be submitted or discovered.
            </p>
          </section>
        ) : loading ? (
          <div className="mt-5 flex min-h-60 items-center justify-center rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
            <Loader2 className="animate-spin" size={25} />
          </div>
        ) : businesses.length === 0 ? (
          <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <Building2 className="mx-auto" size={28} />
            <h2 className="mt-3 text-xl font-semibold">No approved listing matches yet.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Try a broader category or location. Business owners can submit a listing
              for review from the management workspace.
            </p>
            <Link
              href="/businesses/manage"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
            >
              Submit a business <ArrowRight size={16} />
            </Link>
          </section>
        ) : (
          <section className="mt-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                  Approved listings
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {businesses.length} business{businesses.length === 1 ? "" : "es"}
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {businesses.map((business) => {
                const location = businessLocationLabel(business);
                const area = businessServiceAreaLabel(business);
                return (
                  <Link
                    key={business.id}
                    href={`/businesses/${encodeURIComponent(business.slug)}`}
                    className="group rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--loombus-text-subtle)] hover:shadow-lg"
                  >
                    <div className="flex gap-4">
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
                        {business.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={business.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Building2 size={24} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-[var(--loombus-text-subtle)]">
                            {business.category}
                          </span>
                          {business.verificationStatus === "verified" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-[0.7rem] font-semibold">
                              <BadgeCheck size={13} /> Verified
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em]">
                          {business.name}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                          {business.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-[var(--loombus-text-muted)]">
                      {location ? (
                        <span className="flex items-start gap-2">
                          <MapPin className="mt-0.5 shrink-0" size={15} /> {location}
                        </span>
                      ) : null}
                      <span className="flex items-start gap-2">
                        <Wrench className="mt-0.5 shrink-0" size={15} /> {area}
                      </span>
                    </div>

                    {business.services.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {business.services.slice(0, 4).map((service) => (
                          <span
                            key={service.id}
                            className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)]"
                          >
                            {service.name}
                          </span>
                        ))}
                        {business.services.length > 4 ? (
                          <span className="rounded-full px-3 py-1.5 text-xs text-[var(--loombus-text-subtle)]">
                            +{business.services.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">
                      Open business profile
                      <ArrowRight
                        size={16}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
