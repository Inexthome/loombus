"use client";

import Link from "next/link";
import {
  CalendarDays,
  Filter,
  Globe2,
  MapPin,
  Search,
  SlidersHorizontal,
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
    [events]
  );

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Loombus Events
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Find a real reason to show up.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--loombus-text-muted)]">
                Browse accountable public events, keep private Room dates in context, and
                return to one calendar when it is time to act.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-5 py-3 text-sm font-semibold"
              >
                <CalendarDays size={17} /> My calendar
              </Link>
              <Link
                href="/events/manage"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)]"
              >
                <SlidersHorizontal size={17} /> Create or manage
              </Link>
            </div>
          </div>

          <section className="mt-7 grid gap-3 sm:grid-cols-3" aria-label="Events overview">
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Upcoming
              </span>
              <strong className="mt-1 block text-2xl">{events.length}</strong>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Places represented
              </span>
              <strong className="mt-1 block text-2xl">{cityCount}</strong>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                Ranking
              </span>
              <strong className="mt-1 block text-sm">Chronological, not pay-to-rank</strong>
            </article>
          </section>
        </header>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_190px_auto]">
            <label className="relative block">
              <span className="sr-only">Search Events</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]" size={18} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, topic, city, or venue"
                className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4 outline-none focus:border-[var(--loombus-text-subtle)]"
              />
            </label>
            <label className="relative">
              <span className="sr-only">Event category</span>
              <Filter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--loombus-text-subtle)]" size={17} />
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full appearance-none rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] py-3 pl-11 pr-4 outline-none"
              >
                {CATEGORIES.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <select
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 outline-none"
              aria-label="Event format"
            >
              <option value="all">All formats</option>
              <option value="in_person">In person</option>
              <option value="online">Online</option>
              <option value="hybrid">Hybrid</option>
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
            >
              Refresh
            </button>
          </div>
        </section>

        {notice ? (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm" role="alert">
            {notice}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center text-[var(--loombus-text-muted)]">
            Gathering upcoming Events…
          </section>
        ) : events.length === 0 ? (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <CalendarDays className="mx-auto text-[var(--loombus-text-subtle)]" size={38} />
            <h2 className="mt-4 text-2xl font-semibold">No Events match this view.</h2>
            <p className="mt-2 text-[var(--loombus-text-muted)]">
              Clear a filter or create the first accountable event for this topic.
            </p>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Upcoming Events">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.slug}`}
                className="group flex min-h-[320px] flex-col rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold">
                    {event.category}
                  </span>
                  <span className="text-xs font-semibold text-[var(--loombus-text-muted)]">
                    {eventPriceLabel(event)}
                  </span>
                </div>
                <h2 className="mt-5 text-2xl font-semibold leading-tight group-hover:underline">
                  {event.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                  {event.description}
                </p>
                <div className="mt-auto space-y-3 pt-6 text-sm">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]" size={17} />
                    <span>{formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    {event.format === "online" ? (
                      <Globe2 className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]" size={17} />
                    ) : (
                      <MapPin className="mt-0.5 shrink-0 text-[var(--loombus-text-subtle)]" size={17} />
                    )}
                    <span>{eventLocationLabel(event)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[var(--loombus-text-muted)]">
                    <Users size={17} />
                    <span>
                      {event.goingCount} going · {event.interestedCount} interested
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
