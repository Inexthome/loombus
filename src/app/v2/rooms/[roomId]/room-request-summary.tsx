"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type RequestSummary = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRequest(row: Row, index: number): RequestSummary {
  return {
    id: asString(row.id) || `request-${index}`,
    title: asString(row.title) || "Untitled request",
    category: asString(row.category) || "general",
    status: asString(row.status) || "open",
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
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function RoomRequestSummary({ roomId }: { roomId: string }) {
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!roomId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("room_requests")
        .select("id,title,category,status,created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!cancelled) {
        setRequests(error ? [] : ((data ?? []) as Row[]).map(normalizeRequest));
        setLoading(false);
      }
    }

    loadSummary();

    const channel = supabase
      .channel(`room-request-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_requests", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const activeRequests = requests.filter((request) => request.status === "open" || request.status === "in_progress");
  const latestRequest = requests[0];

  return (
    <aside className="fixed bottom-24 right-5 z-[120] w-[min(92vw,360px)] rounded-[1.25rem] border border-slate-200 bg-white p-4 text-slate-950 shadow-2xl sm:bottom-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <ClipboardList className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Room requests</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              {loading ? "Checking requests" : `${activeRequests.length} active request${activeRequests.length === 1 ? "" : "s"}`}
            </h2>
          </div>
        </div>
        {activeRequests.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">Needs review</span>}
      </div>

      {latestRequest ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{latestRequest.status.replace(/_/g, " ")}</span>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{latestRequest.category}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-black text-slate-900">{latestRequest.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Submitted {formatRelativeTime(latestRequest.createdAt)}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-200">No submitted room requests yet.</p>
      )}

      <Link href={`/rooms/${roomId}/requests`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
        Open Request Center
      </Link>
    </aside>
  );
}
