"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Globe2,
  Loader2,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eventLocationLabel,
  eventPriceLabel,
  formatEventDateRange,
  type EventsDirectoryResponse,
  type PublicEvent,
} from "@/lib/events";

const CATEGORIES = [
  "All categories",
  "Community",
  "Education",
  "Business",
  "Technology",
  "Arts and culture",
  "Health and wellness",
  "Government and civic",
  "Family",
  "Sports and recreation",
  "Other",
];

const FORMAT_OPTIONS = [
  { value: "all", label: "All formats" },
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
] as const;

const controlClass =
  "h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 text-sm text-[color:var(--loombus-text)] outline-none transition motion-reduce:transition-none focus:border-[color:var(--loombus-gold)] focus:border-b-2";

export default function EventsDirectoryPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [format, setFormat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (category !== "All categories") params.set("category", category);
      if (format !== "all") params.set("format", format);
      const response = await fetch(`/api/events?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<EventsDirectoryResponse> & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Events.");
      setEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load Events.");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [category, format, query]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const cityCount = useMemo(
    () => new Set(events.map((event) => event.city).filter(Boolean)).size,
    [events],
  );

  const onlineCount = useMemo(
    () => events.filter((event) => event.format === "online" || event.format === "hybrid").length,
    [events],
  );

  const freeCount = useMemo(() => events.filter((event) => event.isFree).length, [events]);

  const nextEvent = useMemo(
    () => [...events].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0] ?? null,
    [events],
  );

  const activeFilterCount = [query.trim(), category !== "All categories", format !== "all"].filter(Boolean).length;

  function clearFilters() {
    setQuery("");
    setCategory("All categories");
    setFormat("all");
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[86rem]">
        <header className="border-b border-[color:var(--loombus-border)] pb-6 lg:flex lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Public calendar</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Events</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Discover accountable public events in chronological order, keep organizer context visible, and move selected dates into your Loombus calendar.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 lg:mt-0">
            <Link
              href="/calendar"
              className="inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-border)] px-0.5 text-sm font-semibold transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
            >
              <CalendarDays size={16} className="text-[color:var(--loombus-gold)]" /> My calendar
            </Link>
            <Link
              href="/events/manage"
              className="inline-flex min-h-11 items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-0.5 text-sm font-semibold transition motion-reduce:transition-none hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
            >
              <SlidersHorizontal size={16} /> Create or manage
            </Link>
          </div>
        </header>

        <section className="grid border-b border-[color:var(--loombus-border)] sm:grid-cols-2 lg:grid-cols-4" aria-label="Event overview">
          {[
            ["Upcoming", events.length],
            ["Places represented", cityCount],
            ["Online or hybrid", onlineCount],
            ["Free in view", freeCount],
          ].map(([label, value], index) => (
            <article key={String(label)} className={`py-5 sm:px-5 ${index === 0 ? "sm:pl-0" : ""} ${index > 0 ? "sm:border-l sm:border-[color:var(--loombus-border)]" : ""}`}>
              <span className={`text-xs font-bold uppercase tracking-[0.18em] ${index === 0 ? "text-[color:var(--loombus-gold)]" : "text-[color:var(--loombus-text-muted)]"}`}>{label}</span>
              <strong className="mt-2 block text-3xl tracking-[-0.04em]">{value}</strong>
            </article>
          ))}
        </section>

        <div className="grid gap-8 pt-7 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <div className="flex items-end gap-4 border-b border-[color:var(--loombus-border)]">
              <label className="relative flex min-h-14 flex-1 items-center">
                <span className="sr-only">Search Events</span>
                <Search className="pointer-events-none h-5 w-5 shrink-0 text-[color:var(--loombus-text-subtle)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, topic, city, venue, or organizer"
                  className="h-14 w-full border-0 bg-transparent px-4 text-base outline-none placeholder:text-[color:var(--loombus-text-subtle)]"
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="relative inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-0.5 text-sm font-semibold transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                aria-label="Clear Event filters"
              >
                <SlidersHorizontal size={18} />
                <span className="hidden sm:inline">Clear filters</span>
                {activeFilterCount > 0 ? <span className="text-[color:var(--loombus-gold)]">{activeFilterCount}</span> : null}
              </button>
            </div>

            <nav className="mb-7 flex gap-5 overflow-x-auto border-b border-[color:var(--loombus-border)]" aria-label="Event formats">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  className={`shrink-0 border-b-2 px-0.5 py-3 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)] ${
                    format === option.value
                      ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-text)]"
                      : "border-transparent text-[color:var(--loombus-text-muted)] hover:border-[color:var(--loombus-border)] hover:text-[color:var(--loombus-text)]"
                  }`}
                >
                  {option.value === "online" ? <Globe2 className="mr-1 inline h-4 w-4 text-[color:var(--loombus-gold)]" /> : null}
                  {option.label}
                </button>
              ))}
            </nav>

            {notice ? (
              <section className="mb-6 border-y border-red-500/40 py-4 text-sm" role="alert">{notice}</section>
            ) : null}

            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Chronological directory</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {loading ? "Gathering upcoming Events" : `${events.length} Event${events.length === 1 ? "" : "s"} in this view`}
              </h2>
            </div>

            {loading ? (
              <section className="grid min-h-64 place-items-center border-y border-[color:var(--loombus-border)]">
                <Loader2 className="animate-spin motion-reduce:animate-none text-[color:var(--loombus-gold)]" size={28} />
              </section>
            ) : events.length === 0 ? (
              <section className="border-y border-[color:var(--loombus-border)] py-12 text-center">
                <CalendarDays className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No Events match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Clear a filter or create the first accountable Event for this topic.
                </p>
                <Link href="/events/manage" className="mt-5 inline-flex min-h-11 items-center border-b-2 border-[color:var(--loombus-gold)] px-0.5 text-sm font-semibold hover:text-[color:var(--loombus-gold)]">
                  Create an Event
                </Link>
              </section>
            ) : (
              <section className="grid border-t border-[color:var(--loombus-border)] md:grid-cols-2" aria-label="Upcoming Events">
                {events.map((event, index) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className={`group flex min-h-[340px] flex-col border-b border-[color:var(--loombus-border)] py-6 transition motion-reduce:transition-none hover:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)] md:px-6 ${index % 2 === 0 ? "md:pl-0 md:border-r md:border-r-[color:var(--loombus-border)]" : "md:pr-0"}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <CalendarDays size={20} className="mt-1 shrink-0 text-[color:var(--loombus-gold)]" />
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">
                        <span>{event.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{event.format.replaceAll("_", " ")}</span>
                      </div>
                    </div>

                    <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-[-0.035em] group-hover:underline">{event.title}</h3>
                    <p className="mt-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">{event.businessName || event.organizerName}</p>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{event.description}</p>

                    <div className="mt-auto space-y-3 pt-6 text-sm text-[color:var(--loombus-text-muted)]">
                      <div className="flex items-start gap-3"><Clock3 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /><span>{formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}</span></div>
                      <div className="flex items-start gap-3">
                        {event.format === "online" ? <Globe2 className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} /> : <MapPin className="mt-0.5 shrink-0 text-[color:var(--loombus-gold)]" size={17} />}
                        <span>{eventLocationLabel(event)}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--loombus-border-muted)] pt-4 text-xs text-[color:var(--loombus-text-muted)]">
                      <span className="font-semibold text-[color:var(--loombus-text)]">{eventPriceLabel(event)}</span>
                      <span className="inline-flex items-center gap-1"><Users size={14} /> {event.goingCount} going · {event.interestedCount} interested</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[color:var(--loombus-gold)]">Open Event <ArrowUpRight size={13} /></span>
                    </div>
                  </Link>
                ))}
              </section>
            )}
          </section>

          <aside className="space-y-7 xl:sticky xl:top-28 xl:self-start">
            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Browse categories</p>
                <Sparkles className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-3 border-t border-[color:var(--loombus-border)]">
                {CATEGORIES.slice(0, 8).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className={`flex min-h-11 w-full items-center justify-between border-b px-0 py-2 text-left text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--loombus-gold)] ${
                      category === item
                        ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                        : "border-[color:var(--loombus-border)] text-[color:var(--loombus-text)] hover:text-[color:var(--loombus-gold)]"
                    }`}
                  >
                    <span className="truncate">{item}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                  </button>
                ))}
              </div>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={`${controlClass} mt-4`} aria-label="All Event categories">
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </section>

            {nextEvent ? (
              <section className="border-b border-[color:var(--loombus-border)] pb-6">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--loombus-gold)]">Next in this view</p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{nextEvent.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{formatEventDateRange(nextEvent.startsAt, nextEvent.endsAt, nextEvent.timezone)}</p>
                <Link href={`/events/${nextEvent.slug}`} className="mt-4 inline-flex min-h-11 items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] text-sm font-semibold text-[color:var(--loombus-gold)]">
                  Open Event <ArrowUpRight size={14} />
                </Link>
              </section>
            ) : null}

            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Event tools</p>
              <div className="mt-3 border-t border-[color:var(--loombus-border)]">
                <Link href="/events/manage" className="flex min-h-11 items-center justify-between border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold hover:text-[color:var(--loombus-gold)]">
                  Create or manage <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/calendar" className="flex min-h-11 items-center justify-between border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold hover:text-[color:var(--loombus-gold)]">
                  My calendar <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/local" className="flex min-h-11 items-center justify-between border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold hover:text-[color:var(--loombus-gold)]">
                  Explore Local <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Organizer context remains visible</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Loombus does not process Event payments or guarantee attendance, admission, venues, or organizer performance. Confirm external registration details directly.
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
