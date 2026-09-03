"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Loader2, LockKeyhole, MessageCircleMore, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Publication = { id: string; title: string; author_name: string | null; status: string };
type Hub = { id: string; publication_id: string };
type Session = {
  id: string;
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

export function LibraryBookClubHub({ publicationId }: { publicationId: string }) {
  const [publication, setPublication] = useState<Publication | null>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const publicationResult = await supabase
      .from("library_publications")
      .select("id,title,author_name,status")
      .eq("id", publicationId)
      .eq("status", "published")
      .maybeSingle();

    if (publicationResult.error || !publicationResult.data) {
      setError("This Library publication is not available for a Book Club.");
      setLoading(false);
      return;
    }
    setPublication(publicationResult.data as Publication);

    const hubResult = await supabase
      .from("library_book_club_hubs")
      .select("id,publication_id")
      .eq("publication_id", publicationId)
      .maybeSingle();
    if (hubResult.error || !hubResult.data) {
      setError("The Book Club Hub is not available yet.");
      setLoading(false);
      return;
    }
    const nextHub = hubResult.data as Hub;
    setHub(nextHub);

    const { data: authData } = await supabase.auth.getUser();
    const nextUserId = authData.user?.id ?? null;
    setUserId(nextUserId);

    const sessionsResult = await supabase
      .from("library_book_club_sessions")
      .select("id,title,description,visibility,status,room_id,created_by,starts_at,ends_at,created_at")
      .eq("hub_id", nextHub.id)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });
    if (sessionsResult.error) {
      setError("Unable to load Book Club sessions.");
      setLoading(false);
      return;
    }
    const nextSessions = (sessionsResult.data ?? []) as Session[];
    setSessions(nextSessions);

    if (nextUserId && nextSessions.length) {
      const membershipResult = await supabase
        .from("library_book_club_members")
        .select("session_id,user_id,role")
        .eq("user_id", nextUserId)
        .in("session_id", nextSessions.map((session) => session.id));
      if (!membershipResult.error) setMemberships((membershipResult.data ?? []) as Membership[]);
    } else {
      setMemberships([]);
    }
    setLoading(false);
  }, [publicationId]);

  useEffect(() => { void load(); }, [load]);

  const activePublic = useMemo(
    () => sessions.find((session) => session.visibility === "public" && session.status === "active") ?? null,
    [sessions],
  );

  async function startPublicSession() {
    if (!hub || !publication) return;
    if (!userId) {
      window.location.assign(`/login?next=/library/publication/${publicationId}/book-club`);
      return;
    }
    setWorking("start");
    setError(null);
    const result = await supabase.from("library_book_club_sessions").insert({
      hub_id: hub.id,
      title: `${publication.title} Book Club`,
      description: "Read together, discuss the book in context, and carry the strongest ideas into Loombus discussions.",
      visibility: "public",
      status: "active",
      created_by: userId,
    });
    if (result.error) {
      setError(result.error.code === "23505" ? "This book already has an active public Book Club session." : "Unable to start this Book Club session.");
    } else {
      await load();
    }
    setWorking(null);
  }

  async function toggleMembership(session: Session) {
    if (!userId) {
      window.location.assign(`/login?next=/library/publication/${publicationId}/book-club`);
      return;
    }
    const membership = memberships.find((item) => item.session_id === session.id);
    if (membership?.role === "host") return;
    setWorking(session.id);
    setError(null);
    const result = membership
      ? await supabase.from("library_book_club_members").delete().eq("session_id", session.id).eq("user_id", userId)
      : await supabase.from("library_book_club_members").insert({ session_id: session.id, user_id: userId, role: "member" });
    if (result.error) setError(membership ? "Unable to leave this session." : "Unable to join this session.");
    else await load();
    setWorking(null);
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Book Club" /></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <Link href={`/library/publication/${publicationId}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-text)]">
          <ArrowLeft className="h-4 w-4" />Back to book
        </Link>

        <header className="mt-8 border-b border-[var(--loombus-border)] pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Library · Book · Book Club Hub</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{publication?.title ?? "Book Club"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
            One canonical Book Club Hub for this publication. Reading sessions and private groups live here instead of becoming separate competing clubs.
          </p>
        </header>

        {error ? <div role="alert" className="mt-6 border-l-2 border-[var(--loombus-gold)] py-2 pl-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}

        <section className="border-b border-[var(--loombus-border)] py-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Current reading session</p>
              <h2 className="mt-2 text-2xl font-semibold">{activePublic ? activePublic.title : "No active public session"}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                {activePublic?.description ?? "Start the single active public session for this book. Future cohorts can be preserved as completed sessions beneath the same hub."}
              </p>
            </div>
            {!activePublic ? <button type="button" onClick={() => void startPublicSession()} disabled={working === "start"} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60">{working === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}Start public session</button> : null}
          </div>
        </section>

        <section className="py-8">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Club Sessions / Groups</p><h2 className="mt-2 text-2xl font-semibold">Reading cohorts</h2></div>
            <span className="text-sm text-[var(--loombus-text-muted)]">{sessions.length} {sessions.length === 1 ? "session" : "sessions"}</span>
          </div>

          {sessions.length ? <div className="mt-6 divide-y divide-[var(--loombus-border)] border-y border-[var(--loombus-border)]">
            {sessions.map((session) => {
              const membership = memberships.find((item) => item.session_id === session.id);
              return <article key={session.id} className="grid gap-5 py-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-gold)]">{session.status}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--loombus-text-subtle)]">{session.visibility === "private" ? <LockKeyhole className="h-3.5 w-3.5" /> : <UsersRound className="h-3.5 w-3.5" />}{session.visibility}</span>
                    {membership?.role === "host" ? <span className="text-xs text-[var(--loombus-text-muted)]">Host</span> : membership ? <span className="text-xs text-[var(--loombus-text-muted)]">Joined</span> : null}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold">{session.title}</h3>
                  {session.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">{session.description}</p> : null}
                  {session.room_id ? <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">Private Room-linked group</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {session.visibility === "public" && membership?.role !== "host" ? <button type="button" disabled={working === session.id} onClick={() => void toggleMembership(session)} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)] disabled:opacity-60">{working === session.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UsersRound className="h-4 w-4" />}{membership ? "Leave session" : "Join session"}</button> : null}
                  <Link href={`/discussions/create?libraryPublicationId=${publicationId}&bookClubSessionId=${session.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)]"><MessageCircleMore className="h-4 w-4 text-[var(--loombus-gold)]" />Discuss</Link>
                </div>
              </article>;
            })}
          </div> : <div className="mt-6 border-y border-[var(--loombus-border)] py-10 text-sm text-[var(--loombus-text-muted)]">No sessions have been created beneath this Book Club Hub yet.</div>}

          <div className="mt-8 border-t border-[var(--loombus-border)] pt-6 text-sm leading-6 text-[var(--loombus-text-muted)]">
            <strong className="font-semibold text-[var(--loombus-text)]">Private groups:</strong> Room-linked sessions use the same canonical hub and may remain private to their Room membership. They do not create another Book Club for the book.
          </div>
        </section>
      </div>
    </main>
  );
}
