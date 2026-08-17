"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Highlighter, List, Loader2, Minus, NotebookPen, Plus, Search, Trash2, Type, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Publication = { id: string; title: string; subtitle: string | null; author_name: string | null; publisher_name: string | null };
type ReaderSection = { section_key: string; ordinal: number; title: string | null; content_text: string };
type Progress = { locator: string | null; progress_percent: number };
type Highlight = { id: string; locator: string; selected_text: string; start_offset: number | null; end_offset: number | null; text_sha256: string | null; created_at: string };
type Note = { id: string; highlight_id: string | null; locator: string | null; body: string; created_at: string };
type BookmarkRow = { id: string; locator: string; created_at: string };
type ReaderSelection = { text: string; startOffset: number; endOffset: number };
type SearchResult = { id: string; sectionIndex: number; locator: string; title: string; snippet: string; titleMatch: boolean };
type ReadingToolTab = "bookmarks" | "highlights" | "notes";

const READER_FONT_SIZE_KEY = "loombus-library-reader-font-size";
const MAX_SEARCH_RESULTS = 50;

function progressPercent(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(1, Math.round(((index + 1) / total) * 100)));
}

function sectionLabel(section: ReaderSection): string {
  return section.title ?? `Section ${section.ordinal + 1}`;
}

function searchSnippetAt(text: string, index: number, queryLength: number): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const start = Math.max(0, index - 55);
  const end = Math.min(compact.length, index + queryLength + 85);
  return `${start > 0 ? "…" : ""}${compact.slice(start, end)}${end < compact.length ? "…" : ""}`;
}

function renderSearchMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const index = text.toLocaleLowerCase().indexOf(trimmed.toLocaleLowerCase());
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark className="rounded-sm bg-[var(--loombus-gold)] px-0.5 text-black">{text.slice(index, index + trimmed.length)}</mark>{text.slice(index + trimmed.length)}</>;
}

function buildSearchResults(sections: ReaderSection[], query: string): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const lowered = trimmed.toLocaleLowerCase();
  const results: SearchResult[] = [];

  for (let sectionIndex = 0; sectionIndex < sections.length && results.length < MAX_SEARCH_RESULTS; sectionIndex += 1) {
    const section = sections[sectionIndex];
    const title = sectionLabel(section);
    if (title.toLocaleLowerCase().includes(lowered)) {
      results.push({ id: `${section.section_key}:title`, sectionIndex, locator: section.section_key, title, snippet: "Chapter title match", titleMatch: true });
    }

    const compact = section.content_text.replace(/\s+/g, " ").trim();
    const compactLower = compact.toLocaleLowerCase();
    let cursor = 0;
    let matchNumber = 0;
    while (cursor < compactLower.length && results.length < MAX_SEARCH_RESULTS) {
      const matchIndex = compactLower.indexOf(lowered, cursor);
      if (matchIndex < 0) break;
      matchNumber += 1;
      results.push({
        id: `${section.section_key}:body:${matchNumber}:${matchIndex}`,
        sectionIndex,
        locator: section.section_key,
        title,
        snippet: searchSnippetAt(compact, matchIndex, trimmed.length),
        titleMatch: false,
      });
      cursor = matchIndex + Math.max(1, lowered.length);
    }
  }

  return results;
}

async function sha256Text(value: string): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function textOffsetWithin(container: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

function renderInlineHighlights(text: string, highlights: Highlight[], textSha256: string | null) {
  if (!textSha256) return text;

  const ranges = highlights
    .filter((highlight) =>
      highlight.text_sha256 === textSha256 &&
      highlight.start_offset !== null &&
      highlight.end_offset !== null &&
      highlight.start_offset >= 0 &&
      highlight.end_offset > highlight.start_offset &&
      highlight.end_offset <= text.length &&
      text.slice(highlight.start_offset, highlight.end_offset) === highlight.selected_text,
    )
    .map((highlight) => ({ start: highlight.start_offset as number, end: highlight.end_offset as number }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (!ranges.length) return text;

  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }

  const parts = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) parts.push(<span key={`text-${cursor}`}>{text.slice(cursor, range.start)}</span>);
    parts.push(<mark key={`highlight-${range.start}-${range.end}`} className="rounded-sm bg-[var(--loombus-gold)] text-black">{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  if (cursor < text.length) parts.push(<span key={`text-${cursor}`}>{text.slice(cursor)}</span>);
  return parts;
}

export function LibraryReaderSurface({ publicationId }: { publicationId: string }) {
  const readerTextRef = useRef<HTMLDivElement | null>(null);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [sections, setSections] = useState<ReaderSection[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ locator: null, progress_percent: 0 });
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [fontSize, setFontSize] = useState(18);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [currentTextSha256, setCurrentTextSha256] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [readingToolTab, setReadingToolTab] = useState<ReadingToolTab>("bookmarks");

  const locatedIndex = sections.findIndex((section) => section.section_key === progress.locator);
  const currentIndex = locatedIndex >= 0 ? locatedIndex : 0;
  const currentSection = sections[currentIndex] ?? null;
  const sectionHighlights = useMemo(() => currentSection ? highlights.filter((row) => row.locator === currentSection.section_key) : [], [currentSection, highlights]);
  const sectionNotes = useMemo(() => currentSection ? notes.filter((row) => row.locator === currentSection.section_key) : [], [currentSection, notes]);
  const bookmarkedLocators = useMemo(() => new Set(bookmarks.map((row) => row.locator)), [bookmarks]);
  const currentBookmark = currentSection ? bookmarks.find((row) => row.locator === currentSection.section_key) ?? null : null;
  const searchResults = useMemo(() => buildSearchResults(sections, searchQuery), [searchQuery, sections]);
  const inlineHighlightCount = useMemo(() => currentTextSha256 ? sectionHighlights.filter((highlight) =>
    highlight.text_sha256 === currentTextSha256 &&
    highlight.start_offset !== null &&
    highlight.end_offset !== null &&
    highlight.start_offset >= 0 &&
    highlight.end_offset > highlight.start_offset &&
    currentSection !== null &&
    highlight.end_offset <= currentSection.content_text.length &&
    currentSection.content_text.slice(highlight.start_offset, highlight.end_offset) === highlight.selected_text,
  ).length : 0, [currentSection, currentTextSha256, sectionHighlights]);

  useEffect(() => {
    const saved = window.localStorage.getItem(READER_FONT_SIZE_KEY);
    const parsed = saved ? Number.parseInt(saved, 10) : 18;
    if (Number.isFinite(parsed)) setFontSize(Math.min(26, Math.max(15, parsed)));
  }, []);

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    setCurrentTextSha256(null);
    if (!currentSection) return () => { cancelled = true; };
    void sha256Text(currentSection.content_text).then((hash) => {
      if (!cancelled) setCurrentTextSha256(hash);
    }).catch(() => {
      if (!cancelled) setError("Unable to verify saved inline highlights for this chapter.");
    });
    return () => { cancelled = true; };
  }, [currentSection]);

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

    const [sectionResult, progressResult, highlightResult, noteResult, bookmarkResult] = await Promise.all([
      supabase.from("library_publication_sections").select("section_key, ordinal, title, content_text").eq("publication_id", publicationId).order("ordinal", { ascending: true }),
      supabase.from("library_reading_progress").select("locator, progress_percent").eq("publication_id", publicationId).maybeSingle(),
      supabase.from("library_highlights").select("id, locator, selected_text, start_offset, end_offset, text_sha256, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
      supabase.from("library_notes").select("id, highlight_id, locator, body, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
      supabase.from("library_bookmarks").select("id, locator, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
    ]);

    if (sectionResult.error) {
      setError("Unable to load this publication's reading content.");
      setLoading(false);
      return;
    }
    if (bookmarkResult.error) {
      setError("Unable to load your private bookmarks.");
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
    setBookmarks((bookmarkResult.data ?? []) as BookmarkRow[]);
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
    else {
      setProgress(next);
      window.requestAnimationFrame(() => readerTextRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    setSaving(false);
  }

  function moveToLocator(locator: string) {
    const index = sections.findIndex((section) => section.section_key === locator);
    if (index >= 0) void moveTo(index);
  }

  function moveSearchResult(nextIndex: number) {
    if (!searchResults.length) return;
    const normalized = (nextIndex + searchResults.length) % searchResults.length;
    setActiveSearchIndex(normalized);
    void moveTo(searchResults[normalized].sectionIndex);
  }

  async function toggleBookmark() {
    if (!userId || !currentSection) return;
    setSaving(true);
    setError(null);
    if (currentBookmark) {
      const { error: deleteError } = await supabase.from("library_bookmarks").delete().eq("id", currentBookmark.id).eq("user_id", userId).eq("publication_id", publicationId);
      if (deleteError) setError("Unable to remove this bookmark.");
      else setBookmarks((rows) => rows.filter((row) => row.id !== currentBookmark.id));
    } else {
      const { data, error: insertError } = await supabase.from("library_bookmarks").insert({ user_id: userId, publication_id: publicationId, locator: currentSection.section_key }).select("id, locator, created_at").single();
      if (insertError || !data) setError("Unable to save this bookmark.");
      else setBookmarks((rows) => [data as BookmarkRow, ...rows]);
    }
    setSaving(false);
  }

  function captureSelection() {
    const browserSelection = window.getSelection();
    const container = readerTextRef.current;
    if (!browserSelection || browserSelection.rangeCount !== 1 || browserSelection.isCollapsed || !container) {
      setSelection(null);
      return;
    }

    const range = browserSelection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
      setSelection(null);
      return;
    }

    const raw = range.toString();
    const trimmed = raw.trim();
    if (!trimmed) {
      setSelection(null);
      return;
    }

    const leadingWhitespace = raw.length - raw.trimStart().length;
    const startOffset = textOffsetWithin(container, range.startContainer, range.startOffset) + leadingWhitespace;
    const text = trimmed.slice(0, 4000);
    const endOffset = startOffset + text.length;
    if (!currentSection || currentSection.content_text.slice(startOffset, endOffset) !== text) {
      setSelection(null);
      setError("Select text from within the current chapter to create a highlight.");
      return;
    }

    setError(null);
    setSelection({ text, startOffset, endOffset });
  }

  async function saveHighlight() {
    if (!userId || !selection || !currentSection) return;
    setSaving(true);
    setError(null);
    try {
      const textSha256 = currentTextSha256 ?? await sha256Text(currentSection.content_text);
      const { data, error: saveError } = await supabase.from("library_highlights").insert({
        user_id: userId,
        publication_id: publicationId,
        locator: currentSection.section_key,
        selected_text: selection.text,
        start_offset: selection.startOffset,
        end_offset: selection.endOffset,
        text_sha256: textSha256,
      }).select("id, locator, selected_text, start_offset, end_offset, text_sha256, created_at").single();
      if (saveError || !data) setError("Unable to save this highlight.");
      else {
        setHighlights((rows) => [data as Highlight, ...rows]);
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    } catch {
      setError("Unable to verify this highlight against the current chapter text.");
    }
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
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-reader-paper,var(--loombus-surface))] px-6 py-8 sm:px-10 sm:py-12">
              <div className="mx-auto max-w-3xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">{sectionLabel(currentSection)}</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Chapter {currentIndex + 1} of {sections.length}</p></div>
                  <button onClick={() => void toggleBookmark()} disabled={saving} aria-pressed={Boolean(currentBookmark)} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${currentBookmark ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}>{currentBookmark ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{currentBookmark ? "Bookmarked" : "Bookmark"}</button>
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{publication.title}</h1>
                {publication.subtitle ? <p className="mt-2 text-lg text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
                <p className="mt-2 text-sm text-[var(--loombus-text-subtle)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
                <div ref={readerTextRef} onMouseUp={captureSelection} onTouchEnd={captureSelection} className="mt-9 whitespace-pre-line leading-[1.9] selection:bg-[var(--loombus-gold-surface)]" style={{ fontSize }}>{renderInlineHighlights(currentSection.content_text, sectionHighlights, currentTextSha256)}</div>
                {selection ? <div className="mt-6 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] p-4"><p className="line-clamp-3 text-sm">“{selection.text}”</p><div className="mt-3 flex gap-4"><button onClick={() => void saveHighlight()} disabled={saving} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><Highlighter className="h-4 w-4" /> Save highlight</button><button onClick={() => { setSelection(null); window.getSelection()?.removeAllRanges(); }} className="text-sm text-[var(--loombus-text-muted)]">Cancel</button></div></div> : null}
                <div className="mt-10 flex items-center justify-between border-t border-[var(--loombus-border)] pt-5"><button onClick={() => void moveTo(currentIndex - 1)} disabled={currentIndex === 0 || saving} className="inline-flex items-center gap-2 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><span className="text-xs text-[var(--loombus-text-muted)]">{saving ? "Saving…" : `${progress.progress_percent}%`}</span><button onClick={() => void moveTo(currentIndex + 1)} disabled={currentIndex === sections.length - 1 || saving} className="inline-flex items-center gap-2 text-sm disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full bg-[var(--loombus-gold)] transition-all" style={{ width: `${progress.progress_percent}%` }} /></div>
              </div>
            </article>

            <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                <div className="flex items-center gap-2"><Search className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Search this book</h2></div>
                <div className="mt-4 flex items-center rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3"><Search className="h-4 w-4 shrink-0 text-[var(--loombus-text-subtle)]" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Find words or chapters…" className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm outline-none" />{searchQuery ? <button aria-label="Clear book search" onClick={() => setSearchQuery("")} className="text-[var(--loombus-text-muted)]"><X className="h-4 w-4" /></button> : null}</div>
                {searchQuery.trim().length === 1 ? <p className="mt-3 text-xs text-[var(--loombus-text-muted)]">Type at least 2 characters.</p> : null}
                {searchQuery.trim().length >= 2 ? <>
                  <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-[var(--loombus-text-muted)]">{searchResults.length ? `Match ${Math.min(activeSearchIndex + 1, searchResults.length)} of ${searchResults.length}` : "0 matches"}</span>{searchResults.length ? <div className="flex items-center gap-1"><button aria-label="Previous search match" onClick={() => moveSearchResult(activeSearchIndex - 1)} className="rounded-full border border-[var(--loombus-border)] p-1.5"><ChevronLeft className="h-3.5 w-3.5" /></button><button aria-label="Next search match" onClick={() => moveSearchResult(activeSearchIndex + 1)} className="rounded-full border border-[var(--loombus-border)] p-1.5"><ChevronRight className="h-3.5 w-3.5" /></button></div> : null}</div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{searchResults.length ? searchResults.map((result, resultIndex) => <button key={result.id} onClick={() => { setActiveSearchIndex(resultIndex); void moveTo(result.sectionIndex); }} aria-current={resultIndex === activeSearchIndex ? "true" : undefined} className={`w-full rounded-xl border p-3 text-left ${resultIndex === activeSearchIndex ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)] hover:bg-[var(--loombus-surface-strong)]"}`}><p className="text-xs font-semibold text-[var(--loombus-gold)]">{result.sectionIndex + 1}. {renderSearchMatch(result.title, searchQuery)}</p><p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--loombus-text-muted)]">{result.titleMatch ? result.snippet : renderSearchMatch(result.snippet, searchQuery)}</p></button>) : <p className="text-xs text-[var(--loombus-text-muted)]">No matches in this book.</p>}</div>
                </> : null}
              </section>

              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Contents</h2></div><span className="text-xs text-[var(--loombus-text-muted)]">{bookmarks.length} saved</span></div>
                <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Jump between chapters. Bookmarked chapters show a gold marker.</p>
                <div className="mt-4 max-h-80 space-y-1 overflow-y-auto pr-1">{sections.map((section, index) => {
                  const active = section.section_key === currentSection.section_key;
                  const bookmarked = bookmarkedLocators.has(section.section_key);
                  return <button key={section.section_key} onClick={() => void moveTo(index)} aria-current={active ? "location" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active ? "bg-[var(--loombus-gold-surface)] font-semibold" : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-strong)]"}`}><span className="w-5 shrink-0 text-right text-xs text-[var(--loombus-text-subtle)]">{index + 1}</span><span className="min-w-0 flex-1 truncate">{sectionLabel(section)}</span>{bookmarked ? <BookmarkCheck aria-label="Bookmarked chapter" className="h-3.5 w-3.5 shrink-0 text-[var(--loombus-gold)]" /> : null}</button>;
                })}</div>
              </section>

              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                <div className="flex items-center gap-2"><List className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Saved & annotations</h2></div>
                <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Navigate saved reading tools across this publication.</p>
                <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-[var(--loombus-surface-strong)] p-1">{(["bookmarks", "highlights", "notes"] as ReadingToolTab[]).map((tab) => <button key={tab} onClick={() => setReadingToolTab(tab)} aria-pressed={readingToolTab === tab} className={`rounded-lg px-2 py-2 text-[11px] font-semibold capitalize ${readingToolTab === tab ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "text-[var(--loombus-text-muted)]"}`}>{tab}</button>)}</div>
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {readingToolTab === "bookmarks" ? (bookmarks.length ? bookmarks.map((bookmark) => { const index = sections.findIndex((section) => section.section_key === bookmark.locator); return <button key={bookmark.id} disabled={index < 0} onClick={() => moveToLocator(bookmark.locator)} className="w-full rounded-xl border border-[var(--loombus-border)] p-3 text-left disabled:opacity-50"><p className="text-xs font-semibold">{index >= 0 ? `${index + 1}. ${sectionLabel(sections[index])}` : "Unavailable chapter"}</p><p className="mt-1 text-[10px] text-[var(--loombus-text-subtle)]">Private bookmark</p></button>; }) : <p className="text-xs text-[var(--loombus-text-muted)]">No bookmarks in this book.</p>) : null}
                  {readingToolTab === "highlights" ? (highlights.length ? highlights.map((highlight) => { const index = sections.findIndex((section) => section.section_key === highlight.locator); return <button key={highlight.id} disabled={index < 0} onClick={() => moveToLocator(highlight.locator)} className="w-full rounded-xl bg-[var(--loombus-gold-surface)] p-3 text-left disabled:opacity-50"><p className="line-clamp-2 text-xs">“{highlight.selected_text}”</p><p className="mt-1 text-[10px] text-[var(--loombus-text-subtle)]">{index >= 0 ? `${index + 1}. ${sectionLabel(sections[index])}` : "Unavailable chapter"}</p></button>; }) : <p className="text-xs text-[var(--loombus-text-muted)]">No highlights in this book.</p>) : null}
                  {readingToolTab === "notes" ? (notes.length ? notes.map((note) => { const index = note.locator ? sections.findIndex((section) => section.section_key === note.locator) : -1; return <button key={note.id} disabled={index < 0} onClick={() => note.locator && moveToLocator(note.locator)} className="w-full rounded-xl border border-[var(--loombus-border)] p-3 text-left disabled:opacity-50"><p className="line-clamp-2 whitespace-pre-wrap text-xs">{note.body}</p><p className="mt-1 text-[10px] text-[var(--loombus-text-subtle)]">{index >= 0 ? `${index + 1}. ${sectionLabel(sections[index])}` : "Unavailable chapter"}</p></button>; }) : <p className="text-xs text-[var(--loombus-text-muted)]">No notes in this book.</p>) : null}
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><NotebookPen className="h-4 w-4 text-[var(--loombus-gold)]" /><h2 className="font-semibold">Private note</h2></div><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Saved to this chapter only.</p><textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write a note at this position…" className="mt-4 min-h-24 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-3 text-sm outline-none" /><button onClick={() => void saveNote()} disabled={saving || !noteDraft.trim()} className="mt-3 text-sm font-semibold text-[var(--loombus-gold)] disabled:opacity-40">Save note</button></section>
              <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">This chapter</h2><span className="text-xs text-[var(--loombus-text-muted)]">{sectionHighlights.length} highlights · {sectionNotes.length} notes</span></div>{sectionHighlights.length || sectionNotes.length ? <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">{sectionHighlights.map((highlight) => <div key={highlight.id} className="rounded-xl bg-[var(--loombus-gold-surface)] p-3"><div className="flex items-start gap-2"><Highlighter className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--loombus-gold)]" /><div className="min-w-0 flex-1"><p className="text-xs leading-relaxed">“{highlight.selected_text}”</p><p className="mt-1 text-[10px] text-[var(--loombus-text-subtle)]">{highlight.start_offset === null ? "Legacy highlight · sidebar only" : highlight.text_sha256 === currentTextSha256 && highlight.end_offset !== null && currentSection.content_text.slice(highlight.start_offset, highlight.end_offset) === highlight.selected_text ? "Rendered inline" : "Inline range unavailable"}</p></div><button aria-label="Delete highlight" disabled={saving} onClick={() => void deleteHighlight(highlight.id)} className="shrink-0 text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}{sectionNotes.map((note) => <div key={note.id} className="rounded-xl border border-[var(--loombus-border)] p-3"><div className="flex items-start gap-2"><NotebookPen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--loombus-gold)]" /><p className="min-w-0 flex-1 whitespace-pre-wrap text-xs leading-relaxed">{note.body}</p><button aria-label="Delete note" disabled={saving} onClick={() => void deleteNote(note.id)} className="shrink-0 text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"><Trash2 className="h-3.5 w-3.5" /></button></div></div>)}</div> : <p className="mt-3 text-xs text-[var(--loombus-text-muted)]">No annotations in this chapter yet.</p>}<p className="mt-4 border-t border-[var(--loombus-border)] pt-3 text-[11px] text-[var(--loombus-text-subtle)]">Book total: {highlights.length} highlights · {notes.length} notes · {bookmarks.length} bookmarks · {inlineHighlightCount} inline here</p></section>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
