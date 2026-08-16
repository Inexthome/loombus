"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Bookmark,
  ChevronRight,
  Highlighter,
  LibraryBig,
  Loader2,
  Search,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type LibraryTab = "Discover" | "My Library" | "Continue Reading" | "Highlights" | "Authors";

type Publication = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  cover_url: string | null;
  publication_date: string | null;
};

type MemberItem = { publication_id: string; added_at: string };
type ReadingProgress = { publication_id: string; locator: string | null; progress_percent: number; last_read_at: string };
type Highlight = { id: string; publication_id: string; locator: string; selected_text: string; created_at: string };
type Note = { id: string; publication_id: string; highlight_id: string | null; locator: string | null; body: string; created_at: string };

const tabs: LibraryTab[] = ["Discover", "My Library", "Continue Reading", "Highlights", "Authors"];

function normalizeSearch(value: string) { return value.trim().toLowerCase(); }
function publicationMatches(publication: Publication, query: string) {
  if (!query) return true;
  return [publication.title, publication.subtitle, publication.description, publication.author_name, publication.publisher_name, publication.publication_type]
    .filter(Boolean).join(" ").toLowerCase().includes(query);
}

export function LibraryFunctionalSurface() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("Discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [memberItems, setMemberItems] = useState<MemberItem[]>([]);
  const [progressRows, setProgressRows] = useState<ReadingProgress[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    const publicationResult = await supabase.from("library_publications").select("id, slug, title, subtitle, description, publication_type, author_name, publisher_name, cover_url, publication_date").order("publication_date", { ascending: false, nullsFirst: false }).order("title", { ascending: true });
    if (publicationResult.error) { setErrorMessage("Unable to load Library publications."); setLoading(false); return; }
    setPublications((publicationResult.data ?? []) as Publication[]);
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    const currentUser = userResult.user;
    if (userError || !currentUser) { setUserId(null); setMemberItems([]); setProgressRows([]); setHighlights([]); setNotes([]); setLoading(false); return; }
    setUserId(currentUser.id);
    const [memberItemsResult, progressResult, highlightsResult, notesResult] = await Promise.all([
      supabase.from("library_member_items").select("publication_id, added_at").order("added_at", { ascending: false }),
      supabase.from("library_reading_progress").select("publication_id, locator, progress_percent, last_read_at").order("last_read_at", { ascending: false }),
      supabase.from("library_highlights").select("id, publication_id, locator, selected_text, created_at").order("created_at", { ascending: false }),
      supabase.from("library_notes").select("id, publication_id, highlight_id, locator, body, created_at").order("created_at", { ascending: false }),
    ]);
    const firstError = memberItemsResult.error ?? progressResult.error ?? highlightsResult.error ?? notesResult.error;
    if (firstError) { setErrorMessage("Unable to load your private Library state."); setLoading(false); return; }
    setMemberItems((memberItemsResult.data ?? []) as MemberItem[]);
    setProgressRows((progressResult.data ?? []) as ReadingProgress[]);
    setHighlights((highlightsResult.data ?? []) as Highlight[]);
    setNotes((notesResult.data ?? []) as Note[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  const publicationById = useMemo(() => new Map(publications.map((publication) => [publication.id, publication])), [publications]);
  const savedIds = useMemo(() => new Set(memberItems.map((item) => item.publication_id)), [memberItems]);
  const normalizedQuery = normalizeSearch(searchQuery);
  const filteredPublications = useMemo(() => publications.filter((publication) => publicationMatches(publication, normalizedQuery)), [publications, normalizedQuery]);
  const myLibraryPublications = useMemo(() => memberItems.map((item) => publicationById.get(item.publication_id)).filter((publication): publication is Publication => Boolean(publication)).filter((publication) => publicationMatches(publication, normalizedQuery)), [memberItems, publicationById, normalizedQuery]);
  const continueReadingRows = useMemo(() => progressRows.filter((row) => row.progress_percent > 0 && row.progress_percent < 100 && publicationById.has(row.publication_id)), [progressRows, publicationById]);
  const authorNames = useMemo(() => { const names = new Set<string>(); filteredPublications.forEach((publication) => { if (publication.author_name?.trim()) names.add(publication.author_name.trim()); }); return [...names].sort((a, b) => a.localeCompare(b)); }, [filteredPublications]);

  async function toggleMyLibrary(publicationId: string) {
    if (!userId) { setErrorMessage("Sign in to manage My Library."); return; }
    setMutationId(publicationId); setErrorMessage(null);
    if (savedIds.has(publicationId)) {
      const { error } = await supabase.from("library_member_items").delete().eq("user_id", userId).eq("publication_id", publicationId);
      if (error) setErrorMessage("Unable to remove this publication from My Library.");
      else setMemberItems((current) => current.filter((item) => item.publication_id !== publicationId));
    } else {
      const { data, error } = await supabase.from("library_member_items").insert({ user_id: userId, publication_id: publicationId }).select("publication_id, added_at").single();
      if (error || !data) setErrorMessage("Unable to add this publication to My Library.");
      else setMemberItems((current) => [data as MemberItem, ...current.filter((item) => item.publication_id !== publicationId)]);
    }
    setMutationId(null);
  }

  function PublicationCard({ publication }: { publication: Publication }) {
    const saved = savedIds.has(publication.id);
    return (
      <article className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5">
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_35%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><BookOpen className="h-5 w-5" aria-hidden="true" /></span>
          <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--loombus-text-muted)]">{publication.publication_type}</span>
        </div>
        <h3 className="mt-4 text-base font-semibold">{publication.title}</h3>
        {publication.subtitle ? <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
        <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
        {publication.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{publication.description}</p> : null}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href={`/library/read/${publication.id}`} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />Read</Link>
          <button type="button" disabled={mutationId === publication.id} onClick={() => void toggleMyLibrary(publication.id)} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3.5 py-2 text-xs font-semibold text-[var(--loombus-text)] transition hover:border-[var(--loombus-gold)] disabled:cursor-wait disabled:opacity-60">
            {mutationId === publication.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Bookmark className="h-3.5 w-3.5 text-[var(--loombus-gold)]" aria-hidden="true" />}
            {saved ? "Remove from My Library" : "Add to My Library"}
          </button>
        </div>
      </article>
    );
  }

  function EmptyState({ title, body }: { title: string; body: string }) {
    return <div className="rounded-[1.5rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-8 text-center"><LibraryBig className="mx-auto h-6 w-6 text-[var(--loombus-gold)]" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">{body}</p></div>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-28 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-sm">
          <div className="border-b border-[var(--loombus-border)] px-5 py-7 sm:px-8 sm:py-9"><div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]"><BookMarked className="h-4 w-4" aria-hidden="true" />Loombus Library</div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Read deeply. Keep the signal.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">Discover published long-form work and keep your personal reading state private by default.</p></div><label className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 lg:max-w-sm"><Search className="h-4 w-4 shrink-0 text-[var(--loombus-gold)]" aria-hidden="true" /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search the Loombus Library" placeholder="Search books, authors, topics..." className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--loombus-text-subtle)]" /></label></div></div>
          <div className="overflow-x-auto border-b border-[var(--loombus-border)] px-3 sm:px-6"><nav aria-label="Library sections" className="flex min-w-max gap-1 py-2">{tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${activeTab === tab ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-text)] ring-1 ring-[color:color-mix(in_srgb,var(--loombus-gold)_42%,var(--loombus-border))]" : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"}`}>{tab}</button>)}</nav></div>
          <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-8">{[
            { title: "Continue reading", count: continueReadingRows.length, icon: BookOpen, tab: "Continue Reading" as LibraryTab },
            { title: "Your library", count: memberItems.length, icon: LibraryBig, tab: "My Library" as LibraryTab },
            { title: "Highlights & notes", count: highlights.length + notes.length, icon: Highlighter, tab: "Highlights" as LibraryTab },
          ].map(({ title, count, icon: Icon, tab }) => <button key={title} type="button" onClick={() => setActiveTab(tab)} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5 text-left transition hover:border-[var(--loombus-gold)]"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_35%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><Icon className="h-5 w-5" aria-hidden="true" /></span><h2 className="mt-5 text-base font-semibold">{title}</h2><p className="mt-2 text-2xl font-semibold">{loading ? "—" : count}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--loombus-gold)]">Open <ChevronRight className="h-4 w-4" aria-hidden="true" /></span></button>)}</div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-8">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">{activeTab}</p><h2 className="mt-2 text-xl font-semibold">{activeTab === "Discover" ? "Published Library" : activeTab}</h2></div>{loading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Library" /> : null}</div>
          {errorMessage ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{errorMessage}</div> : null}

          {!loading && activeTab === "Discover" ? <div className="mt-6">{filteredPublications.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filteredPublications.map((publication) => <PublicationCard key={publication.id} publication={publication} />)}</div> : <EmptyState title="No published matches" body="Try a different title, author, publisher, or topic." />}</div> : null}
          {!loading && activeTab === "My Library" ? <div className="mt-6">{myLibraryPublications.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{myLibraryPublications.map((publication) => <PublicationCard key={publication.id} publication={publication} />)}</div> : <EmptyState title="My Library is empty" body={userId ? "Add a published work from Discover to keep it here." : "Sign in to build your personal Library."} />}</div> : null}
          {!loading && activeTab === "Continue Reading" ? <div className="mt-6 space-y-3">{continueReadingRows.length ? continueReadingRows.map((row) => { const publication = publicationById.get(row.publication_id); if (!publication) return null; return <Link key={row.publication_id} href={`/library/read/${row.publication_id}`} className="block rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5 transition hover:border-[var(--loombus-gold)]"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{publication.title}</h3><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{row.locator ? `Position: ${row.locator}` : "Reading position saved"}</p></div><span className="text-sm font-semibold text-[var(--loombus-gold)]">{Math.round(row.progress_percent)}%</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full rounded-full bg-[var(--loombus-gold)]" style={{ width: `${Math.min(100, Math.max(0, row.progress_percent))}%` }} /></div></Link>; }) : <EmptyState title="Nothing in progress" body={userId ? "Your saved reading progress will appear here." : "Sign in to keep your reading position private and synced."} />}</div> : null}
          {!loading && activeTab === "Highlights" ? <div className="mt-6 space-y-4">{highlights.length || notes.length ? <>{highlights.map((highlight) => { const publication = publicationById.get(highlight.publication_id); return <article key={highlight.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--loombus-gold)]"><Highlighter className="h-4 w-4" aria-hidden="true" />Highlight</div><blockquote className="mt-3 border-l-2 border-[var(--loombus-gold)] pl-4 text-sm leading-6">{highlight.selected_text}</blockquote><p className="mt-3 text-xs text-[var(--loombus-text-muted)]">{publication?.title ?? "Library publication"}{highlight.locator ? ` · ${highlight.locator}` : ""}</p></article>; })}{notes.map((note) => { const publication = publicationById.get(note.publication_id); return <article key={note.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5"><div className="text-xs font-semibold text-[var(--loombus-gold)]">Private note</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{note.body}</p><p className="mt-3 text-xs text-[var(--loombus-text-muted)]">{publication?.title ?? "Library publication"}{note.locator ? ` · ${note.locator}` : ""}</p></article>; })}</> : <EmptyState title="No highlights or notes" body={userId ? "Your private reading annotations will appear here." : "Sign in to keep private highlights and notes."} />}</div> : null}
          {!loading && activeTab === "Authors" ? <div className="mt-6">{authorNames.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{authorNames.map((author) => <div key={author} className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><UserRound className="h-4 w-4" aria-hidden="true" /></span><div><p className="text-sm font-semibold">{author}</p><p className="text-xs text-[var(--loombus-text-muted)]">{filteredPublications.filter((publication) => publication.author_name?.trim() === author).length} published {filteredPublications.filter((publication) => publication.author_name?.trim() === author).length === 1 ? "work" : "works"}</p></div></div>)}</div> : <EmptyState title="No authors found" body="Published Library authors will appear here." />}</div> : null}
        </section>
      </div>
    </main>
  );
}
