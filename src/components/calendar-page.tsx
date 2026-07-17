"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarDays,
  DoorOpen,
  RefreshCw,
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

function SourceIcon({ source }: { source: CalendarItem["source"] }) {
  if (source === "room_event") return <DoorOpen size={18} />;
  if (source === "appointment") return <BriefcaseBusiness size={18} />;
  return <Users size={18} />;
}

export default function CalendarPage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | CalendarItem["source"]>("all");
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

  const visibleItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.source === filter)),
    [filter, items]
  );

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

  const counts = useMemo(
    () => ({
      public_event: items.filter((item) => item.source === "public_event").length,
      room_event: items.filter((item) => item.source === "room_event").length,
      appointment: items.filter((item) => item.source === "appointment").length,
    }),
    [items]
  );

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                My Loombus Calendar
              </p>
              <h1 className="mt-2 text-4xl font-semibold">One place for the dates that matter.</h1>
              <p className="mt-3 max-w-2xl text-[var(--loombus-text-muted)]">
                Public Events you saved, private Room dates, and appointment requests appear together without exposing private Room context publicly.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Public Events</span><strong className="mt-1 block text-2xl">{counts.public_event}</strong></article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Private Room dates</span><strong className="mt-1 block text-2xl">{counts.room_event}</strong></article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Appointments</span><strong className="mt-1 block text-2xl">{counts.appointment}</strong></article>
          </div>
        </header>

        <section className="flex flex-wrap gap-2 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4" aria-label="Calendar filters">
          {[
            ["all", "All"],
            ["public_event", "Public Events"],
            ["room_event", "Private Rooms"],
            ["appointment", "Appointments"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value as typeof filter)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                filter === value
                  ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                  : "border border-[var(--loombus-border)]"
              }`}
            >
              {label}
            </button>
          ))}
        </section>

        {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="alert">{notice}</div> : null}

        {loading ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-[var(--loombus-text-muted)]">Loading your calendar…</section>
        ) : grouped.length === 0 ? (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <CalendarDays className="mx-auto text-[var(--loombus-text-subtle)]" size={42} />
            <h2 className="mt-4 text-2xl font-semibold">Nothing is scheduled in this view.</h2>
            <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/events" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Browse Events</Link><Link href="/rooms" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Open Rooms</Link><Link href="/appointments" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Open Appointments</Link></div>
          </section>
        ) : (
          <section className="space-y-5">
            {grouped.map(([date, dateItems]) => (
              <div key={date} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
                <h2 className="text-xl font-semibold">{date}</h2>
                <div className="mt-4 grid gap-3">
                  {dateItems.map((item) => (
                    <article
                      key={`${item.source}:${item.id}`}
                      className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 transition hover:border-[var(--loombus-text-subtle)]"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <Link href={item.href} className="flex min-w-0 flex-1 items-start gap-3">
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
                            <SourceIcon source={item.source} />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>{item.title}</strong>
                              <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[11px] font-semibold">
                                {sourceLabel(item.source)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                              {formatEventDateRange(item.startsAt, item.endsAt, item.timezone)}
                            </p>
                            <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">
                              {item.context}
                              {item.location ? ` · ${item.location}` : ""}
                            </p>
                          </div>
                        </Link>
                        <span className="text-xs font-semibold capitalize text-[var(--loombus-text-muted)]">
                          {item.status.replaceAll("_", " ")}
                        </span>
                      </div>

                      {item.source === "room_event" ? (
                        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--loombus-border)] pt-3">
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
                            className={`rounded-full px-4 py-2 text-xs font-semibold ${
                              item.response === "going"
                                ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                                : "border border-[var(--loombus-border)]"
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
                            className={`rounded-full px-4 py-2 text-xs font-semibold ${
                              item.response === "interested"
                                ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                                : "border border-[var(--loombus-border)]"
                            }`}
                          >
                            Interested
                          </button>
                          <Link
                            href={item.href}
                            className="ml-auto rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-semibold"
                          >
                            Open Room
                          </Link>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
