"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowRight, Eye, Loader2, MessageCircle, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type DiscussionRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  discussion_type?: string | null;
  purpose_lane?: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type PreviewDiscussion = DiscussionRow & {
  authorName?: string | null;
  authorUsername?: string | null;
  replyCount?: number;
  viewCount?: number;
};

function cleanPreview(value: string | null) {
  const text = (value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "Open this discussion after signing in to review the full context.";
  return text.length > 170 ? `${text.slice(0, 170)}...` : text;
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Discussion";
}

function getAuthorLabel(discussion: PreviewDiscussion) {
  return discussion.authorName?.trim() || discussion.authorUsername?.trim() || "Loombus member";
}

function getAge(value: string) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "Recently";

  const diffMinutes = Math.floor((Date.now() - createdAt) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function signInHref(discussionId: string) {
  return `/login?next=${encodeURIComponent(`/v2/discussions/${discussionId}`)}`;
}

function PreviewLoading() {
  return (
    <main className="min-h-screen bg-stone-50 px-5 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-2xl shadow-slate-900/10">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-3xl bg-amber-50 text-amber-800 ring-1 ring-amber-200">
            <Loader2 className="size-7 animate-spin" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">Loombus</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Bringing the signal into focus.</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">Loading a cleaner preview of current discussions.</p>
        </div>
      </section>
    </main>
  );
}

export function PublicDiscussionsPreview({ children }: { children: ReactNode }) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [discussions, setDiscussions] = useState<PreviewDiscussion[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadAuthAndPreview() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const hasSession = Boolean(data.session);
      setAuthenticated(hasSession);
      setCheckingAuth(false);

      if (!hasSession) {
        setLoadingPreview(true);
        setMessage("");

        try {
          const { data: discussionRows, error } = await supabase
            .from("discussions")
            .select("id, title, topic, body, created_at, user_id, discussion_type, purpose_lane")
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(20);

          if (error) {
            setMessage("Loombus could not load the public discussion preview yet. Please sign in to continue.");
            setDiscussions([]);
            return;
          }

          const baseRows = (discussionRows ?? []) as DiscussionRow[];
          const discussionIds = baseRows.map((discussion) => discussion.id);
          const authorIds = [...new Set(baseRows.map((discussion) => discussion.user_id).filter(Boolean))];

          let authorMap: Record<string, ProfileRow> = {};
          let replyCounts: Record<string, number> = {};
          let viewCounts: Record<string, number> = {};

          if (authorIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, full_name, username")
              .in("id", authorIds);

            authorMap = Object.fromEntries(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
          }

          if (discussionIds.length > 0) {
            const [{ data: replies }, { data: views }] = await Promise.all([
              supabase.from("replies").select("discussion_id").in("discussion_id", discussionIds).is("deleted_at", null),
              supabase.from("discussion_views").select("discussion_id").in("discussion_id", discussionIds),
            ]);

            for (const reply of replies ?? []) replyCounts[reply.discussion_id] = (replyCounts[reply.discussion_id] ?? 0) + 1;
            for (const view of views ?? []) viewCounts[view.discussion_id] = (viewCounts[view.discussion_id] ?? 0) + 1;
          }

          setDiscussions(
            baseRows.map((discussion) => ({
              ...discussion,
              authorName: authorMap[discussion.user_id]?.full_name ?? null,
              authorUsername: authorMap[discussion.user_id]?.username ?? null,
              replyCount: replyCounts[discussion.id] ?? 0,
              viewCount: viewCounts[discussion.id] ?? 0,
            }))
          );
        } catch {
          setMessage("Loombus could not load the public discussion preview yet. Please sign in to continue.");
          setDiscussions([]);
        } finally {
          if (mounted) setLoadingPreview(false);
        }
      }
    }

    void loadAuthAndPreview();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session));
      setCheckingAuth(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const filteredDiscussions = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return discussions;

    return discussions.filter((discussion) =>
      [discussion.title, discussion.topic, discussion.body, discussion.authorName, discussion.authorUsername]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery)
    );
  }, [discussions, query]);

  if (checkingAuth || authenticated === null) {
    return <PreviewLoading />;
  }

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="relative isolate px-5 py-6 sm:px-8 lg:px-12">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-amber-50 via-stone-50 to-slate-100" />
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 font-black tracking-tight text-slate-950">
            <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-10 object-contain" />
            <span className="text-xl">Loombus</span>
          </Link>
          <Link href="/login?next=/v2/discussions" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-black text-slate-950 shadow-lg shadow-slate-900/10 transition hover:border-slate-400 hover:bg-slate-50">
            Sign in
          </Link>
        </header>

        <section className="mx-auto max-w-7xl pb-20 pt-16">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Discussion preview</p>
              <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Explore the signal before joining.</h1>
              <p className="mt-4 max-w-2xl text-lg font-medium leading-8 text-slate-700">
                Browse a read-only preview of current Loombus discussions. Sign in or create an account to open a full discussion and participate.
              </p>

              <div className="mt-8 flex min-w-0 max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search preview discussions" className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" />
              </div>

              {message ? <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div> : null}

              <div className="mt-6 space-y-4">
                {loadingPreview ? (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm font-bold text-slate-600 shadow-sm">Loading discussion preview...</div>
                ) : null}

                {!loadingPreview && filteredDiscussions.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                    No preview discussions match this search.
                  </div>
                ) : null}

                {!loadingPreview && filteredDiscussions.map((discussion) => (
                  <Link key={discussion.id} href={signInHref(discussion.id)} className="block rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">{discussion.topic || "Discussion"}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{getModeLabel(discussion.discussion_type)}</span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 text-2xl font-black tracking-tight text-slate-950">{discussion.title}</h2>
                    <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-slate-600">{cleanPreview(discussion.body)}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-sm font-bold text-slate-500">
                      <span>{getAuthorLabel(discussion)} · {getAge(discussion.created_at)}</span>
                      <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4" />{discussion.replyCount ?? 0}</span>
                      <span className="inline-flex items-center gap-1.5"><Eye className="size-4" />{discussion.viewCount ?? 0}</span>
                      <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">Sign in to open <ArrowRight className="size-3.5" /></span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10 lg:sticky lg:top-8">
              <h2 className="text-lg font-black text-slate-950">Preview mode</h2>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
                Non-members can browse the discussion list, but opening a discussion, replying, saving, or posting requires sign-in.
              </p>
              <Link href="/login?next=/v2/discussions" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400">
                Join Loombus
              </Link>
            </aside>
          </div>
        </section>
      </section>
    </main>
  );
}
