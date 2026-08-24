"use client";

import Link from "next/link";
import { ArrowLeft, Check, FlaskConical, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  clearLibraryPassageContext,
  type LibraryPassageContext,
  libraryReaderHref,
  readLibraryPassageContext,
} from "@/lib/library/passage-context";

export function LibraryResearchPassageHandoff() {
  const [passage, setPassage] = useState<LibraryPassageContext | null>(null);

  useEffect(() => {
    setPassage(readLibraryPassageContext("research"));
  }, []);

  if (!passage) return null;

  function dismiss() {
    clearLibraryPassageContext("research");
    setPassage(null);
  }

  return (
    <aside className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 md:pt-20">
      <div className="rounded-2xl border border-[var(--loombus-gold)]/50 bg-[var(--loombus-gold-surface)] p-4 text-[var(--loombus-text)] shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[var(--loombus-gold)]">
              <FlaskConical className="size-4" />
              <p className="text-sm font-black">Research handoff</p>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-gold)]/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]"><Check className="size-3" /> source preserved</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{passage.publicationTitle}{passage.authorName ? ` · ${passage.authorName}` : ""}</p>
            <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{passage.sectionTitle ?? "Current chapter"} · characters {passage.startOffset}–{passage.endOffset}</p>
            <blockquote className="mt-3 line-clamp-3 border-l-2 border-[var(--loombus-gold)] pl-3 text-sm leading-6 text-[var(--loombus-text-muted)]">“{passage.selectedText}”</blockquote>
            <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-subtle)]">The passage is saved in Research with its publication, section locator, offsets, and source hash. The newest saved passage appears first below.</p>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss research handoff" className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"><X className="size-4" /></button>
        </div>
        <div className="mt-4">
          <Link href={libraryReaderHref(passage.publicationId)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black hover:border-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Back to passage</Link>
        </div>
      </div>
    </aside>
  );
}
