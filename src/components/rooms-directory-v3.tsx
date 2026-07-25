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
import { RoomModelCard, RoomsSectionHeading } from "@/app/rooms/rooms-v2-components";
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
    <main className="rooms-live-page rooms-directory-page" aria-busy={loading || refreshing}>
      <div className="rooms-directory-layout">
        <aside className="rooms-directory-left" aria-label="Room filters">
          <div className="rooms-directory-sticky">
            <section className="rooms-directory-rail-card">
              <p className="rooms-live-eyebrow">Browse Rooms</p>
              <nav className="rooms-directory-filter-nav">
                {FILTERS.map((item) => {
                  const count =
                    item.value === "all"
                      ? summary.total
                      : item.value === "owned"
                        ? summary.owned
                        : summary.joined;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={filter === item.value}
                      onClick={() => setFilter(item.value)}
                    >
                      <span>{item.label}</span>
                      <strong>{count}</strong>
                    </button>
                  );
                })}
              </nav>
              <Link href="/rooms/new" className="rooms-live-primary-action rooms-directory-create">
                <Plus aria-hidden="true" /> Create a Room
              </Link>
            </section>

            <section className="rooms-directory-rail-card rooms-directory-private-note">
              <LockKeyhole aria-hidden="true" />
              <div>
                <strong>Private by membership</strong>
                <span>Room content stays behind verified account and membership checks.</span>
              </div>
            </section>
          </div>
        </aside>

        <section className="rooms-directory-center">
          <header className="rooms-directory-header">
            <div>
              <p className="rooms-live-eyebrow">Private workspaces</p>
              <h1>Rooms</h1>
              <p>
                Open your private communities, teams, classes, support spaces, and shared
                operating rooms from one focused directory.
              </p>
            </div>
            <div className="rooms-directory-header-actions">
              <Link href="/rooms/new" className="rooms-live-primary-action">
                <Plus aria-hidden="true" /> Create Room
              </Link>
              <button
                type="button"
                onClick={() => void loadRooms(true)}
                disabled={refreshing}
                className="rooms-live-secondary-action"
              >
                <RefreshCw aria-hidden="true" className={refreshing ? "is-spinning" : undefined} />
                Refresh
              </button>
            </div>
          </header>

          <div className="rooms-live-status-row rooms-directory-status-row">
            <span className={realtimeConnected ? "is-live" : "is-fallback"}>
              {realtimeConnected ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
              {realtimeConnected ? "Live updates connected" : "Refresh fallback active"}
            </span>
            <span><ShieldCheck aria-hidden="true" />Membership verified server-side</span>
            {generatedAt ? (
              <span><Clock3 aria-hidden="true" />Updated {formatRelativeTime(generatedAt)}</span>
            ) : null}
          </div>

          {message ? <div className="rooms-live-notice is-error">{message}</div> : null}

          <label className="rooms-directory-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search your Rooms</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Room name, purpose, type, or role"
            />
          </label>

          {loading ? (
            <section className="rooms-directory-loading" role="status">
              Opening your verified Room directory…
            </section>
          ) : visibleRooms.length > 0 ? (
            <div className="rooms-directory-feed">
              {visibleRooms.map((room) => (
                <article key={room.id} className="rooms-directory-card">
                  <div className="rooms-directory-card-main">
                    <div className="rooms-directory-card-topline">
                      <span><ShieldCheck aria-hidden="true" />{roleLabel(room.role)}</span>
                      <span><LockKeyhole aria-hidden="true" />Private</span>
                      <small>{room.roomType.replaceAll("_", " ")}</small>
                    </div>
                    <h2>{room.name}</h2>
                    <p>{room.description}</p>
                    <div className="rooms-directory-card-stats">
                      <span><Users aria-hidden="true" />{room.memberCount} members</span>
                      <span><MessageSquareText aria-hidden="true" />{room.postCount} discussions</span>
                      <span><CalendarDays aria-hidden="true" />{room.eventCount} events</span>
                    </div>
                  </div>

                  <div className="rooms-directory-card-side">
                    {room.nextEvent ? (
                      <div className="rooms-directory-next-event">
                        <CalendarDays aria-hidden="true" />
                        <div>
                          <span>Next date</span>
                          <strong>{room.nextEvent.title}</strong>
                          <small>{formatDateTime(room.nextEvent.startsAt)}</small>
                          {room.nextEvent.location ? <small>{room.nextEvent.location}</small> : null}
                        </div>
                      </div>
                    ) : (
                      <div className="rooms-directory-next-event is-empty">
                        <CheckCircle2 aria-hidden="true" />
                        <span>No upcoming Room event</span>
                      </div>
                    )}
                    <div className="rooms-directory-card-footer">
                      <span>Activity {formatRelativeTime(room.latestActivityAt)}</span>
                      <Link href={`/rooms/${encodeURIComponent(room.id)}`}>
                        Open Room <ArrowRight aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : rooms.length > 0 ? (
            <section className="rooms-live-empty">
              <Search aria-hidden="true" />
              <h3>No Room matches those filters.</h3>
              <p>Clear the search or choose another Room group.</p>
              <button type="button" onClick={() => { setQuery(""); setFilter("all"); }}>
                Clear filters
              </button>
            </section>
          ) : (
            <>
              <section className="rooms-live-empty is-primary">
                <LockKeyhole aria-hidden="true" />
                <h3>Create your first private Room.</h3>
                <p>Start free or choose a paid Room plan for larger operating tools.</p>
                <Link href="/rooms/new" className="rooms-live-primary-action">
                  Create your first Room <ArrowRight aria-hidden="true" />
                </Link>
              </section>
              <section className="rooms-live-models rooms-directory-models">
                <RoomsSectionHeading
                  eyebrow="Room models"
                  title="Start with a structure that matches the group."
                  description="Choose a model, select a Free or paid monthly plan, and create a private Room with verified ownership."
                  action={{ href: "/rooms/new", label: "Create a Room" }}
                />
                <div className="rooms-v2-model-grid">
                  {ROOM_MODELS.slice(0, 4).map((model) => (
                    <RoomModelCard key={model.id} model={model} />
                  ))}
                </div>
              </section>
            </>
          )}
        </section>

        <aside className="rooms-directory-right" aria-label="Room overview">
          <div className="rooms-directory-sticky">
            <section className="rooms-directory-rail-card">
              <div className="rooms-directory-rail-heading">
                <div><p>Room summary</p><h2>Your private spaces</h2></div>
                <Users aria-hidden="true" />
              </div>
              <div className="rooms-directory-summary-grid">
                <span><strong>{summary.total}</strong>Active</span>
                <span><strong>{summary.owned}</strong>Owned</span>
                <span><strong>{summary.joined}</strong>Joined</span>
                <span><strong>{summary.upcomingEvents}</strong>With dates</span>
              </div>
            </section>

            <section className="rooms-directory-rail-card">
              <div className="rooms-directory-rail-heading">
                <div><p>Upcoming</p><h2>Across your Rooms</h2></div>
                <CalendarDays aria-hidden="true" />
              </div>
              {upcomingRooms.length > 0 ? (
                <div className="rooms-directory-upcoming-list">
                  {upcomingRooms.map((room) => (
                    <Link key={room.id} href={`/rooms/${encodeURIComponent(room.id)}/calendar`}>
                      <strong>{room.nextEvent?.title}</strong>
                      <span>{room.name}</span>
                      <small>{formatDateTime(room.nextEvent?.startsAt)}</small>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rooms-directory-rail-empty">No upcoming Room dates are scheduled.</p>
              )}
            </section>

            <section className="rooms-directory-rail-card">
              <div className="rooms-directory-rail-heading">
                <div><p>Invitation</p><h2>Join a private Room</h2></div>
                <Link2 aria-hidden="true" />
              </div>
              <form className="rooms-directory-invite-form" onSubmit={joinRoom}>
                <label>
                  <span className="sr-only">Room invitation link or token</span>
                  <input
                    type="text"
                    value={inviteInput}
                    onChange={(event) => { setInviteInput(event.target.value); setInviteMessage(""); }}
                    placeholder="Paste invitation link"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </label>
                <button type="submit" className="rooms-live-primary-action">
                  Join Room <ArrowRight aria-hidden="true" />
                </button>
              </form>
              {inviteMessage ? <p className="rooms-directory-invite-error" role="alert">{inviteMessage}</p> : null}
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
