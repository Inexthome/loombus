"use client";

import { ChevronLeft, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PreviewSection = {
  section_key: string;
  ordinal: number;
  title: string | null;
  content_text: string;
};

type Props = {
  publicationId: string | null;
  ready: boolean;
  published: boolean;
};

function sectionLabel(section: PreviewSection) {
  return section.title?.trim() || `Section ${section.ordinal + 1}`;
}

export function LibraryAuthorNormalizedPreview({ publicationId, ready, published }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<PreviewSection[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const currentSection = sections[currentIndex] ?? null;
  const sectionCount = sections.length;

  const loadSections = useCallback(async () => {
    if (!publicationId || !ready || published) return;
    setLoading(true);
    setError(null);

    const result = await supabase
      .from("library_publication_sections")
      .select("section_key, ordinal, title, content_text")
      .eq("publication_id", publicationId)
      .order("ordinal", { ascending: true });

    if (result.error) {
      setSections([]);
      setError("Unable to load the normalized preview.");
      setLoading(false);
      return;
    }

    const nextSections = (result.data ?? []) as PreviewSection[];
    setSections(nextSections);
    setCurrentIndex(0);
    if (!nextSections.length) setError("No normalized sections are available to preview yet.");
    setLoading(false);
  }, [publicationId, published, ready]);

  useEffect(() => {
    setOpen(false);
    setSections([]);
    setCurrentIndex(0);
    setError(null);
  }, [publicationId]);

  useEffect(() => {
    if (!ready) {
      setOpen(false);
      setSections([]);
      setCurrentIndex(0);
    }
  }, [ready]);

  const chapterList = useMemo(
    () => sections.map((section) => ({ key: section.section_key, label: sectionLabel(section), ordinal: section.ordinal })),
    [sections]
  );

  if (!publicationId || !ready || published) return null;

  async function openPreview() {
    setOpen(true);
    if (!sections.length) await loadSections();
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void openPreview()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text)] transition hover:border-[var(--loombus-gold)]"
      >
        <Eye className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />
        Preview normalized publication
      </button>

      {open ? (
        <section className="mt-4 overflow-hidden rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]" aria-label="Normalized publication preview">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--loombus-border)] px-4 py-4 sm:px-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Author preview</p>
              <h3 className="mt-1 text-base font-semibold">Normalized Reader content</h3>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-subtle)]">This is the processed text Loombus will use in the Reader. The original EPUB is not rendered here.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-semibold"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />Close preview
            </button>
          </header>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading normalized preview" />
            </div>
          ) : error ? (
            <div role="alert" className="m-4 rounded-xl border border-[var(--loombus-border)] p-4 text-sm text-[var(--loombus-text-muted)]">{error}</div>
          ) : currentSection ? (
            <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="border-b border-[var(--loombus-border)] p-3 md:border-b-0 md:border-r">
                <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Contents · {sectionCount}</p>
                <div className="max-h-72 space-y-1 overflow-y-auto md:max-h-[34rem]">
                  {chapterList.map((chapter, index) => (
                    <button
                      key={chapter.key}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs leading-5 transition ${index === currentIndex ? "bg-[var(--loombus-gold-surface)] font-semibold text-[var(--loombus-text)]" : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)]"}`}
                    >
                      {chapter.label}
                    </button>
                  ))}
                </div>
              </aside>

              <article className="min-w-0 p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--loombus-border)] pb-4">
                  <div>
                    <p className="text-xs font-semibold text-[var(--loombus-gold)]">Section {currentIndex + 1} of {sectionCount}</p>
                    <h4 className="mt-2 text-xl font-semibold">{sectionLabel(currentSection)}</h4>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                      className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-semibold disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous
                    </button>
                    <button
                      type="button"
                      disabled={currentIndex >= sectionCount - 1}
                      onClick={() => setCurrentIndex((index) => Math.min(sectionCount - 1, index + 1))}
                      className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-semibold disabled:opacity-40"
                    >
                      Next<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="mt-5 max-h-[30rem] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text)]">
                  {currentSection.content_text}
                </div>
              </article>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
