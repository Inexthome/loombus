"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileText,
  Megaphone,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type AnyRow = Record<string, unknown>;

type RailRoom = {
  id: string;
  name: string;
  isPrivate: boolean;
  ownerId: string;
  createdBy: string;
  updatedAt: string | null;
  memberCount: number;
  subscriptionPlan: string;
  subscriptionStatus: string;
};

type RailItem = {
  id: string;
  title: string;
  meta: string;
};

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

function normalizeRoom(row: AnyRow): RailRoom {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || asString(row.display_name) || "Room",
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    updatedAt: asString(row.last_activity_at) || asString(row.updated_at) || asString(row.created_at) || null,
    memberCount: asNumber(row.member_count) || asNumber(row.members_count),
    subscriptionPlan: asString(row.subscription_plan) || "free",
    subscriptionStatus: asString(row.subscription_status) || "active",
  };
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value || "Unknown";
}

export default function RoomDetailRightRail() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);

  const [room, setRoom] = useState<RailRoom | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<RailItem[]>([]);
  const [pendingRequests, setPendingRequests] = useState<RailItem[]>([]);
  const [events, setEvents] = useState<RailItem[]>([]);
  const [announcements, setAnnouncements] = useState<RailItem[]>([]);

  useEffect(() => {
    let active = true;

    async function loadRail() {
      if (!roomId) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const nextUserId = sessionData.session?.user.id ?? null;
      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(8);
      const { data: requestData } = await supabase.from("room_applications").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(5);
      const { data: eventData } = await supabase.from("room_events").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }).limit(5);
      const { data: announcementData } = await supabase.from("room_announcements").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(5);

      if (!active) return;

      setUserId(nextUserId);
      setRoom(roomData ? normalizeRoom(roomData as AnyRow) : null);
      setMembers(((memberData ?? []) as AnyRow[]).map((member, index) => ({
        id: asString(member.id) || `${asString(member.user_id)}-${index}`,
        title: asString(member.role) || "member",
        meta: shortId(asString(member.user_id)),
      })));
      setPendingRequests(((requestData ?? []) as AnyRow[]).map((request, index) => ({
        id: asString(request.id) || `request-${index}`,
        title: asString(request.state) || "pending",
        meta: shortId(asString(request.applicant_id)),
      })));
      setEvents(((eventData ?? []) as AnyRow[]).map((event, index) => ({
        id: asString(event.id) || `event-${index}`,
        title: asString(event.title) || "Room event",
        meta: formatDate(asString(event.starts_at)),
      })));
      setAnnouncements(((announcementData ?? []) as AnyRow[]).map((announcement, index) => ({
        id: asString(announcement.id) || `announcement-${index}`,
        title: asString(announcement.title) || "Announcement",
        meta: asBoolean(announcement.is_pinned) ? "Pinned" : formatDate(asString(announcement.created_at)),
      })));
    }

    loadRail();
    const { data } = supabase.auth.onAuthStateChange(() => loadRail());
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [roomId]);

  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const visibleRequests = isOwner ? pendingRequests : pendingRequests.filter((request) => request.meta === shortId(userId ?? ""));

  if (!room) return null;

  return (
    <aside className="pointer-events-none fixed right-4 top-24 z-[85] hidden max-h-[calc(100vh-7.5rem)] w-[320px] overflow-y-auto xl:block">
      <div className="pointer-events-auto space-y-4 pr-1">
        <RailCard title="Room controls" icon={<Settings className="size-4 text-amber-700" />}>
          <div className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <a href="#overview" className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">Overview</a>
            <a href="#calendar" className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">Calendar</a>
            <a href="#discussions" className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">Discussions</a>
            <a href="#announcements" className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">Announcements</a>
          </div>
        </RailCard>

        <RailCard title="Room status" icon={<CreditCard className="size-4 text-amber-700" />}>
          <div className="space-y-2 text-sm text-slate-600">
            <p><span className="font-black text-slate-950">Access:</span> {room.isPrivate ? "Private" : "Public"}</p>
            <p><span className="font-black text-slate-950">View:</span> {isOwner ? "Owner" : "Member"}</p>
            <p><span className="font-black text-slate-950">Plan:</span> {room.subscriptionPlan}</p>
            <p><span className="font-black text-slate-950">Status:</span> {room.subscriptionStatus}</p>
          </div>
        </RailCard>

        <RailCard title="Members" icon={<Users className="size-4 text-amber-700" />}>
          <RailList items={members} empty="No members loaded yet." />
        </RailCard>

        <RailCard title="Access requests" icon={<ClipboardList className="size-4 text-amber-700" />}>
          <RailList items={visibleRequests} empty="No access requests pending." />
        </RailCard>

        <RailCard title="Upcoming events" icon={<CalendarDays className="size-4 text-amber-700" />}>
          <RailList items={events} empty="No events loaded yet." />
        </RailCard>

        <RailCard title="Announcements" icon={<Megaphone className="size-4 text-amber-700" />}>
          <RailList items={announcements} empty="No announcements yet." />
        </RailCard>

        <RailCard title="Resources" icon={<FileText className="size-4 text-amber-700" />}>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Documents, room files, forms, links, rules, and shared guides.</p>
            <a href="#resources" className="inline-flex text-xs font-black uppercase tracking-[0.14em] text-amber-700">Open resources</a>
          </div>
        </RailCard>

        <RailCard title="Services / Store" icon={<ShoppingBag className="size-4 text-amber-700" />}>
          <div className="space-y-2 text-sm text-slate-600">
            <p>Room-specific vendors, listings, bookings, services, and offers.</p>
            <a href="#services" className="inline-flex text-xs font-black uppercase tracking-[0.14em] text-amber-700">Open services</a>
          </div>
        </RailCard>
      </div>
    </aside>
  );
}

function RailCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{title}</h2>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RailList({ items, empty }: { items: RailItem[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm font-semibold text-slate-500">{empty}</p>;

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <p className="text-sm font-black text-slate-950">{item.title}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">{item.meta}</p>
        </div>
      ))}
    </div>
  );
}
