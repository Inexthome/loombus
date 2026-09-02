"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Bookmark, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, SlidersHorizontal } from "lucide-react";
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

type CommerceState = { is_free: boolean; price_cents: number | null; currency: string | null };

type Props = {
  query: string;
  savedIds: Set<string>;
  mutationId: string | null;
  onToggleSaved: (publicationId: string) => void | Promise<void>;
};

function humanType(value: string) {
  return value.replaceAll("_", " ");
}

function priceLabel(state: CommerceState | undefined, owned: boolean) {
  if (owned) return "Purchased · Open";
  if (!state || state.is_free) return "Free";
  if (state.price_cents === null) return "Paid";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: state.currency ?? "USD" }).format(state.price_cents / 100);
}

export function LibraryDiscoverCatalog({ query, savedIds, mutationId, onToggleSaved }: Props) {
  const [rows, setRows] = useState<Publication[]>([]);
  const [commerceById, setCommerceById] = useState<Map<string, CommerceState>>(new Map());
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
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

  useEffect(() => { setPage(0); }, [debouncedQuery, publicationType, sort]);

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
      .then(async ({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setRows([]);
          setCommerceById(new Map());
          setOwnedIds(new Set());
          setError("Unable to search the published Library catalog.");
          setLoading(false);
          return;
        }

        const nextRows = (data ?? []) as Publication[];
        setRows(nextRows);
        const ids = nextRows.map((row) => row.id);
        if (!ids.length) {
          setCommerceById(new Map());
          setOwnedIds(new Set());
          setLoading(false);
          return;
        }

        const [commerceResult, purchaseResult] = await Promise.all([
          supabase.from("library_publications").select("id,is_free,price_cents,currency").in("id", ids),
          supabase.from("library_book_purchases").select("publication_id,status").in("publication_id", ids).in("status", ["paid", "disputed"]),
        ]);
        if (cancelled) return;
        if (!commerceResult.error) {
          setCommerceById(new Map((commerceResult.data ?? []).map((row: any) => [row.id, { is_free: row.is_free, price_cents: row.price_cents, currency: row.currency }])));
        }
        setOwnedIds(new Set((purchaseResult.data ?? []).map((row: any) => row.publication_id)));
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
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--loombus-border)] pb-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">Type<select value={publicationType} onChange={(event) => setPublicationType(event.target.value as PublicationType)} className="min-h-10 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]">{publicationTypes.map((type) => <option key={type} value={type}>{type === "all" ? "All types" : humanType(type)}</option>)}</select></label>
          <label className="grid gap-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">Sort<select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="min-h-10 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 text-sm text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-gold)]"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title_asc">Title A–Z</option><option value="title_desc">Title Z–A</option></select></label>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--loombus-text-muted)]"><SlidersHorizontal className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />{loading ? "Searching…" : rangeLabel}</div>
      </div>

      {error ? <div role="alert" className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}
      {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading published Library catalog" /></div> : null}

      {!loading && !error && rows.length ? (
        <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
          {rows.map((publication) => {
            const saved = savedIds.has(publication.id);
            const owned = ownedIds.has(publication.id);
            const commerce = commerceById.get(publication.id);
            return (
              <article key={publication.id} className="group relative min-w-0">
                <Link href={`/library/publication/${publication.id}`} className="block">
                  <span className="block aspect-[2/3] w-full overflow-hidden rounded-lg bg-[var(--loombus-surface-strong)] shadow-sm ring-1 ring-[var(--loombus-border)] transition group-hover:-translate-y-0.5 group-hover:shadow-md"><LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-6 w-6" /></span>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{publication.title}</h3>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--loombus-text-muted)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p>
                  <p className={`mt-1 text-xs font-semibold ${owned ? "text-[var(--loombus-gold)]" : "text-[var(--loombus-text)]"}`}>{priceLabel(commerce, owned)}</p>
                  {publication.series_title ? <p className="mt-1 line-clamp-1 text-[11px] text-[var(--loombus-text-subtle)]">{publication.series_title}{publication.series_position ? ` · ${Number(publication.series_position).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}</p> : null}
                </Link>

                <details className="absolute right-1 top-1 z-10">
                  <summary className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full bg-black/70 text-white backdrop-blur-sm transition hover:bg-black/85 [&::-webkit-details-marker]:hidden" aria-label={`More options for ${publication.title}`}>{mutationId === publication.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}</summary>
                  <div className="absolute right-0 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-1.5 shadow-xl">
                    <Link href={`/library/publication/${publication.id}`} className="flex min-h-9 items-center gap-2 rounded-lg px-3 text-xs font-medium hover:bg-[var(--loombus-surface-muted)]"><BookOpen className="h-3.5 w-3.5" aria-hidden="true" />{owned || commerce?.is_free ? "Open publication" : "View details"}</Link>
                    <button type="button" disabled={mutationId === publication.id} onClick={() => void onToggleSaved(publication.id)} className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-medium hover:bg-[var(--loombus-surface-muted)] disabled:opacity-50"><Bookmark className="h-3.5 w-3.5" aria-hidden="true" />{saved ? "Remove from My Library" : "Add to My Library"}</button>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && !rows.length ? <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-8 text-center"><h3 className="text-sm font-semibold">No published matches</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">Try another title, author, publisher, ISBN, series, subject, audience, type, or topic.</p></div> : null}

      {!loading && !error && total > PAGE_SIZE ? (
        <nav aria-label="Library catalog pages" className="mt-8 flex items-center justify-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
          <span className="text-xs text-[var(--loombus-text-muted)]">Page {page + 1} of {pageCount}</span>
          <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </nav>
      ) : null}
    </div>
  );
}
