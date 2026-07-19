"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  Compass,
  HandHeart,
  Loader2,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Wifi,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LOCAL_DISCOVERY_TYPES,
  formatLocalDiscoveryDate,
  localDiscoveryLocationLabel,
  localDiscoveryTypeLabel,
  type LocalDiscoveryEntityType,
  type LocalDiscoveryResponse,
  type LocalDiscoveryResult,
} from "@/lib/local-discovery";

const EMPTY_RESPONSE: LocalDiscoveryResponse = {
  results: [],
  total: 0,
  page: 1,
  pageSize: 24,
  counts: {},
  anchoredTotal: 0,
};

type Center = { latitude: number; longitude: number };
type DateWindow = "all" | "today" | "week" | "month";

const controlClass =
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

function dateRange(value: DateWindow) {
  if (value === "all") return { dateFrom: null, dateTo: null };
  const now = new Date();
  const end = new Date(now);
  if (value === "today") {
    end.setHours(23, 59, 59, 999);
  } else if (value === "week") {
    end.setDate(end.getDate() + 7);
  } else {
    end.setDate(end.getDate() + 30);
  }
  return { dateFrom: now.toISOString(), dateTo: end.toISOString() };
}

function ResultIcon({ type }: { type: LocalDiscoveryEntityType }) {
  const props = { size: 19, "aria-hidden": true } as const;
  if (type === "business") return <Building2 {...props} />;
  if (type === "service") return <Sparkles {...props} />;
  if (type === "event") return <CalendarDays {...props} />;
  if (type === "job") return <BriefcaseBusiness {...props} />;
  if (type === "marketplace") return <ShoppingBag {...props} />;
  return <HandHeart {...props} />;
}

function InfoLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]">{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function LocalResultCard({ result }: { result: LocalDiscoveryResult }) {
  const date = formatLocalDiscoveryDate(result.startsAt);

  return (
    <Link
      href={result.href}
      className="group flex min-h-[320px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
          <ResultIcon type={result.entityType} />
        </span>
        <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold text-[color:var(--loombus-text-muted)]">
          <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">
            {localDiscoveryTypeLabel(result.entityType)}
          </span>
          {result.distanceMiles !== null ? (
            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">
              {result.distanceMiles.toFixed(1)} miles
            </span>
          ) : null}
          {result.remoteAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--loombus-border)] px-3 py-1">
              <Wifi size={12} /> Remote
            </span>
          ) : null}
        </div>
      </div>

      <h2 className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em] text-[color:var(--loombus-text)] group-hover:underline">
        {result.title}
      </h2>
      {result.attribution ? (
        <p className="mt-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
          {result.attribution}
        </p>
      ) : null}
      <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        {result.summary}
      </p>

      <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]">
        <InfoLine icon={<MapPin size={16} />}>
          {localDiscoveryLocationLabel(result)}
          {result.locationPrecision ? " · Approximate area" : ""}
        </InfoLine>
        {date ? <InfoLine icon={<Clock3 size={16} />}>{date}</InfoLine> : null}
        {result.priceText ? (
          <InfoLine icon={<BriefcaseBusiness size={16} />}>{result.priceText}</InfoLine>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4 text-xs text-[color:var(--loombus-text-subtle)]">
        <span>{result.category || "Loombus Local"}</span>
        <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)]">
          Open source <ArrowUpRight size={13} />
        </span>
      </div>
    </Link>
  );
}

export default function LocalDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [entityType, setEntityType] = useState<"all" | LocalDiscoveryEntityType>("all");
  const [includeRemote, setIncludeRemote] = useState(true);
  const [dateWindow, setDateWindow] = useState<DateWindow>("all");
  const [center, setCenter] = useState<Center | null>(null);
  const [radiusMiles, setRadiusMiles] = useState(25);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<LocalDiscoveryResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const range = dateRange(dateWindow);
      const response = await fetch("/api/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          query,
          entityTypes: entityType === "all" ? [] : [entityType],
          location,
          latitude: center?.latitude,
          longitude: center?.longitude,
          radiusMiles: center ? radiusMiles : null,
          includeRemote,
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          page,
          pageSize: 24,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to search Loombus Local.");
      setData(payload as LocalDiscoveryResponse);
    } catch (error) {
      setData(EMPTY_RESPONSE);
      setNotice(error instanceof Error ? error.message : "Unable to search Loombus Local.");
    } finally {
      setLoading(false);
    }
  }, [center, dateWindow, entityType, includeRemote, location, page, query, radiusMiles]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [center, dateWindow, entityType, includeRemote, location, query, radiusMiles]);

  const pageCount = Math.max(Math.ceil(data.total / data.pageSize), 1);
  const activeLocationLabel = useMemo(() => {
    if (center && location.trim()) return `${location.trim()} · ${radiusMiles} miles`;
    if (center) return `Current area · ${radiusMiles} miles`;
    if (location.trim()) return location.trim();
    return "Everywhere";
  }, [center, location, radiusMiles]);

  const activeFilterCount = useMemo(
    () =>
      [
        query.trim(),
        location.trim(),
        entityType !== "all",
        dateWindow !== "all",
        center,
        !includeRemote,
      ].filter(Boolean).length,
    [center, dateWindow, entityType, includeRemote, location, query],
  );

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice("This browser does not provide current-location access.");
      return;
    }
    setLocating(true);
    setNotice("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setNotice("Current location was not shared. Enter a city, state, or ZIP code instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function clearFilters() {
    setQuery("");
    setLocation("");
    setEntityType("all");
    setDateWindow("all");
    setCenter(null);
    setRadiusMiles(25);
    setIncludeRemote(true);
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Local</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Search Businesses, Services, Events, Jobs, Marketplace listings, and public Requests together by relevance, place, availability, and freshness.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/local/manage"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <SlidersHorizontal size={16} className="text-[color:var(--loombus-gold)]" /> Manage my areas
            </Link>
            <Link
              href="/search"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              Everything Search <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Matching results</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data.total}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Location anchored</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{data.anchoredTotal}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Search area</span>
            <strong className="mt-2 block truncate text-lg tracking-[-0.025em]">{activeLocationLabel}</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="order-last min-w-0 xl:order-first">
            <div className="mb-4 flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search Loombus Local</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="What are you looking for?"
                  className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]"
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm transition hover:border-[color:var(--loombus-gold)]"
                aria-label="Clear Local filters"
              >
                <SlidersHorizontal className="h-5 w-5" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--loombus-gold)] px-1 text-[10px] font-bold text-[color:var(--loombus-gold-contrast)]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Local result types">
              {LOCAL_DISCOVERY_TYPES.map((item) => {
                const active = entityType === item.value;
                const count = item.value === "all" ? data.total : Number(data.counts[item.value] ?? 0);
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setEntityType(item.value)}
                    className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                      active
                        ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                        : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                    }`}
                  >
                    {item.label} · {count}
                  </button>
                );
              })}
            </nav>

            {notice ? (
              <section className="mb-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm" role="alert">
                {notice}
              </section>
            ) : null}

            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Local discovery</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {loading ? "Organizing sources" : `${data.total} result${data.total === 1 ? "" : "s"}`}
              </h2>
            </div>

            {loading ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
                <Loader2 className="mx-auto animate-spin text-[color:var(--loombus-gold)]" size={28} />
                <p className="mt-3">Organizing local sources…</p>
              </section>
            ) : data.results.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
                <Compass className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No local results match this view.</h2>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Try a broader area, include remote results, remove the distance filter, or search a different category.
                </p>
              </section>
            ) : (
              <section className="grid gap-4 md:grid-cols-2" aria-label="Local Discovery results">
                {data.results.map((result) => (
                  <LocalResultCard key={`${result.sourceTable}:${result.id}`} result={result} />
                ))}
              </section>
            )}

            {pageCount > 1 ? (
              <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Local Discovery pages">
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

          <aside className="order-first space-y-5 xl:order-last xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[color:var(--loombus-gold)]" />
                  <h2 className="text-lg font-semibold">Search area</h2>
                </div>
                <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-xs font-bold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                  {center ? "Distance on" : "Area search"}
                </span>
              </div>

              <div className="mt-5 space-y-3">
                <label className="relative block">
                  <span className="sr-only">Location</span>
                  <MapPin className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="City, state, or ZIP"
                    className={`${controlClass} pl-11`}
                  />
                </label>

                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locating}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
                >
                  {locating ? <Loader2 className="animate-spin" size={16} /> : <Navigation size={16} className="text-[color:var(--loombus-gold)]" />}
                  {locating ? "Locating…" : center ? "Refresh current area" : "Use current area"}
                </button>

                <select
                  value={radiusMiles}
                  disabled={!center}
                  onChange={(event) => setRadiusMiles(Number(event.target.value))}
                  className={`${controlClass} disabled:opacity-50`}
                  aria-label="Distance radius"
                >
                  <option value={5}>Within 5 miles</option>
                  <option value={10}>Within 10 miles</option>
                  <option value={25}>Within 25 miles</option>
                  <option value={50}>Within 50 miles</option>
                </select>

                <select
                  value={dateWindow}
                  onChange={(event) => setDateWindow(event.target.value as DateWindow)}
                  className={controlClass}
                  aria-label="Event date window"
                >
                  <option value="all">Any upcoming date</option>
                  <option value="today">Today</option>
                  <option value="week">Next 7 days</option>
                  <option value="month">Next 30 days</option>
                </select>

                <label className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm font-semibold">
                  <span className="inline-flex items-center gap-2"><Wifi size={16} className="text-[color:var(--loombus-gold)]" /> Include remote or online</span>
                  <input
                    type="checkbox"
                    checked={includeRemote}
                    onChange={(event) => setIncludeRemote(event.target.checked)}
                    className="h-5 w-5 accent-[color:var(--loombus-gold)]"
                  />
                </label>

                {center ? (
                  <button
                    type="button"
                    onClick={() => setCenter(null)}
                    className="w-full rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
                  >
                    Remove distance filter
                  </button>
                ) : null}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Local destinations</p>
              <div className="mt-4 space-y-2">
                {[
                  ["Businesses", "/businesses"],
                  ["Services", "/services"],
                  ["Events", "/events"],
                  ["Jobs", "/jobs"],
                  ["Marketplace", "/marketplace"],
                  ["Requests", "/requests"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    {label}
                    <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Location privacy</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Current-area coordinates are used only for this search. Public results show an approximate area, not a residential point.
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
