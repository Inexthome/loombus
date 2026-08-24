"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bookmark, ChevronLeft, ChevronRight, Loader2, SlidersHorizontal } from "lucide-react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { supabase } from "@/lib/supabase/client";

const PAGE_SIZE = 24;
const publicationTypes = ["all", "book", "essay", "research", "report", "guide", "article", "other"] as const;
type PublicationType = (typeof publicationTypes)[number];
type SortMode = "newest" | "oldest" | "title_asc" | "title_desc";

type Publication = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  cover_url: string | null;
  isbn: string | null;
  publication_date: string | null;
  series_title: string | null;
  series_position: number | null;
  edition_label: string | null;
  subjects: string[];
  audience_label: string | null;
  total_count: number;
};

type Props = {
  query: string;
  savedIds: Set<string>;
  mutationId: string | null;
  onToggleSaved: (publicationId: string) => void | Promise<void>;
};

function humanType(value: string) {
  return value.replaceAll("_", " ");
}

function seriesLabel(publication: Publication) {
  if (!publication.series_title) return null;
  return publication.series_position
    ? `${publication.series_title} · ${Number(publication.series_position).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : publication.series_title;
}

export function LibraryDiscoverCatalog({ query, savedIds, mutationId, onToggleSaved }: Props) {
  const [rows, setRows] = useState<Publication[]>([]);
  const [publicationType, setPublicationType] = useState<PublicationType>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, publicationType, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void supabase
      .rpc("search_library_published_catalog", {
        p_query: debouncedQuery || null,
        p_publication_type: publicationType === "all" ? null : publicationType,
        p_sort: sort,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setRows([]);
          setError("Unable to search the published Library catalog.");
        } else {
          setRows((data ?? []) as Publication[]);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, page, publicationType, sort]);

  const total = Number(rows[0]?.total_count ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeLabel = useMemo(() => {
    if (!total) return "0 published works";
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(total, start + rows.length - 1);
    return `${start}–${end} of ${total}`;
  }, [page, rows.length, total]);

  return (
    <div className="mt-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">
            Type
            <select
              value={publicationType}
              onChange={(event) => setPublicationType(event.target.value as PublicationType)}
              className="min-h-10 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]"
            >
              {publicationTypes.map((type) => <option key={type} value={type}>{type === "all" ? "All types" : humanType(type)}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortMode)}
              className="min-h-10 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--loombus-text-muted)]">
          <SlidersHorizontal className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />
          {loading ? "Searching…" : rangeLabel}
        </div>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}
      {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading published Library catalog" /></div> : null}

      {!loading && !error && rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((publication) => {
            const saved = savedIds.has(publication.id);
            const series = seriesLabel(publication);
            return (
              <article key={publication.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <span className="grid aspect-[2/3] w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_35%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
                    <LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--loombus-text-muted)]">{publication.publication_type}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{publication.title}</h3>
                {publication.subtitle ? <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
                <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
                {series ? <p className="mt-2 text-xs font-semibold text-[var(--loombus-gold)]">{series}</p> : null}
                {(publication.edition_label || publication.audience_label || publication.subjects?.length) ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {publication.edition_label ? <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[10px] text-[var(--loombus-text-muted)]">{publication.edition_label}</span> : null}
                    {publication.audience_label ? <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[10px] text-[var(--loombus-text-muted)]">{publication.audience_label}</span> : null}
                    {(publication.subjects ?? []).slice(0, 2).map((subject) => <span key={subject} className="rounded-full bg-[var(--loombus-gold-surface)] px-2.5 py-1 text-[10px] text-[var(--loombus-text-muted)]">{subject}</span>)}
                  </div>
                ) : null}
                {publication.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">{publication.description}</p> : null}
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <Link href={`/library/publication/${publication.id}`} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-semibold text-black transition hover:opacity-90"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />View</Link>
                  <button
                    type="button"
                    disabled={mutationId === publication.id}
                    onClick={() => void onToggleSaved(publication.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3.5 py-2 text-xs font-semibold text-[var(--loombus-text)] transition hover:border-[var(--loombus-gold)] disabled:cursor-wait disabled:opacity-60"
                  >
                    {mutationId === publication.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Bookmark className="h-3.5 w-3.5 text-[var(--loombus-gold)]" aria-hidden="true" />}
                    {saved ? "Remove from My Library" : "Add to My Library"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && !rows.length ? (
        <div className="rounded-[1.5rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-8 text-center">
          <h3 className="text-sm font-semibold">No published matches</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">Try another title, author, publisher, ISBN, series, subject, audience, type, or topic.</p>
        </div>
      ) : null}

      {!loading && !error && total > PAGE_SIZE ? (
        <nav aria-label="Library catalog pages" className="mt-6 flex items-center justify-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
          <span className="text-xs text-[var(--loombus-text-muted)]">Page {page + 1} of {pageCount}</span>
          <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </nav>
      ) : null}
    </div>
  );
}