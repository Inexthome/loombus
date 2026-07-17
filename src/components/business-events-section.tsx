"use client";

import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import {
  eventLocationLabel,
  formatEventDateRange,
  type PublicEvent,
} from "@/lib/events";

export default function BusinessEventsSection({ businessSlug }: { businessSlug: string }) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ businessSlug, limit: "6" });
    void fetch(`/api/events?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => {
        if (active) setEvents(Array.isArray(payload.events) ? payload.events : []);
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [businessSlug]);

  if (!loaded || events.length === 0) return null;

  return (
    <section className="bg-[var(--loombus-page-bg)] px-4 pb-10 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Loombus Events
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Upcoming events from this business</h2>
          </div>
          <Link href="/events" className="text-sm font-semibold">Browse all</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} href={`/events/${event.slug}`} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <span className="text-xs font-semibold text-[var(--loombus-text-subtle)]">{event.category}</span>
              <h3 className="mt-2 text-lg font-semibold leading-snug">{event.title}</h3>
              <div className="mt-4 space-y-2 text-xs text-[var(--loombus-text-muted)]">
                <span className="flex items-start gap-2"><CalendarDays size={14} className="mt-0.5 shrink-0" /> {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}</span>
                <span className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0" /> {eventLocationLabel(event)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
