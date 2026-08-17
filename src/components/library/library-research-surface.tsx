"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, FlaskConical, Loader2, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

type ResearchItem = {
  id: string;
  publication_id: string;
  locator: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  text_sha256: string;
  created_at: string;
};

type Publication = { id: string; title: string; author_name: string | null; publisher_name: string | null };
type Section = { publication_id: string; section_key: string; ordinal: number; title: string | null };

function sectionLabel(section: Section) {
  return section.title ?? `Section ${section.ordinal + 1}`;
}

export function LibraryResearchSurface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setError("Sign in to view your Library Research.");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const itemResult = await supabase
      .from("library_research_items")
      .select("id, publication_id, locator, selected_text, start_offset, end_offset, text_sha256, created_at")
      .order("created_at", { ascending: false });

    if (itemResult.error) {
      setError("Unable to load your saved research passages.");
      setLoading(false);
      return;
    }

    const rows = (itemResult.data ?? []) as ResearchItem[];
    setItems(rows);
    const publicationIds = Array.from(new Set(rows.map((row) => row.publication_id)));
    if (!publicationIds.length) {
      setPublications([]);
      setSections([]);
      setLoading(false);
      return;
    }

    const [publicationResult, sectionResult] = await Promise.all([
      supabase.from("library_publications").select("id, title, author_name, publisher_name").in("id", publicationIds),
      supabase.from("library_publication_sections").select("publication_id, section_key, ordinal, title").in("publication_id", publicationIds).order("ordinal", { ascending: true }),
    ]);

    if (publicationResult.error || sectionResult.error) {
      setError("Your research passages loaded, but some publication details are unavailable.");
    }
    setPublications((publicationResult.data ?? []) as Publication[]);
    setSections((sectionResult.data ?? []) as Section[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadResearch(); }, [loadResearch]);

  const publicationById = useMemo(() => new Map(publications.map((row) => [row.id, row])), [publications]);
  const sectionByKey = useMemo(() => new Map(sections.map((row) => [`${row.publication_id}:${row.section_key}`, row])), [sections]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const publication = publicationById.get(item.publication_id);
      const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
      return [item.selected_text, publication?.title, publication?.author_name, publication?.publisher_name, section?.title]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle));
    });
  }, [items, publicationById, query, sectionByKey]);

  async function deleteItem(item: ResearchItem) {
    if (!userId) return;
    setBusyId(item.id);
    setError(null);
    const { error: deleteError } = await supabase
      .from("library_research_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (deleteError) setError("Unable to remove this research passage.");
    else setItems((rows) => rows.filter((row) => row.id !== item.id));
    setBusyId(null);
  }

  async function openChapter(item: ResearchItem) {
    if (!userId) return;
    const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
    if (!section) return;

    setBusyId(item.id);
    setError(null);
    const publicationSections = sections.filter((row) => row.publication_id === item.publication_id);
    const index = publicationSections.findIndex((row) => row.section_key === item.locator);
    const progressPercent = index >= 0 && publicationSections.length ? Math.min(100, Math.max(1, Math.round(((index + 1) / publicationSections.length) * 100))) : 1;
    const now = new Date().toISOString();
    const { error: progressError } = await supabase.from("library_reading_progress").upsert({
      user_id: userId,
      publication_id: item.publication_id,
      locator: item.locator,
      progress_percent: progressPercent,
      last_read_at: now,
      updated_at: now,
    }, { onConflict: "user_id,publication_id" });

    if (progressError) {
      setError("Unable to open the saved chapter.");
      setBusyId(null);
      return;
    }
    window.location.href = `/library/read/${item.publication_id}`;
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Library</Link>
          <div className="mt-5 flex items-start gap-3"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><FlaskConical className="size-5" /></div><div><h1 className="text-3xl font-black tracking-tight">Research</h1><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Private passages you saved from the Loombus Reader.</p></div></div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

        <div className="mt-6 flex items-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4"><Search className="size-4 shrink-0 text-[var(--loombus-text-subtle)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved passages, books, or authors…" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none" /></div>

        <div className="mt-6 space-y-3">
          {filtered.length ? filtered.map((item) => {
            const publication = publicationById.get(item.publication_id);
            const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
            return (
              <article key={item.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">{publication?.title ?? "Library publication"}</p>
                    <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{section ? `${section.ordinal + 1}. ${sectionLabel(section)}` : "Unavailable chapter"}{publication?.author_name ? ` · ${publication.author_name}` : ""}</p>
                    <blockquote className="mt-4 whitespace-pre-wrap text-[15px] leading-7">“{item.selected_text}”</blockquote>
                    <p className="mt-3 text-[11px] text-[var(--loombus-text-subtle)]">Saved {new Date(item.created_at).toLocaleString()}</p>
                  </div>
                  <button type="button" aria-label="Delete research passage" disabled={busyId === item.id} onClick={() => void deleteItem(item)} className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--loombus-border)] text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)] disabled:opacity-50"><Trash2 className="size-4" /></button>
                </div>
                <div className="mt-4 border-t border-[var(--loombus-border)] pt-4">
                  <button type="button" disabled={!section || busyId === item.id} onClick={() => void openChapter(item)} className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)] disabled:opacity-40"><BookOpen className="size-4" /> Open chapter</button>
                </div>
              </article>
            );
          }) : <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center"><FlaskConical className="mx-auto size-6 text-[var(--loombus-gold)]" /><p className="mt-3 text-sm font-semibold">{items.length ? "No research passages match your search." : "No saved research passages yet."}</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Select a passage in the Reader and choose Save to Research.</p></div>}
        </div>
      </div>
    </main>
  );
}
