"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Bookmark, CalendarDays, Languages, LibraryBig, Loader2, ScrollText, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { supabase } from "@/lib/supabase/client";

type Publication = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  isbn: string | null;
  cover_url: string | null;
  publication_date: string | null;
  series_title: string | null;
  series_position: number | null;
  edition_label: string | null;
  subjects: string[];
  audience_label: string | null;
};

type AuthorProfile = { username: string; full_name: string | null; bio: string | null; avatar_url: string | null; perspective_marker: string | null; creator_website_url: string | null };
type ProgressRow = { progress_percent: number; last_read_at: string };

function formatDate(value: string | null) {
  if (!value) return "Not listed";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function seriesLabel(publication: Publication) {
  if (!publication.series_title) return null;
  return publication.series_position ? `${publication.series_title} · ${Number(publication.series_position).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : publication.series_title;
}

export function LibraryPublicationDetail({ publicationId }: { publicationId: string }) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [authorProfile, setAuthorProfile] = useState<AuthorProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [sectionCount, setSectionCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true); setError(null); setUnavailable(false); setAuthorProfile(null);
    const publicationResult = await supabase.from("library_publications").select("id,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,cover_url,publication_date,series_title,series_position,edition_label,subjects,audience_label").eq("id", publicationId).eq("status", "published").maybeSingle();
    if (publicationResult.error) { setError("Unable to load this Library publication."); setLoading(false); return; }
    if (!publicationResult.data) { setPublication(null); setUnavailable(true); setLoading(false); return; }
    setPublication(publicationResult.data as Publication);

    const sectionResult = await supabase.from("library_publication_sections").select("id", { count: "exact", head: true }).eq("publication_id", publicationId);
    setSectionCount(sectionResult.error ? null : sectionResult.count ?? 0);

    const { data: userResult } = await supabase.auth.getUser();
    const currentUser = userResult.user;
    if (!currentUser) { setUserId(null); setSaved(false); setProgress(null); setLoading(false); return; }
    setUserId(currentUser.id);

    const [savedResult, progressResult, profileResult] = await Promise.all([
      supabase.from("library_member_items").select("publication_id").eq("user_id", currentUser.id).eq("publication_id", publicationId).maybeSingle(),
      supabase.from("library_reading_progress").select("progress_percent,last_read_at").eq("user_id", currentUser.id).eq("publication_id", publicationId).maybeSingle(),
      supabase.rpc("get_library_published_author_profile", { p_publication_id: publicationId }),
    ]);
    if (savedResult.error || progressResult.error) setError("Publication loaded, but your private Library state could not be loaded.");
    setSaved(Boolean(savedResult.data));
    setProgress((progressResult.data ?? null) as ProgressRow | null);
    setAuthorProfile(profileResult.error ? null : ((profileResult.data as AuthorProfile[] | null)?.[0] ?? null));
    setLoading(false);
  }, [publicationId]);

  useEffect(() => { void loadDetail(); }, [loadDetail]);

  const progressPercent = useMemo(() => {
    const value = Number(progress?.progress_percent ?? 0);
    if (!Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }, [progress]);

  async function toggleSaved() {
    if (!publication || saving) return;
    if (!userId) { window.location.assign(`/login?next=/library/publication/${publication.id}`); return; }
    setSaving(true); setError(null);
    if (saved) {
      const result = await supabase.from("library_member_items").delete().eq("user_id", userId).eq("publication_id", publication.id);
      if (result.error) setError("Unable to remove this publication from My Library."); else setSaved(false);
    } else {
      const result = await supabase.from("library_member_items").insert({ user_id: userId, publication_id: publication.id });
      if (result.error) setError("Unable to add this publication to My Library."); else setSaved(true);
    }
    setSaving(false);
  }

  if (loading) return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading publication details" /></main>;

  if (unavailable || !publication) return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6 md:pt-24"><div className="mx-auto max-w-xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center shadow-sm"><LibraryBig className="mx-auto h-8 w-8 text-[var(--loombus-gold)]" /><h1 className="mt-4 text-2xl font-semibold">This publication is no longer available.</h1><p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">It may have been unpublished or retired.</p><Link href="/library" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black"><ArrowLeft className="h-4 w-4" />Back to Library</Link></div></main>
  );

  const hasProgress = progressPercent > 0;
  const series = seriesLabel(publication);

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link href="/library" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-text)]"><ArrowLeft className="h-4 w-4" />Library</Link>
        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}

        <section className="mt-5 grid gap-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
          <div className="mx-auto w-full max-w-[260px] lg:mx-0"><div className="grid aspect-[2/3] w-full place-items-center overflow-hidden rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)] shadow-sm"><LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-10 w-10" /></div></div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-muted)]">{publication.publication_type}</span><span className="text-xs text-[var(--loombus-text-subtle)]">Published Library</span>{publication.edition_label ? <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs">{publication.edition_label}</span> : null}</div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{publication.title}</h1>
            {publication.subtitle ? <p className="mt-3 max-w-3xl text-lg leading-7 text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
            <p className="mt-4 text-sm font-semibold">{publication.author_name ?? "Loombus Library"}</p>
            {publication.publisher_name ? <p className="mt-1 text-sm text-[var(--loombus-text-subtle)]">{publication.publisher_name}</p> : null}
            {series ? <p className="mt-3 text-sm font-semibold text-[var(--loombus-gold)]">Series: {series}</p> : null}
            {publication.audience_label ? <p className="mt-2 text-xs text-[var(--loombus-text-muted)]">Audience: {publication.audience_label}</p> : null}
            {publication.subjects?.length ? <div className="mt-3 flex flex-wrap gap-2">{publication.subjects.map((subject)=><span key={subject} className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs text-[var(--loombus-text-muted)]">{subject}</span>)}</div> : null}
            {publication.description ? <p className="mt-6 max-w-3xl whitespace-pre-line text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">{publication.description}</p> : null}
            <div className="mt-7 flex flex-wrap gap-3"><Link href={`/library/read/${publication.id}?open=1`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black transition hover:opacity-90"><BookOpen className="h-4 w-4" />{hasProgress ? "Continue reading" : "Read publication"}</Link><button type="button" disabled={saving} onClick={() => void toggleSaved()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 text-sm font-semibold transition hover:border-[var(--loombus-gold)] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className="h-4 w-4 text-[var(--loombus-gold)]" />}{saved ? "Remove from My Library" : "Add to My Library"}</button></div>
            {hasProgress ? <div className="mt-6 max-w-xl rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4"><div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold">Reading progress</span><span className="font-semibold text-[var(--loombus-gold)]">{Math.round(progressPercent)}%</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full rounded-full bg-[var(--loombus-gold)]" style={{ width: `${progressPercent}%` }} /></div></div> : null}
          </div>
        </section>

        {authorProfile ? <section className="mt-6 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><UserRound className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Loombus author profile</p><p className="mt-1 font-semibold">{authorProfile.full_name?.trim() || `@${authorProfile.username}`}</p>{authorProfile.perspective_marker ? <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{authorProfile.perspective_marker}</p> : null}</div></div><Link href={`/u/${encodeURIComponent(authorProfile.username)}`} className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-semibold hover:border-[var(--loombus-gold)]">View member profile</Link></div>{authorProfile.bio ? <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">{authorProfile.bio}</p> : null}</section> : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><CalendarDays className="h-5 w-5 text-[var(--loombus-gold)]" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Publication date</p><p className="mt-2 text-sm font-semibold">{formatDate(publication.publication_date)}</p></div><div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><Languages className="h-5 w-5 text-[var(--loombus-gold)]" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Language</p><p className="mt-2 text-sm font-semibold">{publication.language_code}</p></div><div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><ScrollText className="h-5 w-5 text-[var(--loombus-gold)]" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">ISBN</p><p className="mt-2 break-words text-sm font-semibold">{publication.isbn ?? "Not listed"}</p></div><div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><BookOpen className="h-5 w-5 text-[var(--loombus-gold)]" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Readable sections</p><p className="mt-2 text-sm font-semibold">{sectionCount ?? "—"}</p></div></section>
      </div>
    </main>
  );
}