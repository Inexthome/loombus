"use client";

import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarClock,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCw,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import { getNativePlatform } from "@/lib/native-app";
import {
  getAppointmentLiveUpdateStatus,
  isEligibleForLiveUpdate,
  reconcileAppointmentLiveUpdates,
  startAppointmentLiveUpdate,
} from "@/lib/native-live-updates";

type ScheduleSource = "business" | "marketplace" | "room";
type ScheduleItem = {
  id: string;
  source: ScheduleSource;
  title: string;
  context: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  status: string;
  location: string | null;
  href: string;
};

type Payload = {
  items?: ScheduleItem[];
  generatedAt?: string;
  error?: string;
};

type Filter = "upcoming" | "all" | "pending" | ScheduleSource;

function sourceLabel(source: ScheduleSource) {
  if (source === "marketplace") return "Marketplace";
  if (source === "room") return "Room";
  return "Business";
}

function SourceIcon({ source }: { source: ScheduleSource }) {
  if (source === "marketplace") return <Store aria-hidden="true" />;
  if (source === "room") return <Building2 aria-hidden="true" />;
  return <CalendarClock aria-hidden="true" />;
}

function dateRange(item: ScheduleItem) {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: item.timezone || undefined,
  };
  const formatter = new Intl.DateTimeFormat(undefined, options);
  const start = formatter.format(new Date(item.startsAt));
  if (!item.endsAt) return start;
  return `${start} to ${formatter.format(new Date(item.endsAt))}`;
}

function isPending(status: string) {
  return status === "pending" || status === "time proposed";
}

export default function UnifiedAppointmentsOverview() {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [liveUpdateWorking, setLiveUpdateWorking] = useState(false);
  const [liveUpdateStartedId, setLiveUpdateStartedId] = useState<string | null>(null);
  const [liveUpdatesAvailable, setLiveUpdatesAvailable] = useState(false);
  const [nativePlatform] = useState(() => getNativePlatform());

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/unified",
        { cache: "no-store" },
        "/appointments"
      );
      const payload = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load your Loombus schedule.");
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
      const generatedAt = Date.parse(payload.generatedAt ?? "");
      setCurrentTime(Number.isFinite(generatedAt) ? generatedAt : new Date().getTime());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load your Loombus schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (nativePlatform !== "ios" && nativePlatform !== "android") return;

    void getAppointmentLiveUpdateStatus()
      .then((status) => setLiveUpdatesAvailable(status.supported))
      .catch(() => setLiveUpdatesAvailable(false));

    if (!items.length) return;
    void reconcileAppointmentLiveUpdates(items)
      .then((activeIds) => setLiveUpdateStartedId(activeIds[0] ?? null))
      .catch(() => {
        // Existing live surfaces reconcile again on the next schedule refresh.
      });
  }, [items, nativePlatform]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const startsAt = new Date(item.startsAt).getTime();
      if (filter === "upcoming") {
        return startsAt >= currentTime && !["declined", "cancelled", "completed"].includes(item.status);
      }
      if (filter === "pending") return isPending(item.status);
      if (filter === "business" || filter === "marketplace" || filter === "room") {
        return item.source === filter;
      }
      return true;
    });
  }, [currentTime, filter, items]);

  const liveUpdateCandidate = useMemo(
    () => items.find((item) => isEligibleForLiveUpdate(item, currentTime)) ?? null,
    [currentTime, items]
  );

  async function startLiveUpdate() {
    if (!liveUpdateCandidate || liveUpdateWorking) return;

    setLiveUpdateWorking(true);
    setNotice("");
    try {
      await startAppointmentLiveUpdate(liveUpdateCandidate);
      setLiveUpdateStartedId(liveUpdateCandidate.id);
      setNotice(
        `Live update started for ${liveUpdateCandidate.title}. Loombus will refresh or close it when your schedule next syncs.`
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The appointment live update could not be started.");
    } finally {
      setLiveUpdateWorking(false);
    }
  }

  const filters: Array<{ key: Filter; label: string }> = [
    { key: "upcoming", label: "Upcoming" },
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "business", label: "Business" },
    { key: "marketplace", label: "Marketplace" },
    { key: "room", label: "Rooms" },
  ];

  return (
    <section
      data-appointments-editorial="schedule"
      className="mb-10 border-y border-[color:var(--loombus-border)]"
    >
      <div className="flex flex-col gap-5 py-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
            Your Loombus schedule
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
            Appointments, pickups, and Room reservations
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            One timeline for bookings across Loombus, with each entry linked back to its original business, Marketplace listing, or Room.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(nativePlatform === "ios" || nativePlatform === "android") &&
          liveUpdatesAvailable &&
          liveUpdateCandidate ? (
            <button
              type="button"
              onClick={() => void startLiveUpdate()}
              disabled={liveUpdateWorking || liveUpdateStartedId === liveUpdateCandidate.id}
              className="inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 text-sm font-semibold disabled:opacity-60"
            >
              <Activity aria-hidden="true" className="h-4 w-4" />
              {liveUpdateWorking
                ? "Starting…"
                : liveUpdateStartedId === liveUpdateCandidate.id
                  ? "Live update active"
                  : "Show live update"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
          >
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-6 overflow-x-auto border-t border-[color:var(--loombus-border-muted)]" role="tablist" aria-label="Schedule filters">
        {filters.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={filter === option.key}
            onClick={() => setFilter(option.key)}
            className={`shrink-0 border-b-2 py-3 text-sm font-semibold transition ${
              filter === option.key
                ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {notice ? (
        <p role="alert" className="my-5 border-l-2 border-[color:var(--loombus-gold)] py-2 pl-4 text-sm">
          {notice}
        </p>
      ) : loading && items.length === 0 ? (
        <p className="border-t border-[color:var(--loombus-border-muted)] py-8 text-sm text-[color:var(--loombus-text-muted)]">
          Loading your schedule…
        </p>
      ) : visibleItems.length === 0 ? (
        <div className="border-t border-[color:var(--loombus-border-muted)] py-8">
          <CalendarClock className="h-7 w-7 text-[color:var(--loombus-gold)]" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold">Nothing in this view</h3>
          <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
            New appointments, pickup times, and Room reservations will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[color:var(--loombus-border-muted)] border-t border-[color:var(--loombus-border-muted)]">
          {visibleItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-start gap-4 py-5 transition sm:py-6"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center border border-[color:var(--loombus-border)] text-[color:var(--loombus-gold)] [&>svg]:h-5 [&>svg]:w-5">
                <SourceIcon source={item.source} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <strong className="text-base">{item.title}</strong>
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--loombus-gold)]">
                    {sourceLabel(item.source)}
                  </span>
                  <span className="text-xs font-semibold capitalize text-[color:var(--loombus-text-muted)]">
                    {item.status}
                  </span>
                </span>
                <span className="mt-1 block text-sm font-medium text-[color:var(--loombus-text-muted)]">
                  {item.context}
                </span>
                <span className="mt-3 flex items-start gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
                  {dateRange(item)}
                </span>
                {item.location ? (
                  <span className="mt-2 flex items-start gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
                    {item.location}
                  </span>
                ) : null}
              </span>
              <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-[color:var(--loombus-text-subtle)] transition group-hover:text-[color:var(--loombus-gold)]" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
