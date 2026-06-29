"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
};

type LiveEvent = {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  startsAt: string | null;
  interestedCount: number;
};

const FILTERS = ["All Rooms", "Local", "Expert", "Private", "Following", "Trending"];
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

function getRoomName(row: RoomRow) {
  return asString(row.name) || asString(row.title) || asString(row.display_name) || "Untitled room";
}

function getRoomDescription(row: RoomRow) {
  return asString(row.description) || asString(row.summary) || asString(row.about) || "Live Loombus room.";
}

function getRoomType(row: RoomRow) {
  return asString(row.type) || asString(row.room_type) || asString(row.category) || asString(row.visibility) || "Room";
}

function getRoomUpdatedAt(row: RoomRow) {
  return asString(row.last_activity_at) || asString(row.updated_at) || asString(row.created_at) || null;
}

function normalizeRoom(row: RoomRow, index: number): LiveRoom {
  const visibility = asString(row.visibility).toLowerCase();
  const isPrivate = asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private";

  return {
    id: getRowId(row, index),
    name: getRoomName(row),
    description: getRoomDescription(row),
    type: getRoomType(row),
    isPrivate,
    memberCount: asNumber(row.member_count) || asNumber(row.members_count),
    activityCount: asNumber(row.activity_count) || asNumber(row.post_count),
    latestActivityTitle: "No recent room activity yet",
    latestActivityAt: getRoomUpdatedAt(row),
    updatedAt: getRoomUpdatedAt(row),
  };
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
    time: new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date),
  };
}

function getRoomIcon(room: LiveRoom) {
  const text = `${room.type} ${room.name}`.toLowerCase();
  if (text.includes("research") || text.includes("lab")) return FlaskConical;
  if (text.includes("condo") || text.includes("resident") || text.includes("building")) return Building2;
  if (text.includes("local") || text.includes("community")) return Home;
  if (text.includes("climate") || text.includes("environment")) return Leaf;
  if (room.isPrivate || text.includes("private")) return Lock;
  return Users;
}

function getRoomAccent(room: LiveRoom) {
  const text = `${room.type} ${room.name}`.toLowerCase();
  if (text.includes("research") || text.includes("lab")) return "from-slate-950 to-blue-800";
  if (text.includes("condo") || text.includes("private")) return "from-violet-700 to-indigo-500";
  if (text.includes("local") || text.includes("community")) return "from-orange-600 to-amber-400";
  if (text.includes("climate") || text.includes("environment")) return "from-emerald-600 to-green-400";
  return "from-blue-700 to-cyan-400";
}

async function fetchFirstAvailableRows<RowType>(tables: string[], limit: number) {
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (!error) return { table, rows: (data ?? []) as RowType[] };
  }
  return { table: "", rows: [] as RowType[] };
}

async function fetchLiveRooms(userId: string | null) {
  const roomResult = await fetchFirstAvailableRows<RoomRow>(ROOM_TABLES, 100);

  if (!roomResult.table) {
    return {
      rooms: [] as LiveRoom[],
      joinedRoomIds: [] as string[],
      events: [] as LiveEvent[],
      sourceMessage: "No live rooms table is available yet.",
    };
  }

  const rooms = roomResult.rows.map(normalizeRoom);
  const roomIds = rooms.map((room) => room.id);
  const roomMap = new Map(rooms.map((room) => [room.id, room]));
  const joinedRoomIds = new Set<string>();

  if (roomIds.length > 0) {
    for (const table of MEMBER_TABLES) {
      const { data, error } = await supabase.from(table).select("room_id,user_id").in("room_id", roomIds).limit(1000);
      if (error) continue;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as MemberRow[]) {
        const roomId = row.room_id ?? "";
        if (!roomId) continue;
        counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
        if (userId && row.user_id === userId) joinedRoomIds.add(roomId);
      }
      for (const [roomId, count] of counts) {
        const room = roomMap.get(roomId);
        if (room) room.memberCount = count;
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
          room.latestActivityTitle = asString(row.title) || asString(row.body) || asString(row.content) || "New room activity";
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

  let events: LiveEvent[] = [];
  for (const table of EVENT_TABLES) {
    const { data, error } = await supabase.from(table).select("*").limit(50);
    if (error) continue;
    events = ((data ?? []) as EventRow[]).map((row, index) => {
      const roomId = asString(row.room_id);
      return {
        id: asString(row.id) || `event-${index}`,
        roomId,
        roomName: roomMap.get(roomId)?.name ?? "Room",
        title: asString(row.title) || asString(row.name) || "Room event",
        startsAt: asString(row.starts_at) || asString(row.start_at) || asString(row.event_time) || null,
        interestedCount: asNumber(row.interested_count) || asNumber(row.rsvp_count),
      };
    }).filter((event) => event.roomId);
    break;
  }

  return {
    rooms: rooms.sort((a, b) => b.activityCount - a.activityCount || new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
    joinedRoomIds: [...joinedRoomIds],
    events: events.slice(0, 5),
    sourceMessage: `Live rooms loaded from ${roomResult.table}.`,
  };
}

function RoomCardView({ room, joined }: { room: LiveRoom; joined: boolean }) {
  const Icon = getRoomIcon(room);

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
        <span>{room.memberCount} members</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> {room.activityCount} live updates</span>
        <span>{room.type}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="grid size-8 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{room.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <p className="font-black text-slate-700">{room.latestActivityTitle}</p>
            <p>{formatRelativeTime(room.latestActivityAt ?? room.updatedAt)}</p>
          </div>
        </div>
        <Link href="/v2/rooms" className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100">
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
            <Link key={room.id} href="/v2/rooms" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{room.memberCount} members</span></span>
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

function RoomEventsCard({ events }: { events: LiveEvent[] }) {
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
            <Link key={event.id} href="/v2/rooms" className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="rounded-2xl bg-blue-50 px-2 py-2 text-center">
                <p className="text-[10px] font-black text-slate-500">{eventDate.month}</p>
                <p className="text-xl font-black text-slate-950">{eventDate.day}</p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">{event.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{event.roomName}</p>
                <p className="mt-1 text-xs text-slate-500">{eventDate.time}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{event.interestedCount} interested</p>
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

      if (userId && accessToken && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        const liveState = await fetchLiveRooms(userId);
        setRooms(liveState.rooms);
        setJoinedRoomIdList(liveState.joinedRoomIds);
        setEvents(liveState.events);
        setSourceMessage(liveState.sourceMessage);
      } else {
        setRooms([]);
        setJoinedRoomIdList([]);
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

  if (loading) return <V2ShellGateCard title="Checking V2 Rooms access" message="Loombus is verifying access before loading live V2 Rooms." loading />;
  if (message) return <V2ShellGateCard title="V2 Rooms check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 Rooms shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current Loombus experience." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Rooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Dedicated spaces loaded from live room data.</p>
          {sourceMessage && <p className="mt-2 text-xs font-semibold text-slate-500">{sourceMessage}</p>}
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <Search className="size-5 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search live rooms and communities" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {filter}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredRooms.map((room) => <RoomCardView key={room.id} room={room} joined={joinedRoomIds.has(room.id)} />)}
              {filteredRooms.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-2">No live rooms match this filter yet.</div>}
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
                    <Link key={room.id} href="/v2/rooms" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${getRoomAccent(room)} text-white`}><Icon className="size-4" /></span>
                        <span className="min-w-0"><span className="block truncate">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{room.memberCount} members · {room.activityCount} updates</span></span>
                      </span>
                      <MessageCircle className="size-4 text-slate-400" />
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
