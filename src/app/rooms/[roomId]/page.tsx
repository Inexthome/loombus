import Link from "next/link";
import { ArrowLeft, CalendarDays, FileText, Lock, Megaphone, MessageCircle, Users } from "lucide-react";

const roomModules = [
  {
    title: "Discussions",
    description: "Start focused private conversations for room members.",
    icon: MessageCircle,
  },
  {
    title: "Announcements",
    description: "Share important room updates in one dependable place.",
    icon: Megaphone,
  },
  {
    title: "Calendar",
    description: "Keep upcoming meetings and room events visible.",
    icon: CalendarDays,
  },
  {
    title: "Resources",
    description: "Organize useful links, documents, and shared information.",
    icon: FileText,
  },
];

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const isStarterRoom = roomId === "loombus-community";

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link
          href="/rooms"
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Rooms
        </Link>

        {!isStarterRoom ? (
          <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private Room</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Room not found</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">
              This room is not available. Return to Rooms to open the current starter room.
            </p>
          </section>
        ) : (
          <>
            <header className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
              <div className="p-6 sm:p-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private Room</p>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        Private
                      </span>
                    </div>
                    <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Loombus Community Room</h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
                      A focused private space for Loombus updates, discussions, shared resources, and community coordination.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 rounded-2xl bg-[var(--loombus-surface-muted)] p-4 ring-1 ring-[var(--loombus-border)]">
                    <Users className="h-5 w-5 text-[var(--loombus-text-muted)]" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Members</p>
                      <p className="mt-1 text-sm font-black">1 member</p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            <section className="mt-6">
              <div className="mb-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Room areas</h2>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">The first room begins with four core areas. Each can be wired into live room data one at a time.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {roomModules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <article key={module.title} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
                      <div className="flex items-start gap-4">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-surface-muted)] ring-1 ring-[var(--loombus-border)]">
                          <Icon className="h-5 w-5 text-[var(--loombus-text-muted)]" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="font-black">{module.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{module.description}</p>
                          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Coming next</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
