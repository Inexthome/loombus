"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  GraduationCap,
  Home,
  Lock,
  Search,
  Store,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type RoomRow = Record<string, unknown>;
type MemberRow = { room_id?: string | null; user_id?: string | null };
type ActivityRow = Record<string, unknown>;
type EventRow = Record<string, unknown>;

type LiveRoom = {
  id: string;
  name: string;
  description: string;
  type: string;
  isPrivate: boolean;
  memberCount: number;
  activityCount: number;
  latestActivityTitle: string;
  latestActivityAt: string | null;
  updatedAt: string | null;
  ownerId: string;
  createdBy: string;
};

type LiveEvent = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  startsAt: string | null;
};

const FILTERS = ["My Rooms", "All", "Business", "Residents", "Classroom", "Customer", "Community"];
const ROOM_TABLES = ["rooms", "loombus_rooms", "community_rooms"];
const MEMBER_TABLES = ["room_members", "room_memberships", "loombus_room_members", "community_room_members"];
const ACTIVITY_TABLES = ["room_posts", "room_messages", "room_discussions", "loombus_room_posts"];
const EVENT_TABLES = ["room_events", "loombus_room_events", "community_room_events"];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function getRowId(row: RoomRow, index: number) {
  return asString(row.id) || asString(row.room_id) || `room-${index}`;
}

function normalizeRoom(row: RoomRow, index: number): LiveRoom {
  const visibility = asString(row.visibility).toLowerCase();
  const isPrivate =
    asBoolean(row.is_private) ||
    asBoolean(row.private) ||
    asBoolean(row.invite_only) ||
    visibility === "private";
  const updatedAt = asString(row.last_activity_at) || asString(row.updated_at) || asString(row.created_at) || null;

  return {
    id: getRowId(row, index),
    name: asString(row.name) || asString(row.title) || asString(row.display_name) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || asString(row.about) || "Private Loombus room.",
    type: asString(row.type) || asString(row.room_type) || asString(row.category) || asString(row.template_key) || "Room",
    isPrivate,
    memberCount: asNumber(row.member_count) || asNumber(row.members_count),
    activityCount: asNumber(row.activity_count) || asNumber(row.post_count),
    latestActivityTitle: "No recent private room activity yet",
    latestActivityAt: null,
    updatedAt,
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizeEvent(row: EventRow, index: number, roomMap: Map<string, LiveRoom>): LiveEvent {
  const roomId = asString(row.room_id);

  return {
    id: asString(row.id) || `event-${index}`,
    roomId,
    roomName: roomMap.get(roomId)?.name ?? "Room",
    title: asString(row.title) || asString(row.name) || "Room event",
    startsAt: asString(row.starts_at) || asString(row.start_at) || asString(row.event_time) || null,
  };
}

function getRoomHref(roomId: string) {
  return `/rooms/${encodeURIComponent(roomId)}`;
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No recent activity";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatEventDate(value: string | null) {
  if (!value) return { day: "--", month: "LIVE", time: "Time not set" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: "--", month: "LIVE", time: "Time not set" };
  return {
    day: new Intl.DateTimeFormat("en", { day: "2-digit" }).format(date),
    month: new Intl.DateTimeFormat("en", { month: "short" }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat("en", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date),
  };
}

function getEventTimestamp(event: LiveEvent) {
  if (!event.startsAt) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(event.startsAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function isUpcomingEvent(event: LiveEvent) {
  const timestamp = getEventTimestamp(event);
  return timestamp >= Date.now() - 60 * 60 * 1000;
}

function getRoomIcon(room: LiveRoom) {
  const text = `${room.type} ${room.name}`.toLowerCase();
  if (text.includes("resident") || text.includes("condo") || text.includes("hoa") || text.includes("neighborhood")) return Home;
  if (text.includes("school") || text.includes("class")) return GraduationCap;
  if (text.includes("customer") || text.includes("support")) return Store;
  if (room.isPrivate || text.includes("private")) return Lock;
  return Users;
}

async function fetchFirstAvailableRows<RowType>(tables: string[], limit: number) {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (!error) return { table, rows: (data ?? []) as RowType[] };
  }
  return { table: "", rows: [] as RowType[] };
}

async function fetchUpcomingEvents(roomIds: string[], roomMap: Map<string, LiveRoom>) {
  if (roomIds.length === 0) return [] as LiveEvent[];

  for (const table of EVENT_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .in("room_id", roomIds)
      .order("starts_at", { ascending: true })
      .limit(50);

    if (error) continue;

    return ((data ?? []) as EventRow[])
      .map((row, index) => normalizeEvent(row, index, roomMap))
      .filter((event) => event.roomId && roomMap.has(event.roomId) && isUpcomingEvent(event))
      .sort((a, b) => getEventTimestamp(a) - getEventTimestamp(b))
      .slice(0, 5);
  }

  return [] as LiveEvent[];
}

async function fetchLiveRooms(userId: string) {
  const roomResult = await fetchFirstAvailableRows<RoomRow>(ROOM_TABLES, 100);

  if (!roomResult.table) {
    return {
      rooms: [] as LiveRoom[],
      joinedRoomIds: [] as string[],
      events: [] as LiveEvent[],
      sourceMessage: "Room tables are not available yet.",
    };
  }

  const rooms = roomResult.rows
    .map(normalizeRoom)
    .filter((room) => !["quiet creek residents", "traverze culture"].includes(room.name.toLowerCase()));
  const roomIds = rooms.map((room) => room.id);
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const joinedRoomIds = new Set<string>();

  for (const room of rooms) {
    if (room.ownerId === userId || room.createdBy === userId) {
      joinedRoomIds.add(room.id);
      room.memberCount = Math.max(room.memberCount, 1);
    }
  }

  if (roomIds.length > 0) {
    for (const table of MEMBER_TABLES) {
      const { data, error } = await supabase.from(table).select("room_id,user_id").in("room_id", roomIds).limit(1000);
      if (error) continue;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as MemberRow[]) {
        const roomId = row.room_id ?? "";
        if (!roomId) continue;
        counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
        if (row.user_id === userId) joinedRoomIds.add(roomId);
      }
      for (const [roomId, count] of counts) {
        const room = roomMap.get(roomId);
        if (room) room.memberCount = Math.max(count, room.memberCount);
      }
      break;
    }

    for (const table of ACTIVITY_TABLES) {
      const { data, error } = await supabase.from(table).select("*").in("room_id", roomIds).limit(500);
      if (error) continue;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as ActivityRow[]) {
        const roomId = asString(row.room_id);
        if (!roomId) continue;
        const room = roomMap.get(roomId);
        const activityAt = asString(row.created_at) || asString(row.updated_at) || null;
        counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
        if (room) {
          room.latestActivityTitle = asString(row.title) || asString(row.body) || asString(row.content) || "New private room activity";
          room.latestActivityAt = activityAt;
        }
      }
      for (const [roomId, count] of counts) {
        const room = roomMap.get(roomId);
        if (room) room.activityCount = count;
      }
      break;
    }
  }

  const events = await fetchUpcomingEvents(roomIds, roomMap);

  return {
    rooms: rooms.sort(
      (a, b) =>
        b.activityCount - a.activityCount ||
        new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    ),
    joinedRoomIds: [...joinedRoomIds],
    events,
    sourceMessage: `Private rooms loaded from ${roomResult.table}.`,
  };
}

function RoomCardView({ room, joined }: { room: LiveRoom; joined: boolean }) {
  const Icon = getRoomIcon(room);
  const roomHref = getRoomHref(room.id);
  const owned = joined && (room.ownerId || room.createdBy);

  return (
    <article className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5 transition hover:-translate-y-0.5 hover:border-[var(--loombus-text-subtle)] hover:shadow-2xl hover:shadow-black/10">
      <div className="flex items-start gap-4">
        <Link href={roomHref} aria-label={`Open ${room.name}`} className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm transition hover:scale-105">
          <Icon className="h-7 w-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={roomHref} className="text-lg font-black text-[var(--loombus-text)] transition hover:opacity-80">
              {room.name}
            </Link>
            <div className="flex flex-wrap gap-2">
              {joined && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-600">{owned ? "Owner" : "Your room"}</span>}
              {room.isPrivate && <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-xs font-black text-[var(--loombus-text-muted)]">Private</span>}
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{room.description}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-bold text-[var(--loombus-text-subtle)]">
        <span>{room.memberCount} members</span>
        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {room.activityCount} private updates</span>
        <span>{room.type}</span>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--loombus-border)] pt-4">
        <div className="min-w-0 text-xs text-[var(--loombus-text-muted)]">
          <p className="truncate font-black text-[var(--loombus-text)]">{room.latestActivityTitle}</p>
          <p>{formatRelativeTime(room.latestActivityAt ?? room.updatedAt)}</p>
        </div>
        <Link href={roomHref} className="rounded-2xl bg-[var(--loombus-surface-muted)] px-4 py-2 text-sm font-black text-[var(--loombus-text)] ring-1 ring-[var(--loombus-border)] transition hover:bg-[var(--loombus-surface-strong)]">
          Open Room
        </Link>
      </div>
    </article>
  );
}

function RoomEventsCard({ events }: { events: LiveEvent[] }) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Upcoming Room Events</h2>
        <CalendarDays className="h-4 w-4 text-[var(--loombus-text-muted)]" />
      </div>
      <div className="mt-4 space-y-4">
        {events.map((event) => {
          const eventDate = formatEventDate(event.startsAt);
          return (
            <Link key={event.id} href={getRoomHref(event.roomId)} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-[var(--loombus-border)] pb-4 last:border-b-0 last:pb-0">
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] px-2 py-2 text-center ring-1 ring-[var(--loombus-border)]">
                <p className="text-[10px] font-black text-[var(--loombus-text-subtle)]">{eventDate.month}</p>
                <p className="text-xl font-black text-[var(--loombus-text)]">{eventDate.day}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-[var(--loombus-text)]">{event.title}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--loombus-text-muted)]">{event.roomName}</p>
                <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{eventDate.time}</p>
              </div>
            </Link>
          );
        })}
        {events.length === 0 && <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3 text-sm font-semibold text-[var(--loombus-text-muted)]">No upcoming private room events found yet.</p>}
      </div>
    </section>
  );
}

export default function RoomsPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("My Rooms");
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [joinedRoomIdList, setJoinedRoomIdList] = useState<string[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [sourceMessage, setSourceMessage] = useState("");

  const joinedRoomIds = useMemo(() => new Set(joinedRoomIdList), [joinedRoomIdList]);
  const filteredRooms = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return rooms.filter((room) => {
      const searchable = `${room.name} ${room.description} ${room.type}`.toLowerCase();
      const matchesQuery = !cleanQuery || searchable.includes(cleanQuery);
      const type = `${room.type} ${room.name}`.toLowerCase();
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "My Rooms" && joinedRoomIds.has(room.id)) ||
        (activeFilter === "Business" && (type.includes("business") || type.includes("team"))) ||
        (activeFilter === "Residents" && (type.includes("resident") || type.includes("condo") || type.includes("hoa"))) ||
        (activeFilter === "Classroom" && (type.includes("class") || type.includes("school"))) ||
        (activeFilter === "Customer" && (type.includes("customer") || type.includes("support"))) ||
        (activeFilter === "Community" && (type.includes("community") || type.includes("club")));
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, joinedRoomIds, query, rooms]);

  useEffect(() => {
    let isMounted = true;

    async function loadRooms() {
      setLoading(true);
      setMessage("");

      try {
        const { data } = await supabase.auth.getSession();
        const nextUserId = data.session?.user.id ?? null;

        if (!isMounted) return;

        setUserId(nextUserId);
        setAuthChecked(true);

        if (!nextUserId) {
          setRooms([]);
          setJoinedRoomIdList([]);
          setEvents([]);
          setSourceMessage("");
          return;
        }

        const liveState = await fetchLiveRooms(nextUserId);

        if (!isMounted) return;

        setRooms(liveState.rooms);
        setJoinedRoomIdList(liveState.joinedRoomIds);
        setEvents(liveState.events);
        setSourceMessage(liveState.sourceMessage);
      } catch {
        if (isMounted) {
          setMessage("Unable to load private Rooms right now.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRooms();
    const { data } = supabase.auth.onAuthStateChange(() => loadRooms());

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm text-[var(--loombus-text-muted)] shadow-xl shadow-black/5">
            Loading private Rooms...
          </p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private Rooms</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Log in to view Rooms.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">
            Rooms are private spaces for teams, residents, classrooms, customers, and communities. Sign in to see the rooms you own or joined.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)]">Log in</Link>
            <Link href="/signup" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">Create account</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <section className="mb-6 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private room dashboard</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Your Rooms</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
                Private spaces for residents, teams, classrooms, customers, and communities. Room discussions stay separate from public Loombus Discussions.
              </p>
              {sourceMessage && <p className="mt-3 text-xs font-semibold text-[var(--loombus-text-subtle)]">{sourceMessage}</p>}
            </div>
            <aside id="room-access" className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-5">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-[var(--loombus-text-muted)]" />
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Room access</h2>
              </div>
              <ol className="mt-4 space-y-3 text-sm font-semibold leading-6 text-[var(--loombus-text-muted)]">
                <li>Rooms you own or joined appear here.</li>
                <li>Room hubs organize discussions, events, members, files, requests, and controls.</li>
                <li>Private room content remains separate from public /discussions.</li>
              </ol>
            </aside>
          </div>
        </section>

        {message && (
          <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-700">
            {message}
          </p>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 shadow-xl shadow-black/5">
              <Search className="h-5 w-5 text-[var(--loombus-text-subtle)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search your private rooms"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)]"
              />
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                    activeFilter === filter
                      ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)] shadow-sm"
                      : "bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] ring-1 ring-[var(--loombus-border)] hover:text-[var(--loombus-text)]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredRooms.map((room) => (
                <RoomCardView key={room.id} room={room} joined={joinedRoomIds.has(room.id)} />
              ))}
              {filteredRooms.length === 0 && (
                <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm text-[var(--loombus-text-muted)] shadow-xl shadow-black/5 md:col-span-2">
                  No rooms match this filter yet. Switch filters or search by room name, type, or description.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <RoomEventsCard events={events} />
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Room structure</h2>
              <div className="mt-4 grid gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]">
                <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3">Discussions</p>
                <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3">Calendar and announcements</p>
                <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3">Requests, resources, services/store</p>
                <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3">Members, roles, files, FAQ, tasks, polls, settings</p>
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
