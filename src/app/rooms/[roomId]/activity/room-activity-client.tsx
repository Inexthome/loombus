"use client";

import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  Landmark,
  Loader2,
  MessageSquareText,
  RefreshCw,
  UserRoundCheck,
  Vote,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

type ModuleKey = "discussions" | "calendar" | "reservations" | "maintenance" | "documents" | "polls" | "guests" | "finance";
type ActivityItem = {
  id: string;
  module: ModuleKey;
  title: string;
  detail: string | null;
  occurredAt: string;
  actorName: string | null;
  href: string;
};
type Payload = {
  room: { id: string; name: string };
  access: { canManage: boolean };
  items: ActivityItem[];
  error?: string;
};

const filters: Array<{ key: "all" | ModuleKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "discussions", label: "Discussions" },
  { key: "calendar", label: "Calendar" },
  { key: "reservations", label: "Reservations" },
  { key: "maintenance", label: "Maintenance" },
  { key: "documents", label: "Documents" },
  { key: "polls", label: "Polls" },
  { key: "guests", label: "Guests" },
  { key: "finance", label: "Finance" },
];

function icon(module: ModuleKey): ReactNode {
  if (module === "discussions") return <MessageSquareText aria-hidden="true" />;
  if (module === "calendar" || module === "reservations") return <CalendarDays aria-hidden="true" />;
  if (module === "maintenance") return <ClipboardList aria-hidden="true" />;
  if (module === "documents") return <FileText aria-hidden="true" />;
  if (module === "polls") return <Vote aria-hidden="true" />;
  if (module === "guests") return <UserRoundCheck aria-hidden="true" />;
  return <Landmark aria-hidden="true" />;
}

function relativeTime(value: string, now: number) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Recently";
  const seconds = Math.max(0, Math.floor((now - time) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString();
}

export default function RoomActivityClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [filter, setFilter] = useState<"all" | ModuleKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/activity`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok) throw new Error(result.error || "Room activity could not load.");
      setPayload(result);
      setLoadedAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room activity could not load.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  const visibleItems = useMemo(
    () => payload?.items.filter((entry) => filter === "all" || entry.module === filter) ?? [],
    [filter, payload]
  );

  return (
    <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6">
      <div className="rooms-live-shell mx-auto max-w-5xl space-y-6">
        <header className="room-workspace-hero">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Room activity</p>
            <h1>{payload?.room.name ? `${payload.room.name} activity` : "Room activity"}</h1>
            <p>One private timeline for discussions, events, operations, documents, voting, guests, and finance.</p>
          </div>
          <button type="button" className="rooms-live-secondary-action !min-h-11" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "is-spinning" : undefined} /> Refresh
          </button>
        </header>

        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Activity filters">
          {filters.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setFilter(entry.key)}
              aria-pressed={filter === entry.key}
              className={filter === entry.key ? "rooms-live-primary-action !min-h-10 whitespace-nowrap" : "rooms-live-secondary-action !min-h-10 whitespace-nowrap"}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {error ? <div className="room-expansion-notice is-error" role="alert">{error}</div> : null}
        {loading && !payload ? <div className="room-expansion-loading"><Loader2 className="is-spinning" /> Loading activity…</div> : null}

        {!loading && payload && visibleItems.length === 0 ? (
          <div className="room-expansion-form text-center">
            <Activity className="mx-auto h-8 w-8 text-[var(--muted)]" />
            <h2 className="mt-3">No recent Room activity</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Activity will appear here as members and managers use the Room.</p>
          </div>
        ) : null}

        <section className="space-y-3" aria-label="Room activity timeline">
          {visibleItems.map((entry) => (
            <Link key={entry.id} href={entry.href} className="flex gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] text-[var(--muted)]">
                {icon(entry.module)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--text)]">{entry.title}</span>
                {entry.detail ? <span className="mt-1 block truncate text-sm text-[var(--muted)]">{entry.detail}</span> : null}
                <span className="mt-2 block text-xs text-[var(--muted)]">{relativeTime(entry.occurredAt, loadedAt)}</span>
              </span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
