"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UsersRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

type DirectoryContact = {
  id: string;
  name: string;
  contactType: string;
  roleTitle: string;
  organization: string;
  isPinned: boolean;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  return value === true;
}

function normalizeContact(row: Row): DirectoryContact {
  return {
    id: asString(row.id),
    name: asString(row.name) || "Unnamed contact",
    contactType: asString(row.contact_type) || "general",
    roleTitle: asString(row.role_title),
    organization: asString(row.organization),
    isPinned: asBoolean(row.is_pinned),
  };
}

function getTypeLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function RoomDirectorySummary({ roomId }: { roomId: string }) {
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [canView, setCanView] = useState(false);
  const [railHost, setRailHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let activeHost: HTMLElement | null = null;

    function placeHost() {
      const pollsSummary = document.querySelector('[data-room-polls-summary="true"]');
      const tasksSummary = document.querySelector('[data-room-tasks-summary="true"]');
      const activitySummary = document.querySelector('[data-room-activity-summary="true"]');
      const entrySummary = document.querySelector('[data-room-entry-summary="true"]');
      const billingSection = document.getElementById("billing");
      const anchor = pollsSummary ?? tasksSummary ?? activitySummary ?? entrySummary ?? billingSection;
      if (!anchor) return;

      if (activeHost?.parentElement) {
        if (activeHost.previousElementSibling !== anchor) anchor.insertAdjacentElement("afterend", activeHost);
        return;
      }

      const host = document.createElement("div");
      host.setAttribute("data-room-directory-summary", "true");
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

      const { data: contactData } = await supabase
        .from("room_directory_contacts")
        .select("*")
        .eq("room_id", roomId)
        .order("is_pinned", { ascending: false })
        .order("contact_type", { ascending: true })
        .order("name", { ascending: true })
        .limit(12);

      if (!cancelled) {
        setContacts(((contactData ?? []) as Row[]).map(normalizeContact).filter((contact) => contact.id));
        setCanView(true);
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  if (!railHost || !canView) return null;

  const pinnedContacts = contacts.filter((contact) => contact.isPinned);
  const emergencyContacts = contacts.filter((contact) => contact.contactType === "emergency");
  const latest = contacts[0];
  const latestSubtitle = latest ? [latest.roleTitle, latest.organization].filter(Boolean).join(" · ") : "";

  return createPortal(
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm" id="room-directory">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Room Directory / Contacts</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Official contacts</h2>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100"><UsersRound className="size-5" /></span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{contacts.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Total</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{pinnedContacts.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Pinned</p></div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xl font-black text-slate-950">{emergencyContacts.length}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Emergency</p></div>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Featured contact</p>
        <p className="mt-2 text-sm font-black text-slate-950">{latest?.name ?? "No contacts added yet."}</p>
        {latest && <p className="mt-1 text-xs font-semibold text-slate-500">{getTypeLabel(latest.contactType)}{latestSubtitle ? ` · ${latestSubtitle}` : ""}</p>}
      </div>
      <Link href={`/rooms/${roomId}/directory`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Open Directory</Link>
    </section>,
    railHost,
  );
}
