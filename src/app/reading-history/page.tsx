"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  user_id: string;
};

type DiscussionView = {
  id: string;
  discussion_id: string;
  viewer_id: string | null;
  created_at: string;
  discussions: Discussion | Discussion[] | null;
};

type ReadingHistoryItem = {
  view_id: string;
  discussion_id: string;
  viewed_at: string;
  view_count: number;
  discussion: Discussion;
};

function hasReadingHistoryAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

export default function ReadingHistoryPage() {
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canUseReadingHistory = hasReadingHistoryAccess(entitlement, isAdmin);

  useEffect(() => {
    async function loadReadingHistory() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const [{ data: profileData }, { data: entitlementData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
      ]);

      const resolvedIsAdmin = Boolean(profileData?.is_admin);
      const resolvedEntitlement = (entitlementData ?? null) as AiEntitlement;

      setIsAdmin(resolvedIsAdmin);
      setEntitlement(resolvedEntitlement);

      if (!hasReadingHistoryAccess(resolvedEntitlement, resolvedIsAdmin)) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("discussion_views")
        .select(`
          id,
          discussion_id,
          viewer_id,
          created_at,
          discussions (
            id,
            title,
            topic,
            body,
            created_at,
            user_id
          )
        `)
        .eq("viewer_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(250);

      if (error) {
        setMessage(`Unable to load reading history: ${error.message}`);
        setLoading(false);
        return;
      }

      const byDiscussion = new Map<string, ReadingHistoryItem>();

      for (const row of (data ?? []) as DiscussionView[]) {
        const discussion = Array.isArray(row.discussions)
          ? row.discussions[0] ?? null
          : row.discussions;

        if (!discussion) {
          continue;
        }

        const existing = byDiscussion.get(row.discussion_id);

        if (existing) {
          existing.view_count += 1;
          continue;
        }

        byDiscussion.set(row.discussion_id, {
          view_id: row.id,
          discussion_id: row.discussion_id,
          viewed_at: row.created_at,
          view_count: 1,
          discussion,
        });
      }

      setHistory([...byDiscussion.values()]);
      setLoading(false);
    }

    loadReadingHistory();
  }, []);

  const totalViews = useMemo(() => {
    return history.reduce((total, item) => total + item.view_count, 0);
  }, [history]);

  const filteredHistory = useMemo(() => {
    const query = historySearchQuery.trim().toLowerCase();

    if (!query) {
      return history;
    }

    return history.filter((item) => {
      return (
        item.discussion.title.toLowerCase().includes(query) ||
        item.discussion.topic.toLowerCase().includes(query) ||
        item.discussion.body.toLowerCase().includes(query)
      );
    });
  }, [history, historySearchQuery]);

  const activeReadingHistorySearch = historySearchQuery.trim();
  const hasActiveReadingHistorySearch = activeReadingHistorySearch.length > 0;

  function resetReadingHistorySearch() {
    setHistorySearchQuery("");
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:mb-3 sm:text-sm sm:tracking-[0.3em]">
              Premium
            </p>

            <h1 className="mb-3 text-2xl font-semibold tracking-tight sm:mb-4 sm:text-5xl">
              Reading history
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-500 sm:text-base">
              Revisit discussions you opened recently and return to the ideas
              worth more attention.
            </p>
          </div>

          <Link
            href="/my-activity"
            className="w-fit rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white sm:px-5 sm:py-3"
          >
            Back to My Activity
          </Link>
        </div>

        {!loading && !canUseReadingHistory && (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              Reading history is a Premium feature.
            </h2>

            <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500 sm:mb-6 sm:text-base">
              You can still read, reply, save, and follow discussions on the Free
              plan. Premium accounts can keep a personal history of recently viewed discussions so useful threads are easier to revisit.
            </p>

            <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Revisit useful threads
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Keep track of discussions you opened but did not finish reading.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Continue thinking
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Return to conversations when you are ready to reply, save, or compare ideas.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Build a reading trail
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Use history as a lightweight trail of what has caught your attention.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/premium"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                View Premium options
              </Link>

              <Link
                href="/discussions"
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Browse discussions
              </Link>

              <Link
                href="/saved"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open saved
              </Link>

              <Link
                href="/onboarding"
                className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Open setup guide
              </Link>
            </div>
          </section>
        )}

        {loading && (
          <p className="text-zinc-500">
            Loading reading history...
          </p>
        )}

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        {!loading && canUseReadingHistory && (
          <>
            <section className="mb-5 grid gap-3 sm:mb-8 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl sm:p-6">
                <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                  Discussions
                </p>

                <h2 className="text-2xl font-semibold sm:text-4xl">
                  {history.length}
                </h2>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl sm:p-6">
                <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                  Recent views counted
                </p>

                <h2 className="text-2xl font-semibold sm:text-4xl">
                  {totalViews}
                </h2>
              </div>
            </section>

            {history.length === 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-8">
                <h2 className="mb-3 text-xl font-medium sm:text-2xl">
                  No reading history yet.
                </h2>

                <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500 sm:mb-6 sm:text-base">
                  Open discussions while logged in, then return here to revisit
                  threads that deserve more attention.
                </p>

                <div className="mb-6 hidden gap-4 md:grid md:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      Browse by signal
                    </p>

                    <p className="text-sm leading-relaxed text-zinc-600">
                      Start with active, high-signal, or topic-filtered discussions.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      Open what matters
                    </p>

                    <p className="text-sm leading-relaxed text-zinc-600">
                      Your history fills as you open discussions that are worth returning to.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-2 text-sm font-medium text-zinc-300">
                      Save the best
                    </p>

                    <p className="text-sm leading-relaxed text-zinc-600">
                      Use Save for threads that should become part of your personal library.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/discussions"
                    className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
                  >
                    Browse discussions
                  </Link>

                  <Link
                    href="/following"
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Open following feed
                  </Link>

                  <Link
                    href="/saved"
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Open saved
                  </Link>

                  <Link
                    href="/people"
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Find people
                  </Link>
                </div>
              </section>
            )}

            {history.length > 0 && (
              <section className="hidden md:block mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <label htmlFor="reading-history-search" className="mb-2 block text-sm font-medium text-zinc-300">
                      Search reading history
                    </label>

                    <input
                      id="reading-history-search"
                      type="text"
                      value={historySearchQuery}
                      onChange={(event) => setHistorySearchQuery(event.target.value)}
                      placeholder="Search viewed titles, topics, or discussion bodies..."
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
                    />
                  </div>

                  {hasActiveReadingHistorySearch && (
                    <button
                      type="button"
                      onClick={resetReadingHistorySearch}
                      className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      Clear search
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {hasActiveReadingHistorySearch ? (
                    <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400">
                      Search: “{activeReadingHistorySearch}”
                    </span>
                  ) : (
                    <p className="text-sm text-zinc-600">
                      Search scans the discussions you recently viewed by title, topic, and body.
                    </p>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-zinc-600">
                    Showing {filteredHistory.length} of {history.length} viewed discussions
                  </p>

                  {hasActiveReadingHistorySearch && (
                    <button
                      type="button"
                      onClick={resetReadingHistorySearch}
                      className="w-fit text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
                    >
                      Reset view
                    </button>
                  )}
                </div>
              </section>
            )}

            {history.length > 0 && filteredHistory.length === 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-3xl sm:p-8">
                <h2 className="mb-3 text-xl font-medium sm:text-2xl">
                  No reading history found.
                </h2>

                <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500 sm:mb-6 sm:text-base">
                  No viewed discussions match the current search. Try a broader term,
                  clear the search, or browse discussions to continue building your reading trail.
                </p>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={resetReadingHistorySearch}
                    className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
                  >
                    Clear search
                  </button>

                  <Link
                    href="/discussions"
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Browse discussions
                  </Link>
                </div>
              </section>
            )}

            <div className="space-y-3 sm:space-y-5">
              {filteredHistory.map((item) => (
                <article
                  key={item.discussion_id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:rounded-3xl sm:p-6"
                >
                  <Link
                    href={`/discussions/${item.discussion.id}`}
                    className="block transition hover:opacity-90"
                  >
                    <p className="mb-2 text-xs uppercase tracking-[0.16em] text-zinc-600 sm:mb-3 sm:text-sm sm:normal-case sm:tracking-normal sm:text-zinc-500">
                      {item.discussion.topic}
                    </p>

                    <h2 className="mb-2 text-lg font-medium sm:mb-3 sm:text-2xl">
                      {item.discussion.title}
                    </h2>

                    <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-zinc-400 sm:mb-5 sm:text-base">
                      {item.discussion.body}
                    </p>
                  </Link>

                  <div className="flex flex-col gap-1.5 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:text-sm">
                    <p>
                      Last viewed {new Date(item.viewed_at).toLocaleString()}
                    </p>

                    <p>
                      {item.view_count} recent {item.view_count === 1 ? "view" : "views"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
