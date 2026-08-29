"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronRight,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LOCAL_DISCOVERY_TYPES,
  formatLocalDiscoveryDate,
  localDiscoveryLocationLabel,
  localDiscoveryTypeLabel,
  type LocalDiscoveryEntityType,
  type LocalDiscoveryResponse,
  type LocalDiscoveryResult,
} from "@/lib/local-discovery";
import { getCurrentApproximateLocation } from "@/lib/native-location";
import "./local-discovery-editorial.css";

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

const DESTINATIONS = [
  ["Businesses", "/businesses"],
  ["Services", "/services"],
  ["Events", "/events"],
  ["Jobs", "/jobs"],
  ["Marketplace", "/marketplace"],
  ["Requests", "/requests"],
] as const;

function dateRange(value: DateWindow) {
  if (value === "all") return { dateFrom: null, dateTo: null };
  const now = new Date();
  const end = new Date(now);
  if (value === "today") end.setHours(23, 59, 59, 999);
  else if (value === "week") end.setDate(end.getDate() + 7);
  else end.setDate(end.getDate() + 30);
  return { dateFrom: now.toISOString(), dateTo: end.toISOString() };
}

function ResultIcon({ type }: { type: LocalDiscoveryEntityType }) {
  const props = { size: 18, "aria-hidden": true } as const;
  if (type === "business") return <Building2 {...props} />;
  if (type === "service") return <Sparkles {...props} />;
  if (type === "event") return <CalendarDays {...props} />;
  if (type === "job") return <BriefcaseBusiness {...props} />;
  if (type === "marketplace") return <ShoppingBag {...props} />;
  return <HandHeart {...props} />;
}

function LocalResultRow({ result }: { result: LocalDiscoveryResult }) {
  const date = formatLocalDiscoveryDate(result.startsAt);
  const distance =
    typeof result.distanceMiles === "number" && Number.isFinite(result.distanceMiles)
      ? `${result.distanceMiles.toFixed(1)} miles`
      : null;

  return (
    <article className="local-editorial-result">
      <div className="local-editorial-result-icon">
        <ResultIcon type={result.entityType} />
      </div>
      <div className="local-editorial-result-copy">
        <div className="local-editorial-result-kicker">
          <span>{localDiscoveryTypeLabel(result.entityType)}</span>
          {distance ? <span>{distance}</span> : null}
          {result.remoteAvailable ? <span>Remote available</span> : null}
        </div>
        <Link href={result.href} className="local-editorial-result-title">
          {result.title}
        </Link>
        {result.attribution ? (
          <p className="local-editorial-result-attribution">{result.attribution}</p>
        ) : null}
        <p className="local-editorial-result-summary">{result.summary}</p>
        <div className="local-editorial-result-meta">
          <span>
            <MapPin aria-hidden="true" size={14} />
            {localDiscoveryLocationLabel(result)}
            {result.locationPrecision ? " · Approximate area" : ""}
          </span>
          {date ? <span>{date}</span> : null}
          {result.priceText ? <span>{result.priceText}</span> : null}
          {result.category ? <span>{result.category}</span> : null}
        </div>
      </div>
      <Link href={result.href} className="local-editorial-open" aria-label={`Open ${result.title}`}>
        Open <ArrowUpRight aria-hidden="true" size={14} />
      </Link>
    </article>
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
      [query.trim(), location.trim(), entityType !== "all", dateWindow !== "all", center, !includeRemote].filter(
        Boolean
      ).length,
    [center, dateWindow, entityType, includeRemote, location, query]
  );

  async function useCurrentLocation() {
    setLocating(true);
    setNotice("");
    try {
      setCenter(await getCurrentApproximateLocation());
    } catch {
      setNotice("Current location was not shared. Enter a city, state, or ZIP code instead.");
    } finally {
      setLocating(false);
    }
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
    <main className="local-editorial-page">
      <div className="local-editorial-shell">
        <header className="local-editorial-header">
          <div>
            <p className="local-editorial-eyebrow">LOOMBUS LOCAL</p>
            <h1>Find what is useful around you.</h1>
            <p className="local-editorial-intro">
              Discover attributable businesses, services, events, jobs, Marketplace listings, and public requests by place, distance, date, and availability.
            </p>
          </div>
          <div className="local-editorial-header-actions">
            <Link href="/local/manage">Manage my areas</Link>
            <Link href="/search" className="is-primary">
              Everything Search <ArrowUpRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </header>

        <section className="local-editorial-signal" aria-label="Local search summary">
          <div><span>Results</span><strong>{data.total}</strong></div>
          <div><span>Location anchored</span><strong>{data.anchoredTotal}</strong></div>
          <div><span>Search area</span><strong>{activeLocationLabel}</strong></div>
        </section>

        <section className="local-editorial-search" aria-labelledby="local-search-heading">
          <div className="local-editorial-section-heading">
            <p className="local-editorial-eyebrow">DISCOVERY</p>
            <h2 id="local-search-heading">Search across Local.</h2>
          </div>

          <div className="local-editorial-search-row">
            <label className="local-editorial-search-input">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Search Loombus Local</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="What are you looking for?"
              />
            </label>
            <button type="button" onClick={clearFilters} className="local-editorial-clear">
              <SlidersHorizontal aria-hidden="true" size={16} />
              Clear filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>
          </div>

          <nav className="local-editorial-types" aria-label="Local result types">
            {LOCAL_DISCOVERY_TYPES.map((item) => {
              const active = entityType === item.value;
              const count = item.value === "all" ? data.total : Number(data.counts[item.value] ?? 0);
              return (
                <button
                  key={item.value}
                  type="button"
                  className={active ? "is-active" : ""}
                  onClick={() => setEntityType(item.value)}
                >
                  {item.label} <span>{count}</span>
                </button>
              );
            })}
          </nav>
        </section>

        <section className="local-editorial-filters" aria-labelledby="local-area-heading">
          <div className="local-editorial-section-heading">
            <p className="local-editorial-eyebrow">SEARCH AREA</p>
            <h2 id="local-area-heading">Set the place and availability.</h2>
          </div>

          <div className="local-editorial-filter-grid">
            <label>
              <span>City, state, or ZIP</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter a place" />
            </label>
            <label>
              <span>Distance</span>
              <select value={radiusMiles} disabled={!center} onChange={(event) => setRadiusMiles(Number(event.target.value))}>
                <option value={5}>Within 5 miles</option>
                <option value={10}>Within 10 miles</option>
                <option value={25}>Within 25 miles</option>
                <option value={50}>Within 50 miles</option>
              </select>
            </label>
            <label>
              <span>Date</span>
              <select value={dateWindow} onChange={(event) => setDateWindow(event.target.value as DateWindow)}>
                <option value="all">Any upcoming date</option>
                <option value="today">Today</option>
                <option value="week">Next 7 days</option>
                <option value="month">Next 30 days</option>
              </select>
            </label>
            <label className="local-editorial-checkbox">
              <span>Remote / online</span>
              <input type="checkbox" checked={includeRemote} onChange={(event) => setIncludeRemote(event.target.checked)} />
            </label>
          </div>

          <div className="local-editorial-area-actions">
            <button type="button" onClick={useCurrentLocation} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" size={15} /> : <Navigation size={15} />}
              {locating ? "Locating…" : center ? "Refresh current area" : "Use current area"}
            </button>
            {center ? <button type="button" onClick={() => setCenter(null)}>Remove distance filter</button> : null}
          </div>

          <div className="local-editorial-privacy">
            <ShieldCheck aria-hidden="true" size={17} />
            <p>
              Current-area coordinates are used only for this search. Public results show an approximate area, not a residential point.
            </p>
          </div>
        </section>

        {notice ? <div className="local-editorial-notice" role="alert">{notice}</div> : null}

        <section className="local-editorial-results" aria-labelledby="local-results-heading">
          <div className="local-editorial-results-heading">
            <div>
              <p className="local-editorial-eyebrow">LOCAL DISCOVERY</p>
              <h2 id="local-results-heading">
                {loading ? "Organizing sources" : `${data.total} result${data.total === 1 ? "" : "s"}`}
              </h2>
            </div>
            <span>{activeLocationLabel}</span>
          </div>

          {loading ? (
            <div className="local-editorial-state">
              <Loader2 className="animate-spin" size={24} />
              <p>Organizing local sources…</p>
            </div>
          ) : data.results.length === 0 ? (
            <div className="local-editorial-state">
              <Compass size={26} />
              <div>
                <h3>No local results match this view.</h3>
                <p>Try a broader area, include remote results, remove the distance filter, or search a different category.</p>
              </div>
            </div>
          ) : (
            <div className="local-editorial-result-list" aria-label="Local Discovery results">
              {data.results.map((result) => (
                <LocalResultRow key={`${result.sourceTable}:${result.id}`} result={result} />
              ))}
            </div>
          )}

          {pageCount > 1 ? (
            <nav className="local-editorial-pagination" aria-label="Local Discovery pages">
              <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(current + 1, pageCount))}>Next</button>
            </nav>
          ) : null}
        </section>

        <section className="local-editorial-destinations" aria-labelledby="local-destinations-heading">
          <div className="local-editorial-section-heading">
            <p className="local-editorial-eyebrow">EXPLORE DIRECTLY</p>
            <h2 id="local-destinations-heading">Local destinations.</h2>
          </div>
          <div className="local-editorial-destination-grid">
            {DESTINATIONS.map(([label, href]) => (
              <Link key={href} href={href}>
                {label} <ChevronRight aria-hidden="true" size={15} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
