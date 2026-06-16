"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "loombus:create-signal-guide-dismissed";

const CHECKLIST_ITEMS = [
  "Make the main question or claim clear.",
  "Add the context someone needs before replying.",
  "Choose the right Topic, Reality Lens, and Purpose Lane.",
  "Say what kind of response would be useful.",
];

export function CreateSignalGuide() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  function dismissGuide() {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  if (dismissed) {
    return null;
  }

  return (
    <aside className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-md rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 p-4 text-[var(--loombus-text)] shadow-2xl shadow-black/20 backdrop-blur-xl md:bottom-6 md:left-auto md:right-6 md:mx-0 md:w-96">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
            Pre-publish signal check
          </p>
          <h2 className="text-base font-semibold tracking-tight">
            Help others reply with substance.
          </h2>
        </div>
        <button
          type="button"
          onClick={dismissGuide}
          aria-label="Dismiss create signal guide"
          className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Close
        </button>
      </div>

      <ul className="space-y-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--loombus-primary-bg)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--loombus-border)] pt-3">
        <Link
          href="/settings/guide#create"
          className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)]"
        >
          Open Create guide
        </Link>
        <span className="text-xs text-[var(--loombus-text-subtle)]">
          This is guidance, not a blocker.
        </span>
      </div>
    </aside>
  );
}
