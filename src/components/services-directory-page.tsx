"use client";

import Link from "next/link";
import {
  Bookmark,
  BriefcaseBusiness,
  Clock3,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
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
      const payload = (await response
        .json()
        .catch(() => ({}))) as Partial<ProviderServicesDirectoryResponse> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load Services.");
      }
      setServices(Array.isArray(payload.services) ? payload.services : []);
      setTotal(Number(payload.total ?? 0));
    } catch (error) {
      setServices([]);
      setTotal(0);
      setNotice(
        error instanceof Error ? error.message : "Unable to load Services.",
      );
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

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Loombus Services
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Discover what people and businesses can provide.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--loombus-text-muted)]">
                Browse attributable Services, send a structured inquiry, connect
                an existing Request, or move into an appointment when a provider
                has scheduling enabled.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/services/saved"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-5 py-3 text-sm font-semibold"
              >
                <Bookmark size={16} /> Saved Services
              </Link>
              <Link
                href="/services/manage"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"
              >
                <SlidersHorizontal size={17} /> Offer a Service
              </Link>
            </div>
          </div>

          <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Services overview">
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Published Services
              </span>
              <strong className="mt-1 block text-2xl">{total}</strong>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Remote in this view
              </span>
              <strong className="mt-1 block text-2xl">{remoteCount}</strong>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Appointment connected
              </span>
              <strong className="mt-1 block text-2xl">{appointmentCount}</strong>
            </article>
          </section>
        </header>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_240px_190px_180px]">
            <label className="relative block">
              <span className="sr-only">Search Services</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]"
                size={18}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search service, specialty, category, or provider"
                className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4 outline-none"
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
              aria-label="Service category"
            >
              <option value="all">All categories</option>
              {PROVIDER_SERVICE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value)}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
              aria-label="Service location mode"
            >
              <option value="all">All locations</option>
              <option value="remote">Remote</option>
              <option value="requester_location">Customer location</option>
              <option value="provider_location">Provider location</option>
              <option value="flexible">Flexible</option>
            </select>
            <select
              value={priceType}
              onChange={(event) => setPriceType(event.target.value)}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
              aria-label="Price type"
            >
              <option value="all">All pricing</option>
              <option value="fixed">Fixed</option>
              <option value="range">Range</option>
              <option value="hourly">Hourly</option>
              <option value="contact">Contact for pricing</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[240px] flex-1">
              <MapPin
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]"
                size={17}
              />
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City, region, or postal code"
                className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setMode("all");
                setPriceType("all");
                setLocation("");
              }}
              className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
            >
              Clear filters
            </button>
          </div>
        </section>

        {notice ? (
          <section
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm"
            role="alert"
          >
            {notice}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-[var(--loombus-text-muted)]">
            Gathering published Services…
          </section>
        ) : services.length === 0 ? (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <BriefcaseBusiness
              className="mx-auto text-[var(--loombus-text-subtle)]"
              size={42}
            />
            <h2 className="mt-4 text-2xl font-semibold">
              No Services match this view.
            </h2>
            <p className="mt-2 text-[var(--loombus-text-muted)]">
              Clear a filter or publish the first Service for this need.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Published Services">
            {services.map((service) => (
              <Link
                key={service.id}
                href={`/services/${service.slug}`}
                className="group flex min-h-[370px] flex-col rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
                    <Sparkles size={20} />
                  </span>
                  <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
                    <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">
                      {service.category}
                    </span>
                    {service.appointmentServiceId ? (
                      <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">
                        Appointment ready
                      </span>
                    ) : null}
                  </div>
                </div>
                <h2 className="mt-5 text-2xl font-semibold leading-tight group-hover:underline">
                  {service.title}
                </h2>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--loombus-text-muted)]">
                  {service.description}
                </p>
                <div className="mt-auto space-y-3 pt-6 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin
                      className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]"
                      size={17}
                    />
                    <span>{providerServiceLocationLabel(service)}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock3
                      className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]"
                      size={17}
                    />
                    <span>
                      {formatProviderServiceDuration(
                        service.typicalDurationMinutes,
                      )}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <BriefcaseBusiness
                      className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]"
                      size={17}
                    />
                    <span>{service.businessName || service.providerName}</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--loombus-border)] pt-4 text-xs text-[var(--loombus-text-muted)]">
                  <span>{formatProviderServicePrice(service)}</span>
                  <span>
                    {service.inquiryCount} inquir
                    {service.inquiryCount === 1 ? "y" : "ies"}
                  </span>
                </div>
              </Link>
            ))}
          </section>
        )}

        {pageCount > 1 ? (
          <nav className="flex items-center justify-center gap-3" aria-label="Services pages">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              className="rounded-full border border-[var(--loombus-border)] px-5 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-[var(--loombus-text-muted)]">
              Page {page} of {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() =>
                setPage((current) => Math.min(current + 1, pageCount))
              }
              className="rounded-full border border-[var(--loombus-border)] px-5 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-sm leading-6 text-[var(--loombus-text-muted)]">
          Loombus does not process Service payments, verify professional
          licensing, guarantee credentials, or promise provider performance.
          Confirm identity, qualifications, scope, pricing, and safety before
          meeting or paying anyone.
        </section>
      </div>
    </main>
  );
}
