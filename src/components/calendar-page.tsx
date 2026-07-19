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
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[88rem] gap-6 xl:grid-cols-[14.5rem_minmax(0,1fr)_20rem]">
        <aside className="hidden xl:block">
          <section className="sticky top-28 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-2xl shadow-black/10">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
              Calendar views
            </p>

            <div className="space-y-2">
              {calendarFilters.map((option) => {
                const selected = filter === option.value;
                const count = counts[option.value];
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectFilter(option.value)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                      selected
                        ? "bg-[color:var(--loombus-surface-muted)] text-[#b45309]"
                        : "bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-surface)] ${
                          selected ? "text-[#b45309]" : "text-[color:var(--loombus-text-muted)]"
                        }`}
                      >
                        {option.value === "all" ? (
                          <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                        ) : (
                          <SourceIcon source={option.value} size={16} />
                        )}
                      </span>
                      <span className="truncate">{option.label}</span>
                    </span>
                    <span className="text-xs text-[#b45309]">{count}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={clearView}
              className="mt-5 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
            >
              Reset calendar view
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[color:var(--loombus-text)] sm:text-5xl">
                Calendar
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
                Review public Events, private Room dates, and Appointments in one personal calendar.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold text-[color:var(--loombus-text)] shadow-sm transition hover:border-[#b45309]"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 text-[#b45309] ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="mb-4">
            <label className="relative block">
              <span className="sr-only">Search your calendar</span>
              <Search
                aria-hidden="true"
                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]"
                strokeWidth={2.1}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search dates, titles, locations, and calendar sources"
                className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base text-[color:var(--loombus-text)] outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[#b45309] focus:ring-4 focus:ring-orange-500/10"
              />
            </label>
          </div>

          <div className="mb-7 flex gap-2 overflow-x-auto pb-1 xl:hidden" aria-label="Calendar filters">
            {calendarFilters.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectFilter(option.value)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  filter === option.value
                    ? "border-orange-200 bg-orange-50 text-[#b45309] dark:border-orange-400/30 dark:bg-orange-400/10"
                    : "border-transparent bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text)] hover:border-[color:var(--loombus-border)]"
                }`}
              >
                {option.shortLabel} · {counts[option.value]}
              </button>
            ))}
          </div>

          {notice ? (
            <div
              className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm text-[color:var(--loombus-text)]"
              role="alert"
            >
              {notice}
            </div>
          ) : null}

          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b45309]">
                Your schedule
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-[color:var(--loombus-text)]">
                {loading
                  ? "Loading calendar"
                  : `${visibleItems.length} scheduled ${visibleItems.length === 1 ? "item" : "items"}`}
              </h2>
            </div>
            {filter !== "all" || query.trim() ? (
              <button
                type="button"
                onClick={clearView}
                className="shrink-0 text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
              >
                Clear view
              </button>
            ) : null}
          </div>

          {loading ? (
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
              Loading your calendar…
            </section>
          ) : grouped.length === 0 ? (
            <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center shadow-xl shadow-black/10">
              <CalendarDays className="mx-auto text-[#b45309]" size={42} />
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-[color:var(--loombus-text)]">
                Nothing is scheduled in this view.
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Adjust the calendar source or search, or open one of the scheduling areas below.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  href="/events"
                  className="rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[#b45309]"
                >
                  Browse Events
                </Link>
                <Link
                  href="/rooms"
                  className="rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[#b45309]"
                >
                  Open Rooms
                </Link>
                <Link
                  href="/appointments"
                  className="rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[#b45309]"
                >
                  Open Appointments
                </Link>
              </div>
            </section>
          ) : (
            <section className="space-y-5">
              {grouped.map(([date, dateItems]) => (
                <section
                  key={date}
                  className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-[color:var(--loombus-border-muted)] px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#b45309] dark:bg-orange-400/10">
                        <CalendarDays aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-[color:var(--loombus-text)]">{date}</h3>
                        <p className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                          {dateItems.length} {dateItems.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                    {dateItems.map((item) => (
                      <article key={`${item.source}:${item.id}`} className="p-5 sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <Link href={item.href} className="flex min-w-0 flex-1 items-start gap-4">
                            <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] text-[#b45309]">
                              <SourceIcon source={item.source} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#b45309] dark:bg-orange-400/10">
                                  {sourceLabel(item.source)}
                                </span>
                                <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold capitalize text-[color:var(--loombus-text-muted)]">
                                  {item.status.replaceAll("_", " ")}
                                </span>
                              </div>
                              <h4 className="mt-3 text-xl font-semibold leading-snug tracking-[-0.025em] text-[color:var(--loombus-text)]">
                                {item.title}
                              </h4>
                              <div className="mt-3 space-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                                <p className="flex items-start gap-2">
                                  <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
                                  <span>{formatEventDateRange(item.startsAt, item.endsAt, item.timezone)}</span>
                                </p>
                                <p className="flex items-start gap-2">
                                  <Sparkles aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
                                  <span>{item.context}</span>
                                </p>
                                {item.location ? (
                                  <p className="flex items-start gap-2">
                                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#b45309]" />
                                    <span>{item.location}</span>
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </Link>

                          <Link
                            href={item.href}
                            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-xs font-semibold text-[color:var(--loombus-text)] transition hover:border-[#b45309]"
                          >
                            Open
                            <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-[#b45309]" />
                          </Link>
                        </div>

                        {item.source === "room_event" ? (
                          <div className="mt-5 flex flex-wrap gap-2 border-t border-[color:var(--loombus-border-muted)] pt-4">
                            <button
                              type="button"
                              aria-pressed={item.response === "going"}
                              disabled={workingKey !== null}
                              onClick={() =>
                                void respondToRoomEvent(
                                  item,
                                  item.response === "going" ? "none" : "going"
                                )
                              }
                              className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                item.response === "going"
                                  ? "bg-[#b45309] text-white"
                                  : "border border-[color:var(--loombus-border)] text-[color:var(--loombus-text)] hover:border-[#b45309]"
                              }`}
                            >
                              Going
                            </button>
                            <button
                              type="button"
                              aria-pressed={item.response === "interested"}
                              disabled={workingKey !== null}
                              onClick={() =>
                                void respondToRoomEvent(
                                  item,
                                  item.response === "interested" ? "none" : "interested"
                                )
                              }
                              className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                                item.response === "interested"
                                  ? "bg-[#b45309] text-white"
                                  : "border border-[color:var(--loombus-border)] text-[color:var(--loombus-text)] hover:border-[#b45309]"
                              }`}
                            >
                              Interested
                            </button>
                            <Link
                              href={item.href}
                              className="ml-auto rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-xs font-semibold transition hover:border-[#b45309]"
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
            </section>
          )}
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-28 space-y-5">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
                  Schedule overview
                </p>
                <CalendarClock aria-hidden="true" className="h-5 w-5 text-[#b45309]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                    Total
                  </span>
                  <strong className="mt-1 block text-2xl text-[color:var(--loombus-text)]">
                    {counts.all}
                  </strong>
                </article>
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                    Next 7 days
                  </span>
                  <strong className="mt-1 block text-2xl text-[color:var(--loombus-text)]">
                    {nextSevenDaysCount}
                  </strong>
                </article>
              </div>

              <div className="mt-3 space-y-2">
                {calendarFilters.slice(1).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => selectFilter(option.value)}
                    className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                  >
                    <span>{option.shortLabel}</span>
                    <span className="text-[#b45309]">{counts[option.value]}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
                Next on your calendar
              </p>

              {nextItem ? (
                <Link
                  href={nextItem.href}
                  className="mt-5 block rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-[#b45309]">
                    <SourceIcon source={nextItem.source} size={14} />
                    {sourceLabel(nextItem.source)}
                  </div>
                  <h3 className="mt-2 font-semibold leading-snug text-[color:var(--loombus-text)]">
                    {nextItem.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                    {formatEventDateRange(nextItem.startsAt, nextItem.endsAt, nextItem.timezone)}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#b45309]">
                    Open item
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ) : (
                <div className="mt-5 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  No upcoming calendar item is available yet.
                </div>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
                Scheduling areas
              </p>

              <div className="mt-4 space-y-2">
                <Link
                  href="/events"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Browse Events
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/events/manage"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Event Studio
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/rooms"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Private Rooms
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/appointments"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Appointments
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#b45309] dark:bg-orange-400/10">
                  <DoorOpen aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-[color:var(--loombus-text)]">Private by design</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Private Room dates appear here for you without exposing Room context publicly.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
