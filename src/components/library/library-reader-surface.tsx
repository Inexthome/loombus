"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Highlighter,
  List,
  Loader2,
  Menu,
  Minus,
  NotebookPen,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  LIBRARY_READER_DEFAULTS,
  LIBRARY_READER_PREFERENCES_KEY,
  type LibraryReaderPreferences,
  readLibraryReaderPreferences,
} from "@/components/library/library-reader-modernization";
import { supabase } from "@/lib/supabase/client";

type Publication = { id: string; title: string; subtitle: string | null; author_name: string | null; publisher_name: string | null };
type ReaderSection = { section_key: string; ordinal: number; title: string | null; content_text: string };
type Progress = { locator: string | null; progress_percent: number };
type Highlight = { id: string; locator: string; selected_text: string; start_offset: number | null; end_offset: number | null; text_sha256: string | null; created_at: string };
type Note = { id: string; highlight_id: string | null; locator: string | null; body: string; created_at: string };
type BookmarkRow = { id: string; locator: string; created_at: string };
type ReaderSelection = { text: string; startOffset: number; endOffset: number };
type ReaderPage = { id: string; sectionIndex: number; locator: string; title: string; start: number; end: number; text: string };
type SearchResult = { id: string; pageIndex: number; title: string; snippet: string; matchStart: number | null; matchEnd: number | null };
type Panel = "contents" | "annotations" | "search" | "appearance" | null;
type ReaderFocus = { locator: string; startOffset: number; endOffset: number; textSha256: string };

type TextRange = { start: number; end: number; kind: "highlight" | "search" };

function sectionLabel(section: ReaderSection) {
  return section.title ?? `Section ${section.ordinal + 1}`;
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

function chooseBreak(text: string, start: number, capacity: number) {
  const max = Math.min(text.length, start + capacity);
  if (max >= text.length) return text.length;
  const min = Math.min(max, start + Math.floor(capacity * 0.62));
  const windowText = text.slice(min, max);
  const paragraph = Math.max(windowText.lastIndexOf("\n\n"), windowText.lastIndexOf("\n"));
  if (paragraph >= 0) return min + paragraph + (windowText[paragraph + 1] === "\n" ? 2 : 1);
  const sentence = Math.max(windowText.lastIndexOf(". "), windowText.lastIndexOf("? "), windowText.lastIndexOf("! "));
  if (sentence >= 0) return min + sentence + 2;
  const space = windowText.lastIndexOf(" ");
  return space >= 0 ? min + space + 1 : max;
}

function paginateSections(sections: ReaderSection[], capacity: number): ReaderPage[] {
  const pages: ReaderPage[] = [];
  sections.forEach((section, sectionIndex) => {
    const text = section.content_text;
    let start = 0;
    let part = 0;
    while (start < text.length) {
      const end = chooseBreak(text, start, capacity);
      pages.push({ id: `${section.section_key}:${part}:${start}`, sectionIndex, locator: section.section_key, title: sectionLabel(section), start, end, text: text.slice(start, end) });
      start = end;
      part += 1;
    }
    if (!text.length) pages.push({ id: `${section.section_key}:0:0`, sectionIndex, locator: section.section_key, title: sectionLabel(section), start: 0, end: 0, text: "" });
  });
  return pages;
}

function renderPageText(page: ReaderPage, highlights: Highlight[], sectionSha: string | null, searchRange: { start: number; end: number } | null) {
  const ranges: TextRange[] = highlights
    .filter((row) => row.locator === page.locator && row.text_sha256 === sectionSha && row.start_offset !== null && row.end_offset !== null && row.end_offset > page.start && row.start_offset < page.end)
    .map((row) => ({ start: Math.max(page.start, row.start_offset as number) - page.start, end: Math.min(page.end, row.end_offset as number) - page.start, kind: "highlight" as const }));
  if (searchRange) ranges.push({ start: Math.max(0, searchRange.start), end: Math.min(page.text.length, searchRange.end), kind: "search" });
  if (!ranges.length) return page.text;

  const boundaries = new Set<number>([0, page.text.length]);
  ranges.forEach((range) => { boundaries.add(range.start); boundaries.add(range.end); });
  const points = [...boundaries].filter((value) => value >= 0 && value <= page.text.length).sort((a, b) => a - b);
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1];
    const segment = page.text.slice(start, end);
    const active = ranges.filter((range) => range.start < end && range.end > start);
    if (!active.length) return <span key={`${start}-${end}`}>{segment}</span>;
    const isSearch = active.some((range) => range.kind === "search");
    const isHighlight = active.some((range) => range.kind === "highlight");
    return <mark key={`${start}-${end}`} className={isSearch ? "rounded-[2px] bg-[#f2a93b] px-[1px] text-inherit ring-1 ring-[#d28a21]" : isHighlight ? "rounded-[2px] bg-[#f3cf66]/70 text-inherit" : "text-inherit"}>{segment}</mark>;
  });
}

function buildSearchResults(pages: ReaderPage[], query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: SearchResult[] = [];
  pages.forEach((page, pageIndex) => {
    if (results.length >= 75) return;
    const titleMatch = page.title.toLowerCase().includes(q);
    const bodyIndex = page.text.toLowerCase().indexOf(q);
    if (!titleMatch && bodyIndex < 0) return;
    const start = Math.max(0, bodyIndex >= 0 ? bodyIndex - 55 : 0);
    const end = Math.min(page.text.length, (bodyIndex >= 0 ? bodyIndex + q.length : 0) + 95);
    results.push({
      id: `${page.id}:${bodyIndex}`,
      pageIndex,
      title: page.title,
      snippet: titleMatch && bodyIndex < 0 ? "Chapter title match" : `${start > 0 ? "…" : ""}${page.text.slice(start, end).replace(/\s+/g, " ").trim()}${end < page.text.length ? "…" : ""}`,
      matchStart: bodyIndex >= 0 ? bodyIndex : null,
      matchEnd: bodyIndex >= 0 ? bodyIndex + q.length : null,
    });
  });
  return results;
}

export function LibraryReaderSurface({ publicationId, focus = null }: { publicationId: string; focus?: ReaderFocus | null }) {
  const touchStartX = useRef<number | null>(null);
  const chromeTimer = useRef<number | null>(null);
  const readingAnchor = useRef<{ locator: string; offset: number } | null>(null);
  const restoredFocusKey = useRef<string | null>(null);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [sections, setSections] = useState<ReaderSection[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ locator: null, progress_percent: 0 });
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [preferences, setPreferences] = useState<LibraryReaderPreferences>(LIBRARY_READER_DEFAULTS);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCapacity, setPageCapacity] = useState(1850);
  const [sectionHashes, setSectionHashes] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [selectionLocator, setSelectionLocator] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [pageNoteDraft, setPageNoteDraft] = useState("");
  const [noteForSelection, setNoteForSelection] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchResultId, setActiveSearchResultId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState<number | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = useMemo(() => paginateSections(sections, pageCapacity), [sections, pageCapacity]);
  const spreadCount = useMemo(() => {
    if (typeof window === "undefined") return 1;
    if (preferences.spread === "one") return 1;
    if (preferences.spread === "two") return window.innerWidth >= 1100 ? 2 : 1;
    return window.innerWidth >= 1250 ? 2 : 1;
  }, [preferences.spread, pageCapacity]);
  const visiblePages = pages.slice(pageIndex, pageIndex + spreadCount);
  const currentPage = pages[pageIndex] ?? null;
  const currentSection = currentPage ? sections[currentPage.sectionIndex] ?? null : null;
  const currentBookmark = currentPage ? bookmarks.find((row) => row.locator === currentPage.locator) ?? null : null;
  const searchResults = useMemo(() => buildSearchResults(pages, searchQuery), [pages, searchQuery]);
  const activeSearchResult = searchResults.find((result) => result.id === activeSearchResultId) ?? null;
  const progressDisplay = pages.length ? `${Math.min(pageIndex + 1, pages.length)} of ${pages.length}` : "";
  const progressPercent = pages.length ? Math.round((Math.min(pageIndex + spreadCount, pages.length) / pages.length) * 100) : 0;

  function revealChrome() {
    setChromeVisible(true);
    if (chromeTimer.current) window.clearTimeout(chromeTimer.current);
    if (!panel && !mobileMenuOpen && !selection) {
      chromeTimer.current = window.setTimeout(() => setChromeVisible(false), 2600);
    }
  }

  useEffect(() => {
    setPreferences(readLibraryReaderPreferences());
    return () => { if (chromeTimer.current) window.clearTimeout(chromeTimer.current); };
  }, []);
  useEffect(() => window.localStorage.setItem(LIBRARY_READER_PREFERENCES_KEY, JSON.stringify(preferences)), [preferences]);
  useEffect(() => { if (panel || mobileMenuOpen || selection) { setChromeVisible(true); if (chromeTimer.current) window.clearTimeout(chromeTimer.current); } else revealChrome(); }, [panel, mobileMenuOpen, selection]);

  useEffect(() => {
    function updateCapacity() {
      const width = Math.min(window.innerWidth, Math.max(560, preferences.width * 16));
      const mobile = window.innerWidth < 768;
      const height = Math.max(430, window.innerHeight - (mobile ? 150 : 150));
      const linePx = preferences.fontSize * preferences.lineHeight;
      const availableWidth = mobile ? window.innerWidth - 58 : width - 92;
      const charsPerLine = Math.max(24, Math.floor(availableWidth / (preferences.fontSize * (preferences.font === "serif" ? 0.53 : 0.56))));
      const lines = Math.max(11, Math.floor(height / linePx));
      setPageCapacity(Math.max(470, Math.floor(charsPerLine * lines * 0.9)));
    }
    updateCapacity();
    window.addEventListener("resize", updateCapacity);
    return () => window.removeEventListener("resize", updateCapacity);
  }, [preferences]);

  const loadReader = useCallback(async () => {
    setLoading(true);
    setError(null);
    const publicationResult = await supabase.from("library_publications").select("id, title, subtitle, author_name, publisher_name").eq("id", publicationId).eq("status", "published").single();
    if (publicationResult.error || !publicationResult.data) { setError("This publication is not available to read."); setLoading(false); return; }
    setPublication(publicationResult.data as Publication);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setError("Sign in to use the Loombus Reader."); setLoading(false); return; }
    setUserId(authData.user.id);
    const [sectionResult, progressResult, highlightResult, noteResult, bookmarkResult] = await Promise.all([
      supabase.from("library_publication_sections").select("section_key, ordinal, title, content_text").eq("publication_id", publicationId).order("ordinal"),
      supabase.from("library_reading_progress").select("locator, progress_percent").eq("publication_id", publicationId).maybeSingle(),
      supabase.from("library_highlights").select("id, locator, selected_text, start_offset, end_offset, text_sha256, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
      supabase.from("library_notes").select("id, highlight_id, locator, body, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
      supabase.from("library_bookmarks").select("id, locator, created_at").eq("publication_id", publicationId).order("created_at", { ascending: false }),
    ]);
    const firstError = sectionResult.error ?? progressResult.error ?? highlightResult.error ?? noteResult.error ?? bookmarkResult.error;
    if (firstError) { setError("Unable to load this publication's reading state."); setLoading(false); return; }
    const nextSections = (sectionResult.data ?? []) as ReaderSection[];
    if (!nextSections.length) { setError("This publication does not have readable content yet."); setLoading(false); return; }
    setSections(nextSections);
    setProgress((progressResult.data as Progress | null) ?? { locator: nextSections[0].section_key, progress_percent: 0 });
    setHighlights((highlightResult.data ?? []) as Highlight[]);
    setNotes((noteResult.data ?? []) as Note[]);
    setBookmarks((bookmarkResult.data ?? []) as BookmarkRow[]);
    const hashes = await Promise.all(nextSections.map(async (section) => [section.section_key, await sha256Text(section.content_text)] as const));
    setSectionHashes(Object.fromEntries(hashes));
    setLoading(false);
  }, [publicationId]);

  useEffect(() => { void loadReader(); }, [loadReader]);

  const focusKey = focus ? `${focus.locator}:${focus.startOffset}:${focus.endOffset}:${focus.textSha256}` : null;
  useEffect(() => {
    if (!pages.length) return;
    if (focus && focusKey && restoredFocusKey.current !== focusKey) {
      const index = pages.findIndex((page) => page.locator === focus.locator && focus.startOffset >= page.start && focus.startOffset < page.end);
      if (index >= 0) {
        setPageIndex(index);
        readingAnchor.current = { locator: focus.locator, offset: focus.startOffset };
        restoredFocusKey.current = focusKey;
        return;
      }
    }
    const anchor = readingAnchor.current;
    if (anchor) {
      const index = pages.findIndex((page) => page.locator === anchor.locator && anchor.offset >= page.start && anchor.offset < page.end);
      if (index >= 0) { setPageIndex(index); return; }
    }
    if (progress.locator) {
      const index = pages.findIndex((page) => page.locator === progress.locator);
      if (index >= 0) setPageIndex(index);
    }
  }, [pages, progress.locator, focus, focusKey]);

  useEffect(() => {
    const page = pages[pageIndex];
    if (page) readingAnchor.current = { locator: page.locator, offset: page.start };
  }, [pageIndex, pages]);

  async function persistPage(nextIndex: number) {
    if (!userId || !pages.length) return;
    const clamped = Math.max(0, Math.min(pages.length - 1, nextIndex));
    const page = pages[clamped];
    readingAnchor.current = { locator: page.locator, offset: page.start };
    setPageIndex(clamped);
    setSelection(null);
    setSelectionLocator(null);
    window.getSelection()?.removeAllRanges();
    const nextProgress = Math.round(((clamped + 1) / pages.length) * 100);
    setProgress({ locator: page.locator, progress_percent: nextProgress });
    const now = new Date().toISOString();
    const { error: saveError } = await supabase.from("library_reading_progress").upsert({ user_id: userId, publication_id: publicationId, locator: page.locator, progress_percent: nextProgress, last_read_at: now, updated_at: now }, { onConflict: "user_id,publication_id" });
    if (saveError) setError("Unable to save your reading position.");
  }

  function turn(delta: number) { void persistPage(pageIndex + delta * spreadCount); }
  function jumpTo(nextIndex: number) {
    if (nextIndex < 0) return;
    if (nextIndex !== pageIndex) setHistoryPage(pageIndex);
    void persistPage(nextIndex);
    setPanel(null);
    setMobileMenuOpen(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); turn(1); }
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); turn(-1); }
      if (event.key === "Escape") { setPanel(null); setMobileMenuOpen(false); setSelection(null); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pageIndex, spreadCount, pages.length]);

  function captureSelection(page: ReaderPage, container: HTMLDivElement) {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.rangeCount !== 1 || browserSelection.isCollapsed) { setSelection(null); setSelectionLocator(null); return; }
    const range = browserSelection.getRangeAt(0);
    if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return;
    const raw = range.toString();
    const trimmed = raw.trim();
    if (!trimmed) return;
    const leading = raw.length - raw.trimStart().length;
    const startOffset = page.start + textOffsetWithin(container, range.startContainer, range.startOffset) + leading;
    const text = trimmed.slice(0, 4000);
    const endOffset = startOffset + text.length;
    const section = sections[page.sectionIndex];
    if (section.content_text.slice(startOffset, endOffset) !== text) { setError("Select text within one displayed page to use reading tools."); return; }
    setSelection({ text, startOffset, endOffset });
    setSelectionLocator(page.locator);
    setNoteForSelection(false);
    setError(null);
    revealChrome();
  }

  async function saveHighlight() {
    if (!userId || !selection || !selectionLocator) return null;
    const section = sections.find((row) => row.section_key === selectionLocator);
    if (!section) return null;
    setSaving(true);
    setError(null);
    try {
      const textSha256 = sectionHashes[selectionLocator] ?? await sha256Text(section.content_text);
      const { data, error: saveError } = await supabase.from("library_highlights").insert({ user_id: userId, publication_id: publicationId, locator: selectionLocator, selected_text: selection.text, start_offset: selection.startOffset, end_offset: selection.endOffset, text_sha256: textSha256 }).select("id, locator, selected_text, start_offset, end_offset, text_sha256, created_at").single();
      if (saveError || !data) { setError("Unable to save this highlight."); return null; }
      const saved = data as Highlight;
      setHighlights((rows) => [saved, ...rows]);
      return saved;
    } finally { setSaving(false); }
  }

  async function saveSelectionNote() {
    if (!userId || !selection || !selectionLocator || !noteDraft.trim()) return;
    setSaving(true);
    let highlight = highlights.find((row) => row.locator === selectionLocator && row.start_offset === selection.startOffset && row.end_offset === selection.endOffset) ?? null;
    if (!highlight) highlight = await saveHighlight();
    if (!highlight) { setSaving(false); return; }
    const { data, error: saveError } = await supabase.from("library_notes").insert({ user_id: userId, publication_id: publicationId, highlight_id: highlight.id, locator: selectionLocator, body: noteDraft.trim() }).select("id, highlight_id, locator, body, created_at").single();
    if (saveError || !data) setError("Unable to save this note.");
    else { setNotes((rows) => [data as Note, ...rows]); setNoteDraft(""); setNoteForSelection(false); setSelection(null); setSelectionLocator(null); window.getSelection()?.removeAllRanges(); }
    setSaving(false);
  }

  async function savePageNote() {
    if (!userId || !currentPage || !pageNoteDraft.trim()) return;
    setSaving(true);
    const { data, error: saveError } = await supabase.from("library_notes").insert({ user_id: userId, publication_id: publicationId, locator: currentPage.locator, body: pageNoteDraft.trim() }).select("id, highlight_id, locator, body, created_at").single();
    if (saveError || !data) setError("Unable to save this note.");
    else { setNotes((rows) => [data as Note, ...rows]); setPageNoteDraft(""); }
    setSaving(false);
  }

  async function deleteHighlight(id: string) {
    if (!userId) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("library_highlights").delete().eq("id", id).eq("user_id", userId).eq("publication_id", publicationId);
    if (deleteError) setError("Unable to remove this highlight.");
    else setHighlights((rows) => rows.filter((row) => row.id !== id));
    setSaving(false);
  }

  async function deleteNote(id: string) {
    if (!userId) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from("library_notes").delete().eq("id", id).eq("user_id", userId).eq("publication_id", publicationId);
    if (deleteError) setError("Unable to remove this note.");
    else setNotes((rows) => rows.filter((row) => row.id !== id));
    setSaving(false);
  }

  async function toggleBookmark() {
    if (!userId || !currentPage) return;
    setSaving(true);
    if (currentBookmark) {
      const { error: deleteError } = await supabase.from("library_bookmarks").delete().eq("id", currentBookmark.id).eq("user_id", userId).eq("publication_id", publicationId);
      if (!deleteError) setBookmarks((rows) => rows.filter((row) => row.id !== currentBookmark.id));
      else setError("Unable to remove this bookmark.");
    } else {
      const { data, error: insertError } = await supabase.from("library_bookmarks").insert({ user_id: userId, publication_id: publicationId, locator: currentPage.locator }).select("id, locator, created_at").single();
      if (!insertError && data) setBookmarks((rows) => [data as BookmarkRow, ...rows]);
      else setError("Unable to save this bookmark.");
    }
    setSaving(false);
  }

  function pageForLocator(locator: string) { return pages.findIndex((page) => page.locator === locator); }
  function pageForHighlight(highlight: Highlight) {
    if (highlight.start_offset !== null) {
      const exact = pages.findIndex((page) => page.locator === highlight.locator && highlight.start_offset! >= page.start && highlight.start_offset! < page.end);
      if (exact >= 0) return exact;
    }
    return pageForLocator(highlight.locator);
  }
  function pageForNote(note: Note) {
    const linked = note.highlight_id ? highlights.find((highlight) => highlight.id === note.highlight_id) : null;
    if (linked) return pageForHighlight(linked);
    return note.locator ? pageForLocator(note.locator) : -1;
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" /></main>;

  const themeClass = preferences.theme === "night" ? "bg-black text-[#f4f1ea]" : preferences.theme === "quiet" ? "bg-[#ebe7de] text-[#25231f]" : preferences.theme === "loombus" ? "bg-[#faf5df] text-[#211f1a]" : "bg-[#fffdf8] text-[#231f19]";
  const pageFont = preferences.font === "sans" ? "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : "Georgia, 'Times New Roman', serif";

  return (
    <main
      className={`relative h-[100dvh] overflow-hidden ${themeClass}`}
      onMouseMove={revealChrome}
      onClick={(event) => {
        if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).closest("a,button,input,textarea,aside")) return;
        const browserSelection = window.getSelection();
        if (browserSelection && !browserSelection.isCollapsed) return;
        const ratio = event.clientX / window.innerWidth;
        if (ratio < 0.12) turn(-1);
        else if (ratio > 0.88) turn(1);
        else { setChromeVisible((value) => !value); if (!chromeVisible) revealChrome(); }
      }}
      onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStartX.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(delta) > 55) turn(delta < 0 ? 1 : -1);
      }}
    >
      <header className={`absolute inset-x-0 top-0 z-40 flex h-16 items-center justify-between px-4 transition-opacity sm:px-6 ${chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
        <div className="flex items-center gap-1">
          <Link href="/library" className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5" aria-label="Back to Library"><ArrowLeft className="h-5 w-5" /></Link>
          <button type="button" onClick={() => setPanel(panel === "contents" ? null : "contents")} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-black/5 md:grid" aria-label="Table of contents"><List className="h-5 w-5" /></button>
          <button type="button" onClick={() => setPanel(panel === "annotations" ? null : "annotations")} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-black/5 md:grid" aria-label="Highlights and notes"><NotebookPen className="h-5 w-5" /></button>
        </div>
        <div className="pointer-events-none absolute left-1/2 max-w-[45vw] -translate-x-1/2 truncate text-sm font-semibold opacity-65">{publication?.title}</div>
        <div className="flex items-center gap-1">
          {historyPage !== null ? <button type="button" onClick={() => { const target = historyPage; setHistoryPage(null); void persistPage(target); }} className="hidden h-10 items-center gap-2 rounded-full px-3 text-xs font-semibold md:inline-flex"><Undo2 className="h-4 w-4" />Back</button> : null}
          <Link href="/library/research" className="hidden h-10 w-10 place-items-center rounded-full hover:bg-black/5 md:grid" aria-label="Open Research"><FlaskConical className="h-5 w-5" /></Link>
          <button type="button" onClick={() => setPanel(panel === "appearance" ? null : "appearance")} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-black/5 md:grid" aria-label="Themes and settings"><SlidersHorizontal className="h-5 w-5" /></button>
          <button type="button" onClick={() => setPanel(panel === "search" ? null : "search")} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-black/5 md:grid" aria-label="Search this book"><Search className="h-5 w-5" /></button>
          <button type="button" onClick={() => void toggleBookmark()} disabled={saving} className="hidden h-10 w-10 place-items-center rounded-full hover:bg-black/5 md:grid" aria-label={currentBookmark ? "Remove bookmark" : "Bookmark page"}>{currentBookmark ? <BookmarkCheck className="h-5 w-5" /> : <Bookmark className="h-5 w-5" />}</button>
        </div>
      </header>

      {error ? <div role="alert" className="absolute left-1/2 top-20 z-[90] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-black/10 bg-white/95 p-3 text-sm text-black shadow-xl backdrop-blur-xl">{error}<button type="button" onClick={() => setError(null)} className="float-right ml-3"><X className="h-4 w-4" /></button></div> : null}

      <div className="absolute inset-0 flex items-center justify-center px-4 pb-20 pt-20 sm:px-8 md:pb-14 md:pt-16">
        <button type="button" onClick={() => turn(-1)} disabled={pageIndex === 0 || saving} className={`absolute left-2 z-20 hidden h-16 w-10 place-items-center rounded-full transition hover:bg-black/5 disabled:opacity-0 md:grid ${chromeVisible ? "opacity-100" : "opacity-0"}`} aria-label="Previous page"><ChevronLeft className="h-7 w-7" /></button>
        <div className={`grid h-full w-full gap-4 ${spreadCount === 2 ? "max-w-[1180px] grid-cols-2" : "max-w-[min(760px,94vw)] grid-cols-1"}`}>
          {visiblePages.map((page, visibleIndex) => {
            const absolutePageIndex = pageIndex + visibleIndex;
            const searchRange = activeSearchResult?.pageIndex === absolutePageIndex && activeSearchResult.matchStart !== null && activeSearchResult.matchEnd !== null ? { start: activeSearchResult.matchStart, end: activeSearchResult.matchEnd } : null;
            return (
              <article key={page.id} className={`relative h-full min-h-0 overflow-hidden rounded-[1.25rem] px-7 py-9 shadow-[0_14px_45px_rgba(0,0,0,0.08)] sm:px-10 md:rounded-[1rem] md:px-12 md:py-10 ${preferences.theme === "night" ? "bg-[#090909]" : preferences.theme === "quiet" ? "bg-[#f3f0e8]" : preferences.theme === "loombus" ? "bg-[#fff9df]" : "bg-white"}`}>
                <div className="mb-4 hidden truncate text-[11px] font-semibold uppercase tracking-[0.14em] opacity-40 md:block">{page.title}</div>
                <div
                  data-library-reader-page="true"
                  data-library-section-key={page.locator}
                  data-library-page-start={page.start}
                  data-library-page-end={page.end}
                  data-library-page-text={page.text}
                  onMouseUp={(event) => captureSelection(page, event.currentTarget)}
                  onTouchEnd={(event) => captureSelection(page, event.currentTarget)}
                  className="h-[calc(100%-1.75rem)] whitespace-pre-line selection:bg-[#f3cf66]/70"
                  style={{ fontFamily: pageFont, fontSize: preferences.fontSize, lineHeight: preferences.lineHeight }}
                >
                  {renderPageText(page, highlights, sectionHashes[page.locator] ?? null, searchRange)}
                </div>
                <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-[10px] opacity-35 md:block">{absolutePageIndex + 1}</div>
              </article>
            );
          })}
        </div>
        <button type="button" onClick={() => turn(1)} disabled={pageIndex + spreadCount >= pages.length || saving} className={`absolute right-2 z-20 hidden h-16 w-10 place-items-center rounded-full transition hover:bg-black/5 disabled:opacity-0 md:grid ${chromeVisible ? "opacity-100" : "opacity-0"}`} aria-label="Next page"><ChevronRight className="h-7 w-7" /></button>
      </div>

      {selection ? (
        <div className="absolute bottom-24 left-1/2 z-[75] w-[min(44rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#242424]/96 p-2 text-white shadow-2xl backdrop-blur-xl md:bottom-8">
          {!noteForSelection ? (
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
              <button type="button" onClick={() => void saveHighlight().then((saved) => { if (saved) { setSelection(null); setSelectionLocator(null); window.getSelection()?.removeAllRanges(); } })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm hover:bg-white/10"><Highlighter className="h-4 w-4" />Highlight</button>
              <button type="button" onClick={() => setNoteForSelection(true)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm hover:bg-white/10"><NotebookPen className="h-4 w-4" />Note</button>
              <button type="button" onClick={() => document.dispatchEvent(new CustomEvent("loombus:reader:passage-action", { detail: { action: "discuss" } }))} className="min-h-10 rounded-xl px-3 text-sm hover:bg-white/10">Discuss</button>
              <button type="button" onClick={() => document.dispatchEvent(new CustomEvent("loombus:reader:passage-action", { detail: { action: "research" } }))} className="min-h-10 rounded-xl px-3 text-sm hover:bg-white/10">Research</button>
              <button type="button" onClick={() => document.dispatchEvent(new CustomEvent("loombus:reader:passage-action", { detail: { action: "ask" } }))} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm hover:bg-white/10"><Sparkles className="h-4 w-4" />Ask</button>
            </div>
          ) : (
            <div className="flex gap-2"><input autoFocus value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add a private note to this passage…" className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm outline-none" /><button type="button" onClick={() => void saveSelectionNote()} disabled={!noteDraft.trim() || saving} className="rounded-xl bg-[var(--loombus-gold)] px-4 text-sm font-semibold text-black disabled:opacity-40">Save</button><button type="button" onClick={() => setNoteForSelection(false)} className="grid h-10 w-10 place-items-center"><X className="h-4 w-4" /></button></div>
          )}
        </div>
      ) : null}

      <div className={`absolute inset-x-0 bottom-5 z-40 flex items-center justify-center transition-opacity md:hidden ${chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}><span className="text-sm font-semibold opacity-55">{progressDisplay}</span></div>
      <button type="button" onClick={() => setMobileMenuOpen((value) => !value)} className={`absolute bottom-6 right-5 z-50 grid h-14 w-14 place-items-center rounded-full border border-white/10 bg-[#242424]/95 text-white shadow-xl transition-opacity md:hidden ${chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-label="Reader controls"><Menu className="h-6 w-6" /></button>

      {mobileMenuOpen ? (
        <div className="absolute inset-0 z-[60] bg-black/15 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-x-3 bottom-20 space-y-2" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => { setPanel("contents"); setMobileMenuOpen(false); }} className="flex min-h-16 w-full items-center justify-between rounded-[2rem] bg-[#3a3a3c]/96 px-6 text-left text-xl text-white"><span>Contents · {progressPercent}%</span><List className="h-7 w-7" /></button>
            <button type="button" onClick={() => { setPanel("search"); setMobileMenuOpen(false); }} className="flex min-h-16 w-full items-center justify-between rounded-[2rem] bg-[#3a3a3c]/96 px-6 text-left text-xl text-white"><span>Search Book</span><Search className="h-7 w-7" /></button>
            <button type="button" onClick={() => { setPanel("appearance"); setMobileMenuOpen(false); }} className="flex min-h-16 w-full items-center justify-between rounded-[2rem] bg-[#3a3a3c]/96 px-6 text-left text-xl text-white"><span>Themes & Settings</span><span className="text-2xl">AA</span></button>
            <div className="grid grid-cols-4 gap-2">
              <button type="button" onClick={() => { setPanel("annotations"); setMobileMenuOpen(false); }} className="grid min-h-16 place-items-center rounded-[2rem] bg-[#3a3a3c]/96 text-white" aria-label="Highlights and notes"><NotebookPen className="h-7 w-7" /></button>
              <Link href="/library/research" className="grid min-h-16 place-items-center rounded-[2rem] bg-[#3a3a3c]/96 text-white" aria-label="Open Research"><FlaskConical className="h-7 w-7" /></Link>
              {historyPage !== null ? <button type="button" onClick={() => { const target = historyPage; setHistoryPage(null); setMobileMenuOpen(false); void persistPage(target); }} className="grid min-h-16 place-items-center rounded-[2rem] bg-[#3a3a3c]/96 text-white" aria-label="Return to previous reading location"><Undo2 className="h-7 w-7" /></button> : <div className="rounded-[2rem] bg-[#3a3a3c]/75" />}
              <button type="button" onClick={() => void toggleBookmark()} className="grid min-h-16 place-items-center rounded-[2rem] bg-[#3a3a3c]/96 text-white" aria-label={currentBookmark ? "Remove bookmark" : "Bookmark page"}>{currentBookmark ? <BookmarkCheck className="h-7 w-7" /> : <Bookmark className="h-7 w-7" />}</button>
            </div>
          </div>
        </div>
      ) : null}

      {panel ? (
        <aside className="absolute inset-y-0 right-0 z-[70] w-full overflow-y-auto border-l border-black/10 bg-white/96 p-5 text-[#211f1a] shadow-2xl backdrop-blur-2xl sm:w-[24rem]">
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{panel === "contents" ? "Contents" : panel === "annotations" ? "Highlights & Notes" : panel === "search" ? "Search Book" : "Themes & Settings"}</h2><button type="button" onClick={() => setPanel(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-black/5"><X className="h-4 w-4" /></button></div>

          {panel === "contents" ? <div className="mt-5 space-y-1">{sections.map((section, index) => { const target = pages.findIndex((page) => page.sectionIndex === index); return <button key={section.section_key} type="button" onClick={() => jumpTo(target)} className={`w-full rounded-xl px-3 py-3 text-left text-sm ${currentPage?.sectionIndex === index ? "bg-[#f3cf66]/25 font-semibold" : "hover:bg-black/5"}`}><span className="mr-2 opacity-45">{index + 1}</span>{sectionLabel(section)}</button>; })}<div className="mt-5 text-xs opacity-55">{progressDisplay} · {progressPercent}%</div></div> : null}

          {panel === "annotations" ? (
            <div className="mt-5 space-y-6">
              <section><h3 className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">New private note</h3><div className="mt-2 flex gap-2"><textarea value={pageNoteDraft} onChange={(event) => setPageNoteDraft(event.target.value)} rows={2} placeholder="Note about the current reading location…" className="min-w-0 flex-1 rounded-xl border border-black/10 p-3 text-sm outline-none" /><button type="button" onClick={() => void savePageNote()} disabled={!pageNoteDraft.trim() || saving} className="self-end rounded-xl bg-[#c79a31] px-3 py-2 text-xs font-semibold text-black disabled:opacity-40">Save</button></div></section>
              <section><h3 className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Highlights</h3><div className="mt-2 space-y-2">{highlights.length ? highlights.map((highlight) => <div key={highlight.id} className="flex items-start gap-2 rounded-xl border border-black/10 p-3"><button type="button" onClick={() => jumpTo(pageForHighlight(highlight))} className="min-w-0 flex-1 text-left"><p className="line-clamp-3 text-sm">“{highlight.selected_text}”</p><p className="mt-2 text-xs opacity-45">{sections.find((section) => section.section_key === highlight.locator)?.title ?? "Source"}</p></button><button type="button" onClick={() => void deleteHighlight(highlight.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="Delete highlight"><Trash2 className="h-4 w-4" /></button></div>) : <p className="text-sm opacity-55">No highlights yet.</p>}</div></section>
              <section><h3 className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Notes</h3><div className="mt-2 space-y-2">{notes.length ? notes.map((note) => <div key={note.id} className="flex items-start gap-2 rounded-xl border border-black/10 p-3"><button type="button" onClick={() => jumpTo(pageForNote(note))} className="min-w-0 flex-1 text-left"><p className="whitespace-pre-wrap text-sm">{note.body}</p>{note.highlight_id ? <p className="mt-2 text-xs opacity-45">Linked to highlighted passage</p> : null}</button><button type="button" onClick={() => void deleteNote(note.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="Delete note"><Trash2 className="h-4 w-4" /></button></div>) : <p className="text-sm opacity-55">No notes yet.</p>}</div></section>
              <section><h3 className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Bookmarks</h3><div className="mt-2 space-y-2">{bookmarks.length ? bookmarks.map((bookmark) => <button key={bookmark.id} type="button" onClick={() => jumpTo(pageForLocator(bookmark.locator))} className="w-full rounded-xl border border-black/10 p-3 text-left text-sm">{sections.find((section) => section.section_key === bookmark.locator)?.title ?? "Bookmarked location"}</button>) : <p className="text-sm opacity-55">No bookmarks yet.</p>}</div></section>
            </div>
          ) : null}

          {panel === "search" ? <div className="mt-5"><label className="flex items-center gap-2 rounded-xl border border-black/10 px-3"><Search className="h-4 w-4 opacity-45" /><input autoFocus value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setActiveSearchResultId(null); }} placeholder="Find words or chapters…" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />{searchQuery ? <button type="button" onClick={() => { setSearchQuery(""); setActiveSearchResultId(null); }}><X className="h-4 w-4" /></button> : null}</label><div className="mt-4 space-y-2">{searchQuery.trim().length === 1 ? <p className="text-sm opacity-55">Type at least 2 characters.</p> : null}{searchResults.length ? <p className="text-xs opacity-50">{searchResults.length} {searchResults.length === 1 ? "match" : "matches"}</p> : null}{searchResults.map((result) => <button key={result.id} type="button" onClick={() => { setActiveSearchResultId(result.id); jumpTo(result.pageIndex); }} className={`w-full rounded-xl border p-3 text-left ${activeSearchResultId === result.id ? "border-[#c79a31] bg-[#f3cf66]/15" : "border-black/10"}`}><p className="text-xs font-semibold text-[#9c761e]">{result.title}</p><p className="mt-1 line-clamp-3 text-sm opacity-70">{result.snippet}</p></button>)}{searchQuery.trim().length >= 2 && !searchResults.length ? <p className="text-sm opacity-55">No matches in this book.</p> : null}</div></div> : null}

          {panel === "appearance" ? <div className="mt-5 space-y-6"><div><div className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Theme</div><div className="mt-2 grid grid-cols-4 gap-2">{(["paper", "loombus", "quiet", "night"] as const).map((theme) => <button key={theme} type="button" onClick={() => setPreferences((current) => ({ ...current, theme }))} className={`rounded-xl border px-2 py-3 text-xs capitalize ${preferences.theme === theme ? "border-[#b88a1e] bg-[#f3cf66]/20" : "border-black/10"}`}>{theme}</button>)}</div></div><div><div className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Text</div><div className="mt-2 flex items-center gap-2"><button type="button" onClick={() => setPreferences((current) => ({ ...current, fontSize: Math.max(14, current.fontSize - 1) }))} className="grid h-10 w-10 place-items-center rounded-full border border-black/10"><Minus className="h-4 w-4" /></button><span className="w-10 text-center text-sm">{preferences.fontSize}</span><button type="button" onClick={() => setPreferences((current) => ({ ...current, fontSize: Math.min(30, current.fontSize + 1) }))} className="grid h-10 w-10 place-items-center rounded-full border border-black/10"><Plus className="h-4 w-4" /></button><button type="button" onClick={() => setPreferences((current) => ({ ...current, font: current.font === "serif" ? "sans" : "serif" }))} className="ml-auto rounded-xl border border-black/10 px-3 py-2 text-sm">{preferences.font === "serif" ? "Serif" : "Sans"}</button></div></div><label className="grid gap-2 text-xs font-semibold">Line spacing<input type="range" min="1.35" max="2.2" step="0.05" value={preferences.lineHeight} onChange={(event) => setPreferences((current) => ({ ...current, lineHeight: Number(event.target.value) }))} /></label><label className="grid gap-2 text-xs font-semibold">Reading width / margins<input type="range" min="34" max="58" step="2" value={preferences.width} onChange={(event) => setPreferences((current) => ({ ...current, width: Number(event.target.value) }))} /></label><div><div className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Desktop pages</div><div className="mt-2 grid grid-cols-3 gap-2">{(["auto", "one", "two"] as const).map((spread) => <button key={spread} type="button" onClick={() => setPreferences((current) => ({ ...current, spread }))} className={`rounded-xl border px-3 py-2 text-xs capitalize ${preferences.spread === spread ? "border-[#b88a1e] bg-[#f3cf66]/20" : "border-black/10"}`}>{spread}</button>)}</div></div></div> : null}
        </aside>
      ) : null}
    </main>
  );
}
