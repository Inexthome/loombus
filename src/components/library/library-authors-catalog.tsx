"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

const PAGE_SIZE = 36;
type AuthorRow = { author_name: string; work_count: number; total_count: number };

export function LibraryAuthorsCatalog({ query }: { query: string }) {
  const [rows, setRows] = useState<AuthorRow[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => { setPage(0); }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supabase.rpc("search_library_published_authors", {
      p_query: debouncedQuery || null,
      p_limit: PAGE_SIZE,
      p_offset: page * PAGE_SIZE,
    }).then(({ data, error: queryError }) => {
      if (cancelled) return;
      if (queryError) {
        setRows([]);
        setError("Unable to load published Library authors.");
      } else setRows((data ?? []) as AuthorRow[]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery, page]);

  const total = Number(rows[0]?.total_count ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) return <div className="mt-6 grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Library authors" /></div>;
  if (error) return <div role="alert" className="mt-6 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{error}</div>;
  if (!rows.length) return <div className="mt-6 rounded-[1.5rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-8 text-center"><h3 className="text-sm font-semibold">No authors found</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">Published Library authors matching this search will appear here.</p></div>;

  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((author) => (
          <article key={author.author_name} className="flex items-center gap-3 rounded-[1.25rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><UserRound className="h-4 w-4" aria-hidden="true" /></span>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{author.author_name}</p><p className="text-xs text-[var(--loombus-text-muted)]">{author.work_count} published {Number(author.work_count) === 1 ? "work" : "works"}</p></div>
          </article>
        ))}
      </div>
      {total > PAGE_SIZE ? (
        <nav aria-label="Library author pages" className="mt-6 flex items-center justify-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-40"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</button>
          <span className="text-xs text-[var(--loombus-text-muted)]">Page {page + 1} of {pageCount}</span>
          <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => value + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-40">Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
        </nav>
      ) : null}
    </div>
  );
}
