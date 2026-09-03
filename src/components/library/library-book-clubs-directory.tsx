"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, Loader2, LockKeyhole, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { supabase } from "@/lib/supabase/client";

type Hub = { id: string; publication_id: string };
type Publication = {
  id: string;
  title: string;
  subtitle: string | null;
  author_name: string | null;
  publisher_name: string | null;
  cover_url: string | null;
};
type Session = {
  id: string;
  hub_id: string;
  title: string;
  description: string | null;
  visibility: "public" | "private";
  status: "upcoming" | "active" | "completed";
  room_id: string | null;
  created_by: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};
type Membership = { session_id: string; user_id: string; role: "host" | "member" };
type ClubBook = { publication: Publication; sessions: Session[] };

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function LibraryBookClubsDirectory() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const nextUserId = authData.user?.id ?? null;
    setUserId(nextUserId);

    const hubsResult = await supabase
      .from("library_book_club_hubs")
      .select("id,publication_id")
      .order("created_at", { ascending: false });

    if (hubsResult.error) {
      setError("Unable to load Book Clubs.");
      setLoading(false);
      return;
    }

    const nextHubs = (hubsResult.data ?? []) as Hub[];
    if (!nextHubs.length) {
      setHubs([]);
      setSessions([]);
      setPublications([]);
      setMemberships([]);
      setLoading(false);
      return;
    }

    const sessionsResult = await supabase
      .from("library_book_club_sessions")
      .select("id,hub_id,title,description,visibility,status,room_id,created_by,starts_at,ends_at,created_at")
      .in("hub_id", nextHubs.map((hub) => hub.id))
      .order("created_at", { ascending: false });

    if (sessionsResult.error) {
      setError("Unable to load Book Club sessions.");
      setLoading(false);
      return;
    }

    const nextSessions = (sessionsResult.data ?? []) as Session[];
    const activeHubIds = new Set(nextSessions.map((session) => session.hub_id));
    const hubsWithSessions = nextHubs.filter((hub) => activeHubIds.has(hub.id));
    setHubs(hubsWithSessions);
    setSessions(nextSessions);

    if (!hubsWithSessions.length) {
      setPublications([]);
      setMemberships([]);
      setLoading(false);
      return;
    }

    const publicationResult = await supabase
      .from("library_publications")
      .select("id,title,subtitle,author_name,publisher_name,cover_url")
      .in("id", hubsWithSessions.map((hub) => hub.publication_id))
      .eq("status", "published");

    if (publicationResult.error) {
      setError("Unable to load Book Club publication details.");
      setLoading(false);
      return;
    }

    setPublications((publicationResult.data ?? []) as Publication[]);

    if (nextUserId && nextSessions.length) {
      const membershipResult = await supabase
        .from("library_book_club_members")
        .select("session_id,user_id,role")
        .eq("user_id", nextUserId)
        .in("session_id", nextSessions.map((session) => session.id));
      setMemberships(membershipResult.error ? [] : ((membershipResult.data ?? []) as Membership[]));
    } else {
      setMemberships([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hubById = useMemo(() => new Map(hubs.map((hub) => [hub.id, hub])), [hubs]);
  const publicationById = useMemo(() => new Map(publications.map((publication) => [publication.id, publication])), [publications]);
  const membershipBySessionId = useMemo(() => new Map(memberships.map((membership) => [membership.session_id, membership])), [memberships]);

  const groupBooks = useCallback((matchingSessions: Session[]) => {
    const grouped = new Map<string, ClubBook>();
    for (const session of matchingSessions) {
      const hub = hubById.get(session.hub_id);
      if (!hub) continue;
      const publication = publicationById.get(hub.publication_id);
      if (!publication) continue;
      const current = grouped.get(publication.id);
      if (current) current.sessions.push(session);
      else grouped.set(publication.id, { publication, sessions: [session] });
    }
    return [...grouped.values()].sort((a, b) => a.publication.title.localeCompare(b.publication.title));
  }, [hubById, publicationById]);

  const activeBooks = useMemo(() => groupBooks(sessions.filter((session) => session.status === "active")), [groupBooks, sessions]);
  const upcomingBooks = useMemo(() => groupBooks(sessions.filter((session) => session.status === "upcoming")), [groupBooks, sessions]);
  const pastBooks = useMemo(() => groupBooks(sessions.filter((session) => session.status === "completed")), [groupBooks, sessions]);
  const yourBooks = useMemo(() => groupBooks(sessions.filter((session) => session.created_by === userId || membershipBySessionId.has(session.id))), [groupBooks, membershipBySessionId, sessions, userId]);

  function BookClubRow({ club }: { club: ClubBook }) {
    const primary = club.sessions.find((session) => session.status === "active") ?? club.sessions[0];
    const membership = membershipBySessionId.get(primary.id);
    const isHost = primary.created_by === userId || membership?.role === "host";
    const joined = Boolean(membership || isHost);
    const date = formatDate(primary.starts_at);

    return (
      <article className="grid gap-5 border-t border-[var(--loombus-border)] py-6 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center">
        <Link href={`/library/publication/${club.publication.id}/book-club`} className="block aspect-[2/3] w-20 overflow-hidden rounded-md bg-[var(--loombus-surface-muted)]">
          <LibraryCoverImage storagePath={club.publication.cover_url} alt={`${club.publication.title} cover`} fallbackClassName="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold uppercase tracking-[0.14em] text-[var(--loombus-gold)]">{primary.status}</span>
            <span className="inline-flex items-center gap-1 text-[var(--loombus-text-subtle)]">{primary.visibility === "private" ? <LockKeyhole className="h-3.5 w-3.5" /> : <UsersRound className="h-3.5 w-3.5" />}{primary.visibility}</span>
            {joined ? <span className="text-[var(--loombus-text-muted)]">{isHost ? "Hosting" : "Joined"}</span> : null}
          </div>
          <Link href={`/library/publication/${club.publication.id}/book-club`} className="mt-2 block text-xl font-semibold hover:text-[var(--loombus-gold)]">{club.publication.title}</Link>
          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{club.publication.author_name ?? club.publication.publisher_name ?? "Loombus Library"}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">{primary.description ?? primary.title}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--loombus-text-subtle)]">
            <span>{club.sessions.length} {club.sessions.length === 1 ? "session" : "sessions"} in this section</span>
            {date ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{date}</span> : null}
          </div>
        </div>
        <Link href={`/library/publication/${club.publication.id}/book-club`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)]">
          <BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" />View Book Club
        </Link>
      </article>
    );
  }

  function Section({ title, eyebrow, books, empty }: { title: string; eyebrow: string; books: ClubBook[]; empty: string }) {
    return (
      <section className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
          </div>
          <span className="text-sm text-[var(--loombus-text-muted)]">{books.length} {books.length === 1 ? "book" : "books"}</span>
        </div>
        <div className="mt-5 border-b border-[var(--loombus-border)]">
          {books.length ? books.map((club) => <BookClubRow key={club.publication.id} club={club} />) : <div className="border-t border-[var(--loombus-border)] py-8 text-sm text-[var(--loombus-text-muted)]">{empty}</div>}
        </div>
      </section>
    );
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Book Clubs" /></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-24 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-b border-[var(--loombus-border)] pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Library · Book Clubs</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Book Clubs</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">See the books Loombus members are reading together. Each book has one canonical Book Club Hub, with active, upcoming, and completed sessions living beneath it.</p>
        </header>

        {error ? <div role="alert" className="mt-6 border-l-2 border-[var(--loombus-gold)] py-2 pl-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}

        {userId ? <Section eyebrow="Your reading groups" title="Your Book Clubs" books={yourBooks} empty="You have not joined or hosted a Book Club session yet." /> : null}
        <Section eyebrow="Reading now" title="Active Book Clubs" books={activeBooks} empty="There are no active Book Club sessions right now." />
        <Section eyebrow="Starting next" title="Upcoming" books={upcomingBooks} empty="No upcoming Book Club sessions are scheduled yet." />
        <Section eyebrow="Previous cohorts" title="Past Sessions" books={pastBooks} empty="No Book Club sessions have been completed yet." />
      </div>
    </main>
  );
}
