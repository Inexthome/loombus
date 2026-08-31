"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  BriefcaseBusiness,
  CalendarClock,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PROVIDER_SERVICE_CATEGORIES,
  formatProviderServiceDuration,
  formatProviderServicePrice,
  providerServiceLocationLabel,
  type ProviderServicesDirectoryResponse,
  type PublicProviderService,
} from "@/lib/provider-services";

const controlClass =
  "min-h-11 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-2 text-sm text-[color:var(--loombus-text)] outline-none transition motion-reduce:transition-none placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]";

const modeOptions = [
  { value: "all", label: "All locations" },
  { value: "remote", label: "Remote" },
  { value: "requester_location", label: "Customer location" },
  { value: "provider_location", label: "Provider location" },
  { value: "flexible", label: "Flexible" },
] as const;

export default function ServicesDirectoryPage() {
  const [services, setServices] = useState<PublicProviderService[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState("all");
  const [priceType, setPriceType] = useState("all");
  const [location, setLocation] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "24" });
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all") params.set("category", category);
      if (mode !== "all") params.set("mode", mode);
      if (priceType !== "all") params.set("priceType", priceType);
      if (location.trim()) params.set("location", location.trim());
      const response = await fetch(`/api/services?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as Partial<ProviderServicesDirectoryResponse> & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Services.");
      setServices(Array.isArray(payload.services) ? payload.services : []);
      setTotal(Number(payload.total ?? 0));
    } catch (error) {
      setServices([]);
      setTotal(0);
      setNotice(error instanceof Error ? error.message : "Unable to load Services.");
    } finally {
      setLoading(false);
    }
  }, [category, location, mode, page, priceType, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [category, location, mode, priceType, query]);

  const pageCount = Math.max(Math.ceil(total / 24), 1);
  const remoteCount = useMemo(() => services.filter((service) => service.serviceMode === "remote").length, [services]);
  const appointmentCount = useMemo(() => services.filter((service) => service.appointmentServiceId).length, [services]);
  const activeFilterCount = [query.trim(), category !== "all", mode !== "all", priceType !== "all", location.trim()].filter(Boolean).length;

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setMode("all");
    setPriceType("all");
    setLocation("");
  }

  return (
    <main data-services-editorial className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-[color:var(--loombus-border)] pb-8 sm:pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">Service directory</p>
          <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Services</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
                Browse attributable Services, send structured inquiries, connect existing Requests, or request an appointment when scheduling is available.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/services/saved" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium underline decoration-[color:var(--loombus-gold)] underline-offset-4 transition motion-reduce:transition-none hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]">
                <Bookmark size={16} /> Saved Services
              </Link>
              <Link href="/services/manage" className="inline-flex min-h-11 items-center gap-2 border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition motion-reduce:transition-none hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]">
                <SlidersHorizontal size={16} /> Offer a Service
              </Link>
            </div>
          </div>
        </header>

        <section aria-label="Services summary" className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-3">
          <div className="py-5 sm:border-r sm:border-[color:var(--loombus-border)] sm:pr-6">
            <span className="text-xs font-medium text-[color:var(--loombus-text-muted)]">Published Services</span>
            <strong className="mt-1 block text-2xl font-semibold">{total}</strong>
          </div>
          <div className="border-t border-[color:var(--loombus-border)] py-5 sm:border-t-0 sm:border-r sm:px-6">
            <span className="text-xs font-medium text-[color:var(--loombus-text-muted)]">Remote in view</span>
            <strong className="mt-1 block text-2xl font-semibold">{remoteCount}</strong>
          </div>
          <div className="border-t border-[color:var(--loombus-border)] py-5 sm:border-t-0 sm:pl-6">
            <span className="text-xs font-medium text-[color:var(--loombus-text-muted)]">Appointment connected</span>
            <strong className="mt-1 block text-2xl font-semibold">{appointmentCount}</strong>
          </div>
        </section>

        <section className="border-b border-[color:var(--loombus-border)] py-6">
          <label className="relative block">
            <span className="sr-only">Search Services</span>
            <Search className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search service, specialty, category, or provider" className="min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent py-3 pl-8 pr-4 text-base outline-none transition motion-reduce:transition-none placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]" />
          </label>

          <nav className="mt-5 flex gap-6 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Service location modes">
            {modeOptions.map((option) => (
              <button key={option.value} type="button" onClick={() => setMode(option.value)} className={`min-h-11 shrink-0 border-b-2 px-0 text-sm font-medium transition motion-reduce:transition-none ${mode === option.value ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]" : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"}`}>
                {option.value === "remote" ? <Wifi className="mr-1 inline h-4 w-4" /> : null}
                {option.label}
              </button>
            ))}
          </nav>
        </section>

        <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-12">
          <section className="min-w-0">
            {notice ? <div className="mb-6 border-y border-red-500/30 py-4 text-sm" role="alert">{notice}</div> : null}

            {loading ? (
              <section className="border-y border-[color:var(--loombus-border)] py-12 text-center text-[color:var(--loombus-text-muted)]">
                <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)] motion-reduce:animate-none" size={26} />
                <p className="mt-3 text-sm">Gathering published Services…</p>
              </section>
            ) : services.length === 0 ? (
              <section className="border-y border-[color:var(--loombus-border)] py-12 text-center">
                <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={34} />
                <h2 className="mt-4 text-xl font-semibold">No Services match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">Clear a filter or publish the first Service for this need.</p>
                <Link href="/services/manage" className="mt-5 inline-flex min-h-11 items-center border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-4 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">Offer a Service</Link>
              </section>
            ) : (
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--loombus-border)] pb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Service directory</p>
                    <h2 className="mt-2 text-xl font-semibold">{total} published Service{total === 1 ? "" : "s"}</h2>
                  </div>
                  {activeFilterCount > 0 ? <button type="button" onClick={clearFilters} className="min-h-11 text-sm font-medium text-[color:var(--loombus-text-muted)] underline underline-offset-4 hover:text-[color:var(--loombus-text)]">Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}</button> : null}
                </div>

                <div className="divide-y divide-[color:var(--loombus-border)]" aria-label="Published Services">
                  {services.map((service) => (
                    <article key={service.id} className="py-6">
                      <Link href={`/services/${service.slug}`} className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 max-w-3xl">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
                              <span className="font-semibold uppercase tracking-[0.14em] text-[color:var(--loombus-gold)]">{service.category}</span>
                              {service.appointmentServiceId ? <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> Appointment ready</span> : null}
                            </div>
                            <h3 className="mt-2 text-xl font-semibold tracking-tight transition motion-reduce:transition-none group-hover:text-[color:var(--loombus-gold)] sm:text-2xl">{service.title}</h3>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{service.description}</p>
                          </div>
                          <div className="shrink-0 text-left sm:text-right">
                            <p className="text-sm font-semibold text-[color:var(--loombus-text)]">{formatProviderServicePrice(service)}</p>
                            <p className="mt-1 text-xs text-[color:var(--loombus-text-muted)]">{service.inquiryCount} inquir{service.inquiryCount === 1 ? "y" : "ies"}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[color:var(--loombus-text-muted)]">
                          <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-[color:var(--loombus-gold)]" />{providerServiceLocationLabel(service)}</span>
                          <span className="inline-flex items-center gap-1.5"><Clock3 size={14} className="text-[color:var(--loombus-gold)]" />{formatProviderServiceDuration(service.typicalDurationMinutes)}</span>
                          <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness size={14} className="text-[color:var(--loombus-gold)]" />{service.businessName || service.providerName}</span>
                          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)]">Open Service <ArrowUpRight size={13} /></span>
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {pageCount > 1 ? (
              <nav className="mt-6 flex items-center justify-between gap-3 border-t border-[color:var(--loombus-border)] pt-5" aria-label="Services pages">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="min-h-11 border-b border-[color:var(--loombus-border)] px-0 text-sm font-medium transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] disabled:opacity-40">Previous</button>
                <span className="text-sm text-[color:var(--loombus-text-muted)]">Page {page} of {pageCount}</span>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(current + 1, pageCount))} className="min-h-11 border-b border-[color:var(--loombus-border)] px-0 text-sm font-medium transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] disabled:opacity-40">Next</button>
              </nav>
            ) : null}
          </section>

          <aside className="space-y-8 lg:border-l lg:border-[color:var(--loombus-border)] lg:pl-8">
            <section>
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--loombus-border)] pb-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em]">Service filters</p>
                <SlidersHorizontal className="h-4 w-4 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-4">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className={controlClass} aria-label="Service category">
                  <option value="all">All categories</option>
                  {PROVIDER_SERVICE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={priceType} onChange={(event) => setPriceType(event.target.value)} className={controlClass} aria-label="Price type">
                  <option value="all">All pricing</option><option value="fixed">Fixed</option><option value="range">Range</option><option value="hourly">Hourly</option><option value="contact">Contact for pricing</option>
                </select>
                <label className="relative block">
                  <span className="sr-only">Service location</span>
                  <MapPin className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, region, or postal code" className={`${controlClass} pl-6`} />
                </label>
                <button type="button" onClick={clearFilters} className="min-h-11 text-sm font-medium text-[color:var(--loombus-text-muted)] underline underline-offset-4 hover:text-[color:var(--loombus-text)]">Clear filters</button>
              </div>
            </section>

            <section>
              <p className="border-b border-[color:var(--loombus-border)] pb-3 text-xs font-semibold uppercase tracking-[0.18em]">Service tools</p>
              <div className="divide-y divide-[color:var(--loombus-border)]">
                {[["Manage Services", "/services/manage"], ["Saved Services", "/services/saved"], ["Browse Requests", "/requests"], ["Appointments", "/appointments"]].map(([label, href]) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center justify-between py-3 text-sm font-medium transition motion-reduce:transition-none hover:text-[color:var(--loombus-gold)]">{label}<ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" /></Link>
                ))}
              </div>
            </section>

            <section className="border-t border-[color:var(--loombus-border)] pt-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="text-sm font-semibold">Confirm before hiring</h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process payments or guarantee licensing, credentials, pricing, or provider performance. Confirm material details directly.</p>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
