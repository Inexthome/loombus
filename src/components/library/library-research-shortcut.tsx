"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";

export function LibraryResearchShortcut() {
  return (
    <Link
      href="/library/research"
      aria-label="Open Research"
      className="fixed bottom-5 right-4 z-[110] inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black text-[var(--loombus-gold)] shadow-xl transition hover:border-[var(--loombus-gold)] sm:bottom-7 sm:right-6"
    >
      <FlaskConical className="size-4" />
      Research
    </Link>
  );
}
