"use client";

import { BookOpen, ChevronLeft, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { supabase } from "@/lib/supabase/client";

type SectionRow = {
  section_key: string;
  ordinal: number;
  title: string | null;
  content_text: string;
};

export function LibraryAdminNormalizedPreview({
  publicationId,
  publicationTitle,
  disabled = false,
}: {
  publicationId: string;
  publicationTitle: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const activeSection = sections[activeIndex] ?? null;
  const sectionCount = sections.length;
  const activeLabel = useMemo(
    () => activeSection?.title?.trim() || (activeSection ? `Section ${activeSection.ordinal + 1}` : "Normalized content"),
    [activeSection]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setError(null);
      setSections([]);
      setCoverPath(null);
      setActiveIndex(0);

      const [sectionResult, publicationResult] = await Promise.all([
        supabase
          .from("library_publication_sections")
          .select("section_key,ordinal,title,content_text")
          .eq("publication_id", publicationId)
          .order("ordinal", { ascending: true }),
        supabase
          .from("library_publications")
          .select("cover_url")
          .eq("id", publicationId)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      if (sectionResult.error || publicationResult.error) {
        setError("Unable to load normalized publication content for review.");
        setLoading(false);
        return;
      }

      const nextSections = (sectionResult.data ?? []) as SectionRow[];
      setSections(nextSections);
      setCoverPath(publicationResult.data?.cover_url ?? null);
      if (!nextSections.length) setError("No normalized sections are available for this publication.");
      setLoading(false);
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [open, publicationId]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-semibold transition hover:border-[var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Eye className="size-4" aria-hidden="true" />
        Preview normalized publication
      </button>

      {open ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={`Preview ${publicationTitle}`}>
          <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] text-[var(--loombus-text)] shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--loombus-border)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="grid aspect-[2/3] w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
                  <LibraryCoverImage storagePath={coverPath} alt={`${publicationTitle} cover`} fallbackClassName="size-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Editorial preview · normalized content</p>
                  <h2 className="mt-1 text-lg font-semibold">{publicationTitle}</h2>
                  <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">This is the processed text Loombus will serve to the Reader, not the original EPUB.</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full border border-[var(--loombus-border)] hover:border-[var(--loombus-gold)]" aria-label="Close normalized publication preview">
                <X className="size-4" aria-hidden="true" />
              </button>
            </header>

            {loading ? (
              <div className="grid min-h-[360px] place-items-center"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading normalized publication preview" /></div>
            ) : error ? (
              <div className="grid min-h-[360px] place-items-center px-6 text-center text-sm text-[var(--loombus-text-muted)]">{error}</div>
            ) : activeSection ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="max-h-[30vh] overflow-y-auto border-b border-[var(--loombus-border)] p-4 lg:max-h-none lg:border-b-0 lg:border-r">
                  <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-gold)]"><BookOpen className="size-4" aria-hidden="true" />Contents</div>
                  <div className="space-y-1">
                    {sections.map((section, index) => (
                      <button
                        key={section.section_key}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className={`w-full rounded-xl px-3 py-2 text-left text-xs leading-5 transition ${index === activeIndex ? "bg-[var(--loombus-gold-surface)] font-semibold text-[var(--loombus-text)]" : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)]"}`}
                      >
                        <span className="mr-2 text-[var(--loombus-text-subtle)]">{section.ordinal + 1}.</span>{section.title?.trim() || `Section ${section.ordinal + 1}`}
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
                  <div className="mx-auto max-w-3xl">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--loombus-border)] pb-4">
                      <div>
                        <p className="text-xs font-semibold text-[var(--loombus-gold)]">Section {activeIndex + 1} of {sectionCount}</p>
                        <h3 className="mt-1 text-2xl font-semibold">{activeLabel}</h3>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={activeIndex === 0} onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="grid size-10 place-items-center rounded-full border border-[var(--loombus-border)] disabled:opacity-40" aria-label="Previous normalized section"><ChevronLeft className="size-4" aria-hidden="true" /></button>
                        <button type="button" disabled={activeIndex >= sectionCount - 1} onClick={() => setActiveIndex((index) => Math.min(sectionCount - 1, index + 1))} className="grid size-10 place-items-center rounded-full border border-[var(--loombus-border)] disabled:opacity-40" aria-label="Next normalized section"><ChevronRight className="size-4" aria-hidden="true" /></button>
                      </div>
                    </div>
                    <div className="whitespace-pre-wrap py-7 text-[17px] leading-8 text-[var(--loombus-text)]">{activeSection.content_text}</div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
