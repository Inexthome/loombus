"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  Clock3,
  DoorOpen,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEventDateRange, type CalendarItem } from "@/lib/events";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

function sourceLabel(source: CalendarItem["source"]) {
  if (source === "room_event") return "Private Room";
  if (source === "appointment") return "Appointment";
  return "Public Event";
}

function SourceIcon({ source, size = 18 }: { source: CalendarItem["source"]; size?: number }) {
  if (source === "room_event") return <DoorOpen size={size} />;
  if (source === "appointment") return <BriefcaseBusiness size={size} />;
  return <Users size={size} />;
}

const calendarFilters: Array<{
  value: "all" | CalendarItem["source"];
  label: string;
  shortLabel: string;
}> = [
  { value: "all", label: "Everything", shortLabel: "All" },
  { value: "public_event", label: "Public Events", shortLabel: "Events" },
  { value: "room_event", label: "Private Room dates", shortLabel: "Rooms" },
  { value: "appointment", label: "Appointments", shortLabel: "Appointments" },
];

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-page-bg)]";

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | CalendarItem["source"]>("all");
  const [query, setQuery] = useState("");
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/calendar",
        { cache: "no-store" },
        "/calendar"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load your calendar.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load your calendar.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function respondToRoomEvent(
    item: CalendarItem,
    response: "going" | "interested" | "none"
  ) {
    if (item.source !== "room_event" || workingKey) return;
    const key = `${item.id}:${response}`;
    setWorkingKey(key);
    setNotice("");
    try {
      const result = await scheduleAuthorizedFetch(
        "/api/calendar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "respond_room_event",
            eventId: item.id,
            response,
          }),
        },
        "/calendar"
      );
      const payload = await result.json().catch(() => ({}));
      if (!result.ok) {
        throw new Error(payload.error ?? "Unable to save your Room event response.");
      }
      setItems((current) =>
        current.map((candidate) =>
          candidate.source === "room_event" && candidate.id === item.id
            ? {
                ...candidate,
                response:
                  payload.response === "going" || payload.response === "interested"
                    ? payload.response
                    : null,
              }
            : candidate
        )
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save your Room event response."
      );
    } finally {
      setWorkingKey(null);
    }
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      public_event: items.filter((item) => item.source === "public_event").length,
      room_event: items.filter((item) => item.source === "room_event").length,
      appointment: items.filter((item) => item.source === "appointment").length,
    }),
    [items]
  );

  const visibleItems = useMemo(() => {
    const cleanQuery = query.trim().toLocaleLowerCase();

    return items
      .filter((item) => filter === "all" || item.source === filter)
      .filter((item) => {
        if (!cleanQuery) return true;
        return [
          item.title,
          item.context,
          item.location ?? "",
          item.status,
          sourceLabel(item.source),
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(cleanQuery);
      })
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
      );
  }, [filter, items, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CalendarItem[]>();
    for (const item of visibleItems) {
      const date = new Date(item.startsAt);
      const key = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(date);
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    }
    return [...groups.entries()];
  }, [visibleItems]);

  const nextItem = useMemo(() => {
    const now = Date.now();
    return [...items]
      .sort(
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
      )
      .find((item) => new Date(item.endsAt ?? item.startsAt).getTime() >= now);
  }, [items]);

  const nextSevenDaysCount = useMemo(() => {
    const now = Date.now();
    const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
    return items.filter((item) => {
      const startsAt = new Date(item.startsAt).getTime();
      return startsAt >= now && startsAt <= sevenDaysFromNow;
    }).length;
  }, [items]);

  function selectFilter(nextFilter: "all" | CalendarItem["source"]) {
    setFilter(nextFilter);
  }

  function clearView() {
    setFilter("all");
    setQuery("");
  }

  return (
    <main
      data-calendar-editorial="route"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-7 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[78rem]">
        <header className="grid gap-7 border-b border-[color:var(--loombus-border)] pb-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
              Personal schedule
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">
              Calendar
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Review public Events, private Room dates, and Appointments in one personal calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className={`inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 text-[color:var(--loombus-gold)] ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            Refresh
          </button>
        </header>

        <section className="grid gap-8 border-b border-[color:var(--loombus-border)] py-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block min-w-0">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-subtle)]">
              Search schedule
            </span>
            <span className="flex min-h-12 items-center border-b border-[color:var(--loombus-border)] focus-within:border-[color:var(--loombus-gold)]">
              <Search aria-hidden="true" className="mr-3 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dates, titles, locations, and calendar sources"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-base text-[color:var(--loombus-text)] outline-none placeholder:text-[color:var(--loombus-text-subtle)]"
              />
            </span>
          </label>

          <nav aria-label="Calendar filters" className="flex gap-5 overflow-x-auto">
            {calendarFilters.map((option) => {
              const selected = filter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectFilter(option.value)}
                  className={`min-h-11 shrink-0 border-b-2 px-0.5 py-2 text-sm font-semibold transition motion-reduce:transition-none ${focusClass} ${
                    selected
                      ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                      : "border-transparent text-[color:var(--loombus-text-muted)] hover:border-[color:var(--loombus-border)] hover:text-[color:var(--loombus-text)]"
                  }`}
                >
                  {option.shortLabel} <span className="ml-1 text-xs">{counts[option.value]}</span>
                </button>
              );
            })}
          </nav>
        </section>

        {notice ? (
          <p
            className="border-b border-[color:var(--loombus-border)] py-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]"
            role="alert"
          >
            {notice}
          </p>
        ) : null}

        <div className="grid gap-10 pt-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-gold)]">
                  Your schedule
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                  {loading
                    ? "Loading calendar"
                    : `${visibleItems.length} scheduled ${visibleItems.length === 1 ? "item" : "items"}`}
                </h2>
              </div>
              {filter !== "all" || query.trim() ? (
                <button
                  type="button"
                  onClick={clearView}
                  className={`min-h-11 border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold text-[color:var(--loombus-gold)] transition hover:border-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
                >
                  Clear view
                </button>
              ) : null}
            </div>

            {loading ? (
              <p className="border-b border-[color:var(--loombus-border)] py-12 text-center text-[color:var(--loombus-text-muted)]">
                Loading your calendar…
              </p>
            ) : grouped.length === 0 ? (
              <section className="border-b border-[color:var(--loombus-border)] py-12 text-center">
                <CalendarDays className="mx-auto text-[color:var(--loombus-gold)]" size={36} />
                <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em]">
                  Nothing is scheduled in this view.
                </h2>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Adjust the calendar source or search, or open one of the scheduling areas below.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2">
                  {[
                    ["Browse Events", "/events"],
                    ["Open Rooms", "/rooms"],
                    ["Open Appointments", "/appointments"],
                  ].map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className={`min-h-11 border-b border-[color:var(--loombus-border)] py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <div>
                {grouped.map(([date, dateItems]) => (
                  <section key={date} className="border-b border-[color:var(--loombus-border)] py-7">
                    <header className="mb-2 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                      <CalendarDays aria-hidden="true" className="mt-1 h-5 w-5 text-[color:var(--loombus-gold)]" />
                      <div>
                        <h3 className="text-lg font-semibold">{date}</h3>
                        <p className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                          {dateItems.length} {dateItems.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </header>

                    <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                      {dateItems.map((item) => (
                        <article key={`${item.source}:${item.id}`} className="py-5">
                          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                            <Link href={item.href} className={`group min-w-0 ${focusClass}`}>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold uppercase tracking-[0.12em]">
                                <span className="inline-flex items-center gap-1.5 text-[color:var(--loombus-gold)]">
                                  <SourceIcon source={item.source} size={14} />
                                  {sourceLabel(item.source)}
                                </span>
                                <span className="capitalize text-[color:var(--loombus-text-subtle)]">
                                  {item.status.replaceAll("_", " ")}
                                </span>
                              </div>
                              <h4 className="mt-2 text-xl font-semibold leading-snug tracking-[-0.025em] transition group-hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none">
                                {item.title}
                              </h4>
                              <div className="mt-3 grid gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                                <p className="flex items-start gap-2">
                                  <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                                  <span>{formatEventDateRange(item.startsAt, item.endsAt, item.timezone)}</span>
                                </p>
                                <p className="flex items-start gap-2">
                                  <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                                  <span>{item.context}</span>
                                </p>
                                {item.location ? (
                                  <p className="flex items-start gap-2">
                                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                                    <span>{item.location}</span>
                                  </p>
                                ) : null}
                              </div>
                            </Link>

                            <Link
                              href={item.href}
                              className={`inline-flex min-h-11 items-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-xs font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
                            >
                              Open
                              <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                            </Link>
                          </div>

                          {item.source === "room_event" ? (
                            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[color:var(--loombus-border-muted)] pt-4">
                              {(["going", "interested"] as const).map((response) => {
                                const selected = item.response === response;
                                return (
                                  <button
                                    key={response}
                                    type="button"
                                    aria-pressed={selected}
                                    disabled={workingKey !== null}
                                    onClick={() =>
                                      void respondToRoomEvent(item, selected ? "none" : response)
                                    }
                                    className={`min-h-11 border-b-2 px-0.5 py-2 text-xs font-semibold capitalize transition disabled:opacity-50 motion-reduce:transition-none ${focusClass} ${
                                      selected
                                        ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                                        : "border-transparent text-[color:var(--loombus-text-muted)] hover:border-[color:var(--loombus-border)] hover:text-[color:var(--loombus-text)]"
                                    }`}
                                  >
                                    {response}
                                  </button>
                                );
                              })}
                              <Link
                                href={item.href}
                                className={`ml-auto min-h-11 border-b border-[color:var(--loombus-border)] py-2 text-xs font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
                              >
                                Open Room
                              </Link>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-8 xl:border-l xl:border-[color:var(--loombus-border)] xl:pl-7">
            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">
                  Schedule overview
                </p>
                <CalendarClock aria-hidden="true" className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <dl className="mt-4 grid grid-cols-2 border-y border-[color:var(--loombus-border-muted)]">
                <div className="py-4 pr-4">
                  <dt className="text-xs text-[color:var(--loombus-text-muted)]">Total</dt>
                  <dd className="mt-1 text-2xl font-semibold">{counts.all}</dd>
                </div>
                <div className="border-l border-[color:var(--loombus-border-muted)] py-4 pl-4">
                  <dt className="text-xs text-[color:var(--loombus-text-muted)]">Next 7 days</dt>
                  <dd className="mt-1 text-2xl font-semibold">{nextSevenDaysCount}</dd>
                </div>
              </dl>
              <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                {calendarFilters.slice(1).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectFilter(option.value)}
                    className={`flex min-h-11 w-full items-center justify-between py-3 text-left text-sm font-semibold transition hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
                  >
                    <span>{option.shortLabel}</span>
                    <span className="text-[color:var(--loombus-gold)]">{counts[option.value]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">
                Next on your calendar
              </p>
              {nextItem ? (
                <Link href={nextItem.href} className={`mt-4 block ${focusClass}`}>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--loombus-gold)]">
                    <SourceIcon source={nextItem.source} size={14} />
                    {sourceLabel(nextItem.source)}
                  </div>
                  <h3 className="mt-2 font-semibold leading-snug">{nextItem.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                    {formatEventDateRange(nextItem.startsAt, nextItem.endsAt, nextItem.timezone)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 border-b border-[color:var(--loombus-border)] pb-1 text-xs font-semibold text-[color:var(--loombus-gold)]">
                    Open item
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ) : (
                <p className="mt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  No upcoming calendar item is available yet.
                </p>
              )}
            </section>

            <section className="border-b border-[color:var(--loombus-border)] pb-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">
                Scheduling areas
              </p>
              <div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)]">
                {[
                  ["Browse Events", "/events"],
                  ["Event Studio", "/events/manage"],
                  ["Private Rooms", "/rooms"],
                  ["Appointments", "/appointments"],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex min-h-11 items-center justify-between py-3 text-sm font-semibold transition hover:text-[color:var(--loombus-gold)] motion-reduce:transition-none ${focusClass}`}
                  >
                    {label}
                    <ChevronRight aria-hidden="true" className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="pb-2">
              <div className="flex gap-3">
                <DoorOpen aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <div>
                  <h3 className="font-semibold">Private by design</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Private Room dates appear here for you without exposing Room context publicly.
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
