"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type RoomDocument = {
  id: string;
  title: string;
  description: string;
  category: string;
  fileUrl: string;
  isPinned: boolean;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function normalizeDocument(row: Row): RoomDocument {
  return {
    id: asString(row.id),
    title: asString(row.title) || "Untitled document",
    description: asString(row.description),
    category: asString(row.category) || "general",
    fileUrl: asString(row.file_url),
    isPinned: asBoolean(row.is_pinned),
  };
}

export function RoomDocumentsSummary({ roomId }: { roomId: string }) {
  const [documents, setDocuments] = useState<RoomDocument[]>([]);
  const [canView, setCanView] = useState(false);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const faqSummary = document.querySelector('[data-room-faq-summary="true"]');
      const directorySummary = document.querySelector('[data-room-directory-summary="true"]');
      const pollsSummary = document.querySelector('[data-room-polls-summary="true"]');
      const tasksSummary = document.querySelector('[data-room-tasks-summary="true"]');
      const activitySummary = document.querySelector('[data-room-activity-summary="true"]');
      const entrySummary = document.querySelector('[data-room-entry-summary="true"]');
      const billingSection = document.getElementById("billing");
      const anchor = faqSummary ?? directorySummary ?? pollsSummary ?? tasksSummary ?? activitySummary ?? entrySummary ?? billingSection;
      if (!anchor) return;

      if (activeHost?.parentElement) {
        if (activeHost.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", activeHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-documents-summary", "true");
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
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;
      if (!currentUserId || !roomId) {
        if (!cancelled) setCanView(false);
        return;
      }

      const [{ data: roomData }, { data: memberData }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(),
        supabase.from("room_members").select("*").eq("room_id", roomId),
      ]);

      const room = (roomData ?? {}) as Row;
      const members = ((memberData ?? []) as Row[]).map((member) => asString(member.user_id));
      const isOwner = asString(room.owner_id) === currentUserId || asString(room.created_by) === currentUserId;
      const isMember = members.includes(currentUserId);

      if (!isOwner && !isMember) {
        if (!cancelled) setCanView(false);
        return;
      }

      const { data: documentData } = await supabase
        .from("room_documents")
        .select("*")
        .eq("room_id", roomId)
        .order("is_pinned", { ascending: false })
        .order("category", { ascending: true })
        .order("title", { ascending: true })
        .limit(12);

      if (!cancelled) {
        setDocuments(((documentData ?? []) as Row[]).map(normalizeDocument).filter((document) => document.id));
        setCanView(true);
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const categoryCount = useMemo(() => new Set(documents.map((document) => document.category).filter(Boolean)).size, [documents]);

  if (!railHost || !canView) return null;

  const pinnedDocuments = documents.filter((document) => document.isPinned);
  const latest = documents[0];

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" id="room-documents">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Files / Documents</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Member document library</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><FileText className="size-5" /></span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{documents.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Files</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{pinnedDocuments.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Pinned</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{categoryCount}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Categories</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Featured document</p>
        <p className="mt-2 text-sm font-black text-slate-950">{latest?.title ?? "No documents added yet."}</p>
        {latest && <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{latest.category} · {latest.description || latest.fileUrl}</p>}
      </div>
      <Link href={`/rooms/${roomId}/documents`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Open Documents</Link>
    </section>,
    railHost,
  );
}
