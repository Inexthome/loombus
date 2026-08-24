"use client";

import { ChevronLeft, ChevronRight, Eye, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SectionRow = { section_key: string; ordinal: number; title: string | null; content_text: string };

export function LibraryVersionNormalizedPreview({ versionId, label = "Preview normalized revision", disabled = false }: { versionId: string; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<SectionRow[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase
      .from("library_publication_sections")
      .select("section_key,ordinal,title,content_text")
      .eq("version_id", versionId)
      .order("ordinal", { ascending: true })
      .then((result) => {
        if (cancelled) return;
        if (result.error) {
          setRows([]);
          setError("Unable to load this normalized revision preview.");
        } else {
          setRows((result.data ?? []) as SectionRow[]);
          setIndex(0);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, versionId]);

  const current = rows[index] ?? null;

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)] disabled:opacity-50">
        <Eye className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />{label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Normalized revision preview">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] text-[var(--loombus-text)] shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-[var(--loombus-border)] px-5 py-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Normalized revision</p><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Exact section text staged for this publication version.</p></div>
              <button type="button" aria-label="Close preview" onClick={() => setOpen(false)} className="rounded-full border border-[var(--loombus-border)] p-2"><X className="h-4 w-4" /></button>
            </header>
            {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" /></div> : error ? <div className="p-6 text-sm text-[var(--loombus-text-muted)]">{error}</div> : !current ? <div className="p-6 text-sm text-[var(--loombus-text-muted)]">No normalized sections are ready for this revision yet.</div> : (
              <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
                <aside className="overflow-y-auto border-b border-[var(--loombus-border)] p-3 md:border-b-0 md:border-r">
                  {rows.map((row, rowIndex) => <button key={row.section_key} type="button" onClick={() => setIndex(rowIndex)} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-xs ${rowIndex === index ? "bg-[var(--loombus-gold-surface)] font-semibold text-[var(--loombus-gold)]" : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface)]"}`}>{row.title ?? `Section ${row.ordinal + 1}`}</button>)}
                </aside>
                <article className="overflow-y-auto p-5 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Section {current.ordinal + 1} of {rows.length}</p><h2 className="mt-2 text-2xl font-semibold">{current.title ?? `Section ${current.ordinal + 1}`}</h2><div className="mt-6 whitespace-pre-line text-sm leading-7 text-[var(--loombus-text-muted)]">{current.content_text}</div></article>
              </div>
            )}
            <footer className="flex items-center justify-between gap-3 border-t border-[var(--loombus-border)] px-5 py-4"><button type="button" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} className="inline-flex items-center gap-1 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Previous</button><span className="text-xs text-[var(--loombus-text-subtle)]">{rows.length ? `${index + 1} / ${rows.length}` : "No sections"}</span><button type="button" disabled={index >= rows.length - 1} onClick={() => setIndex((value) => Math.min(rows.length - 1, value + 1))} className="inline-flex items-center gap-1 text-sm disabled:opacity-40">Next<ChevronRight className="h-4 w-4" /></button></footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
