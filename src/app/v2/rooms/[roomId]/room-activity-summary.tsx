"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Activity } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type Room = {
  ownerId: string;
  createdBy: string;
};

type Member = {
  userId: string;
  role: string;
};

type ActivityItem = {
  id: string;
  summary: string;
  eventType: string;
  actorId: string;
  createdAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRoom(row: Row | null): Room | null {
  if (!row) return null;
  return {
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

function normalizeActivity(row: Row, index: number): ActivityItem {
  return {
    id: asString(row.id) || `activity-${index}`,
    summary: asString(row.summary) || "Room activity",
    eventType: asString(row.event_type),
    actorId: asString(row.actor_id),
    createdAt: asString(row.created_at) || null,
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function getShortId(value: string) {
  if (!value) return "System";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

export function RoomActivitySummary({ roomId }: { roomId: string }) {
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [canView, setCanView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const entrySummary = document.querySelector('[data-room-entry-summary="true"]');
      const membersSummary = document.querySelector('[data-room-members-summary="true"]');
      const billingSection = document.getElementById("billing");
      const anchor = entrySummary ?? membersSummary ?? billingSection;
      if (!anchor) return;

      if (activeHost && activeHost.parentElement) {
        if (activeHost.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", activeHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-activity-summary", "true");
      anchor.insertAdjacentElement("afterend", host);
      activeHost = host;
      setRailHost(host);
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
      setRailHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!roomId) return;
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;

      if (!currentUserId) {
        if (!cancelled) {
          setActivity([]);
          setCanView(false);
          setLoading(false);
        }
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

      if (!nextCanView) {
        if (!cancelled) {
          setActivity([]);
          setCanView(false);
          setLoading(false);
        }
        return;
      }

      const { data: activityData } = await supabase
        .from("room_activity_log")
        .select("id,summary,event_type,actor_id,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(12);

      if (!cancelled) {
        setActivity(((activityData ?? []) as Row[]).map(normalizeActivity).filter((item) => item.id));
        setCanView(true);
        setLoading(false);
      }
    }

    loadSummary();

    const channel = supabase
      .channel(`room-activity-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_activity_log", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  if (!railHost || (!canView && !loading)) return null;

  const latest = activity[0];
  const actors = new Set(activity.map((item) => item.actorId).filter(Boolean)).size;

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" id="room-activity">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Activity / Audit Log</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Accountability</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <Activity className="size-5" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-2xl font-black text-slate-950">{loading ? "—" : activity.length}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Recent events</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-2xl font-black text-slate-950">{loading ? "—" : actors}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Actors</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Latest activity</p>
        {latest ? (
          <div className="mt-2">
            <p className="text-sm font-black text-slate-950">{latest.summary}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{latest.eventType.replace(/_/g, " ")} · {getShortId(latest.actorId)} · {formatRelativeTime(latest.createdAt)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-slate-600">No activity tracked yet.</p>
        )}
      </div>
      <Link href={`/rooms/${roomId}/activity`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
        Open Activity Log
      </Link>
    </section>,
    railHost,
  );
}
