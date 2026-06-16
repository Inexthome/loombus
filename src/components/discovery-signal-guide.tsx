"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "loombus:discovery-signal-guide-dismissed";

const DISCOVERY_PATHS = [
  {
    label: "Show Learning discussions",
    description: "Find threads built for understanding, context, and clear explanation.",
    href: "/discussions?purpose=Learning",
  },
  {
    label: "Show Mastery discussions",
    description: "Look for discussions tied to skill, practice, and deeper competence.",
    href: "/discussions?purpose=Mastery",
  },
  {
    label: "Show Contribution discussions",
    description: "Add lived context, experience, or useful framing to active threads.",
    href: "/discussions?purpose=Contribution",
  },
  {
    label: "Show Local problem-solving",
    description: "Explore community and real-world issues that benefit from practical detail.",
    href: "/discussions?purpose=Local%20problem-solving",
  },
];

export function DiscoverySignalGuide() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function dismissGuide() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  if (dismissed || pathname !== "/discussions") {
    return null;
  }

  return (
    <aside className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-lg rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 p-4 text-[var(--loombus-text)] shadow-2xl shadow-black/20 backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:mx-0 md:w-[28rem]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
            Discover by purpose
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            Start with what you came here to do.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
            Loombus discovery works best when you browse by intent, not only by topic.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissGuide}
          aria-label="Dismiss discovery signal guide"
          className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Close
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {DISCOVERY_PATHS.map((path) => (
          <a
            key={path.label}
            href={path.href}
            className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3 transition hover:border-[var(--loombus-text-subtle)] hover:bg-[var(--loombus-surface-strong)]"
          >
            <p className="text-sm font-semibold text-[var(--loombus-text)]">
              {path.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--loombus-text-muted)]">
              {path.description}
            </p>
          </a>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--loombus-border)] pt-3">
        <a
          href="/discussions"
          className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Show all discussions
        </a>
        <a
          href="/create"
          className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Start a discussion
        </a>
      </div>
    </aside>
  );
}
