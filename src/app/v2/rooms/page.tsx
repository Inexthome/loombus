"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  FlaskConical,
  Home,
  Leaf,
  Lock,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type RoomRecord = Record<string, unknown>;
type MembershipRecord = Record<string, unknown>;
type ActivityRecord = Record<string, unknown>;
type EventRecord = Record<string, unknown>;

type LiveRoom = {
  id: string;
  name: string;
  type: string;
  description: string;
  isPrivate: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  memberCount: number | null;
  activityCount: number;
  latestActivity: {
    title: string;
    createdAt: string | null;
  } | null;
};

type LiveRoomEvent = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  startsAt: string | null;
  interestedCount: number | null;
};

type LiveRoomState = {
  rooms: LiveRoom[];
  joinedRoomIds: Set<string>;
  events: LiveRoomEvent[];
  sourceMessage: string;
};

const FILTERS = ["All Rooms", "Local", "Expert", "Private", "Following", "Trending"];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatRelativeTime(value: string | null | undefined) {
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
    time: new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function getRoomType(record: RoomRecord) {
  return (
    asString(record.type) ||
    asString(record.room_type) ||
    asString(record.category) ||
    asString(record.visibility) ||
    "Room"
  );
}

function getRoomName(record: RoomRecord) {
  return asString(record.name) || asString(record.title) || asString(record.display_name) || "Untitled room";
}

function getRoomDescription(record: RoomRecord) {
  return asString(record.description) || asString(record.summary) || asString(record.about) || "Live Loombus room.";
}

function getRoomUpdatedAt(record: RoomRecord) {
  return asString(record.updated_at) || asString(record.last_activity_at) || asString(record.created_at) || null;
}

function getRoomIcon(room: LiveRoom): LucideIcon {
  const type = `${room.type} ${room.name}`.toLowerCase();
  if (type.includes("research") || type.includes("lab")) return FlaskConical;
  if (type.includes("condo") || type.includes("resident") || type.includes("building")) return Building2;
  if (type.includes("local") || type.includes("community")) return Home;
  if (type.includes("climate") || type.includes("environment")) return Leaf;
  if (room.isPrivate || type.includes("private")) return Lock;
  return Users;
}

function getRoomAccent(room: LiveRoom) {
  const type = `${room.type} ${room.name}`.toLowerCase();
  if (type.includes("research") || type.includes("lab")) return "from-slate-950 to-blue-800";
  if (type.includes("condo") || type.includes("private")) return "from-violet-700 to-indigo-500";
  if (type.includes("local") || type.includes("community")) return "from-orange-600 to-amber-400";
  if (type.includes("climate") || type.includes("environment")) return "from-emerald-600 to-green-400";
  return "from-blue-700 to-cyan-400";
}

function getRoomId(record: RoomRecord) {
  return asString(record.id) || asString(record.room_id) || crypto.randomUUID();
}

function normalizeRoom(record: RoomRecord): LiveRoom {
  const isPrivate =
    asBoolean(record.is_private) ||
    asBoolean(record.private) ||
    asBoolean(record.invite_only) ||
    ["private", "invite_only"].includes(asString(record.visibility).toLowerCase());

  return {
    id: getRoomId(record),
    name: getRoomName(record),
    type: getRoomType(record),
    description: getRoomDescription(record),
    isPrivate,
    createdAt: asString(record.created_at) || null,
    updatedAt: getRoomUpdatedAt(record),
    memberCount: asNumber(record.member_count) ?? asNumber(record.members_count),
    activityCount: asNumber(record.activity_count) ?? asNumber(record.post_count) ?? 0,
    latestActivity: null,
  };
}

function getRoomIdFromRecord(record: Record<string, unknown>) {
  return asString(record.room_id) || asString(record.roomId) || asString(record.space_id) || asString(record.id);
}

function getActivityTitle(record: ActivityRecord) {
  return asString(record.title) || asString(record.body) || asString(record.content) || asString(record.message) || "New room activity";
}

async function readFirstAvailableTable<T extends Record<string, unknown>>({
  tables,
  select = "*",
  filter,
  limit = 100,
}: {
  tables: string[];
  select?: string;
  filter?: (query: any) => any;
  limit?: number;
}): Promise<{ rows: T[]; table: string | null }> {
  for (const table of tables) {
    let query = supabase.from(table).select(select).limit(limit);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (!error) return { rows: (data ?? []) as T[], table };
  }
  return { rows: [], table: null };
}

async function loadLiveRooms(userId: string | null): Promise<LiveRoomState> {
  const roomResult = await readFirstAvailableTable<RoomRecord>({
    tables: ["rooms", "loombus_rooms", "community_rooms"],
    limit: 100,
  });

  if (!roomResult.table) {
    return {
      rooms: [],
      joinedRoomIds: new Set(),
      events: [],
      sourceMessage: "No live rooms table is available yet. Create or connect a rooms table before showing room activity.",
    };
  }

  const rooms = roomResult.rows.map(normalizeRoom);
  const roomIds = rooms.map((room) => room.id).filter(Boolean);
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const joinedRoomIds = new Set<string>();

  if (roomIds.length > 0) {
    const membershipResult = await readFirstAvailableTable<MembershipRecord>({
      tables: ["room_members", "room_memberships", "loombus_room_members", "community_room_members"],
      filter: (query) => query.in("room_id", roomIds),
      limit: 1000,
    });

    if (membershipResult.table) {
      const memberCounts = new Map<string, number>();
      for (const row of membershipResult.rows) {
        const roomId = getRoomIdFromRecord(row);
        if (!roomId) continue;
        memberCounts.set(roomId, (memberCounts.get(roomId) ?? 0) + 1);
        if (userId && asString(row.user_id) === userId) joinedRoomIds.add(roomId);
      }

      for (const [roomId, count] of memberCounts) {
        const room = roomMap.get(roomId);
        if (room) room.memberCount = count;
      }
    }

    const activityResult = await readFirstAvailableTable<ActivityRecord>({
      tables: ["room_posts", "room_messages", "room_discussions", "loombus_room_posts"],
      filter: (query) => query.in("room_id", roomIds),
      limit: 500,
    });

    if (activityResult.table) {
      const activityCounts = new Map<string, number>();
      const latestActivity = new Map<string, { title: string; createdAt: string | null }>();

      for (const row of activityResult.rows) {
        const roomId = getRoomIdFromRecord(row);
        if (!roomId) continue;
        const createdAt = asString(row.created_at) || asString(row.updated_at) || null;
        const existing = latestActivity.get(roomId);
        const existingTime = new Date(existing?.createdAt ?? 0).getTime();
        const nextTime = new Date(createdAt ?? 0).getTime();
        activityCounts.set(roomId, (activityCounts.get(roomId) ?? 0) + 1);
        if (!existing || (Number.isFinite(nextTime) && nextTime > existingTime)) {
          latestActivity.set(roomId, { title: getActivityTitle(row), createdAt });
        }
      }

      for (const [roomId, count] of activityCounts) {
        const room = roomMap.get(roomId);
        if (room) room.activityCount = count;
      }
      for (const [roomId, latest] of latestActivity) {
        const room = roomMap.get(roomId);
        if (room) room.latestActivity = latest;
      }
    }
  }

  const eventResult =
    roomIds.length > 0
      ? await readFirstAvailableTable<EventRecord>({
          tables: ["room_events", "loombus_room_events", "community_room_events"],
          filter: (query) => query.in("room_id", roomIds),
          limit: 50,
        })
      : { rows: [] as EventRecord[], table: null };

  const events = eventResult.rows
    .map((row) => {
      const roomId = getRoomIdFromRecord(row);
      const room = roomMap.get(roomId);
      return {
        id: asString(row.id) || `${roomId}-${asString(row.title)}`,
        roomId,
        roomName: room?.name ?? "Room",
        title: asString(row.title) || asString(row.name) || "Room event",
        startsAt: asString(row.starts_at) || asString(row.start_at) || asString(row.event_time) || null,
        interestedCount: asNumber(row.interested_count) ?? asNumber(row.rsvp_count),
      };
    })
    .filter((event) => event.roomId && event.title)
    .sort((a, b) => new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime())
    .slice(0, 5);

  return {
    rooms: rooms.sort((a, b) => {
      const activityDiff = b.activityCount - a.activityCount;
      if (activityDiff !== 0) return activityDiff;
      return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
    }),
    joinedRoomIds,
    events,
    sourceMessage: `Live rooms loaded from ${roomResult.table}.`,
  };
}

function RoomCardView({ room, joined }: { room: LiveRoom; joined: boolean }) {
  const Icon = getRoomIcon(room);
  const latest = room.latestActivity;

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="grid gap-4 sm:grid-cols-[76px_minmax(0,1fr)]">
        <div className={`grid size-16 place-items-center rounded-2xl bg-gradient-to-br ${getRoomAccent(room)} text-white shadow-lg`}>
          <Icon className="size-8" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-black text-slate-950">{room.name}</h2>
            <div className="flex flex-wrap gap-2">
              {joined && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">Joined</span>}
              {room.isPrivate && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">Private</span>}
            </div>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{room.description}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
        <span>{room.memberCount ?? 0} members</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> {room.activityCount} live updates</span>
        <span>{room.type}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="grid size-8 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{room.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <p className="font-black text-slate-700">{latest?.title ?? "No recent room activity yet"}</p>
            <p>{formatRelativeTime(latest?.createdAt ?? room.updatedAt)}</p>
          </div>
        </div>
        <Link href={`/v2/rooms/${room.id}`} className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100">
          View Room
        </Link>
      </div>
    </article>
  );
}

function SuggestedRoomsCard({ rooms, joinedRoomIds }: { rooms: LiveRoom[]; joinedRoomIds: Set<string> }) {
  const suggestedRooms = rooms.filter((room) => !joinedRoomIds.has(room.id)).slice(0, 4);

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Suggested Rooms</h2>
        <Sparkles className="size-4 text-blue-700" />
      </div>
      <div className="mt-4 space-y-3">
        {suggestedRooms.map((room) => {
          const Icon = getRoomIcon(room);
          return (
            <Link key={room.id} href={`/v2/rooms/${room.id}`} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{room.memberCount ?? 0} members</span></span>
              </span>
              <ChevronRight className="size-4 text-slate-400" />
            </Link>
          );
        })}
        {suggestedRooms.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No live room suggestions yet.</p>}
      </div>
    </section>
  );
}

function RoomEventsCard({ events }: { events: LiveRoomEvent[] }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Upcoming Room Events</h2>
        <CalendarDays className="size-4 text-blue-700" />
      </div>
      <div className="mt-4 space-y-4">
        {events.map((event) => {
          const eventDate = formatEventDate(event.startsAt);
          return (
            <Link key={event.id} href={`/v2/rooms/${event.roomId}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="rounded-2xl bg-blue-50 px-2 py-2 text-center">
                <p className="text-[10px] font-black text-slate-500">{eventDate.month}</p>
                <p className="text-xl font-black text-slate-950">{eventDate.day}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">{event.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{event.roomName}</p>
                <p className="mt-1 text-xs text-slate-500">{eventDate.time}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{event.interestedCount ?? 0} interested</p>
              </div>
            </Link>
          );
        })}
        {events.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No live room events found.</p>}
      </div>
    </section>
  );
}

export default function V2RoomsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Rooms");
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<LiveRoomEvent[]>([]);
  const [sourceMessage, setSourceMessage] = useState("");

  const filteredRooms = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return rooms.filter((room) => {
      const searchable = `${room.name} ${room.description} ${room.type}`.toLowerCase();
      const matchesQuery = !cleanQuery || searchable.includes(cleanQuery);
      const type = `${room.type} ${room.name}`.toLowerCase();
      const matchesFilter =
        activeFilter === "All Rooms" ||
        (activeFilter === "Following" && joinedRoomIds.has(room.id)) ||
        (activeFilter === "Trending" && room.activityCount > 0) ||
        (activeFilter === "Expert" && (type.includes("expert") || type.includes("research") || type.includes("lab"))) ||
        (activeFilter === "Private" && room.isPrivate) ||
        (activeFilter === "Local" && (type.includes("local") || type.includes("community")));
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, joinedRoomIds, query, rooms]);

  async function loadShellAndRooms() {
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const userId = data.session?.user.id ?? null;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (userId && accessToken && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.flags.v2_rooms && nextPayload.version === "v2") {
        const liveState = await loadLiveRooms(userId);
        setRooms(liveState.rooms);
        setJoinedRoomIds(liveState.joinedRoomIds);
        setEvents(liveState.events);
        setSourceMessage(liveState.sourceMessage);
      } else {
        setRooms([]);
        setJoinedRoomIds(new Set());
        setEvents([]);
        setSourceMessage("");
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Rooms access. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShellAndRooms();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShellAndRooms();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <V2ShellGateCard title="Checking V2 Rooms access" message="Loombus is verifying access before loading live V2 Rooms." loading />;
  }

  if (message) {
    return <V2ShellGateCard title="V2 Rooms check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <V2ShellGateCard title="Sign in required" message="The V2 Rooms shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current Loombus experience." payload={payload} />;
  }

  if (!payload.flags.v2_rooms) {
    return <V2ShellGateCard title="V2 Rooms flag is off" message="The V2 shell is enabled, but the v2_rooms flag is not enabled for this account yet." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Rooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Dedicated spaces loaded from live room data.</p>
          {sourceMessage && <p className="mt-2 text-xs font-semibold text-slate-500">{sourceMessage}</p>}
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search live rooms and communities"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredRooms.map((room) => <RoomCardView key={room.id} room={room} joined={joinedRoomIds.has(room.id)} />)}
              {filteredRooms.length === 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-2">
                  No live rooms match this filter yet.
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Your Rooms</h2>
                <Users className="size-4 text-blue-700" />
              </div>
              <div className="mt-4 space-y-3">
                {rooms.filter((room) => joinedRoomIds.has(room.id)).slice(0, 5).map((room) => {
                  const Icon = getRoomIcon(room);
                  return (
                    <Link key={room.id} href={`/v2/rooms/${room.id}`} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${getRoomAccent(room)} text-white`}><Icon className="size-4" /></span>
                        <span className="min-w-0"><span className="block truncate">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{room.memberCount ?? 0} members · {room.activityCount} updates</span></span>
                      </span>
                      <span className="size-2 shrink-0 rounded-full bg-blue-600" />
                    </Link>
                  );
                })}
                {rooms.filter((room) => joinedRoomIds.has(room.id)).length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No joined rooms found for this account.</p>}
              </div>
            </section>

            <SuggestedRoomsCard rooms={rooms} joinedRoomIds={joinedRoomIds} />
            <RoomEventsCard events={events} />
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
