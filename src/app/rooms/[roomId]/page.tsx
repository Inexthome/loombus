"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const modules = [
  "Overview",
  "Discussions",
  "Calendar",
  "Announcements",
  "Requests",
  "Resources",
  "Services / Store",
  "Members / Roles",
  "Tasks",
  "Polls / Decisions",
  "FAQ",
  "Files",
  "Settings",
];

export default function RoomHubPage() {
  const params = useParams();
  const roomId = Array.isArray(params?.roomId) ? params.roomId[0] : params?.roomId ?? "";

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link
          href="/rooms"
          className="mb-4 inline-flex rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
        >
          ← Back to Rooms
        </Link>

        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">
            Private room hub
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Room hub restored.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
            This canonical room page is back under the current Loombus shell and uses the current Light, System, and Dark appearance variables. Room ID: {roomId}
          </p>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <article
              key={module}
              className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5"
            >
              <h2 className="font-black text-[var(--loombus-text)]">{module}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                {module} is part of the private room hub structure and will continue to use the current Loombus appearance system.
              </p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
