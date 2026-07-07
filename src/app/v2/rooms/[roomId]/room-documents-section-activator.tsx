"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileText, Pin, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveHubAnchor() {
  const faq = document.getElementById("faq");
  const directory = document.getElementById("directory");
  const polls = document.getElementById("polls");
  const tasks = document.getElementById("tasks");
  const activity = document.getElementById("activity");
  const members = document.getElementById("members");
  const discussions = document.getElementById("discussions");
  const overview = document.getElementById("overview");
  return faq ?? directory ?? polls ?? tasks ?? activity ?? members ?? discussions ?? overview;
}

export function RoomDocumentsSectionActivator({ roomId }: { roomId: string }) {
  const [sectionHost, setSectionHost] = useState<HTMLElement | null>(null);
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function activate() {
      const anchor = resolveHubAnchor();
      if (!anchor) return;

      const existingHost = document.querySelector<HTMLElement>('[data-room-documents-section-host="true"]');
      if (existingHost) {
        activeHost = existingHost;
        setSectionHost(existingHost);
        return;
      }

      const host = document.createElement("section");
      host.setAttribute("data-room-documents-section-host", "true");
      host.setAttribute("id", "documents");
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

      if (!cancelled) setCanView(Boolean(isOwner || isMember));
    }

    checkAccess();
    const { data } = supabase.auth.onAuthStateChange(() => checkAccess());

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [roomId]);

  if (!sectionHost || !canView) return null;

  return createPortal(
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
            <FileText className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Room Files / Documents is live</p>
            <h2 className="mt-1 max-w-2xl text-xl font-black leading-tight text-slate-950 sm:text-2xl">Keep important room documents in one place</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-700">
              Store links to bylaws, forms, packets, policies, handbooks, clinic forms, school documents, and vendor files for approved members.
            </p>
          </div>
        </div>
        <Link href={`/rooms/${roomId}/documents`} className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 sm:w-auto">
          Open Documents
        </Link>
      </div>
      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><FileText className="size-3 text-amber-700" /> Files</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Add important documents with titles, descriptions, categories, and file links.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><Search className="size-3 text-amber-700" /> Search</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Members can search and filter document links by category.</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500"><Pin className="size-3 text-amber-700" /> Pinned</div>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-700">Pin critical packets, rules, forms, and links for quick access.</p>
        </div>
      </div>
      <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-100">
        <ExternalLink className="size-3" /> External links MVP
      </p>
    </div>,
    sectionHost,
  );
}
