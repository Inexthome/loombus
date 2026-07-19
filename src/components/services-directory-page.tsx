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
  Sparkles,
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
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "24",
      });
      if (query.trim()) params.set("q", query.trim());
      if (category !== "all") params.set("category", category);
      if (mode !== "all") params.set("mode", mode);
      if (priceType !== "all") params.set("priceType", priceType);
      if (location.trim()) params.set("location", location.trim());
      const response = await fetch(`/api/services?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ProviderServicesDirectoryResponse> & {
        error?: string;
      };
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
  const remoteCount = useMemo(
    () => services.filter((service) => service.serviceMode === "remote").length,
    [services],
  );
  const appointmentCount = useMemo(
    () => services.filter((service) => service.appointmentServiceId).length,
    [services],
  );
  const activeFilterCount = [
    query.trim(),
    category !== "all",
    mode !== "all",
    priceType !== "all",
    location.trim(),
  ].filter(Boolean).length;

  function clearFilters() {
    setQuery("");
    setCategory("all");
    setMode("all");
    setPriceType("all");
    setLocation("");
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Services</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Browse attributable Services, send structured inquiries, connect existing Requests, or request an appointment when scheduling is available.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/services/saved"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <Bookmark size={16} className="text-[color:var(--loombus-gold)]" /> Saved Services
            </Link>
            <Link
              href="/services/manage"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <SlidersHorizontal size={16} /> Offer a Service
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Published Services</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{total}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Remote in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{remoteCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Appointment connected</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{appointmentCount}</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <div className="mb-4 flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search Services</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search service, specialty, category, or provider"
                  className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]"
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm transition hover:border-[color:var(--loombus-gold)]"
                aria-label="Clear Service filters"
              >
                <SlidersHorizontal className="h-5 w-5" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--loombus-gold)] px-1 text-[10px] font-bold text-[color:var(--loombus-gold-contrast)]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Service location modes">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                    mode === option.value
                      ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                      : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                  }`}
                >
                  {option.value === "remote" ? <Wifi className="mr-1 inline h-4 w-4" /> : null}
                  {option.label}
                </button>
              ))}
            </nav>

            {notice ? (
              <section className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm" role="alert">{notice}</section>
            ) : null}

            {loading ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
                <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
                <p className="mt-3">Gathering published Services…</p>
              </section>
            ) : services.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
                <BriefcaseBusiness className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No Services match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Clear a filter or publish the first Service for this need.
                </p>
                <Link
                  href="/services/manage"
                  className="mt-5 inline-flex rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]"
                >
                  Offer a Service
                </Link>
              </section>
            ) : (
              <section>
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Service directory</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    {total} published Service{total === 1 ? "" : "s"}
                  </h2>
                </div>

                <div className="grid gap-4 md:grid-cols-2" aria-label="Published Services">
                  {services.map((service) => (
                    <Link
                      key={service.id}
                      href={`/services/${service.slug}`}
                      className="group flex min-h-[340px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                          <Sparkles size={20} />
                        </span>
                        <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold text-[color:var(--loombus-text-muted)]">
                          <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">{service.category}</span>
                          {service.appointmentServiceId ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                              <CalendarClock size={12} /> Appointment ready
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em] group-hover:underline">{service.title}</h3>
                      <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{service.description}</p>

                      <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]">
                        <div className="flex items-start gap-3"><MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span>{providerServiceLocationLabel(service)}</span></div>
                        <div className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span>{formatProviderServiceDuration(service.typicalDurationMinutes)}</span></div>
                        <div className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span>{service.businessName || service.providerName}</span></div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4 text-xs text-[color:var(--loombus-text-muted)]">
                        <span className="font-semibold text-[color:var(--loombus-text)]">{formatProviderServicePrice(service)}</span>
                        <span>{service.inquiryCount} inquir{service.inquiryCount === 1 ? "y" : "ies"}</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)]">Open Service <ArrowUpRight size={13} /></span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {pageCount > 1 ? (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Services pages">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-[color:var(--loombus-text-muted)]">Page {page} of {pageCount}</span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
                  className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-5 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Service filters</p>
                <SlidersHorizontal className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-3">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className={controlClass} aria-label="Service category">
                  <option value="all">All categories</option>
                  {PROVIDER_SERVICE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <select value={priceType} onChange={(event) => setPriceType(event.target.value)} className={controlClass} aria-label="Price type">
                  <option value="all">All pricing</option>
                  <option value="fixed">Fixed</option>
                  <option value="range">Range</option>
                  <option value="hourly">Hourly</option>
                  <option value="contact">Contact for pricing</option>
                </select>
                <label className="relative block">
                  <span className="sr-only">Service location</span>
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, region, or postal code" className={`${controlClass} pl-11`} />
                </label>
                <button type="button" onClick={clearFilters} className="w-full rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
                  Clear filters
                </button>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Service tools</p>
              <div className="mt-4 space-y-2">
                <Link href="/services/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Manage Services <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/services/saved" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Saved Services <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/requests" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Browse Requests <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/appointments" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Appointments <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Confirm before hiring</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Loombus does not process payments or guarantee licensing, credentials, pricing, or provider performance. Confirm material details directly.
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
