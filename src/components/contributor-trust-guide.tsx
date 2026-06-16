"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const STORAGE_KEY = "loombus:contributor-trust-guide-dismissed";

const TRUST_CUES = [
  {
    label: "Substance first",
    description: "Look at the person’s posts, replies, and bio before judging follower counts.",
  },
  {
    label: "Relationship context",
    description: "Mutual, following, and follower labels show connection context, not status.",
  },
  {
    label: "Account context",
    description: "Badges can show membership context, but they are not quality scores.",
  },
  {
    label: "Follow for signal",
    description: "Follow contributors whose thinking you want to see again.",
  },
];

export function ContributorTrustGuide() {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function dismissGuide() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  if (dismissed || pathname !== "/people") {
    return null;
  }

  return (
    <aside className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-lg rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 p-4 text-[var(--loombus-text)] shadow-2xl shadow-black/20 backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:mx-0 md:w-[28rem]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
            Contributor trust
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            Recognize signal without turning it into popularity.
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
            Use people cards as context for thoughtful discovery, not as a scoreboard.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissGuide}
          aria-label="Dismiss contributor trust guide"
          className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Close
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {TRUST_CUES.map((cue) => (
          <div
            key={cue.label}
            className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-3"
          >
            <p className="text-sm font-semibold text-[var(--loombus-text)]">
              {cue.label}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--loombus-text-muted)]">
              {cue.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--loombus-border)] pt-3">
        <Link
          href="/discussions"
          className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Find thoughtful discussions
        </Link>
        <Link
          href="/profile"
          className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Improve your profile
        </Link>
      </div>
    </aside>
  );
}
