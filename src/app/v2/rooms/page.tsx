"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronRight, GraduationCap, Home, Lock, Search, Sparkles, Store, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getDefaultShellPayload, V2ShellGateCard, V2ShellMobileNav, V2ShellTopNav, type ShellPayload } from "../v2-shell-components";

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
  const isPrivate = asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private";
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
    time: new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date),
  };
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

async function fetchLiveRooms(userId: string | null) {
  const roomResult = await fetchFirstAvailableRows<RoomRow>(ROOM_TABLES, 100);

  if (!roomResult.table) {
    return { rooms: [] as LiveRoom[], joinedRoomIds: [] as string[], events: [] as LiveEvent[], sourceMessage: "Room tables are not available yet." };
  }

  const rooms = roomResult.rows.map(normalizeRoom).filter((room) => !["quiet creek residents", "traverze culture"].includes(room.name.toLowerCase()));
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
    }).filter((event) => event.roomId && roomMap.has(event.roomId));
    break;
  }

  return {
    rooms: rooms.sort((a, b) => b.activityCount - a.activityCount || new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()),
    joinedRoomIds: [...joinedRoomIds],
    events: events.slice(0, 5),
    sourceMessage: `Private rooms loaded from ${roomResult.table}.`,
  };
}

function RoomCardView({ room, joined }: { room: LiveRoom; joined: boolean }) {
  const Icon = getRoomIcon(room);
  const roomHref = getRoomHref(room.id);

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-4">
        <Link href={roomHref} aria-label={`Open ${room.name}`} className="grid size-14 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-sm transition hover:scale-105"><Icon className="size-7" /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Link href={roomHref} className="text-lg font-black text-slate-950 transition hover:text-amber-700">{room.name}</Link>
            <div className="flex flex-wrap gap-2">
              {joined && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">Your room</span>}
              {room.isPrivate && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">Private</span>}
            </div>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{room.description}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
        <span>{room.memberCount} members</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> {room.activityCount} private updates</span>
        <span>{room.type}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="min-w-0 text-xs text-slate-500">
          <p className="truncate font-black text-slate-700">{room.latestActivityTitle}</p>
          <p>{formatRelativeTime(room.latestActivityAt ?? room.updatedAt)}</p>
        </div>
        <Link href={roomHref} className="rounded-2xl bg-amber-50 px-4 py-2 text-sm font-black text-amber-800 transition hover:bg-amber-100">Open Room</Link>
      </div>
    </article>
  );
}

function RoomEventsCard({ events }: { events: LiveEvent[] }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Upcoming Room Events</h2><CalendarDays className="size-4 text-amber-700" /></div>
      <div className="mt-4 space-y-4">
        {events.map((event) => {
          const eventDate = formatEventDate(event.startsAt);
          return (
            <Link key={event.id} href={getRoomHref(event.roomId)} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="rounded-2xl bg-amber-50 px-2 py-2 text-center"><p className="text-[10px] font-black text-slate-500">{eventDate.month}</p><p className="text-xl font-black text-slate-950">{eventDate.day}</p></div>
              <div className="min-w-0"><p className="text-sm font-black text-slate-950">{event.title}</p><p className="mt-1 text-xs font-semibold text-slate-500">{event.roomName}</p><p className="mt-1 text-xs text-slate-500">{eventDate.time}</p></div>
            </Link>
          );
        })}
        {events.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No private room events found yet.</p>}
      </div>
    </section>
  );
}

export default function V2RoomsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
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
      const matchesFilter = activeFilter === "All" || (activeFilter === "My Rooms" && joinedRoomIds.has(room.id)) || (activeFilter === "Business" && (type.includes("business") || type.includes("team"))) || (activeFilter === "Residents" && (type.includes("resident") || type.includes("condo") || type.includes("hoa"))) || (activeFilter === "Classroom" && (type.includes("class") || type.includes("school"))) || (activeFilter === "Customer" && (type.includes("customer") || type.includes("support"))) || (activeFilter === "Community" && (type.includes("community") || type.includes("club")));
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
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
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
    const { data } = supabase.auth.onAuthStateChange(() => loadShellAndRooms());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <V2ShellGateCard title="Checking V2 Rooms access" message="Loombus is verifying access before loading your private room dashboard." loading />;
  if (message) return <V2ShellGateCard title="V2 Rooms check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open your private room dashboard." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current Loombus experience." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <section id="my-rooms" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Private room dashboard</p><h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Your rooms</h1>{sourceMessage && <p className="mt-2 text-xs font-semibold text-slate-500">{sourceMessage}</p>}</div>
              <Link href="/create-room" className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800"><Sparkles className="size-4" />Create or subscribe to a room</Link>
            </div>
            <div className="mb-4 flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><Search className="size-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your private rooms" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /></div>
            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">{FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-slate-950 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-amber-700"}`}>{filter}</button>)}</div>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredRooms.map((room) => <RoomCardView key={room.id} room={room} joined={joinedRoomIds.has(room.id)} />)}
              {filteredRooms.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-2">No rooms match this filter yet. Room subscriptions and room setup now live on <Link href="/create-room" className="font-black text-amber-800">/create-room</Link>.</div>}
            </div>
          </div>
          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Room access</h2><Lock className="size-4 text-amber-700" /></div>
              <ol className="mt-4 space-y-3 text-sm font-semibold text-slate-600"><li>Only your owned or joined rooms belong here.</li><li>Room plans and setup choices live on /create-room.</li><li>After subscription, available room choices should appear in this dashboard.</li></ol>
              <Link href="/create-room" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">View room plans<ChevronRight className="size-4" /></Link>
            </section>
            <RoomEventsCard events={events} />
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
