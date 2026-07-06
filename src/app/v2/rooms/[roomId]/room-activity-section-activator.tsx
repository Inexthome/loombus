"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Activity } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveHubAnchor() {
  const overview = document.getElementById("overview");
  const discussions = document.getElementById("discussions");
  const members = document.getElementById("members");
  return members ?? discussions ?? overview;
}

function normalizeRoom(row: Row | null) {
  if (!row) return null;
  return {
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizeMember(row: Row) {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

export function RoomActivitySectionActivator({ roomId }: { roomId: string }) {
  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function activate() {
      const anchor = resolveHubAnchor();
      if (!anchor) return;

      const existingHost = document.querySelector<HTMLElement>('[data-room-activity-section-host="true"]');
      if (existingHost) {
        activeHost = existingHost;
        setSectionHost(existingHost);
        return;
      }

      const host = document.createElement("section");
      host.setAttribute("data-room-activity-section-host", "true");
      host.setAttribute("id", "activity");
      host.className = "rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm";
      anchor.insertAdjacentElement("afterend", host);
      activeHost = host;
      setSectionHost(host);
    }

    activate();
    const observer = new MutationObserver(activate);
    observer.observe(document.body, { childList: true, subtree: true });
    const intervalId = window.setInterval(activate, 500);
    const timeoutId = window.setTimeout(() => window.clearInterval(intervalId), 8000);

    return () => {
      observer.disconnect();
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
      activeHost?.remove();
      setSectionHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (!currentUserId) {
        if (!cancelled) setCanView(false);
        return;
      }

      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        supabase.from("rooms").select("owner_id,created_by").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("user_id,role").eq("room_id", roomId),
      ]);

      const room = normalizeRoom((roomData as Row | null) ?? null);
      const members = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      const currentMember = members.find((member) => member.userId === currentUserId);
      const nextCanView = Boolean(room && (room.ownerId === currentUserId || room.createdBy === currentUserId)) || currentMember?.role === "owner" || currentMember?.role === "admin";

      if (!cancelled) setCanView(Boolean(nextCanView));
    }

    checkAccess();
    const { data } = supabase.auth.onAuthStateChange(checkAccess);

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [roomId]);

  if (!sectionHost || !canView) return null;

  const livePanel = (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <Activity className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Room Activity / Audit Log is live</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Accountability for room owners and admins</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
              Review who changed what and when across members, invites, join requests, announcements, resources, services, room requests, and room controls.
            </p>
          </div>
        </div>
        <Link href={`/rooms/${roomId}/activity`} className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
          Open Activity Log
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Access</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Owner/admin only.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Scope</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Entry, members, content, services, and controls.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">History</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Tracks new actions after activation.</p>
        </div>
      </div>
    </div>
  );

  return createPortal(livePanel, sectionHost);
}
