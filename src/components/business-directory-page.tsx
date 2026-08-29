"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2, Loader2, MapPin, Search, Wrench } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { BUSINESS_CATEGORIES, type BusinessProfile, businessLocationLabel, businessServiceAreaLabel } from "@/lib/business-directory";

const controlClass = "h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";

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
      const response = await fetch(`/api/businesses?${params.toString()}`, { cache: "no-store" });
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

  const verifiedCount = useMemo(() => businesses.filter((business) => business.verificationStatus === "verified").length, [businesses]);
  const serviceCount = useMemo(() => businesses.reduce((total, business) => total + business.services.length, 0), [businesses]);
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
    <main data-business-editorial="directory" className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-7 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <header className="border-b border-[color:var(--loombus-border)] pb-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Local business directory</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Businesses</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">Find approved businesses by name, category, location, and service area.</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
              <Link href="/local" className="inline-flex items-center gap-2 hover:text-[color:var(--loombus-gold)]"><MapPin size={15} /> Explore Local</Link>
              <Link href="/businesses/manage" className="inline-flex items-center gap-2 text-[color:var(--loombus-gold)] hover:underline"><Building2 size={15} /> Add or manage business</Link>
            </div>
          </div>
        </header>

        <section aria-label="Business directory signals" className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3">
          {[["Approved", businesses.length], ["Verified in view", verifiedCount], ["Listed services", serviceCount]].map(([label, value]) => (
            <div key={String(label)} className="flex items-baseline justify-between gap-4 border-b border-[color:var(--loombus-border-muted)] py-4 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-subtle)]">{label}</span>
              <strong className="text-xl font-semibold">{value}</strong>
            </div>
          ))}
        </section>

        <form onSubmit={submit} className="border-b border-[color:var(--loombus-border)] py-6" aria-label="Business directory filters">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(12rem,.7fr)_minmax(12rem,.7fr)_auto] lg:items-end">
            <label className="relative block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">Search</span>
              <Search className="pointer-events-none absolute bottom-4 left-0 h-4 w-4 text-[color:var(--loombus-gold)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business name or service" className={`${controlClass} pl-7`} />
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">Category</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={controlClass}>
                <option value="">All categories</option>
                {BUSINESS_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--loombus-text-subtle)]">Location</span>
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City or service area" className={controlClass} />
            </label>
            <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 text-sm font-semibold hover:text-[color:var(--loombus-gold)]">Search <ArrowRight size={15} /></button>
          </div>
          {activeFilterCount > 0 ? <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--loombus-text-muted)]"><span>{activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}</span><button type="button" onClick={resetFilters} className="font-semibold text-[color:var(--loombus-gold)] hover:underline">Clear filters</button></div> : null}
        </form>

        {message ? <p className="border-b border-red-500/30 py-4 text-sm text-red-500" role="status">{message}</p> : null}

        {!directoryActive ? (
          <section className="border-b border-[color:var(--loombus-border)] py-12"><h2 className="text-2xl font-semibold">Directory activation is pending.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Business listings are not available yet.</p></section>
        ) : loading ? (
          <div className="flex min-h-64 items-center justify-center border-b border-[color:var(--loombus-border)]" aria-live="polite"><Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={26} /></div>
        ) : businesses.length === 0 ? (
          <section className="border-b border-[color:var(--loombus-border)] py-12"><h2 className="text-2xl font-semibold">No approved listing matches yet.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Try a broader category or location, or submit a business for review.</p><Link href="/businesses/manage" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)] hover:underline">Submit a business <ArrowRight size={15} /></Link></section>
        ) : (
          <section aria-label="Approved business directory">
            <div className="border-b border-[color:var(--loombus-border)] py-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">Approved directory</p><h2 className="mt-1 text-2xl font-semibold">{businesses.length} business{businesses.length === 1 ? "" : "es"}</h2></div>
            <div className="divide-y divide-[color:var(--loombus-border)]">
              {businesses.map((business) => {
                const location = businessLocationLabel(business);
                const area = businessServiceAreaLabel(business);
                return (
                  <Link key={business.id} href={`/businesses/${encodeURIComponent(business.slug)}`} className="group grid gap-4 py-6 transition hover:bg-[color:var(--loombus-surface-muted)] sm:grid-cols-[4rem_minmax(0,1fr)_minmax(12rem,.45fr)] sm:px-2">
                    <span className="flex h-14 w-14 items-center justify-center overflow-hidden border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)]">{business.logoUrl ? <img src={business.logoUrl} alt="" className="h-full w-full object-cover" /> : <Building2 size={23} />}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]"><span>{business.category}</span>{business.verificationStatus === "verified" ? <span className="inline-flex items-center gap-1 text-[color:var(--loombus-gold)]"><BadgeCheck size={13} /> Verified</span> : null}</div>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] group-hover:text-[color:var(--loombus-gold)]">{business.name}</h3>
                      <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">{business.description}</p>
                      {business.services.length ? <p className="mt-3 text-xs text-[color:var(--loombus-text-subtle)]">{business.services.slice(0, 3).map((service) => service.name).join(" · ")}{business.services.length > 3 ? ` · +${business.services.length - 3}` : ""}</p> : null}
                    </div>
                    <div className="grid content-start gap-3 text-sm text-[color:var(--loombus-text-muted)] sm:border-l sm:border-[color:var(--loombus-border-muted)] sm:pl-5">{location ? <span className="flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" />{location}</span> : null}<span className="flex items-start gap-2"><Wrench size={15} className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" />{area}</span><span className="text-xs font-semibold text-[color:var(--loombus-gold)]">Open profile →</span></div>
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
