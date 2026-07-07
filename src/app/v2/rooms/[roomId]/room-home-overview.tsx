"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarDays, Clock3, FileText, Lock, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type RoomSnapshot = {
  name: string;
  description: string;
  plan: string;
  status: string;
  privacy: string;
  memberCount: number;
  isPrivate: boolean;
};
type OverviewSnapshot = {
  room: RoomSnapshot;
  latestAnnouncement: string;
  nextEvent: string;
  recentDiscussion: string;
  pendingRequests: number;
  isAdmin: boolean;
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

function formatPlan(value: string) {
  const plans: Record<string, string> = {
    free: "Free Room",
    starter: "Room Starter",
    room_starter: "Room Starter",
    pro: "Room Pro",
    room_pro: "Room Pro",
    organization: "Organization",
    organization_plus: "Organization Plus",
    organization_enterprise: "Organization Enterprise",
  };
  return plans[value] ?? value.replace(/_/g, " ") || "Room Starter";
}

function formatDate(value: string) {
  if (!value) return "No date set";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatRelative(value: string) {
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

function isAdminRole(role: string) {
  return ["owner", "admin", "moderator"].includes(role.toLowerCase());
}

function isRoomHomePath(pathname: string | null, roomId: string) {
  if (!pathname || !roomId) return false;
  return pathname === `/rooms/${roomId}` || pathname === `/v2/rooms/${roomId}`;
}

function findBackToRoomsLink() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/rooms"]'));
  return links.find((link) => link.textContent?.toLowerCase().includes("back to rooms")) ?? null;
}

function buildRoomSnapshot(row: Row, memberCount: number): RoomSnapshot {
  const visibility = asString(row.visibility).toLowerCase() || "public";
  const isPrivate = asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private";
  const plan = asString(row.subscription_plan) || "starter";
  return {
    name: asString(row.name) || asString(row.title) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || asString(row.about) || "Live Loombus room.",
    plan: formatPlan(plan),
    status: asString(row.subscription_status) || "active",
    privacy: isPrivate ? "Private" : "Public",
    memberCount: asNumber(row.member_count) || asNumber(row.members_count) || memberCount,
    isPrivate,
  };
}

export function RoomHomeOverview({ roomId }: { roomId: string }) {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const shouldShow = isRoomHomePath(pathname, roomId);

  useEffect(() => {
    if (!shouldShow) {
      setHost(null);
      return;
    }

    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const backLink = findBackToRoomsLink();
      if (!backLink?.parentElement) return;
      if (activeHost?.parentElement) return;

      const nextHost = document.createElement("div");
      nextHost.setAttribute("data-room-home-overview-host", "true");
      nextHost.className = "mt-4";
      backLink.insertAdjacentElement("afterend", nextHost);
      activeHost = nextHost;
      setHost(nextHost);
    }

    placeHost();
    const observer = new MutationObserver(placeHost);
    observer.observe(document.body, { childList: true, subtree: true });
    const intervalId = window.setInterval(placeHost, 500);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 7000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      activeHost?.remove();
      setHost(null);
    };
  }, [roomId, shouldShow]);

  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!roomId || !shouldShow) {
        if (!cancelled) setSnapshot(null);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      if (!userId) {
        if (!cancelled) setSnapshot(null);
        return;
      }

      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("*").eq("room_id", roomId),
      ]);

      const room = (roomData ?? null) as Row | null;
      if (!room) {
        if (!cancelled) setSnapshot(null);
        return;
      }

      const members = ((memberData ?? []) as Row[]).map((member) => ({ userId: asString(member.user_id), role: asString(member.role) || "member" }));
      const membership = members.find((member) => member.userId === userId);
      const isOwner = asString(room.owner_id) === userId || asString(room.created_by) === userId;
      const isAdmin = isOwner || Boolean(membership && isAdminRole(membership.role));
      const isMember = Boolean(membership) || isOwner;
      const roomSnapshot = buildRoomSnapshot(room, members.length);

      if (roomSnapshot.isPrivate && !isMember) {
        if (!cancelled) setSnapshot(null);
        return;
      }

      const [{ data: announcements }, { data: events }, { data: posts }, { data: applications }] = await Promise.all([
        supabase.from("room_announcements").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(1),
        supabase.from("room_events").select("*").eq("room_id", roomId).gte("starts_at", new Date(Date.now() - 3600000).toISOString()).order("starts_at", { ascending: true }).limit(1),
        supabase.from("room_posts").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(1),
        isAdmin ? supabase.from("room_applications").select("*").eq("room_id", roomId).eq("state", "pending") : Promise.resolve({ data: [] }),
      ]);

      const latestAnnouncement = ((announcements ?? []) as Row[])[0];
      const nextEvent = ((events ?? []) as Row[])[0];
      const recentPost = ((posts ?? []) as Row[])[0];
      const pendingRequests = ((applications ?? []) as Row[]).length;

      if (!cancelled) {
        setSnapshot({
          room: roomSnapshot,
          latestAnnouncement: latestAnnouncement ? asString(latestAnnouncement.title) || "Latest announcement" : "No announcements yet",
          nextEvent: nextEvent ? `${asString(nextEvent.title) || "Next event"} • ${formatDate(asString(nextEvent.starts_at))}` : "No upcoming events",
          recentDiscussion: recentPost ? `${asString(recentPost.title) || "Recent discussion"} • ${formatRelative(asString(recentPost.created_at) || asString(recentPost.updated_at))}` : "No discussions yet",
          pendingRequests,
          isAdmin,
        });
      }
    }

    void loadOverview();
    const { data } = supabase.auth.onAuthStateChange(() => void loadOverview());

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [roomId, shouldShow]);

  const statusCards = useMemo(() => {
    if (!snapshot) return [];
    const cards = [
      { label: "Room status", value: `${snapshot.room.privacy} • ${snapshot.room.status}`, icon: snapshot.room.isPrivate ? Lock : ShieldCheck },
      { label: "Plan", value: snapshot.room.plan, icon: ShieldCheck },
      { label: "Members", value: `${snapshot.room.memberCount} member${snapshot.room.memberCount === 1 ? "" : "s"}`, icon: Users },
      { label: "Latest announcement", value: snapshot.latestAnnouncement, icon: Bell },
      { label: "Next calendar event", value: snapshot.nextEvent, icon: CalendarDays },
      { label: "Recent discussion", value: snapshot.recentDiscussion, icon: FileText },
    ];

    if (snapshot.isAdmin) {
      cards.push({ label: "Pending access requests", value: `${snapshot.pendingRequests} pending`, icon: Clock3 });
    }

    return cards;
  }, [snapshot]);

  if (!host || !shouldShow || !snapshot) return null;

  return createPortal(
    <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-950/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Overview</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Latest in this room</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">A quick dashboard summary. Use Room Menu for full navigation and deeper tools.</p>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">{snapshot.room.privacy}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700 ring-1 ring-slate-200"><Icon className="size-4" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</p>
                  <p className="mt-1 text-sm font-black leading-5 text-slate-950">{card.value}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>,
    host,
  );
}
