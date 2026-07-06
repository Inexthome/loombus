"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, Clock3, Database, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type Room = {
  id: string;
  name: string;
  ownerId: string;
  createdBy: string;
};

type Member = {
  userId: string;
  role: string;
};

type ActivityEntry = {
  id: string;
  actorId: string;
  eventType: string;
  entityTable: string;
  entityId: string;
  summary: string;
  createdAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoom(row: Row | null): Room | null {
  if (!row) return null;
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Private room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizeMember(row: Row): Member {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizeActivity(row: Row): ActivityEntry {
  return {
    id: asString(row.id),
    actorId: asString(row.actor_id),
    eventType: asString(row.event_type),
    entityTable: asString(row.entity_table),
    entityId: asString(row.entity_id),
    summary: asString(row.summary) || "Room activity",
    createdAt: asString(row.created_at) || null,
  };
}

function formatDate(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function getShortId(value: string) {
  if (!value) return "System";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function getEventLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function V2RoomActivityPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => {
    if (Array.isArray(rawRoomId)) return rawRoomId[0] ?? "";
    return rawRoomId ?? "";
  }, [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canView = Boolean(isOwner || isAdmin);
  const uniqueActors = new Set(entries.map((entry) => entry.actorId).filter(Boolean)).size;
  const latestEntry = entries[0];

  async function loadActivity() {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.authenticated || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null);
        setMembers([]);
        setEntries([]);
        return;
      }

      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      setRoom(nextRoom);

      const { data: memberData } = await supabase.from("room_members").select("user_id,role").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);

      const nextIsOwner = Boolean(nextRoom && (nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId));
      const nextMember = nextMembers.find((member) => member.userId === nextUserId);
      const nextCanView = nextIsOwner || nextMember?.role === "owner" || nextMember?.role === "admin";

      if (!nextRoom || !nextCanView) {
        setEntries([]);
        setMessage("Room Activity / Audit Log is only available to room owners and admins.");
        return;
      }

      const { data: activityData, error } = await supabase.from("room_activity_log").select("id,actor_id,event_type,entity_table,entity_id,summary,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      setEntries(((activityData ?? []) as Row[]).map(normalizeActivity).filter((entry) => entry.id));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Loombus could not load the room activity log yet. Confirm the room activity migration and RLS policies are active.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivity();
    const { data } = supabase.auth.onAuthStateChange(() => loadActivity());

    const channel = supabase
      .channel(`room-activity-page-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_activity_log", filter: `room_id=eq.${roomId}` }, loadActivity)
      .subscribe();

    return () => {
      data.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (loading) return <V2ShellGateCard title="Opening room activity" message="Loombus is loading this room accountability log." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room activity log." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;
  if (!room || !canView) return <V2ShellGateCard title="Room activity is private" message={message || "Only room owners and admins can view this room activity log."} payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>
        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Activity / Audit Log</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room.name}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Track important room changes, access activity, content updates, service activity, and room-control changes.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{entries.length} recent events</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{uniqueActors} actors</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">Owner/admin only</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">{getEventLabel(entry.eventType)}</p>
                      <h2 className="mt-3 text-lg font-black text-slate-950">{entry.summary}</h2>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-slate-500">
                        <span className="inline-flex items-center gap-1"><Database className="size-3" /> {entry.entityTable}</span>
                        <span className="inline-flex items-center gap-1"><UserRound className="size-3" /> {getShortId(entry.actorId)}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {formatDate(entry.createdAt)}</span>
                      </div>
                      {entry.entityId && <p className="mt-2 break-all text-xs font-semibold text-slate-400">Entity: {getShortId(entry.entityId)}</p>}
                    </div>
                  </div>
                </article>
              ))}

              {entries.length === 0 && (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                  <Activity className="mx-auto size-9 text-amber-700" />
                  <h2 className="mt-3 text-lg font-black text-slate-950">No tracked activity yet</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">New member, invite, request, resource, service, announcement, and settings changes will appear here after this migration is active.</p>
                </div>
              )}
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Activity summary</h2>
                  <ShieldCheck className="size-4 text-amber-700" />
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Recent events</dt><dd className="font-black text-slate-900">{entries.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Actors</dt><dd className="font-black text-slate-900">{uniqueActors}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Latest</dt><dd className="font-black text-slate-900">{latestEntry ? formatDate(latestEntry.createdAt) : "None"}</dd></div>
                </dl>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Tracked activity</h2>
                <div className="mt-4 space-y-2 text-sm font-semibold leading-6 text-slate-600">
                  <p>Members, roles, invites, join requests, announcements, resources, services, requests, and room controls.</p>
                  <p>This log starts from the time the migration is applied. It does not backfill historical room changes.</p>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
