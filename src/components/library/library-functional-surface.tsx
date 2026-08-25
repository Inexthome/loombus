"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookCheck,
  BookOpen,
  Bookmark,
  Clock3,
  Compass,
  Folders,
  Highlighter,
  Home,
  LibraryBig,
  Loader2,
  MoreHorizontal,
  PenSquare,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { LibraryAuthorsCatalog } from "@/components/library/library-authors-catalog";
import { LibraryCollectionsPanel } from "@/components/library/library-collections-panel";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { LibraryDiscoverCatalog } from "@/components/library/library-discover-catalog";
import { libraryReaderHref } from "@/lib/library/passage-context";
import { supabase } from "@/lib/supabase/client";

type LibraryView =
  | "Home"
  | "Discover"
  | "My Library"
  | "Want to Read"
  | "Continue Reading"
  | "Finished"
  | "Collections"
  | "Highlights"
  | "Authors";

type LifecycleState = "want_to_read" | "reading" | "finished";
type PersonalSortMode = "recent" | "title" | "author" | "progress";

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
type ReadingLifecycle = { publication_id: string; state: LifecycleState; finished_at: string | null; updated_at: string };
type Highlight = {
  id: string;
  publication_id: string;
  locator: string;
  selected_text: string;
  start_offset: number | null;
  end_offset: number | null;
  text_sha256: string | null;
  created_at: string;
};
type Note = { id: string; publication_id: string; highlight_id: string | null; locator: string | null; body: string; created_at: string };

const publicationSelect = "id, slug, title, subtitle, description, publication_type, author_name, publisher_name, cover_url, publication_date";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function publicationMatches(publication: Publication, query: string) {
  if (!query) return true;
  return [publication.title, publication.subtitle, publication.description, publication.author_name, publication.publisher_name, publication.publication_type]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function SidebarButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition ${active ? "bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]" : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function SidebarLink({ href, icon: Icon, label }: { href: string; icon: typeof Home; label: string }) {
  return (
    <Link href={href} className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function LibraryFunctionalSurface() {
  const [activeView, setActiveView] = useState<LibraryView>("Home");
  const [searchQuery, setSearchQuery] = useState("");
  const [personalSort, setPersonalSort] = useState<PersonalSortMode>("recent");
  const [personalType, setPersonalType] = useState("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [memberItems, setMemberItems] = useState<MemberItem[]>([]);
  const [progressRows, setProgressRows] = useState<ReadingProgress[]>([]);
  const [lifecycleRows, setLifecycleRows] = useState<ReadingLifecycle[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutationId, setMutationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    const currentUser = userResult.user;
    if (userError || !currentUser) {
      setUserId(null);
      setPublications([]);
      setMemberItems([]);
      setProgressRows([]);
      setLifecycleRows([]);
      setHighlights([]);
      setNotes([]);
      setLoading(false);
      return;
    }

    setUserId(currentUser.id);
    const [memberItemsResult, progressResult, lifecycleResult, highlightsResult, notesResult] = await Promise.all([
      supabase.from("library_member_items").select("publication_id, added_at").order("added_at", { ascending: false }),
      supabase.from("library_reading_progress").select("publication_id, locator, progress_percent, last_read_at").order("last_read_at", { ascending: false }),
      supabase.from("library_reading_lifecycle").select("publication_id, state, finished_at, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_highlights").select("id, publication_id, locator, selected_text, start_offset, end_offset, text_sha256, created_at").order("created_at", { ascending: false }),
      supabase.from("library_notes").select("id, publication_id, highlight_id, locator, body, created_at").order("created_at", { ascending: false }),
    ]);

    const firstError = memberItemsResult.error ?? progressResult.error ?? lifecycleResult.error ?? highlightsResult.error ?? notesResult.error;
    if (firstError) {
      setErrorMessage("Unable to load your private Library state.");
      setLoading(false);
      return;
    }

    const nextMemberItems = (memberItemsResult.data ?? []) as MemberItem[];
    const nextProgressRows = (progressResult.data ?? []) as ReadingProgress[];
    const nextLifecycleRows = (lifecycleResult.data ?? []) as ReadingLifecycle[];
    const nextHighlights = (highlightsResult.data ?? []) as Highlight[];
    const nextNotes = (notesResult.data ?? []) as Note[];
    setMemberItems(nextMemberItems);
    setProgressRows(nextProgressRows);
    setLifecycleRows(nextLifecycleRows);
    setHighlights(nextHighlights);
    setNotes(nextNotes);

    const publicationIds = [...new Set([
      ...nextMemberItems.map((row) => row.publication_id),
      ...nextProgressRows.map((row) => row.publication_id),
      ...nextLifecycleRows.map((row) => row.publication_id),
      ...nextHighlights.map((row) => row.publication_id),
      ...nextNotes.map((row) => row.publication_id),
    ])];

    if (!publicationIds.length) {
      setPublications([]);
      setLoading(false);
      return;
    }

    const publicationResult = await supabase
      .from("library_publications")
      .select(publicationSelect)
      .in("id", publicationIds)
      .eq("status", "published");

    if (publicationResult.error) {
      setErrorMessage("Unable to load publication metadata for your private Library state.");
      setPublications([]);
      setLoading(false);
      return;
    }

    setPublications((publicationResult.data ?? []) as Publication[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const publicationById = useMemo(() => new Map(publications.map((publication) => [publication.id, publication])), [publications]);
  const savedIds = useMemo(() => new Set(memberItems.map((item) => item.publication_id)), [memberItems]);
  const lifecycleByPublicationId = useMemo(() => new Map(lifecycleRows.map((row) => [row.publication_id, row])), [lifecycleRows]);
  const progressByPublicationId = useMemo(() => new Map(progressRows.map((row) => [row.publication_id, row])), [progressRows]);
  const highlightById = useMemo(() => new Map(highlights.map((highlight) => [highlight.id, highlight])), [highlights]);
  const normalizedQuery = normalizeSearch(searchQuery);

  const homeLibraryPublications = useMemo(
    () => memberItems
      .map((item) => publicationById.get(item.publication_id))
      .filter((publication): publication is Publication => Boolean(publication)),
    [memberItems, publicationById],
  );

  const myLibraryPublications = useMemo(
    () => homeLibraryPublications.filter((publication) => publicationMatches(publication, normalizedQuery)),
    [homeLibraryPublications, normalizedQuery],
  );

  const organizedMyLibraryPublications = useMemo(() => {
    const filtered = myLibraryPublications.filter((publication) => personalType === "all" || publication.publication_type === personalType);
    const rows = [...filtered];
    if (personalSort === "title") return rows.sort((a, b) => a.title.localeCompare(b.title));
    if (personalSort === "author") return rows.sort((a, b) => (a.author_name ?? a.publisher_name ?? "").localeCompare(b.author_name ?? b.publisher_name ?? "") || a.title.localeCompare(b.title));
    if (personalSort === "progress") return rows.sort((a, b) => Number(progressByPublicationId.get(b.id)?.progress_percent ?? 0) - Number(progressByPublicationId.get(a.id)?.progress_percent ?? 0) || a.title.localeCompare(b.title));
    return rows;
  }, [myLibraryPublications, personalSort, personalType, progressByPublicationId]);

  const personalPublicationTypes = useMemo(() => [...new Set(myLibraryPublications.map((publication) => publication.publication_type))].sort(), [myLibraryPublications]);

  const continueReadingRows = useMemo(
    () => progressRows.filter((row) => {
      if (!(row.progress_percent > 0 && row.progress_percent < 100)) return false;
      const publication = publicationById.get(row.publication_id);
      return Boolean(publication && publicationMatches(publication, normalizedQuery));
    }),
    [normalizedQuery, progressRows, publicationById],
  );

  const filteredHighlights = useMemo(() => highlights.filter((highlight) => {
    if (!normalizedQuery) return true;
    const publication = publicationById.get(highlight.publication_id);
    return [highlight.selected_text, highlight.locator, publication?.title, publication?.author_name, publication?.publisher_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  }), [highlights, normalizedQuery, publicationById]);

  const filteredNotes = useMemo(() => notes.filter((note) => {
    if (!normalizedQuery) return true;
    const publication = publicationById.get(note.publication_id);
    return [note.body, note.locator, publication?.title, publication?.author_name, publication?.publisher_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  }), [normalizedQuery, notes, publicationById]);

  const publicationsForLifecycle = useCallback(
    (state: LifecycleState) => lifecycleRows
      .filter((row) => row.state === state)
      .map((row) => publicationById.get(row.publication_id))
      .filter((publication): publication is Publication => Boolean(publication))
      .filter((publication) => publicationMatches(publication, normalizedQuery)),
    [lifecycleRows, normalizedQuery, publicationById],
  );

  const wantToReadPublications = useMemo(() => publicationsForLifecycle("want_to_read"), [publicationsForLifecycle]);
  const finishedPublications = useMemo(() => publicationsForLifecycle("finished"), [publicationsForLifecycle]);

  async function ensurePublicationMetadata(publicationId: string) {
    if (publicationById.has(publicationId)) return;
    const publicationResult = await supabase
      .from("library_publications")
      .select(publicationSelect)
      .eq("id", publicationId)
      .eq("status", "published")
      .maybeSingle();
    if (!publicationResult.error && publicationResult.data) {
      setPublications((current) => [publicationResult.data as Publication, ...current.filter((row) => row.id !== publicationId)]);
    }
  }

  async function setReadingLifecycle(publicationId: string, state: LifecycleState) {
    if (!userId) {
      setErrorMessage("Sign in to manage your reading status.");
      return;
    }

    setMutationId(publicationId);
    setErrorMessage(null);

    if (state === "want_to_read" && !savedIds.has(publicationId)) {
      const { data: savedData, error: savedError } = await supabase
        .from("library_member_items")
        .insert({ user_id: userId, publication_id: publicationId })
        .select("publication_id, added_at")
        .single();
      if (savedError || !savedData) {
        setErrorMessage("Unable to add this publication to Want to Read.");
        setMutationId(null);
        return;
      }
      setMemberItems((current) => [savedData as MemberItem, ...current.filter((item) => item.publication_id !== publicationId)]);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("library_reading_lifecycle")
      .upsert(
        {
          user_id: userId,
          publication_id: publicationId,
          state,
          finished_at: state === "finished" ? now : null,
          updated_at: now,
        },
        { onConflict: "user_id,publication_id" },
      )
      .select("publication_id, state, finished_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage("Unable to update this publication's reading status.");
    } else {
      setLifecycleRows((current) => [data as ReadingLifecycle, ...current.filter((row) => row.publication_id !== publicationId)]);
      await ensurePublicationMetadata(publicationId);
    }
    setMutationId(null);
  }

  async function toggleMyLibrary(publicationId: string) {
    if (!userId) {
      setErrorMessage("Sign in to manage My Library.");
      return;
    }
    setMutationId(publicationId);
    setErrorMessage(null);

    if (savedIds.has(publicationId)) {
      const { error } = await supabase.from("library_member_items").delete().eq("user_id", userId).eq("publication_id", publicationId);
      if (error) {
        setErrorMessage("Unable to remove this publication from My Library.");
      } else {
        setMemberItems((current) => current.filter((item) => item.publication_id !== publicationId));
        if (lifecycleByPublicationId.get(publicationId)?.state === "want_to_read") {
          const { error: lifecycleDeleteError } = await supabase
            .from("library_reading_lifecycle")
            .delete()
            .eq("user_id", userId)
            .eq("publication_id", publicationId)
            .eq("state", "want_to_read");
          if (!lifecycleDeleteError) setLifecycleRows((current) => current.filter((row) => row.publication_id !== publicationId));
        }
      }
    } else {
      const { data, error } = await supabase
        .from("library_member_items")
        .insert({ user_id: userId, publication_id: publicationId })
        .select("publication_id, added_at")
        .single();
      if (error || !data) {
        setErrorMessage("Unable to add this publication to My Library.");
      } else {
        setMemberItems((current) => [data as MemberItem, ...current.filter((item) => item.publication_id !== publicationId)]);
        await ensurePublicationMetadata(publicationId);
        if (!lifecycleByPublicationId.has(publicationId)) {
          const now = new Date().toISOString();
          const { data: lifecycleData, error: lifecycleError } = await supabase
            .from("library_reading_lifecycle")
            .insert({ user_id: userId, publication_id: publicationId, state: "want_to_read", finished_at: null, updated_at: now })
            .select("publication_id, state, finished_at, updated_at")
            .single();
          if (!lifecycleError && lifecycleData) setLifecycleRows((current) => [lifecycleData as ReadingLifecycle, ...current]);
        }
      }
    }
    setMutationId(null);
  }

  function BookTile({ publication, statusLabel }: { publication: Publication; statusLabel?: string }) {
    const lifecycle = lifecycleByPublicationId.get(publication.id);
    const progress = progressByPublicationId.get(publication.id);
    return (
      <article className="group relative min-w-0">
        <Link href={`/library/publication/${publication.id}`} className="block">
          <span className="block aspect-[2/3] w-full overflow-hidden rounded-lg bg-[var(--loombus-surface-strong)] shadow-sm ring-1 ring-[var(--loombus-border)] transition group-hover:-translate-y-0.5 group-hover:shadow-md">
            <LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-6 w-6" />
          </span>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{publication.title}</h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--loombus-text-muted)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
          {statusLabel ? <p className="mt-1 text-[11px] font-medium text-[var(--loombus-gold)]">{statusLabel}</p> : progress && progress.progress_percent > 0 ? <p className="mt-1 text-[11px] font-medium text-[var(--loombus-gold)]">{Math.round(progress.progress_percent)}% read</p> : null}
        </Link>

        <details className="absolute right-1 top-1 z-10">
          <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/85 [&::-webkit-details-marker]:hidden" aria-label={`More options for ${publication.title}`}>
            {mutationId === publication.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
          </summary>
          <div className="absolute right-0 mt-1 w-52 overflow-hidden rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-1.5 shadow-xl">
            <Link href={`/library/read/${publication.id}?open=1`} className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium hover:bg-[var(--loombus-surface-muted)]"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />Read</Link>
            {lifecycle?.state !== "want_to_read" ? <button type="button" disabled={mutationId === publication.id} onClick={() => void setReadingLifecycle(publication.id, "want_to_read")} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium hover:bg-[var(--loombus-surface-muted)] disabled:opacity-50"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Want to Read</button> : null}
            {lifecycle?.state === "finished" ? <button type="button" disabled={mutationId === publication.id} onClick={() => void setReadingLifecycle(publication.id, "reading")} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium hover:bg-[var(--loombus-surface-muted)] disabled:opacity-50"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />Still Reading</button> : <button type="button" disabled={mutationId === publication.id} onClick={() => void setReadingLifecycle(publication.id, "finished")} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium hover:bg-[var(--loombus-surface-muted)] disabled:opacity-50"><BookCheck className="h-3.5 w-3.5" aria-hidden="true" />Mark as Finished</button>}
            {savedIds.has(publication.id) ? <button type="button" disabled={mutationId === publication.id} onClick={() => void toggleMyLibrary(publication.id)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium hover:bg-[var(--loombus-surface-muted)] disabled:opacity-50"><Bookmark className="h-3.5 w-3.5" aria-hidden="true" />Remove from My Library</button> : <button type="button" disabled={mutationId === publication.id} onClick={() => void toggleMyLibrary(publication.id)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium hover:bg-[var(--loombus-surface-muted)] disabled:opacity-50"><Bookmark className="h-3.5 w-3.5" aria-hidden="true" />Add to My Library</button>}
          </div>
        </details>
      </article>
    );
  }

  function EmptyState({ title, body, action }: { title: string; body: string; action?: { label: string; view: LibraryView } }) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-8 text-center">
        <LibraryBig className="mx-auto h-6 w-6 text-[var(--loombus-gold)]" aria-hidden="true" />
        <h3 className="mt-3 text-sm font-semibold">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">{body}</p>
        {action ? <button type="button" onClick={() => setActiveView(action.view)} className="mt-4 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-semibold text-black">{action.label}</button> : null}
      </div>
    );
  }

  function ContinueShelf() {
    if (loading) return <div className="grid min-h-28 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading reading progress" /></div>;
    if (!continueReadingRows.length) return <EmptyState title={normalizedQuery ? "No matching books in progress" : "Nothing in progress"} body={normalizedQuery ? "Try another Library search." : userId ? "Start reading a publication and your saved position will appear here." : "Sign in to keep your reading position private and synced."} action={normalizedQuery ? undefined : { label: "Explore Library", view: "Discover" }} />;

    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {continueReadingRows.map((row) => {
          const publication = publicationById.get(row.publication_id);
          if (!publication) return null;
          return (
            <Link key={row.publication_id} href={`/library/read/${row.publication_id}?open=1`} className="flex w-72 shrink-0 items-center gap-3 rounded-xl bg-[var(--loombus-surface-strong)] p-3 ring-1 ring-[var(--loombus-border)] transition hover:ring-[var(--loombus-gold)]">
              <span className="block aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-md bg-[var(--loombus-surface-muted)]">
                <LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-semibold">{publication.title}</span>
                <span className="mt-1 block line-clamp-1 text-xs text-[var(--loombus-text-muted)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</span>
                <span className="mt-2 block text-[11px] font-medium text-[var(--loombus-text-muted)]">{Math.round(row.progress_percent)}% complete</span>
                <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><span className="block h-full rounded-full bg-[var(--loombus-gold)]" style={{ width: `${Math.min(100, Math.max(0, row.progress_percent))}%` }} /></span>
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  function PublicationShelf({ rows, emptyTitle, emptyBody, limit, statusLabel }: { rows: Publication[]; emptyTitle: string; emptyBody: string; limit?: number; statusLabel?: string }) {
    const visibleRows = typeof limit === "number" ? rows.slice(0, limit) : rows;
    if (loading) return <div className="grid min-h-40 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Library shelf" /></div>;
    if (!visibleRows.length) return <EmptyState title={emptyTitle} body={emptyBody} action={{ label: "Explore Library", view: "Discover" }} />;
    return <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">{visibleRows.map((publication) => <BookTile key={publication.id} publication={publication} statusLabel={statusLabel} />)}</div>;
  }

  function MyLibraryShelf({ limit, home = false }: { limit?: number; home?: boolean }) {
    return <PublicationShelf rows={home ? homeLibraryPublications : organizedMyLibraryPublications} limit={limit} emptyTitle="My Library is empty" emptyBody={userId ? "Add a published work from Discover to keep it here." : "Sign in to build your personal Library."} />;
  }

  function PersonalLibraryControls() {
    return (
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--loombus-border)] pb-5">
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">Type
            <select value={personalType} onChange={(event) => setPersonalType(event.target.value)} className="min-h-10 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]">
              <option value="all">All types</option>
              {personalPublicationTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">Sort
            <select value={personalSort} onChange={(event) => setPersonalSort(event.target.value as PersonalSortMode)} className="min-h-10 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]">
              <option value="recent">Recently added</option>
              <option value="title">Title A–Z</option>
              <option value="author">Author A–Z</option>
              <option value="progress">Reading progress</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--loombus-text-muted)]"><SlidersHorizontal className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />{organizedMyLibraryPublications.length} {organizedMyLibraryPublications.length === 1 ? "work" : "works"}</div>
      </div>
    );
  }

  function highlightHref(highlight: Highlight) {
    if (
      highlight.locator &&
      Number.isInteger(highlight.start_offset) &&
      Number.isInteger(highlight.end_offset) &&
      Number(highlight.end_offset) > Number(highlight.start_offset) &&
      highlight.text_sha256?.length === 64
    ) {
      return libraryReaderHref(highlight.publication_id, {
        locator: highlight.locator,
        startOffset: Number(highlight.start_offset),
        endOffset: Number(highlight.end_offset),
        textSha256: highlight.text_sha256,
      });
    }
    return `/library/read/${highlight.publication_id}?open=1`;
  }

  function noteHref(note: Note) {
    const linkedHighlight = note.highlight_id ? highlightById.get(note.highlight_id) : null;
    return linkedHighlight ? highlightHref(linkedHighlight) : `/library/read/${note.publication_id}?open=1`;
  }

  const showSearch = activeView !== "Home" || Boolean(searchQuery);

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] pb-28 text-[var(--loombus-text)] md:pt-20">
      <div className="mx-auto flex w-full max-w-[1600px] gap-0 lg:px-4">
        <aside className="hidden w-56 shrink-0 border-r border-[var(--loombus-border)] px-3 py-6 lg:sticky lg:top-20 lg:block lg:h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <label className="mb-5 flex min-h-10 items-center gap-2 rounded-xl bg-[var(--loombus-surface-strong)] px-3 ring-1 ring-[var(--loombus-border)]">
            <Search className="h-4 w-4 shrink-0 text-[var(--loombus-text-muted)]" aria-hidden="true" />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onFocus={() => { if (activeView === "Home") setActiveView("Discover"); }} aria-label="Search the Loombus Library" placeholder="Search" className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--loombus-text-subtle)]" />
            {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-[var(--loombus-surface-muted)]" aria-label="Clear Library search"><X className="h-3.5 w-3.5" /></button> : null}
          </label>

          <nav aria-label="Library navigation" className="space-y-5">
            <div className="space-y-1"><SidebarButton active={activeView === "Home"} icon={Home} label="Home" onClick={() => setActiveView("Home")} /></div>
            <div>
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Discover</p>
              <div className="space-y-1">
                <SidebarButton active={activeView === "Discover"} icon={Compass} label="Explore" onClick={() => setActiveView("Discover")} />
                <SidebarButton active={activeView === "Authors"} icon={Users} label="Authors" onClick={() => setActiveView("Authors")} />
              </div>
            </div>
            <div>
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Library</p>
              <div className="space-y-1">
                <SidebarButton active={activeView === "My Library"} icon={LibraryBig} label="My Library" onClick={() => setActiveView("My Library")} />
                <SidebarButton active={activeView === "Want to Read"} icon={Clock3} label="Want to Read" onClick={() => setActiveView("Want to Read")} />
                <SidebarButton active={activeView === "Continue Reading"} icon={BookOpen} label="Continue Reading" onClick={() => setActiveView("Continue Reading")} />
                <SidebarButton active={activeView === "Finished"} icon={BookCheck} label="Finished" onClick={() => setActiveView("Finished")} />
                <SidebarButton active={activeView === "Collections"} icon={Folders} label="Collections" onClick={() => setActiveView("Collections")} />
                <SidebarButton active={activeView === "Highlights"} icon={Highlighter} label="Highlights & Notes" onClick={() => setActiveView("Highlights")} />
              </div>
            </div>
            <div>
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Knowledge</p>
              <div className="space-y-1">
                <SidebarLink href="/library/research" icon={Sparkles} label="Research" />
                <SidebarLink href="/library/ask-loombus" icon={Sparkles} label="Ask Loombus" />
              </div>
            </div>
            <div>
              <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Author</p>
              <div className="space-y-1"><SidebarLink href="/library/publish" icon={PenSquare} label="My Publications" /></div>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 lg:hidden">
            <label className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--loombus-surface-strong)] px-3 ring-1 ring-[var(--loombus-border)]">
              <Search className="h-4 w-4 text-[var(--loombus-text-muted)]" aria-hidden="true" />
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onFocus={() => { if (activeView === "Home") setActiveView("Discover"); }} aria-label="Search the Loombus Library" placeholder="Search books, authors, topics..." className="w-full bg-transparent text-sm outline-none" />
              {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full" aria-label="Clear Library search"><X className="h-4 w-4" /></button> : null}
            </label>
            <nav aria-label="Library sections" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(["Home", "Discover", "My Library", "Want to Read", "Continue Reading", "Finished", "Collections", "Highlights", "Authors"] as LibraryView[]).map((view) => <button key={view} type="button" onClick={() => setActiveView(view)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${activeView === view ? "bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]" : "bg-[var(--loombus-surface-strong)] text-[var(--loombus-text-muted)]"}`}>{view}</button>)}
              <Link href="/library/research" className="shrink-0 rounded-full bg-[var(--loombus-surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--loombus-text-muted)]">Research</Link>
              <Link href="/library/ask-loombus" className="shrink-0 rounded-full bg-[var(--loombus-surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--loombus-text-muted)]">Ask Loombus</Link>
              <Link href="/library/publish" className="shrink-0 rounded-full bg-[var(--loombus-surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--loombus-text-muted)]">My Publications</Link>
            </nav>
          </div>

          {errorMessage ? <div role="alert" className="mb-5 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{errorMessage}</div> : null}

          {activeView === "Home" ? (
            <div>
              <div className="mb-8 flex items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Loombus Library</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Home</h1></div>
                <button type="button" onClick={() => setActiveView("Discover")} className="hidden rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[var(--loombus-gold)] sm:inline-flex">Explore Library</button>
              </div>
              <section>
                <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Continue</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Pick up where you left off.</p></div><button type="button" onClick={() => setActiveView("Continue Reading")} className="text-sm font-semibold text-[var(--loombus-gold)]">See All</button></div>
                <ContinueShelf />
              </section>
              <section className="mt-10 border-t border-[var(--loombus-border)] pt-8">
                <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">My Library</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Your saved published works.</p></div><button type="button" onClick={() => setActiveView("My Library")} className="text-sm font-semibold text-[var(--loombus-gold)]">See All</button></div>
                <MyLibraryShelf limit={8} home />
              </section>
              {wantToReadPublications.length ? <section className="mt-10 border-t border-[var(--loombus-border)] pt-8">
                <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Want to Read</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Saved for later.</p></div><button type="button" onClick={() => setActiveView("Want to Read")} className="text-sm font-semibold text-[var(--loombus-gold)]">See All</button></div>
                <PublicationShelf rows={wantToReadPublications} limit={8} emptyTitle="Nothing saved for later" emptyBody="Mark a published work as Want to Read." statusLabel="Want to Read" />
              </section> : null}
              <section className="mt-10 grid gap-3 border-t border-[var(--loombus-border)] pt-8 sm:grid-cols-2">
                <button type="button" onClick={() => setActiveView("Discover")} className="flex w-full items-center justify-between rounded-2xl bg-[var(--loombus-surface-strong)] p-5 text-left ring-1 ring-[var(--loombus-border)] transition hover:ring-[var(--loombus-gold)]"><span><span className="block text-base font-semibold">Discover published work</span><span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">Browse books, essays, research, reports, guides, and articles.</span></span><Compass className="h-5 w-5 text-[var(--loombus-gold)]" aria-hidden="true" /></button>
                <button type="button" onClick={() => setActiveView("Collections")} className="flex w-full items-center justify-between rounded-2xl bg-[var(--loombus-surface-strong)] p-5 text-left ring-1 ring-[var(--loombus-border)] transition hover:ring-[var(--loombus-gold)]"><span><span className="block text-base font-semibold">Organize with Collections</span><span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">Group the books in My Library without creating duplicate copies.</span></span><Folders className="h-5 w-5 text-[var(--loombus-gold)]" aria-hidden="true" /></button>
              </section>
            </div>
          ) : null}

          {activeView !== "Home" ? (
            <div>
              <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Loombus Library</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{activeView}</h1></div>
              {showSearch && searchQuery && activeView !== "Discover" && activeView !== "Authors" ? <p className="mb-5 text-sm text-[var(--loombus-text-muted)]">Filtered by “{searchQuery}”</p> : null}
              {activeView === "Discover" ? <LibraryDiscoverCatalog query={searchQuery} savedIds={savedIds} mutationId={mutationId} onToggleSaved={toggleMyLibrary} /> : null}
              {activeView === "Authors" ? <LibraryAuthorsCatalog query={searchQuery} /> : null}
              {activeView === "My Library" ? <><PersonalLibraryControls /><MyLibraryShelf /></> : null}
              {activeView === "Want to Read" ? <PublicationShelf rows={wantToReadPublications} emptyTitle="Nothing in Want to Read" emptyBody={userId ? "Use a book's menu to save it for later." : "Sign in to keep a private Want to Read list."} statusLabel="Want to Read" /> : null}
              {activeView === "Continue Reading" ? <ContinueShelf /> : null}
              {activeView === "Finished" ? <PublicationShelf rows={finishedPublications} emptyTitle="No finished books yet" emptyBody={userId ? "Books you finish will appear here automatically, or you can mark one as Finished." : "Sign in to keep your reading history private and synced."} statusLabel="Finished" /> : null}
              {activeView === "Collections" ? <LibraryCollectionsPanel query={searchQuery} /> : null}
              {!loading && activeView === "Highlights" ? (
                <div className="space-y-4">
                  {filteredHighlights.length || filteredNotes.length ? <>
                    {filteredHighlights.map((highlight) => {
                      const publication = publicationById.get(highlight.publication_id);
                      return <article key={highlight.id} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-5 ring-1 ring-[var(--loombus-border)]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--loombus-gold)]"><Highlighter className="h-4 w-4" aria-hidden="true" />Highlight</div><Link href={highlightHref(highlight)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--loombus-gold)]"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />Open passage</Link></div><blockquote className="mt-3 border-l-2 border-[var(--loombus-gold)] pl-4 text-sm leading-6">{highlight.selected_text}</blockquote><p className="mt-3 text-xs text-[var(--loombus-text-muted)]">{publication?.title ?? "Library publication"}{highlight.locator ? ` · ${highlight.locator}` : ""}</p></article>;
                    })}
                    {filteredNotes.map((note) => {
                      const publication = publicationById.get(note.publication_id);
                      return <article key={note.id} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-5 ring-1 ring-[var(--loombus-border)]"><div className="flex items-center justify-between gap-3"><div className="text-xs font-semibold text-[var(--loombus-gold)]">Private note</div><Link href={noteHref(note)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-semibold transition hover:border-[var(--loombus-gold)]"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />{note.highlight_id && highlightById.has(note.highlight_id) ? "Open passage" : "Open book"}</Link></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{note.body}</p><p className="mt-3 text-xs text-[var(--loombus-text-muted)]">{publication?.title ?? "Library publication"}{note.locator ? ` · ${note.locator}` : ""}</p></article>;
                    })}
                  </> : <EmptyState title={normalizedQuery ? "No matching highlights or notes" : "No highlights or notes"} body={normalizedQuery ? "Try another Library search." : userId ? "Your private reading annotations will appear here." : "Sign in to keep private highlights and notes."} />}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
