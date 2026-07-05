"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type ResourceSummary = {
  id: string;
  title: string;
  resourceType: string;
  isPinned: boolean;
  createdAt: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function normalizeResource(row: Row, index: number): ResourceSummary {
  return {
    id: asString(row.id) || `resource-${index}`,
    title: asString(row.title) || "Untitled resource",
    resourceType: asString(row.resource_type) || "link",
    isPinned: asBoolean(row.is_pinned),
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

export function RoomResourceSummary({ roomId }: { roomId: string }) {
  const [resources, setResources] = useState<ResourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const requestSummary = document.querySelector('[data-room-request-summary="true"]');
    const billingSection = document.getElementById("billing");
    const anchor = requestSummary ?? billingSection;
    if (!anchor) return;

    const host = document.createElement("div");
    host.setAttribute("data-room-resource-summary", "true");
    anchor.insertAdjacentElement("afterend", host);
    setRailHost(host);

    return () => {
      host.remove();
      setRailHost(null);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!roomId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("room_resources")
        .select("id,title,resource_type,is_pinned,created_at")
        .eq("room_id", roomId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5);

      if (!cancelled) {
        setResources(error ? [] : ((data ?? []) as Row[]).map(normalizeResource));
        setLoading(false);
      }
    }

    loadSummary();

    const channel = supabase
      .channel(`room-resource-summary-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_resources", filter: `room_id=eq.${roomId}` }, loadSummary)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const pinnedCount = resources.filter((resource) => resource.isPinned).length;
  const latestResource = resources[0];

  const card = (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-slate-950 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <FileText className="size-5" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Room resources</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              {loading ? "Checking resources" : `${resources.length} resource${resources.length === 1 ? "" : "s"}`}
            </h2>
          </div>
        </div>
        {pinnedCount > 0 && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-700 ring-1 ring-amber-100">{pinnedCount} pinned</span>}
      </div>

      {latestResource ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            {latestResource.isPinned && <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Pinned</span>}
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{latestResource.resourceType}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-black text-slate-900">{latestResource.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-400">Added {formatRelativeTime(latestResource.createdAt)}</p>
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-200">No room resources yet.</p>
      )}

      <Link href={`/rooms/${roomId}/resources`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
        Open Resource Center
      </Link>
    </section>
  );

  if (!railHost) return null;
  return createPortal(card, railHost);
}
