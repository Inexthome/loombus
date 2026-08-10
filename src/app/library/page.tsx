import Link from "next/link";
import {
  BookMarked,
  BookOpen,
  Bookmark,
  ChevronRight,
  Highlighter,
  LibraryBig,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";

const libraryTabs = ["Discover", "My Library", "Continue Reading", "Highlights", "Authors"];

const starterShelves = [
  {
    title: "Continue reading",
    description: "Pick up exactly where you left off across Loombus.",
    icon: BookOpen,
    action: "Open reading queue",
  },
  {
    title: "Your library",
    description: "Keep books, essays, reports, guides, and long-form publications together.",
    icon: LibraryBig,
    action: "View library",
  },
  {
    title: "Highlights & notes",
    description: "Return to passages you highlighted and the notes you attached to them.",
    icon: Highlighter,
    action: "Review highlights",
  },
];

const readerActions = [
  { label: "Highlight", icon: Highlighter },
  { label: "Note", icon: Bookmark },
  { label: "Discuss", icon: MessageSquareText },
  { label: "Ask Loombus", icon: Sparkles },
];

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-28 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-sm">
          <div className="border-b border-[var(--loombus-border)] px-5 py-7 sm:px-8 sm:py-9">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]">
                  <BookMarked className="h-4 w-4" aria-hidden="true" />
                  Loombus Library
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Read deeply. Keep the signal.</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">
                  A reading home for books, essays, research, reports, and guides, built to connect passages with notes, evidence, and thoughtful discussion.
                </p>
              </div>

              <label className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 lg:max-w-sm">
                <Search className="h-4 w-4 shrink-0 text-[var(--loombus-gold)]" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Search the Loombus Library"
                  placeholder="Search books, authors, topics..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--loombus-text-subtle)]"
                />
              </label>
            </div>
          </div>

          <div className="overflow-x-auto border-b border-[var(--loombus-border)] px-3 sm:px-6">
            <nav aria-label="Library sections" className="flex min-w-max gap-1 py-2">
              {libraryTabs.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    index === 0
                      ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-text)] ring-1 ring-[color:color-mix(in_srgb,var(--loombus-gold)_42%,var(--loombus-border))]"
                      : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">
            {starterShelves.map(({ title, description, icon: Icon, action }) => (
              <article key={title} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_35%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-5 text-base font-semibold">{title}</h2>
                <p className="mt-2 min-h-16 text-sm leading-6 text-[var(--loombus-text-muted)]">{description}</p>
                <button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--loombus-gold)]">
                  {action} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Reader preview</p>
                <h2 className="mt-2 text-xl font-semibold">A Loombus-native reading experience</h2>
              </div>
              <BookOpen className="h-6 w-6 text-[var(--loombus-gold)]" aria-hidden="true" />
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-reader-paper,var(--loombus-surface-strong))] p-6 sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--loombus-text-muted)]">Chapter 4</p>
              <h3 className="mt-2 text-2xl font-semibold">The Intelligence Economy</h3>
              <p className="mt-6 text-base leading-8 text-[var(--loombus-text)]">
                Long-form ideas become more useful when readers can preserve context, annotate the source, and move from a passage into a structured conversation without losing their place.
              </p>
              <div className="mt-7 flex flex-wrap gap-2 border-t border-[var(--loombus-border)] pt-5">
                {readerActions.map(({ label, icon: Icon }) => (
                  <button key={label} type="button" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-text)]">
                    <Icon className="h-3.5 w-3.5 text-[var(--loombus-gold)]" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </article>

          <aside className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Foundation scope</p>
            <h2 className="mt-2 text-xl font-semibold">Reading first</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
              The first Library surface establishes discovery, personal shelves, reading continuity, highlights, and the passage-to-discussion model without introducing paid ebook sales or DRM yet.
            </p>
            <div className="mt-6 rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_35%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] p-4">
              <p className="text-sm font-semibold">Theme aware by default</p>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">
                Library inherits Loombus Light, Dark, and System appearance and uses Gold for signal, selection, and reading actions.
              </p>
            </div>
            <Link href="/discussions" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]">
              Browse discussions <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </section>
      </div>
    </main>
  );
}
