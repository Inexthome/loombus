"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Highlighter, Loader2, Minus, NotebookPen, Plus, Type } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Publication = { id: string; title: string; subtitle: string | null; description: string | null; author_name: string | null; publisher_name: string | null };
type Progress = { locator: string | null; progress_percent: number };
type Highlight = { id: string; locator: string; selected_text: string; created_at: string };
type Note = { id: string; highlight_id: string | null; locator: string | null; body: string; created_at: string };

const sections = [
  { key: "opening", label: "Opening", percent: 8 },
  { key: "section-1", label: "Section 1", percent: 28 },
  { key: "section-2", label: "Section 2", percent: 52 },
  { key: "section-3", label: "Section 3", percent: 76 },
  { key: "closing", label: "Closing", percent: 96 },
];

export function LibraryReaderSurface({ publicationId }: { publicationId: string }) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ locator: "opening", progress_percent: 8 });
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [fontSize, setFontSize] = useState(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  const currentIndex = Math.max(0, sections.findIndex((section) => section.key === progress.locator));
  const currentSection = sections[currentIndex] ?? sections[0];

  const loadReader = useCallback(async () => {
    setLoading(true);
    setError(null);
    const publicationResult = await supabase.from("library_publications").select("id, title, subtitle, description, author_name, publisher_name").eq("id", publicationId).single();
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
    const [progressResult, highlightResult, noteResult] = await Promise.all([
      supabase.from("library_reading_progress").select("locator, progress_percent").eq("publication_id", publicationId).maybeSingle(),
      supabase.from("library_highlights").select("id, locator, selected_text, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
      supabase.from("library_notes").select("id, highlight_id, locator, body, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
    ]);
    if (progressResult.data) setProgress(progressResult.data as Progress);
    setHighlights((highlightResult.data ?? []) as Highlight[]);
    setNotes((noteResult.data ?? []) as Note[]);
    setLoading(false);
  }, [publicationId]);

  useEffect(() => { void loadReader(); }, [loadReader]);

  async function moveTo(index: number) {
    if (!userId || index < 0 || index >= sections.length) return;
    const section = sections[index];
    setSaving(true);
    const next = { locator: section.key, progress_percent: section.percent };
    const { error: saveError } = await supabase.from("library_reading_progress").upsert({ user_id: userId, publication_id: publicationId, ...next, last_read_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,publication_id" });
    if (saveError) setError("Unable to save your reading position.");
    else setProgress(next);
    setSaving(false);
  }

  function captureSelection() {
    const text = window.getSelection()?.toString().trim() ?? "";
    setSelection(text.slice(0, 4000));
  }

  async function saveHighlight() {
    if (!userId || !selection) return;
    setSaving(true);
    const { data, error: saveError } = await supabase.from("library_highlights").insert({ user_id: userId, publication_id: publicationId, locator: currentSection.key, selected_text: selection }).select("id, locator, selected_text, created_at").single();
    if (saveError || !data) setError("Unable to save this highlight.");
    else { setHighlights((rows) => [data as Highlight, ...rows]); setSelection(""); }
    setSaving(false);
  }

  async function saveNote() {
    if (!userId || !noteDraft.trim()) return;
    setSaving(true);
    const { data, error: saveError } = await supabase.from("library_notes").insert({ user_id: userId, publication_id: publicationId, locator: currentSection.key, body: noteDraft.trim() }).select("id, highlight_id, locator, body, created_at").single();
    if (saveError || !data) setError("Unable to save this note.");
    else { setNotes((rows) => [data as Note, ...rows]); setNoteDraft(""); }
    setSaving(false);
  }

  const readingCopy = useMemo(() => publication?.description?.trim() || "This Reader foundation establishes a durable reading position and private annotation layer. Publication body ingestion will arrive separately, so stored books can later flow into the same reader without changing its member privacy model.", [publication]);

  if (loading) return <main className="min-h-screen bg-[var(--loombus-page-bg)] grid place-items-center text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" /></main>;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--loombus-border)] pb-4">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><ArrowLeft className="h-4 w-4" /> Library</Link>
          <div className="flex items-center gap-2"><Type className="h-4 w-4 text-[var(--loombus-gold)]" /><button aria-label="Decrease text size" onClick={() => setFontSize((v) => Math.max(15, v - 1))} className="rounded-full border border-[var(--loombus-border)] p-2"><Minus className="h-4 w-4" /></button><span className="w-8 text-center text-xs">{fontSize}</span><button aria-label="Increase text size" onClick={() => setFontSize((v) => Math.min(26, v + 1))} className="rounded-full border border-[var(--loombus-border)] p-2"><Plus className="h-4 w-4" /></button></div>
        </header>

        {error ? <div className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}
        {publication ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
            <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-reader-paper,var(--loombus-surface))] px-6 py-8 sm:px-10 sm:py-12">
              <div className="mx-auto max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">{currentSection.label}</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{publication.title}</h1>
                {publication.subtitle ? <p className="mt-2 text-lg text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
                <p className="mt-2 text-sm text-[var(--loombus-text-subtle)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
                <div onMouseUp={captureSelection} onTouchEnd={captureSelection} className="mt-9 whitespace-pre-line leading-[1.9]" style={{ fontSize }}>{readingCopy}</div>
                {selection ? <div className="mt-6 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] p-4"><p className="line-clamp-3 text-sm">“{selection}”</p><button onClick={() => void saveHighlight()} disabled={saving} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><Highlighter className="h-4 w-4" /> Save highlight</button></div> : null}
                <div className="mt-10 flex items-center justify-between border-t border-[var(--loombus-border)] pt-5"><button onClick={() => void moveTo(currentIndex - 1)} disabled={currentIndex === 0 || saving} className="inline-flex items-center gap-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><span className="text-xs text-[var(--loombus-text-muted)]">{saving ? "Saving…" : `${progress.progress_percent}%`}</span><button onClick={() => void moveTo(currentIndex + 1)} disabled={currentIndex === sections.length - 1 || saving} className="inline-flex items-center gap-2 text-sm disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full bg-[var(--loombus-gold)] transition-all" style={{ width: `${progress.progress_percent}%` }} /></div>
              </div>
            </article>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Reading position</h2></div><div className="mt-4 space-y-1">{sections.map((section, index) => <button key={section.key} onClick={() => void moveTo(index)} className={`w-full rounded-xl px-3 py-2 text-left text-sm ${section.key === currentSection.key ? "bg-[var(--loombus-gold-surface)] font-semibold" : "text-[var(--loombus-text-muted)]"}`}>{section.label}</button>)}</div></section>
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><NotebookPen className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Private note</h2></div><textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write a note at this position…" className="mt-4 min-h-24 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-3 text-sm outline-none" /><button onClick={() => void saveNote()} disabled={saving || !noteDraft.trim()} className="mt-3 text-sm font-semibold text-[var(--loombus-gold)] disabled:opacity-40">Save note</button></section>
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="text-sm font-semibold">Annotations</h2><p className="mt-2 text-xs text-[var(--loombus-text-muted)]">{highlights.length} highlights · {notes.length} notes</p></section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
