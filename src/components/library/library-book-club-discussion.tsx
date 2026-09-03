"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, MessageCircleMore, Reply, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Session = {
  id: string;
  hub_id: string;
  title: string;
  status: "upcoming" | "active" | "completed";
  visibility: "public" | "private";
};

type Hub = { id: string; publication_id: string };
type Membership = { role: "host" | "member" };
type Post = {
  id: string;
  session_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export function LibraryBookClubDiscussion({
  publicationId,
  sessionId,
}: {
  publicationId: string;
  sessionId: string;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const nextUserId = authData.user?.id ?? null;
    setUserId(nextUserId);

    const sessionResult = await supabase
      .from("library_book_club_sessions")
      .select("id,hub_id,title,status,visibility")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionResult.error || !sessionResult.data) {
      setError("This Book Club session is not available.");
      setLoading(false);
      return;
    }

    const nextSession = sessionResult.data as Session;
    const hubResult = await supabase
      .from("library_book_club_hubs")
      .select("id,publication_id")
      .eq("id", nextSession.hub_id)
      .eq("publication_id", publicationId)
      .maybeSingle();

    if (hubResult.error || !(hubResult.data as Hub | null)) {
      setError("This Book Club session does not belong to this book.");
      setLoading(false);
      return;
    }

    setSession(nextSession);

    if (!nextUserId) {
      setMembership(null);
      setPosts([]);
      setLoading(false);
      return;
    }

    const membershipResult = await supabase
      .from("library_book_club_members")
      .select("role")
      .eq("session_id", sessionId)
      .eq("user_id", nextUserId)
      .maybeSingle();

    const nextMembership = membershipResult.data as Membership | null;
    setMembership(nextMembership);

    if (!nextMembership) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postsResult = await supabase
      .from("library_book_club_discussion_posts")
      .select("id,session_id,author_id,parent_id,body,created_at,updated_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (postsResult.error) setError("Unable to load this Book Club discussion.");
    else setPosts((postsResult.data ?? []) as Post[]);
    setLoading(false);
  }, [publicationId, sessionId]);

  useEffect(() => { void load(); }, [load]);

  const roots = useMemo(() => posts.filter((post) => !post.parent_id), [posts]);
  const repliesByParent = useMemo(() => {
    const grouped = new Map<string, Post[]>();
    for (const post of posts) {
      if (!post.parent_id) continue;
      const current = grouped.get(post.parent_id) ?? [];
      current.push(post);
      grouped.set(post.parent_id, current);
    }
    return grouped;
  }, [posts]);

  async function publish(parentId: string | null, text: string) {
    if (!userId || !membership || !text.trim()) return;
    setWorking(true);
    setError(null);
    const result = await supabase.from("library_book_club_discussion_posts").insert({
      session_id: sessionId,
      author_id: userId,
      parent_id: parentId,
      body: text.trim(),
    });
    if (result.error) setError("Unable to publish to this Book Club discussion.");
    else {
      setBody("");
      setReplyBody("");
      setReplyTo(null);
      await load();
    }
    setWorking(false);
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Book Club discussion" /></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <Link href={`/library/publication/${publicationId}/book-club`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-text)]">
          <ArrowLeft className="h-4 w-4" />Back to Book Club
        </Link>

        <header className="mt-8 border-b border-[var(--loombus-border)] pb-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Library · Book Club · Session Discussion</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{session?.title ?? "Book Club Discussion"}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">
            This conversation belongs to this Book Club session. It does not publish to the public Discussions feed.
          </p>
        </header>

        {error ? <div role="alert" className="mt-6 border-l-2 border-[var(--loombus-gold)] py-2 pl-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}

        {!userId ? (
          <section className="py-10">
            <h2 className="text-xl font-semibold">Sign in to enter the Book Club discussion</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">Book Club conversation stays with the session and its members.</p>
            <Link href={`/login?next=/library/publication/${publicationId}/book-club/session/${sessionId}`} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black">Sign in</Link>
          </section>
        ) : !membership ? (
          <section className="py-10">
            <h2 className="text-xl font-semibold">Join this session first</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Return to the Book Club Hub and join this reading session before entering its discussion.</p>
            <Link href={`/library/publication/${publicationId}/book-club`} className="mt-5 inline-flex min-h-11 items-center rounded-full border border-[var(--loombus-border)] px-5 text-sm font-semibold transition hover:border-[var(--loombus-gold)]">Return to Book Club</Link>
          </section>
        ) : (
          <>
            <section className="border-b border-[var(--loombus-border)] py-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]"><MessageCircleMore className="h-4 w-4 text-[var(--loombus-gold)]" />Start a club discussion</div>
              <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} rows={5} placeholder="Share a question, interpretation, or idea about the reading…" className="mt-4 w-full resize-y border-y border-[var(--loombus-border)] bg-transparent px-0 py-4 text-base leading-7 outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-gold)]" />
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => void publish(null, body)} disabled={working || !body.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Post to Book Club</button>
              </div>
            </section>

            <section className="py-8">
              <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Session conversation</p><h2 className="mt-2 text-2xl font-semibold">Discussion</h2></div><span className="text-sm text-[var(--loombus-text-muted)]">{roots.length} {roots.length === 1 ? "topic" : "topics"}</span></div>

              {roots.length ? <div className="mt-6 divide-y divide-[var(--loombus-border)] border-y border-[var(--loombus-border)]">
                {roots.map((post) => {
                  const replies = repliesByParent.get(post.id) ?? [];
                  return <article key={post.id} className="py-6">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--loombus-text-subtle)]"><span className="font-semibold text-[var(--loombus-text-muted)]">{post.author_id === userId ? "You" : "Club member"}</span><span>·</span><time dateTime={post.created_at}>{new Date(post.created_at).toLocaleString()}</time></div>
                    <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7">{post.body}</p>
                    <button type="button" onClick={() => { setReplyTo(replyTo === post.id ? null : post.id); setReplyBody(""); }} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"><Reply className="h-4 w-4 text-[var(--loombus-gold)]" />Reply</button>

                    {replyTo === post.id ? <div className="mt-4 border-l border-[var(--loombus-border)] pl-4"><textarea value={replyBody} onChange={(event) => setReplyBody(event.target.value)} maxLength={5000} rows={3} placeholder="Reply within this Book Club…" className="w-full resize-y border-y border-[var(--loombus-border)] bg-transparent py-3 text-sm leading-6 outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-gold)]" /><div className="mt-3 flex justify-end"><button type="button" onClick={() => void publish(post.id, replyBody)} disabled={working || !replyBody.trim()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)] disabled:opacity-50"><Send className="h-4 w-4 text-[var(--loombus-gold)]" />Reply</button></div></div> : null}

                    {replies.length ? <div className="mt-5 space-y-5 border-l border-[var(--loombus-border)] pl-5">{replies.map((reply) => <div key={reply.id}><div className="flex flex-wrap items-center gap-2 text-xs text-[var(--loombus-text-subtle)]"><span className="font-semibold text-[var(--loombus-text-muted)]">{reply.author_id === userId ? "You" : "Club member"}</span><span>·</span><time dateTime={reply.created_at}>{new Date(reply.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{reply.body}</p></div>)}</div> : null}
                  </article>;
                })}
              </div> : <div className="mt-6 border-y border-[var(--loombus-border)] py-10 text-sm text-[var(--loombus-text-muted)]">No Book Club discussion yet. Start the first topic for this reading session.</div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
