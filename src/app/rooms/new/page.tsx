"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  FileText,
  Library,
  Megaphone,
  MemoryStick,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";

const standardFeatures = [
  { label: "Discussions", icon: BookOpen },
  { label: "Documents", icon: FileText },
  { label: "Calendar", icon: CalendarDays },
];

const optionalFeatures = [
  { id: "notices", label: "Notices", description: "Short operational updates that stay easy to scan.", icon: Megaphone },
  { id: "votes", label: "Votes", description: "Structured room decisions with visible outcomes.", icon: Vote },
  { id: "directory", label: "Directory Board", description: "People, roles, vendors, and trusted contacts.", icon: Users },
  { id: "memory", label: "Room Memory", description: "AI-maintained conclusions, open questions, and decisions.", icon: MemoryStick },
  { id: "library", label: "Library", description: "Pinned files, links, references, and key discussions.", icon: Library },
  { id: "announcements", label: "Announcements", description: "Important owner updates with durable visibility.", icon: Megaphone },
  { id: "members", label: "Member Roles", description: "Owner, admin, member, and viewer permissions.", icon: ShieldCheck },
];

export default function NewRoomPage() {
  const [selected, setSelected] = useState<string[]>(["memory", "library", "announcements"]);
  const [roomName, setRoomName] = useState("Team Room");
  const [charter, setCharter] = useState("A focused private space for team decisions, shared knowledge, and structured discussion.");

  const featureCount = useMemo(() => standardFeatures.length + selected.length, [selected]);

  function toggleFeature(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Rooms
        </Link>

        <header className="mt-6 grid gap-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700 dark:text-amber-500">Team Room</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Build a private room for your team.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
              Up to 250 members for $49 per month. Discussions, Documents, and Calendar are always included. Add only the room surfaces your team needs.
            </p>
          </div>
          <aside className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Room Pro</p>
            <p className="mt-3 text-4xl font-black">$49<span className="text-base text-[var(--loombus-text-muted)]">/mo</span></p>
            <p className="mt-2 text-sm font-bold text-[var(--loombus-text-muted)]">Up to 250 members</p>
            <p className="mt-4 text-sm leading-6 text-[var(--loombus-text-muted)]">{featureCount} room surfaces selected</p>
          </aside>
        </header>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
              <h2 className="text-xl font-black">Room identity</h2>
              <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">The charter stays permanently visible in the room header.</p>
              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-black">Room name</span>
                  <input value={roomName} onChange={(event) => setRoomName(event.target.value)} className="mt-2 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-bold outline-none" />
                </label>
                <label className="block">
                  <span className="text-sm font-black">One-line charter</span>
                  <textarea value={charter} onChange={(event) => setCharter(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm leading-6 outline-none" />
                </label>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
              <h2 className="text-xl font-black">Included with every Team Room</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {standardFeatures.map((feature) => {
                  const Icon = feature.icon;
                  return <div key={feature.label} className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4 ring-1 ring-[var(--loombus-border)]"><Icon className="h-5 w-5" /><p className="mt-3 font-black">{feature.label}</p><p className="mt-1 text-xs font-bold text-emerald-600">Standard</p></div>;
                })}
              </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
              <h2 className="text-xl font-black">Choose additional room surfaces</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {optionalFeatures.map((feature) => {
                  const Icon = feature.icon;
                  const active = selected.includes(feature.id);
                  return (
                    <button key={feature.id} type="button" onClick={() => toggleFeature(feature.id)} className={`rounded-[1.25rem] border p-4 text-left transition ${active ? "border-[var(--loombus-text)] bg-[var(--loombus-surface-muted)]" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:bg-[var(--loombus-surface-muted)]"}`}>
                      <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--loombus-surface-muted)] ring-1 ring-[var(--loombus-border)]"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-3"><span className="font-black">{feature.label}</span>{active && <Check className="h-5 w-5 text-emerald-600" />}</span><span className="mt-1 block text-sm leading-6 text-[var(--loombus-text-muted)]">{feature.description}</span></span></div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Preview</p>
              <h2 className="mt-3 text-2xl font-black">{roomName || "Team Room"}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{charter || "Add a charter for this room."}</p>
              <div className="mt-5 flex flex-wrap gap-2"><span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black">Private</span><span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black">250 members</span></div>
              <Link href="/rooms/team-room" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)]">Preview Team Room</Link>
              <p className="mt-3 text-center text-xs text-[var(--loombus-text-subtle)]">Checkout and live room creation will be wired separately.</p>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
