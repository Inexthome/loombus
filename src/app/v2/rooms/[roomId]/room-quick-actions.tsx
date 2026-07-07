"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  FolderOpen,
  Megaphone,
  MessageCircle,
  Plus,
  Users,
  Vote,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;
type AccessLevel = "none" | "member" | "admin";
type QuickAction = {
  label: string;
  description: string;
  href: (roomId: string) => string;
  icon: typeof MessageCircle;
  adminOnly?: boolean;
};

const ADMIN_ACTIONS: QuickAction[] = [
  { label: "Post announcement", description: "Publish an important room update.", href: (roomId) => `/rooms/${roomId}/announcements`, icon: Megaphone, adminOnly: true },
  { label: "Add calendar event", description: "Open the room schedule.", href: (roomId) => `/rooms/${roomId}/calendar`, icon: CalendarDays, adminOnly: true },
  { label: "Create form", description: "Collect structured submissions.", href: (roomId) => `/rooms/${roomId}/forms`, icon: FileQuestion, adminOnly: true },
  { label: "Add document", description: "Open shared files and documents.", href: (roomId) => `/rooms/${roomId}/documents`, icon: FolderOpen, adminOnly: true },
  { label: "Create task", description: "Track action items.", href: (roomId) => `/rooms/${roomId}/tasks`, icon: CheckCircle2, adminOnly: true },
  { label: "Create poll", description: "Capture room decisions.", href: (roomId) => `/rooms/${roomId}/polls`, icon: Vote, adminOnly: true },
  { label: "Manage members", description: "Review roles and access.", href: (roomId) => `/rooms/${roomId}/members`, icon: Users, adminOnly: true },
];

const MEMBER_ACTIONS: QuickAction[] = [
  { label: "Start discussion", description: "Open private room discussions.", href: (roomId) => `/rooms/${roomId}/discussions`, icon: MessageCircle },
  { label: "Submit request", description: "Send a room request.", href: (roomId) => `/rooms/${roomId}/requests`, icon: ClipboardList },
  { label: "View calendar", description: "See upcoming room dates.", href: (roomId) => `/rooms/${roomId}/calendar`, icon: CalendarDays },
  { label: "Open files", description: "View room documents.", href: (roomId) => `/rooms/${roomId}/documents`, icon: FolderOpen },
  { label: "Open forms", description: "View room forms.", href: (roomId) => `/rooms/${roomId}/forms`, icon: FileQuestion },
];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRoomHomePath(pathname: string | null, roomId: string) {
  if (!pathname || !roomId) return false;
  return pathname === `/rooms/${roomId}` || pathname === `/v2/rooms/${roomId}`;
}

function findBackToRoomsLink() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href="/rooms"]'));
  return links.find((link) => link.textContent?.toLowerCase().includes("back to rooms")) ?? null;
}

function isAdminRole(role: string) {
  return ["owner", "admin", "moderator"].includes(role.toLowerCase());
}

export function RoomQuickActions({ roomId }: { roomId: string }) {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("none");
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
      nextHost.setAttribute("data-room-quick-actions-host", "true");
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

    async function loadAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id ?? null;
      if (!userId || !roomId || !shouldShow) {
        if (!cancelled) setAccessLevel("none");
        return;
      }

      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("*").eq("room_id", roomId),
      ]);

      const room = (roomData ?? {}) as Row;
      const members = ((memberData ?? []) as Row[]).map((member) => ({ userId: asString(member.user_id), role: asString(member.role) || "member" }));
      const member = members.find((item) => item.userId === userId);
      const isOwner = asString(room.owner_id) === userId || asString(room.created_by) === userId;
      const isAdmin = isOwner || Boolean(member && isAdminRole(member.role));
      const isMember = Boolean(member) || isOwner;

      if (!cancelled) setAccessLevel(isAdmin ? "admin" : isMember ? "member" : "none");
    }

    void loadAccess();
    const { data } = supabase.auth.onAuthStateChange(() => void loadAccess());

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [roomId, shouldShow]);

  const actions = useMemo(() => (accessLevel === "admin" ? ADMIN_ACTIONS : MEMBER_ACTIONS), [accessLevel]);

  if (!host || !shouldShow || accessLevel === "none") return null;

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-950/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Quick Actions</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Jump into common room work</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">Room Menu handles full navigation. These shortcuts keep the hub fast without filling the page.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">
          <Plus className="size-3" /> {accessLevel === "admin" ? "Owner/Admin" : "Member"}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href(roomId)}
              className="group rounded-2xl border border-slate-200 bg-slate-50 p-3 transition hover:border-amber-200 hover:bg-amber-50"
            >
              <span className="flex items-center gap-2 text-sm font-black text-slate-900 group-hover:text-amber-800">
                <Icon className="size-4 text-amber-700" /> {action.label}
              </span>
              <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">{action.description}</span>
            </Link>
          );
        })}
      </div>
    </section>,
    host,
  );
}
