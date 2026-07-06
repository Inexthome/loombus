"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type EntryItem = {
  id: string;
  type: "request" | "invite";
  label: string;
  status: string;
  createdAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeRequest(row: Row, index: number): EntryItem {
  return {
    id: asString(row.id) || `request-${index}`,
    type: "request",
    label: asString(row.requester_user_id) || "Join request",
    status: asString(row.status) || "pending",
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeInvite(row: Row, index: number): EntryItem {
  return {
    id: asString(row.id) || `invite-${index}`,
    type: "invite",
    label: asString(row.invited_email) || asString(row.invited_user_id) || "Room invite",
    status: asString(row.status) || "pending",
    createdAt: asString(row.created_at) || null,
  };
}

export function RoomEntrySummary({ roomId }: { roomId: string }) {
  const [items, setItems] = useState<EntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const membersSummary = document.querySelector('[data-room-members-summary="true"]');
      const billingSection = document.getElementById("billing");
      const anchor = membersSummary ?? billingSection;
      if (!anchor) return;

      if (activeHost && activeHost.parentElement) {
        if (activeHost.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", activeHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-entry-summary", "true");
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

      const [{ data: requestData }, { data: inviteData }] = await Promise.all([
        supabase.from("room_join_requests").select("id,requester_user_id,status,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(8),
        supabase.from("room_invites").select("id,invited_email,invited_user_id,status,created_at").eq("room_id", roomId).order("created_at", { ascending: false }).limit(8),
      ]);

      if (!cancelled) {
        const nextItems = [
          ...((requestData ?? []) as Row[]).map(normalizeRequest),
          ...((inviteData ?? []) as Row[]).map(normalizeInvite),
        ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
        setItems(nextItems);
        setLoading(false);
      }
    }

    loadSummary();

    const requestsChannel = supabase
      .channel(`room-entry-requests-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_join_requests", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();
    const invitesChannel = supabase
      .channel(`room-entry-invites-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_invites", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(requestsChannel);
      supabase.removeChannel(invitesChannel);
    };
  }, [roomId]);

  if (!railHost) return null;

  const pendingRequests = items.filter((item) => item.type === "request" && item.status === "pending").length;
  const pendingInvites = items.filter((item) => item.type === "invite" && item.status === "pending").length;
  const latest = items[0];

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" id="room-entry">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Invites / Join Requests</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Entry control</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          <UserPlus className="size-5" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-2xl font-black text-slate-950">{loading ? "—" : pendingRequests}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pending requests</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <p className="text-2xl font-black text-slate-950">{loading ? "—" : pendingInvites}</p>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Pending invites</p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Latest entry activity</p>
        {latest ? (
          <div className="mt-2">
            <p className="break-all text-sm font-black text-slate-950">{latest.label}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{latest.type === "request" ? "Join request" : "Invite"} · {latest.status} · {formatRelativeTime(latest.createdAt)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-slate-600">No visible entry activity yet.</p>
        )}
      </div>
      <Link href={`/rooms/${roomId}/invites`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
        Open Invites / Join Requests
      </Link>
    </section>,
    railHost,
  );
}
