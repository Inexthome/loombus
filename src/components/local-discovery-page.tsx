"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  HandHeart,
  Loader2,
  MapPin,
  Navigation,
  Search,
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
  const props = { size: 20, "aria-hidden": true } as const;
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
      <span className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]">
        {icon}
      </span>
      <span>{children}</span>
    </span>
  );
}

function LocalResultCard({ result }: { result: LocalDiscoveryResult }) {
  const date = formatLocalDiscoveryDate(result.startsAt);
  return (
    <Link
      href={result.href}
      className="group flex min-h-[340px] flex-col rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)]">
          <ResultIcon type={result.entityType} />
        </span>
        <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold">
          <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">
            {localDiscoveryTypeLabel(result.entityType)}
          </span>
          {result.distanceMiles !== null ? (
            <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1">
              {result.distanceMiles.toFixed(1)} miles
            </span>
          ) : null}
          {result.remoteAvailable ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-1">
              <Wifi size={12} /> Remote
            </span>
          ) : null}
        </div>
      </div>
      <h2 className="mt-5 text-2xl font-semibold leading-tight group-hover:underline">
        {result.title}
      </h2>
      {result.attribution ? (
        <p className="mt-2 text-sm font-semibold text-[var(--loombus-text-muted)]">
          {result.attribution}
        </p>
      ) : null}
      <p className="mt-3 line-clamp-4 text-sm leading-6 text-[var(--loombus-text-muted)]">
        {result.summary}
      </p>
      <div className="mt-auto space-y-3 pt-6 text-sm text-[var(--loombus-text-muted)]">
        <InfoLine icon={<MapPin size={16} />}>
          {localDiscoveryLocationLabel(result)}
          {result.locationPrecision ? " · Approximate area" : ""}
        </InfoLine>
        {date ? (
          <InfoLine icon={<Clock3 size={16} />}>{date}</InfoLine>
        ) : null}
        {result.priceText ? (
          <InfoLine icon={<BriefcaseBusiness size={16} />}>
            {result.priceText}
          </InfoLine>
        ) : null}
      </div>
      {result.category ? (
        <div className="mt-5 border-t border-[var(--loombus-border)] pt-4 text-xs text-[var(--loombus-text-subtle)]">
          {result.category}
        </div>
      ) : null}
    </Link>
  );
}

export default function LocalDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [entityType, setEntityType] = useState<
    "all" | LocalDiscoveryEntityType
  >("all");
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
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to search Loombus Local.");
      }
      setData(payload as LocalDiscoveryResponse);
    } catch (error) {
      setData(EMPTY_RESPONSE);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to search Loombus Local.",
      );
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
        setNotice(
          "Current location was not shared. Enter a city, state, or ZIP code instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Loombus Local
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                One place for what is available around you.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--loombus-text-muted)]">
                Search Businesses, Services, Events, Jobs, Marketplace items,
                and public Requests together. Results remain attributable and
                are ranked by relevance, location, availability, and freshness,
                never by payment or follower count.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/local/manage"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
              >
                <SlidersHorizontal size={16} /> Manage my areas
              </Link>
              <Link
                href="/search"
                className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"
              >
                Everything Search
              </Link>
            </div>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Matching results
              </span>
              <strong className="mt-1 block text-2xl">{data.total}</strong>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Location anchored
              </span>
              <strong className="mt-1 block text-2xl">{data.anchoredTotal}</strong>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Search area
              </span>
              <strong className="mt-1 block truncate text-lg">
                {activeLocationLabel}
              </strong>
            </article>
          </div>
        </header>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)_170px_170px]">
            <label className="relative block">
              <span className="sr-only">Search Loombus Local</span>
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]"
                size={18}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="What are you looking for?"
                className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4 outline-none"
              />
            </label>
            <label className="relative block">
              <span className="sr-only">Location</span>
              <MapPin
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]"
                size={18}
              />
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City, state, or ZIP"
                className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4 outline-none"
              />
            </label>
            <select
              value={radiusMiles}
              disabled={!center}
              onChange={(event) => setRadiusMiles(Number(event.target.value))}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 disabled:opacity-50"
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
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
              aria-label="Event date window"
            >
              <option value="all">Any upcoming date</option>
              <option value="today">Today</option>
              <option value="week">Next 7 days</option>
              <option value="month">Next 30 days</option>
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={useCurrentLocation}
              disabled={locating}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Navigation size={16} />
              )}
              {locating ? "Locating…" : center ? "Refresh current area" : "Use current area"}
            </button>
            {center ? (
              <button
                type="button"
                onClick={() => setCenter(null)}
                className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
              >
                Remove distance filter
              </button>
            ) : null}
            <label className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={includeRemote}
                onChange={(event) => setIncludeRemote(event.target.checked)}
              />
              Include remote or online
            </label>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setLocation("");
                setEntityType("all");
                setDateWindow("all");
                setCenter(null);
                setRadiusMiles(25);
                setIncludeRemote(true);
              }}
              className="ml-auto rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
            >
              Clear filters
            </button>
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-subtle)]">
            Current-area coordinates are sent only for this search and are not
            returned in results. Public cards show an approximate area, not a
            residential point.
          </p>
        </section>

        <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Local result types">
          {LOCAL_DISCOVERY_TYPES.map((item) => {
            const active = entityType === item.value;
            const count =
              item.value === "all"
                ? data.total
                : Number(data.counts[item.value] ?? 0);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setEntityType(item.value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                  active
                    ? "border-[var(--loombus-text)] bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]"
                    : "border-[var(--loombus-border)] bg-[var(--loombus-surface)]"
                }`}
              >
                {item.label} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </nav>

        {notice ? (
          <section
            className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-sm"
            role="alert"
          >
            {notice}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-[var(--loombus-text-muted)]">
            <Loader2 className="mx-auto animate-spin" size={28} />
            <p className="mt-3">Organizing local sources…</p>
          </section>
        ) : data.results.length === 0 ? (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <MapPin className="mx-auto text-[var(--loombus-text-subtle)]" size={42} />
            <h2 className="mt-4 text-2xl font-semibold">No local results match this view.</h2>
            <p className="mx-auto mt-2 max-w-2xl text-[var(--loombus-text-muted)]">
              Try a broader area, include remote results, remove the distance
              filter, or search a different category. Distance searches include
              listings that have a privacy-safe location anchor.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Local Discovery results">
            {data.results.map((result) => (
              <LocalResultCard
                key={`${result.sourceTable}:${result.id}`}
                result={result}
              />
            ))}
          </section>
        )}

        {pageCount > 1 ? (
          <nav className="flex items-center justify-center gap-3" aria-label="Local Discovery pages">
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
              onClick={() => setPage((current) => Math.min(current + 1, pageCount))}
              className="rounded-full border border-[var(--loombus-border)] px-5 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Next
            </button>
          </nav>
        ) : null}

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-sm leading-6 text-[var(--loombus-text-muted)]">
          Loombus Local organizes existing attributable sources. It does not
          guarantee availability, credentials, pricing, employment, event
          access, item condition, or completion of a Request. Open the original
          source and confirm material details directly.
        </section>
      </div>
    </main>
  );
}
