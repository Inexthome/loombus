import Link from "next/link";
import { ArrowRight, Lock, MessageCircle, Users } from "lucide-react";

const starterRoom = {
  id: "loombus-community",
  name: "Loombus Community Room",
  description:
    "A private starter room for Loombus updates, focused discussion, shared resources, and community coordination.",
  members: 1,
};

export default function RoomsPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">
            Private Rooms
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Your Rooms</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
            Rooms are focused private spaces inside Loombus. We are starting with one room and will expand the experience carefully from here.
          </p>
        </header>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
              Available room
            </h2>
            <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">
              1 room
            </span>
          </div>

          <article className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]">
                    <Users className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-black tracking-tight">{starterRoom.name}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--loombus-text-muted)]">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        Private
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--loombus-text-muted)]">
                      {starterRoom.description}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/rooms/${starterRoom.id}`}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)] transition hover:opacity-90"
                >
                  Open Room
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-6 grid gap-3 border-t border-[var(--loombus-border)] pt-5 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--loombus-surface-muted)] p-4">
                  <Users className="h-5 w-5 text-[var(--loombus-text-muted)]" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Members</p>
                    <p className="mt-1 text-sm font-black">{starterRoom.members} member</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-[var(--loombus-surface-muted)] p-4">
                  <MessageCircle className="h-5 w-5 text-[var(--loombus-text-muted)]" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Activity</p>
                    <p className="mt-1 text-sm font-black">Ready for the first discussion</p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
