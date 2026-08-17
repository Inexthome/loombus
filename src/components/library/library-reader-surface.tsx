"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Highlighter, Loader2, Minus, NotebookPen, Plus, Trash2, Type } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Publication = { id: string; title: string; subtitle: string | null; author_name: string | null; publisher_name: string | null };
type ReaderSection = { section_key: string; ordinal: number; title: string | null; content_text: string };
type Progress = { locator: string | null; progress_percent: number };
type Highlight = { id: string; locator: string; selected_text: string; created_at: string };
type Note = { id: string; highlight_id: string | null; locator: string | null; body: string; created_at: string };

const READER_FONT_SIZE_KEY = "loombus-library-reader-font-size";

function progressPercent(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round(((index + 1) / total) * 100)));
}

export function LibraryReaderSurface({ publicationId }: { publicationId: string }) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [sections, setSections] = useState<ReaderSection[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ locator: null, progress_percent: 0 });
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [fontSize, setFontSize] = useState(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  const locatedIndex = sections.findIndex((section) => section.section_key === progress.locator);
  const currentIndex = locatedIndex >= 0 ? locatedIndex : 0;
  const currentSection = sections[currentIndex] ?? null;
  const sectionHighlights = useMemo(() => currentSection ? highlights.filter((row) => row.locator === currentSection.section_key) : [], [currentSection, highlights]);
  const sectionNotes = useMemo(() => currentSection ? notes.filter((row) => row.locator === currentSection.section_key) : [], [currentSection, notes]);

  useEffect(() => {
    const saved = window.localStorage.getItem(READER_FONT_SIZE_KEY);
    const parsed = saved ? Number.parseInt(saved, 10) : 18;
    if (Number.isFinite(parsed)) setFontSize(Math.min(26, Math.max(15, parsed)));
  }, []);

  function changeFontSize(next: number) {
    const value = Math.min(26, Math.max(15, next));
    setFontSize(value);
    window.localStorage.setItem(READER_FONT_SIZE_KEY, String(value));
  }

  const loadReader = useCallback(async () => {
    setLoading(true);
    setError(null);

    const publicationResult = await supabase
      .from("library_publications")
      .select("id, title, subtitle, author_name, publisher_name")
      .eq("id", publicationId)
      .single();
    if (publicationResult.error || !publicationResult.data) {
      setError("This publication is not available to read.");
      setLoading(false);
      return;
    }
    setPublication(publicationResult.data as Publication);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setError("Sign in to use the Loombus Reader.");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [sectionResult, progressResult, highlightResult, noteResult] = await Promise.all([
      supabase.from("library_publication_sections").select("section_key, ordinal, title, content_text").eq("publication_id", publicationId).order("ordinal", { ascending: true }),
      supabase.from("library_reading_progress").select("locator, progress_percent").eq("publication_id", publicationId).maybeSingle(),
      supabase.from("library_highlights").select("id, locator, selected_text, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
      supabase.from("library_notes").select("id, highlight_id, locator, body, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
    ]);

    if (sectionResult.error) {
      setError("Unable to load this publication's reading content.");
      setLoading(false);
      return;
    }

    const normalizedSections = (sectionResult.data ?? []) as ReaderSection[];
    if (!normalizedSections.length) {
      setSections([]);
      setError("This publication does not have readable content yet.");
      setLoading(false);
      return;
    }

    setSections(normalizedSections);
    const savedProgress = progressResult.data as Progress | null;
    const savedIndex = savedProgress?.locator ? normalizedSections.findIndex((section) => section.section_key === savedProgress.locator) : -1;
    if (savedProgress && savedIndex >= 0) setProgress(savedProgress);
    else setProgress({ locator: normalizedSections[0].section_key, progress_percent: progressPercent(0, normalizedSections.length) });
    setHighlights((highlightResult.data ?? []) as Highlight[]);
    setNotes((noteResult.data ?? []) as Note[]);
    setLoading(false);
  }, [publicationId]);

  useEffect(() => { void loadReader(); }, [loadReader]);

  async function moveTo(index: number) {
    if (!userId || index < 0 || index >= sections.length) return;
    const section = sections[index];
    setSaving(true);
    setError(null);
    const next = { locator: section.section_key, progress_percent: progressPercent(index, sections.length) };
    const { error: saveError } = await supabase.from("library_reading_progress").upsert({ user_id: userId, publication_id: publicationId, ...next, last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,publication_id" });
    if (saveError) setError("Unable to save your reading position.");
    else setProgress(next);
    setSelection("");
    setSaving(false);
  }

  function captureSelection() {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSelection(text.slice(0, 4000));
  }

  async function saveHighlight() {
    if (!userId || !selection || !currentSection) return;
    setSaving(true);
    const { data, error: saveError } = await supabase.from("library_highlights").insert({ user_id: userId, publication_id: publicationId, locator: currentSection.section_key, selected_text: selection }).select("id, locator, selected_text, created_at").single();
    if (saveError || !data) setError("Unable to save this highlight.");
    else { setHighlights((rows) => [data as Highlight, ...rows]); setSelection(""); window.getSelection()?.removeAllRanges(); }
    setSaving(false);
  }

  async function saveNote() {
    if (!userId || !noteDraft.trim() || !currentSection) return;
    setSaving(true);
    const { data, error: saveError } = await supabase.from("library_notes").insert({ user_id: userId, publication_id: publicationId, locator: currentSection.section_key, body: noteDraft.trim() }).select("id, highlight_id, locator, body, created_at").single();
    if (saveError || !data) setError("Unable to save this note.");
    else { setNotes((rows) => [data as Note, ...rows]); setNoteDraft(""); }
    setSaving(false);
  }

  async function deleteHighlight(id: string) {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from("library_highlights").delete().eq("id", id).eq("user_id", userId).eq("publication_id", publicationId);
    if (deleteError) setError("Unable to remove this highlight.");
    else setHighlights((rows) => rows.filter((row) => row.id !== id));
    setSaving(false);
  }

  async function deleteNote(id: string) {
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error: deleteError } = await supabase.from("library_notes").delete().eq("id", id).eq("user_id", userId).eq("publication_id", publicationId);
    if (deleteError) setError("Unable to remove this note.");
    else setNotes((rows) => rows.filter((row) => row.id !== id));
    setSaving(false);
  }

  if (loading) return <main className="min-h-screen bg-[var(--loombus-page-bg)] grid place-items-center text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" /></main>;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--loombus-border)] pb-4">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><ArrowLeft className="h-4 w-4" /> Library</Link>
          <div className="flex items-center gap-2"><Type className="h-4 w-4 text-[var(--loombus-gold)]" /><button aria-label="Decrease text size" onClick={() => changeFontSize(fontSize - 1)} className="rounded-full border border-[var(--loombus-border)] p-2"><Minus className="h-4 w-4" /></button><span className="w-8 text-center text-xs">{fontSize}</span><button aria-label="Increase text size" onClick={() => changeFontSize(fontSize + 1)} className="rounded-full border border-[var(--loombus-border)] p-2"><Plus className="h-4 w-4" /></button></div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}
        {publication && currentSection ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-reader-paper,var(--loombus-surface))] px-6 py-8 sm:px-10 sm:py-12">
              <div className="mx-auto max-w-3xl">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">{currentSection.title ?? `Section ${currentSection.ordinal + 1}`}</p><p className="text-xs text-[var(--loombus-text-muted)]">Chapter {currentIndex + 1} of {sections.length}</p></div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{publication.title}</h1>
                {publication.subtitle ? <p className="mt-2 text-lg text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
                <p className="mt-2 text-sm text-[var(--loombus-text-subtle)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
                <div onMouseUp={captureSelection} onTouchEnd={captureSelection} className="mt-9 whitespace-pre-line leading-[1.9] selection:bg-[var(--loombus-gold-surface)]" style={{ fontSize }}>{currentSection.content_text}</div>
                {selection ? <div className="mt-6 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] p-4"><p className="line-clamp-3 text-sm">“{selection}”</p><div className="mt-3 flex gap-4"><button onClick={() => void saveHighlight()} disabled={saving} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><Highlighter className="h-4 w-4" /> Save highlight</button><button onClick={() => { setSelection(""); window.getSelection()?.removeAllRanges(); }} className="text-sm text-[var(--loombus-text-muted)]">Cancel</button></div></div> : null}
                <div className="mt-10 flex items-center justify-between border-t border-[var(--loombus-border)] pt-5"><button onClick={() => void moveTo(currentIndex - 1)} disabled={currentIndex === 0 || saving} className="inline-flex items-center gap-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><span className="text-xs text-[var(--loombus-text-muted)]">{saving ? "Saving…" : `${progress.progress_percent}%`}</span><button onClick={() => void moveTo(currentIndex + 1)} disabled={currentIndex === sections.length - 1 || saving} className="inline-flex items-center gap-2 text-sm disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full bg-[var(--loombus-gold)] transition-all" style={{ width: `${progress.progress_percent}%` }} /></div>
              </div>
            </article>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Chapters</h2></div><div className="mt-4 max-h-72 space-y-1 overflow-y-auto pr-1">{sections.map((section, index) => <button key={section.section_key} onClick={() => void moveTo(index)} aria-current={section.section_key === currentSection.section_key ? "location" : undefined} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${section.section_key === currentSection.section_key ? "bg-[var(--loombus-gold-surface)] font-semibold" : "text-[var(--loombus-text-muted)]"}`}><span className="mr-2 text-xs text-[var(--loombus-text-subtle)]">{index + 1}</span>{section.title ?? `Section ${section.ordinal + 1}`}</button>)}</div></section>
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><NotebookPen className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Private note</h2></div><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Saved to this chapter only.</p><textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write a note at this position…" className="mt-4 min-h-24 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-3 text-sm outline-none" /><button onClick={() => void saveNote()} disabled={saving || !noteDraft.trim()} className="mt-3 text-sm font-semibold text-[var(--loombus-gold)] disabled:opacity-40">Save note</button></section>
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">This chapter</h2><span className="text-xs text-[var(--loombus-text-muted)]">{sectionHighlights.length} highlights · {sectionNotes.length} notes</span></div>{sectionHighlights.length || sectionNotes.length ? <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">{sectionHighlights.map((highlight) => <div key={highlight.id} className="rounded-xl bg-[var(--loombus-gold-surface)] p-3"><div className="flex items-start gap-2"><Highlighter className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--loombus-gold)]" /><p className="min-w-0 flex-1 text-xs leading-relaxed">“{highlight.selected_text}”</p><button aria-label="Delete highlight" disabled={saving} onClick={() => void deleteHighlight(highlight.id)} className="shrink-0 text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}{sectionNotes.map((note) => <div key={note.id} className="rounded-xl border border-[var(--loombus-border)] p-3"><div className="flex items-start gap-2"><NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--loombus-gold)]" /><p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed">{note.body}</p><button aria-label="Delete note" disabled={saving} onClick={() => void deleteNote(note.id)} className="shrink-0 text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div> : <p className="mt-3 text-xs text-[var(--loombus-text-muted)]">No annotations in this chapter yet.</p>}<p className="mt-4 border-t border-[var(--loombus-border)] pt-3 text-[11px] text-[var(--loombus-text-subtle)]">Book total: {highlights.length} highlights · {notes.length} notes</p></section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
