"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ROOM_MODELS } from "@/app/rooms/rooms-v2-model";

type RoomRole = "owner" | "administrator" | "moderator" | "member";
type RoomFilter = "all" | "owned" | "joined";

type RoomEventSummary = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
};

type LiveRoomSummary = {
  id: string;
  name: string;
  description: string;
  roomType: string;
  visibility: string;
  inviteOnly: boolean;
  status: string;
  ownerId: string;
  createdBy: string;
  templateKey: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  memberLimit: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  role: RoomRole;
  memberCount: number;
  postCount: number;
  eventCount: number;
  announcementCount: number;
  latestActivityAt: string | null;
  nextEvent: RoomEventSummary | null;
};

type RoomsResponse = {
  generatedAt?: string;
  rooms?: LiveRoomSummary[];
  summary?: {
    total: number;
    owned: number;
    joined: number;
    upcomingEvents: number;
  };
  error?: string;
};

const FILTERS: Array<{ value: RoomFilter; label: string }> = [
  { value: "all", label: "All Rooms" },
  { value: "owned", label: "Owned" },
  { value: "joined", label: "Joined" },
];

function roleLabel(role: RoomRole) {
  if (role === "owner") return "Owner";
  if (role === "administrator") return "Administrator";
  if (role === "moderator") return "Moderator";
  return "Member";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No date";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No recent activity";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No recent activity";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : formatDateTime(value);
}

function invitationToken(value: string) {
  const input = value.trim();
  if (!input) return null;
  const pattern = /^[A-Za-z0-9_-]{20,300}$/;
  if (pattern.test(input)) return input;
  try {
    const invitation = new URL(input, "https://loombus.com");
    if (invitation.pathname.replace(/\/+$/, "") !== "/rooms/join") return null;
    const token = invitation.searchParams.get("token")?.trim() ?? "";
    return pattern.test(token) ? token : null;
  } catch {
    return null;
  }
}

function signalCount(filter: RoomFilter, summary: NonNullable<RoomsResponse["summary"]>) {
  if (filter === "all") return summary.total;
  if (filter === "owned") return summary.owned;
  return summary.joined;
}

export default function RoomsDirectoryV3() {
  const [rooms, setRooms] = useState<LiveRoomSummary[]>([]);
  const [summary, setSummary] = useState<NonNullable<RoomsResponse["summary"]>>({
    total: 0,
    owned: 0,
    joined: 0,
    upcomingEvents: 0,
  });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RoomFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteInput, setInviteInput] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadRooms = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        window.location.href = "/login?next=/rooms";
        return;
      }
      const response = await fetch("/api/rooms", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as RoomsResponse;
      if (!response.ok) throw new Error(result.error || "Unable to load your Rooms.");
      const nextRooms = Array.isArray(result.rooms) ? result.rooms : [];
      setRooms(nextRooms);
      setSummary(
        result.summary ?? {
          total: nextRooms.length,
          owned: nextRooms.filter((room) => room.role === "owner").length,
          joined: nextRooms.filter((room) => room.role !== "owner").length,
          upcomingEvents: nextRooms.filter((room) => room.nextEvent).length,
        }
      );
      setGeneratedAt(result.generatedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load your Rooms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    const refresh = () => void loadRooms(true);
    const channel = supabase
      .channel("rooms-directory-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_posts" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_events" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_announcements" }, refresh)
      .subscribe((status) => setRealtimeConnected(status === "SUBSCRIBED"));
    const interval = window.setInterval(refresh, 45_000);
    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [loadRooms]);

  const visibleRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (filter === "owned" && room.role !== "owner") return false;
      if (filter === "joined" && room.role === "owner") return false;
      if (!normalized) return true;
      return [room.name, room.description, room.roomType, roleLabel(room.role)]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, query, rooms]);

  const upcomingRooms = useMemo(
    () =>
      rooms
        .filter((room) => room.nextEvent)
        .sort(
          (left, right) =>
            new Date(left.nextEvent?.startsAt ?? 0).getTime() -
            new Date(right.nextEvent?.startsAt ?? 0).getTime()
        )
        .slice(0, 5),
    [rooms]
  );

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = invitationToken(inviteInput);
    if (!token) {
      setInviteMessage("Paste a complete Loombus Room invitation link or valid token.");
      return;
    }
    window.location.assign(`/rooms/join?token=${encodeURIComponent(token)}`);
  }

  return (
    <main
      data-rooms-editorial="directory"
      className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6 lg:px-8 lg:py-12"
      aria-busy={loading || refreshing}
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-[var(--loombus-border)] pb-7 sm:pb-9">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="m-0 text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">
                Private workspaces
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                Rooms
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
                Open your private communities, teams, classes, support spaces, and shared
                operating rooms from one focused directory.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/rooms/new"
                className="inline-flex min-h-11 items-center gap-2 border border-[var(--loombus-gold)] px-4 py-2.5 text-sm font-bold text-[var(--loombus-text)] no-underline transition-colors hover:bg-[color:rgba(203,171,91,0.1)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Create Room
              </Link>
              <button
                type="button"
                onClick={() => void loadRooms(true)}
                disabled={refreshing}
                className="inline-flex min-h-11 items-center gap-2 border-0 border-b border-[var(--loombus-border)] bg-transparent px-1 py-2.5 text-sm font-bold text-[var(--loombus-text-muted)] disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <section aria-label="Room signals" className="grid border-b border-[var(--loombus-border)] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Active", summary.total],
            ["Owned", summary.owned],
            ["Joined", summary.joined],
            ["With dates", summary.upcomingEvents],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`py-4 ${index > 0 ? "sm:border-l sm:border-[var(--loombus-border)] sm:pl-5" : ""}`}
            >
              <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">{label}</span>
              <strong className="mt-1 block text-xl font-semibold tracking-tight">{value}</strong>
            </div>
          ))}
        </section>

        <section className="border-b border-[var(--loombus-border)] py-5" aria-label="Room status">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
            <span className="inline-flex items-center gap-2">
              {realtimeConnected ? <Wifi className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" /> : <WifiOff className="h-4 w-4" aria-hidden="true" />}
              {realtimeConnected ? "Live updates connected" : "Refresh fallback active"}
            </span>
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden="true" />Membership verified server-side</span>
            {generatedAt ? (
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4" aria-hidden="true" />Updated {formatRelativeTime(generatedAt)}</span>
            ) : null}
          </div>
        </section>

        {message ? (
          <div className="border-b border-[var(--loombus-border)] py-4 text-sm font-semibold text-red-700" role="alert">
            {message}
          </div>
        ) : null}

        <section className="py-6" aria-labelledby="rooms-directory-heading">
          <div className="flex flex-col gap-5 border-b border-[var(--loombus-border)] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Browse Rooms</p>
              <h2 id="rooms-directory-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Your private spaces</h2>
            </div>
            <label className="flex min-h-11 w-full max-w-xl items-center gap-3 border-b border-[var(--loombus-border)] py-2 text-[var(--loombus-text-subtle)] focus-within:border-[var(--loombus-gold)]">
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="sr-only">Search your Rooms</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Room name, purpose, type, or role"
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)]"
              />
            </label>
          </div>

          <nav aria-label="Room filters" className="flex gap-6 overflow-x-auto border-b border-[var(--loombus-border)] pt-2">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className={`shrink-0 border-0 border-b-2 bg-transparent px-0 py-4 text-sm font-bold ${
                  filter === item.value
                    ? "border-[var(--loombus-gold)] text-[var(--loombus-text)]"
                    : "border-transparent text-[var(--loombus-text-muted)]"
                }`}
              >
                {item.label} <span className="ml-1 text-xs font-semibold text-[var(--loombus-text-subtle)]">{signalCount(item.value, summary)}</span>
              </button>
            ))}
          </nav>

          {loading ? (
            <div className="border-b border-[var(--loombus-border)] py-12 text-sm text-[var(--loombus-text-muted)]" role="status">
              Opening your verified Room directory…
            </div>
          ) : visibleRooms.length > 0 ? (
            <div className="divide-y divide-[var(--loombus-border)]">
              {visibleRooms.map((room) => (
                <article key={room.id} className="grid gap-5 py-7 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-10">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-[var(--loombus-text-muted)]">
                      <span className="inline-flex items-center gap-1.5 text-[var(--loombus-gold)]"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{roleLabel(room.role)}</span>
                      <span className="inline-flex items-center gap-1.5"><LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />Private</span>
                      <span className="capitalize">{room.roomType.replaceAll("_", " ")}</span>
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{room.name}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">{room.description}</p>
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[var(--loombus-text-subtle)]">
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden="true" />{room.memberCount} members</span>
                      <span className="inline-flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />{room.postCount} discussions</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{room.eventCount} events</span>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col justify-between gap-4 border-l-0 border-[var(--loombus-border)] lg:border-l lg:pl-6">
                    {room.nextEvent ? (
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Next date</p>
                        <strong className="mt-2 block text-sm leading-6">{room.nextEvent.title}</strong>
                        <span className="mt-1 block text-xs leading-5 text-[var(--loombus-text-muted)]">{formatDateTime(room.nextEvent.startsAt)}</span>
                        {room.nextEvent.location ? <span className="block text-xs leading-5 text-[var(--loombus-text-subtle)]">{room.nextEvent.location}</span> : null}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> No upcoming Room event
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 text-xs">
                      <span className="text-[var(--loombus-text-subtle)]">Activity {formatRelativeTime(room.latestActivityAt)}</span>
                      <Link href={`/rooms/${encodeURIComponent(room.id)}`} className="inline-flex items-center gap-1.5 font-extrabold text-[var(--loombus-gold)] no-underline">
                        Open Room <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : rooms.length > 0 ? (
            <div className="border-b border-[var(--loombus-border)] py-10">
              <h3 className="text-lg font-semibold">No Room matches those filters.</h3>
              <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Clear the search or choose another Room group.</p>
              <button type="button" onClick={() => { setQuery(""); setFilter("all"); }} className="mt-4 border-0 border-b border-[var(--loombus-gold)] bg-transparent px-0 py-1 text-sm font-bold text-[var(--loombus-text)]">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="py-8">
              <section className="border-b border-[var(--loombus-border)] pb-8">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Start a private workspace</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Create your first private Room.</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Start free or choose a paid Room plan for larger operating tools.</p>
                <Link href="/rooms/new" className="mt-5 inline-flex items-center gap-2 border-b border-[var(--loombus-gold)] py-1 text-sm font-extrabold text-[var(--loombus-text)] no-underline">
                  Create your first Room <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </section>
              <section className="pt-8" aria-labelledby="room-models-heading">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Room models</p>
                <h3 id="room-models-heading" className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Start with a structure that matches the group.</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Choose a model, select a Free or paid monthly plan, and create a private Room with verified ownership.</p>
                <div className="mt-5 divide-y divide-[var(--loombus-border)] border-y border-[var(--loombus-border)]">
                  {ROOM_MODELS.slice(0, 4).map((model) => (
                    <div key={model.id} className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                      <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--loombus-gold)]">{model.category}</span>
                      <div>
                        <strong className="text-base">{model.title}</strong>
                        <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">{model.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>

        <section className="grid gap-8 border-t border-[var(--loombus-border)] py-8 lg:grid-cols-2 lg:gap-12" aria-label="Room utilities">
          <div>
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-[var(--loombus-gold)]" aria-hidden="true" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Upcoming</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Across your Rooms</h2>
              </div>
            </div>
            {upcomingRooms.length > 0 ? (
              <div className="mt-5 divide-y divide-[var(--loombus-border)] border-y border-[var(--loombus-border)]">
                {upcomingRooms.map((room) => (
                  <Link key={room.id} href={`/rooms/${encodeURIComponent(room.id)}/calendar`} className="grid gap-1 py-4 text-inherit no-underline sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-5">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">{room.nextEvent?.title}</strong>
                      <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">{room.name}</span>
                    </div>
                    <small className="text-xs text-[var(--loombus-text-subtle)]">{formatDateTime(room.nextEvent?.startsAt)}</small>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 border-y border-[var(--loombus-border)] py-5 text-sm text-[var(--loombus-text-muted)]">No upcoming Room dates are scheduled.</p>
            )}
          </div>

          <div className="lg:border-l lg:border-[var(--loombus-border)] lg:pl-12">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-[var(--loombus-gold)]" aria-hidden="true" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Invitation</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Join a private Room</h2>
              </div>
            </div>
            <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={joinRoom}>
              <label className="flex-1 border-b border-[var(--loombus-border)] focus-within:border-[var(--loombus-gold)]">
                <span className="sr-only">Room invitation link or token</span>
                <input
                  type="text"
                  value={inviteInput}
                  onChange={(event) => { setInviteInput(event.target.value); setInviteMessage(""); }}
                  placeholder="Paste invitation link"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="min-h-11 w-full border-0 bg-transparent px-0 py-2 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)]"
                />
              </label>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--loombus-gold)] bg-transparent px-4 py-2 text-sm font-bold text-[var(--loombus-text)]">
                Join Room <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
            {inviteMessage ? <p className="mt-3 text-xs font-semibold text-red-700" role="alert">{inviteMessage}</p> : null}
            <div className="mt-5 flex items-start gap-2 border-t border-[var(--loombus-border)] pt-4 text-xs leading-5 text-[var(--loombus-text-muted)]">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[var(--loombus-gold)]" aria-hidden="true" />
              <p><strong className="text-[var(--loombus-text)]">Private by membership.</strong> Room content stays behind verified account and membership checks.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
