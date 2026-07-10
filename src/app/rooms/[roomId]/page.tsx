"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  FileText,
  Library,
  Lock,
  MemoryStick,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

const desktopTabs = ["Discussions", "Library", "Members", "Room Memory"] as const;
const mobileTabs = ["Discussions", "Room Memory", "Library", "Members"] as const;
type RoomTab = (typeof desktopTabs)[number];

const discussions = [
  { mode: "Problem Solving", title: "How should the team prioritize the next release?", state: "6 contributors · 3 proposals", signal: "High signal" },
  { mode: "Research Question", title: "What evidence should guide our customer onboarding changes?", state: "4 contributors · 8 references", signal: "Developing" },
  { mode: "Debate", title: "Should this decision graduate to the public Loombus feed?", state: "Room vote open", signal: "Decision needed" },
];

export default function RoomPage() {
  const params = useParams();
  const roomId = Array.isArray(params?.roomId) ? params.roomId[0] : params?.roomId ?? "";
  const [activeTab, setActiveTab] = useState<RoomTab>("Discussions");
  const isTeamRoom = roomId === "team-room";

  if (!isTeamRoom) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl">
          <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="h-4 w-4" />Back to Rooms</Link>
          <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 shadow-xl shadow-black/5"><h1 className="text-3xl font-black">Room not found</h1><p className="mt-3 text-sm text-[var(--loombus-text-muted)]">This room is not available.</p></section>
        </section>
      </main>
    );
  }

  const tabs = typeof window !== "undefined" && window.innerWidth < 768 ? mobileTabs : desktopTabs;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link href="/rooms/new" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"><ArrowLeft className="h-4 w-4" />Back to Team Room setup</Link>

        <header className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-500">Team Room</p><span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black"><Lock className="h-3.5 w-3.5" />Private</span><span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black">Invite-only</span></div>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Team Room</h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[var(--loombus-text-muted)]">A focused private space for team decisions, shared knowledge, and structured discussion.</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Permanent room charter</p>
            </div>
            <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4 ring-1 ring-[var(--loombus-border)]"><div className="flex items-center gap-3"><Users className="h-5 w-5" /><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Members</p><p className="mt-1 font-black">1 of 250</p></div></div></div>
          </div>
        </header>

        <nav className="mt-5 flex gap-2 overflow-x-auto pb-2 md:hidden">
          {mobileTabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${activeTab === tab ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]" : "bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] ring-1 ring-[var(--loombus-border)]"}`}>{tab}</button>)}
        </nav>
        <nav className="mt-5 hidden gap-2 overflow-x-auto pb-2 md:flex">
          {tabs.map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-black ${activeTab === tab ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]" : "bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)] ring-1 ring-[var(--loombus-border)]"}`}>{tab}</button>)}
        </nav>

        <section className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            {activeTab === "Discussions" && (
              <section>
                <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Main lane</p><h2 className="mt-2 text-2xl font-black">Discussions</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Sorted by signal, not recency.</p></div><button className="rounded-2xl bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)]">Start discussion</button></div>
                <div className="mt-5 space-y-4">{discussions.map((discussion) => <article key={discussion.title} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black">{discussion.mode}</span><span className="text-xs font-black text-[var(--loombus-text-subtle)]">{discussion.signal}</span></div><h3 className="mt-4 text-xl font-black leading-snug">{discussion.title}</h3><p className="mt-3 text-sm font-semibold text-[var(--loombus-text-muted)]">{discussion.state}</p></article>)}</div>
              </section>
            )}
            {activeTab === "Room Memory" && <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8"><div className="flex items-center gap-3"><MemoryStick className="h-6 w-6" /><h2 className="text-2xl font-black">Room Memory</h2></div><p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">An AI-maintained view of what this room has concluded, what remains open, and what new members need to know.</p><div className="mt-6 grid gap-4 md:grid-cols-2"><article className="rounded-2xl bg-[var(--loombus-surface-muted)] p-5"><span className="text-xs font-black uppercase tracking-[0.14em] text-emerald-600">Decided</span><h3 className="mt-3 font-black">Prioritize customer onboarding before expansion work.</h3></article><article className="rounded-2xl bg-[var(--loombus-surface-muted)] p-5"><span className="text-xs font-black uppercase tracking-[0.14em] text-amber-600">Open</span><h3 className="mt-3 font-black">Whether the next roadmap discussion should graduate to public.</h3></article></div></section>}
            {activeTab === "Library" && <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8"><div className="flex items-center gap-3"><Library className="h-6 w-6" /><h2 className="text-2xl font-black">Library</h2></div><p className="mt-3 text-sm text-[var(--loombus-text-muted)]">Pinned files, links, reference discussions, and shared documents.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4"><FileText className="h-5 w-5" /><p className="mt-3 font-black">Team operating charter</p></div><div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4"><CalendarDays className="h-5 w-5" /><p className="mt-3 font-black">Decision calendar</p></div></div></section>}
            {activeTab === "Members" && <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8"><div className="flex items-center gap-3"><Users className="h-6 w-6" /><h2 className="text-2xl font-black">Members</h2></div><p className="mt-3 text-sm text-[var(--loombus-text-muted)]">Owner, admin, member, and viewer roles without online-now pressure, typing indicators, or read receipts.</p></section>}
          </div>

          <aside className="hidden space-y-4 lg:block">
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5"><div className="flex items-center gap-3"><MemoryStick className="h-5 w-5" /><h2 className="font-black">Room Memory</h2></div><p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">2 decisions captured · 1 question still open.</p><button onClick={() => setActiveTab("Room Memory")} className="mt-4 text-sm font-black">Open memory →</button></section>
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5"><div className="flex items-center gap-3"><BookOpen className="h-5 w-5" /><h2 className="font-black">Active threads</h2></div><div className="mt-4 space-y-3 text-sm font-semibold text-[var(--loombus-text-muted)]"><p>Release priority workshop</p><p>Onboarding evidence review</p><p>Public graduation vote</p></div></section>
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" /><h2 className="font-black">Privacy</h2></div><div className="mt-4 space-y-3 text-sm leading-6 text-[var(--loombus-text-muted)]"><p><strong className="text-[var(--loombus-text)]">Invites:</strong> Owner and admins</p><p><strong className="text-[var(--loombus-text)]">Graduate to public:</strong> By room vote</p><p><strong className="text-[var(--loombus-text)]">Read receipts:</strong> Off</p><p><strong className="text-[var(--loombus-text)]">Typing indicators:</strong> Off</p></div></section>
          </aside>
        </section>
      </section>
    </main>
  );
}
