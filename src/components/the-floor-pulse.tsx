"use client";

import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Activity,
  BookOpenCheck,
  CalendarClock,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSearch,
  MessageCircle,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type PulseType = "research" | "thesis" | "outcome" | "live" | "academy" | "announcement";
export type PulseEvent = {
  id: string;
  event_type: PulseType;
  title: string;
  summary: string;
  href: string;
  occurred_at: string;
  floor_posts: Array<{ id: string }> | null;
};

const pulseLabels: Record<PulseType, string> = {
  research: "Research",
  thesis: "Thesis",
  outcome: "Outcome",
  live: "Live",
  academy: "Academy",
  announcement: "Loombus",
};

const pulseIcons = {
  research: FileSearch,
  thesis: ScrollText,
  outcome: ShieldCheck,
  live: CalendarClock,
  academy: BookOpenCheck,
  announcement: Activity,
} satisfies Record<PulseType, typeof Activity>;

function relativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(elapsed / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function TheFloorPulse({
  onDiscuss,
}: {
  onDiscuss: (event: PulseEvent) => void;
}) {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<PulseType | "all">("all");
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const now = new Date().toISOString();
    const { data: pulseRows, error } = await supabase
      .from("floor_pulse_events")
      .select("id,event_type,title,summary,href,occurred_at,floor_posts(id)")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("occurred_at", { ascending: false })
      .limit(24);

    if (error) {
      setReady(true);
      return;
    }

    const nextEvents = (pulseRows ?? []) as unknown as PulseEvent[];
    const { data: readRows } = nextEvents.length
      ? await supabase
          .from("floor_pulse_event_reads")
          .select("event_id")
          .eq("user_id", auth.user.id)
          .in("event_id", nextEvents.map((event) => event.id))
      : { data: [] as Array<{ event_id: string }> };
    const nextReadIds = new Set((readRows ?? []).map((row) => row.event_id));
    setUserId(auth.user.id);
    setEvents(nextEvents);
    setReadIds(nextReadIds);
    setCollapsed(nextEvents.length > 0 && nextEvents.every((event) => nextReadIds.has(event.id)));
    setReady(true);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void load(), 0);
    const channel = supabase
      .channel("the-floor:pulse")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_pulse_events" },
        () => void load()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "floor_posts" },
        () => void load()
      )
      .subscribe();
    return () => {
      window.clearTimeout(initialLoad);
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const unreadCount = useMemo(
    () => events.filter((event) => !readIds.has(event.id)).length,
    [events, readIds]
  );
  const filtered = useMemo(
    () => events.filter((event) => filter === "all" || event.event_type === filter),
    [events, filter]
  );
  const visible = expanded ? filtered.slice(0, 12) : filtered.slice(0, 3);
  const availableFilters = useMemo(
    () => Array.from(new Set(events.map((event) => event.event_type))),
    [events]
  );

  async function markRead(eventIds: string[]) {
    if (!userId || !eventIds.length) return;
    setReadIds((current) => new Set([...current, ...eventIds]));
    await supabase.from("floor_pulse_event_reads").upsert(
      eventIds.map((eventId) => ({ event_id: eventId, user_id: userId, read_at: new Date().toISOString() })),
      { onConflict: "event_id,user_id" }
    );
  }

  if (!ready || !events.length) return null;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-lg shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="flex min-w-0 items-center gap-3 text-left"
          aria-expanded={!collapsed}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
            <Activity className="size-5" aria-hidden="true" />
          </span>
          <span>
            <span className="flex items-center gap-2 text-sm font-black">
              Floor Pulse
              {unreadCount ? (
                <span className="rounded-full bg-[var(--loombus-gold)] px-2 py-0.5 text-[10px] text-black">
                  {unreadCount} new
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-[var(--loombus-text-muted)]">
              Research, theses, programming, and outcomes worth discussing
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          {unreadCount ? (
            <button
              type="button"
              onClick={() => void markRead(events.filter((event) => !readIds.has(event.id)).map((event) => event.id))}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-black"
            >
              <CheckCheck className="size-3.5" aria-hidden="true" /> Mark read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Open Floor Pulse" : "Collapse Floor Pulse"}
            className="grid size-9 place-items-center rounded-full border border-[var(--loombus-border)]"
          >
            {collapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          </button>
        </div>
      </div>

      {!collapsed ? (
        <div className="border-t border-[var(--loombus-border)] px-4 pb-4 pt-3 sm:px-5">
          {availableFilters.length > 1 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {(["all", ...availableFilters] as Array<PulseType | "all">).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black ${filter === item ? "bg-[var(--loombus-gold)] text-black" : "bg-[var(--loombus-page-bg)] text-[var(--loombus-text-muted)]"}`}
                >
                  {item === "all" ? "All" : pulseLabels[item]}
                </button>
              ))}
            </div>
          ) : null}

          <div className="divide-y divide-[var(--loombus-border-muted)]">
            {visible.map((event) => {
              const Icon = pulseIcons[event.event_type];
              const discussionId = event.floor_posts?.[0]?.id;
              const unread = !readIds.has(event.id);
              return (
                <article key={event.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="flex min-w-0 gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--loombus-page-bg)] text-[var(--loombus-gold)]">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--loombus-gold)]">
                          {pulseLabels[event.event_type]}
                        </span>
                        <time className="text-[10px] font-bold text-[var(--loombus-text-subtle)]">
                          {relativeTime(event.occurred_at)}
                        </time>
                        {unread ? <span className="size-1.5 rounded-full bg-[var(--loombus-gold)]" aria-label="Unread" /> : null}
                      </div>
                      <h3 className="mt-1 truncate text-sm font-black">{event.title}</h3>
                      {event.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--loombus-text-muted)]">
                          {event.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="ml-11 flex gap-2 sm:ml-0">
                    <Link
                      href={event.href}
                      onClick={() => void markRead([event.id])}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 text-[11px] font-black"
                    >
                      Open <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                    {discussionId ? (
                      <Link
                        href={`/the-floor/discussion#post-${discussionId}`}
                        onClick={() => void markRead([event.id])}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--loombus-gold)] px-3 text-[11px] font-black text-black"
                      >
                        Join discussion
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          void markRead([event.id]);
                          onDiscuss(event);
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--loombus-gold)] px-3 text-[11px] font-black text-black"
                      >
                        <MessageCircle className="size-3" aria-hidden="true" /> Discuss this
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {filtered.length > 3 ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 w-full rounded-xl border border-[var(--loombus-border)] py-2 text-xs font-black text-[var(--loombus-gold)]"
            >
              {expanded ? "Show fewer updates" : `View all activity (${filtered.length})`}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
