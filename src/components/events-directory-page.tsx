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
  "h-12 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Events</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Discover accountable public events in chronological order, keep organizer context visible, and move selected dates into your Loombus calendar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/calendar"
              className="inline-flex h-12 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[color:var(--loombus-gold)]"
            >
              <CalendarDays size={16} className="text-[color:var(--loombus-gold)]" /> My calendar
            </Link>
            <Link
              href="/events/manage"
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <SlidersHorizontal size={16} /> Create or manage
            </Link>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Upcoming</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{events.length}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Places represented</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{cityCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Online or hybrid</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{onlineCount}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Free in view</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{freeCount}</strong>
          </article>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <div className="mb-4 flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search Events</span>
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, topic, city, venue, or organizer"
                  className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]"
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-sm transition hover:border-[color:var(--loombus-gold)]"
                aria-label="Clear Event filters"
              >
                <SlidersHorizontal size={19} />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[color:var(--loombus-gold)] px-1 text-[10px] font-bold text-[color:var(--loombus-gold-contrast)]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Event formats">
              {FORMAT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormat(option.value)}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                    format === option.value
                      ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                      : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] hover:border-[color:var(--loombus-gold)]"
                  }`}
                >
                  {option.value === "online" ? <Globe2 className="mr-1 inline h-4 w-4" /> : null}
                  {option.label}
                </button>
              ))}
            </nav>

            {notice ? (
              <section className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm" role="alert">{notice}</section>
            ) : null}

            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Chronological directory</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                {loading ? "Gathering upcoming Events" : `${events.length} Event${events.length === 1 ? "" : "s"} in this view`}
              </h2>
            </div>

            {loading ? (
              <section className="grid min-h-64 place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={28} />
              </section>
            ) : events.length === 0 ? (
              <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
                <CalendarDays className="mx-auto text-[color:var(--loombus-gold)]" size={42} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">No Events match this view.</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Clear a filter or create the first accountable Event for this topic.
                </p>
                <Link href="/events/manage" className="mt-5 inline-flex rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)]">
                  Create an Event
                </Link>
              </section>
            ) : (
              <section className="grid gap-4 md:grid-cols-2" aria-label="Upcoming Events">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="group flex min-h-[360px] flex-col rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5 transition hover:-translate-y-0.5 hover:border-[color:var(--loombus-gold)] hover:shadow-xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                        <CalendarDays size={20} />
                      </span>
                      <div className="flex flex-wrap justify-end gap-2 text-[11px] font-semibold text-[color:var(--loombus-text-muted)]">
                        <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1">{event.category}</span>
                        <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 capitalize">{event.format.replaceAll("_", " ")}</span>
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

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Browse categories</p>
                <Sparkles className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 space-y-2">
                {CATEGORIES.slice(0, 8).map((item) => (
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
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={`${controlClass} mt-4`} aria-label="All Event categories">
                {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </section>

            {nextEvent ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-5 text-[color:var(--loombus-cream-contrast)] shadow-2xl shadow-black/10 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--loombus-gold)]">Next in this view</p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{nextEvent.title}</h3>
                <p className="mt-2 text-sm leading-6">{formatEventDateRange(nextEvent.startsAt, nextEvent.endsAt, nextEvent.timezone)}</p>
                <Link href={`/events/${nextEvent.slug}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-gold)]">
                  Open Event <ArrowUpRight size={14} />
                </Link>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Event tools</p>
              <div className="mt-4 space-y-2">
                <Link href="/events/manage" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Create or manage <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/calendar" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  My calendar <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
                <Link href="/local" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Explore Local <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  <ShieldCheck className="h-5 w-5" />
                </span>
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
