import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Loombus | Signal over noise",
  description:
    "Loombus is a signal-first discussion platform for thoughtful conversations, sharper ideas, and cleaner community dialogue.",
  alternates: {
    canonical: "https://loombus.com/",
  },
};

const signalCards = [
  {
    title: "Structured discussions",
    description: "Follow questions, context, replies, and signal without losing the thread.",
    icon: "◌",
  },
  {
    title: "People and topics",
    description: "Find thoughtful contributors, saved ideas, and topics worth returning to.",
    icon: "⌘",
  },
  {
    title: "Search with intent",
    description: "Move through discussions, people, saved items, and activity with clearer navigation.",
    icon: "⌕",
  },
];

export default function RootPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
      <section className="relative min-h-screen px-6 py-7 sm:px-10 lg:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_52%,rgba(214,166,94,0.14),transparent_30%),radial-gradient(circle_at_96%_72%,rgba(148,163,184,0.22),transparent_38%)]"
        />

        <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl flex-col">
          <header className="flex items-center justify-between gap-6">
            <Link href="/" className="flex items-center gap-4 font-semibold tracking-tight">
              <img
                src="/assets/brand/loombus-mark-transparent.png"
                alt=""
                className="h-9 w-9 object-contain"
              />
              <span className="text-xl">Loombus</span>
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--loombus-text)] shadow-sm transition hover:border-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-surface-muted)]"
            >
              Join Loombus
            </Link>
          </header>

          <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.58fr)] lg:py-20">
            <section className="max-w-4xl">
              <h1 className="max-w-3xl text-5xl font-semibold leading-[0.96] tracking-[-0.065em] text-[color:var(--loombus-text)] sm:text-6xl md:text-7xl lg:text-8xl">
                You deserve better than the scroll.
              </h1>

              <p className="mt-8 max-w-3xl text-lg leading-8 text-[color:var(--loombus-text-muted)] sm:text-2xl sm:leading-10">
                Loombus is a signal-first discussion platform built for clearer
                conversations, stronger ideas, and less noise.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-3 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-7 py-4 text-base font-semibold text-[color:var(--loombus-text)] shadow-sm transition hover:border-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Get started
                  <span aria-hidden="true" className="text-2xl leading-none">
                    →
                  </span>
                </Link>
              </div>
            </section>

            <aside className="rounded-[2rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10 sm:rounded-[2.25rem] sm:p-6">
              <div className="rounded-[1.7rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-6 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#b45309]">
                  Signal brief
                </p>
                <h2 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.03em] text-[color:var(--loombus-text)] sm:text-3xl">
                  A cleaner way to follow what matters.
                </h2>
                <p className="mt-5 text-sm leading-7 text-[color:var(--loombus-text-muted)] sm:text-base">
                  Follow discussions with clearer structure, stronger context,
                  and fewer distractions.
                </p>
              </div>

              <div className="mt-5 space-y-4">
                {signalCards.map((card) => (
                  <div
                    key={card.title}
                    className="flex gap-4 rounded-[1.55rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/70 bg-amber-50/70 text-xl text-[#b45309] dark:bg-amber-300/10">
                      {card.icon}
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold tracking-tight text-[color:var(--loombus-text)]">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                        {card.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
