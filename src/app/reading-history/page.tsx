"use client";

import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

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

type DateFilter = "all" | "today" | "7d" | "30d";
type SortOrder = "newest" | "oldest" | "most-viewed";

function hasReadingHistoryAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) return true;

  return (
    entitlement?.ai_assisted_enabled === true && entitlement.tier === "premium"
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDateThreshold(filter: DateFilter) {
  const now = new Date();

  if (filter === "today") {
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  if (filter === "7d") return Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return Date.now() - 30 * 24 * 60 * 60 * 1000;
  return null;
}

export default function ReadingHistoryPage() {
  const [history, setHistory] = useState<ReadingHistoryItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [removingDiscussionId, setRemovingDiscussionId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  const canUseReadingHistory = hasReadingHistoryAccess(entitlement, isAdmin);

  useEffect(() => {
    let alive = true;

    async function loadReadingHistory() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          window.location.href = "/login";
          return;
        }

        const [profileResult, entitlementResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("is_admin, full_name, username, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (entitlementResult.error) throw entitlementResult.error;
        if (!alive) return;

        const resolvedIsAdmin = Boolean(profileResult.data?.is_admin);
        const resolvedEntitlement = (entitlementResult.data ?? null) as AiEntitlement;

        setProfile({
          full_name: profileResult.data?.full_name ?? null,
          username: profileResult.data?.username ?? null,
          avatar_url: profileResult.data?.avatar_url ?? null,
        });
        setIsAdmin(resolvedIsAdmin);
        setEntitlement(resolvedEntitlement);

        if (!hasReadingHistoryAccess(resolvedEntitlement, resolvedIsAdmin)) return;

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
          .eq("viewer_id", user.id)
          .order("created_at", { ascending: false })
          .limit(250);

        if (error) throw error;

        const byDiscussion = new Map<string, ReadingHistoryItem>();

        for (const row of (data ?? []) as DiscussionView[]) {
          const discussion = Array.isArray(row.discussions)
            ? row.discussions[0] ?? null
            : row.discussions;

          if (!discussion) continue;

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

        if (alive) setHistory([...byDiscussion.values()]);
      } catch (error) {
        console.error("Unable to load reading history", error);
        if (alive) setMessage("Your Signal History could not be loaded. Refresh and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadReadingHistory();
    return () => {
      alive = false;
    };
  }, []);

  const topics = useMemo(
    () =>
      [...new Set(history.map((item) => item.discussion.topic).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [history]
  );

  const totalViews = useMemo(
    () => history.reduce((total, item) => total + item.view_count, 0),
    [history]
  );

  const filteredHistory = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const threshold = getDateThreshold(dateFilter);

    return history
      .filter((item) => topic === "all" || item.discussion.topic === topic)
      .filter(
        (item) => threshold === null || new Date(item.viewed_at).getTime() >= threshold
      )
      .filter((item) => {
        if (!needle) return true;

        return [item.discussion.title, item.discussion.topic, item.discussion.body]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (sort === "most-viewed") {
          return (
            b.view_count - a.view_count ||
            new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime()
          );
        }

        const delta = new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime();
        return sort === "oldest" ? -delta : delta;
      });
  }, [dateFilter, history, query, sort, topic]);

  const hasActiveFilters =
    query.trim().length > 0 || topic !== "all" || dateFilter !== "all" || sort !== "newest";

  function resetFilters() {
    setQuery("");
    setTopic("all");
    setDateFilter("all");
    setSort("newest");
  }

  async function deleteHistory(payload: { discussionId?: string; clearAll?: boolean }) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      window.location.href = "/login";
      return false;
    }

    const response = await fetch("/api/reading-history", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error ?? "Unable to update Signal History.");
    }

    return true;
  }

  async function removeHistoryItem(discussionId: string) {
    if (removingDiscussionId || clearing) return;

    setRemovingDiscussionId(discussionId);
    setMessage("");

    try {
      await deleteHistory({ discussionId });
      setHistory((current) =>
        current.filter((item) => item.discussion_id !== discussionId)
      );
      setMessage("Discussion removed from Signal History.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to remove this discussion."
      );
    } finally {
      setRemovingDiscussionId(null);
    }
  }

  async function clearHistory() {
    if (clearing || removingDiscussionId) return;

    setClearing(true);
    setMessage("");

    try {
      await deleteHistory({ clearAll: true });
      setHistory([]);
      setShowClearConfirmation(false);
      setMessage("Signal History cleared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to clear Signal History.");
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]">
        <section className="mx-auto max-w-6xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8">
          <p className="text-sm font-bold uppercase tracking-[.22em] text-[var(--loombus-gold)]">
            Private Signal History
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Rebuilding your reading trail…
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_left,var(--loombus-cream-soft),transparent_28rem),radial-gradient(circle_at_top_right,var(--loombus-gold-soft),transparent_26rem),var(--loombus-surface)] p-6 shadow-2xl shadow-black/10 sm:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[.22em] text-[var(--loombus-gold)]">
                Private Signal History
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-[-.045em] sm:text-6xl">
                Return to ideas worth another look.
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">
                Reading history keeps a private trail of discussions you opened, so useful
                Signal is easier to find, compare, save, and revisit.
              </p>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-3">
              <ProfileAvatar profile={profile} size="xl" />
              <div>
                <p className="text-xs uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">
                  Private to you
                </p>
                <p className="mt-1 font-semibold">{getProfileDisplayName(profile)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/discussions"
              className="rounded-full bg-[var(--loombus-gold-strong)] px-5 py-3 text-sm font-semibold text-[var(--loombus-gold-contrast)]"
            >
              Browse discussions
            </Link>
            <Link
              href="/saved"
              className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
            >
              Open Saved
            </Link>
            <Link
              href="/my-activity"
              className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
            >
              Open My Activity
            </Link>
          </div>
        </header>

        {!canUseReadingHistory ? (
          <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 sm:p-10">
            <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
              Premium Signal tool
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">
              Signal History is available with Premium.
            </h2>
            <p className="mt-4 max-w-3xl leading-7 text-[var(--loombus-text-muted)]">
              Free members can still read, reply, follow, and save discussions. Premium
              keeps a private, searchable trail of recently viewed discussions across devices.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/premium"
                className="rounded-full bg-[var(--loombus-gold-strong)] px-5 py-3 font-semibold text-[var(--loombus-gold-contrast)]"
              >
                View Premium
              </Link>
              <Link
                href="/discussions"
                className="rounded-full border border-[var(--loombus-border)] px-5 py-3 font-semibold"
              >
                Browse discussions
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Viewed discussions", history.length],
                ["Recent views", totalViews],
                ["Signal topics", topics.length],
                ["Last viewed", history[0] ? formatDateTime(history[0].viewed_at) : "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:p-5"
                >
                  <p className="text-xs uppercase tracking-[.14em] text-[var(--loombus-text-subtle)]">
                    {label}
                  </p>
                  <p
                    className={`mt-2 font-bold ${
                      label === "Last viewed" ? "text-base sm:text-lg" : "text-3xl"
                    }`}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </section>

            {message && (
              <div
                role="status"
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]"
              >
                {message}
              </div>
            )}

            {history.length > 0 && (
              <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:p-5">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_13rem_12rem_13rem]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, topic, or discussion text"
                    aria-label="Search Signal History"
                    className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 outline-none focus:border-[var(--loombus-gold)]"
                  />
                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    aria-label="Filter Signal History by topic"
                    className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4"
                  >
                    <option value="all">All Signal topics</option>
                    {topics.map((itemTopic) => (
                      <option key={itemTopic} value={itemTopic}>
                        {itemTopic}
                      </option>
                    ))}
                  </select>
                  <select
                    value={dateFilter}
                    onChange={(event) => setDateFilter(event.target.value as DateFilter)}
                    aria-label="Filter Signal History by date"
                    className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4"
                  >
                    <option value="all">Any time</option>
                    <option value="today">Viewed today</option>
                    <option value="7d">Past 7 days</option>
                    <option value="30d">Past 30 days</option>
                  </select>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortOrder)}
                    aria-label="Sort Signal History"
                    className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4"
                  >
                    <option value="newest">Recently viewed</option>
                    <option value="oldest">Oldest viewed</option>
                    <option value="most-viewed">Most revisited</option>
                  </select>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold">
                      {filteredHistory.length} {filteredHistory.length === 1 ? "discussion" : "discussions"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">
                      History is private and only visible to your account.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm"
                      >
                        Reset view
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowClearConfirmation(true)}
                      className="rounded-full border border-red-500/40 px-4 py-2 text-sm text-red-500 transition hover:border-red-500"
                    >
                      Clear history
                    </button>
                  </div>
                </div>
              </section>
            )}

            {history.length === 0 ? (
              <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 sm:p-10">
                <p className="text-sm font-bold uppercase tracking-[.2em] text-[var(--loombus-gold)]">
                  Build your Signal trail
                </p>
                <h2 className="mt-3 text-3xl font-bold">No reading history yet.</h2>
                <p className="mt-3 max-w-2xl leading-7 text-[var(--loombus-text-muted)]">
                  Open discussions while signed in. Threads you read will appear here so you
                  can revisit the strongest ideas later.
                </p>
                <Link
                  href="/discussions"
                  className="mt-6 inline-flex rounded-full bg-[var(--loombus-gold-strong)] px-5 py-3 font-semibold text-[var(--loombus-gold-contrast)]"
                >
                  Find Signal
                </Link>
              </section>
            ) : filteredHistory.length === 0 ? (
              <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8">
                <h2 className="text-2xl font-bold">No discussions match this view.</h2>
                <p className="mt-3 text-[var(--loombus-text-muted)]">
                  Broaden the search, change the topic or date range, or reset the filters.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-5 rounded-full bg-[var(--loombus-gold-strong)] px-5 py-3 font-semibold text-[var(--loombus-gold-contrast)]"
                >
                  Reset view
                </button>
              </section>
            ) : (
              <section className="space-y-3">
                {filteredHistory.map((item) => (
                  <article
                    key={item.discussion_id}
                    className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:border-[var(--loombus-gold)] sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[var(--loombus-gold-soft)] px-3 py-1 text-xs font-bold text-[var(--loombus-gold)]">
                            {item.discussion.topic || "Discussion"}
                          </span>
                          <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-subtle)]">
                            {item.view_count} recent {item.view_count === 1 ? "view" : "views"}
                          </span>
                        </div>
                        <Link href={`/discussions/${item.discussion.id}`} className="block">
                          <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
                            {normalizePublicText(item.discussion.title)}
                          </h2>
                          <p className="mt-3 line-clamp-3 leading-7 text-[var(--loombus-text-muted)]">
                            {normalizePublicText(item.discussion.body)}
                          </p>
                        </Link>
                      </div>
                      <time className="shrink-0 text-sm text-[var(--loombus-text-subtle)]">
                        {formatDateTime(item.viewed_at)}
                      </time>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--loombus-border)] pt-4">
                      <span className="text-sm text-[var(--loombus-text-subtle)]">
                        Last opened from your private history
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void removeHistoryItem(item.discussion_id)}
                          disabled={Boolean(removingDiscussionId) || clearing}
                          className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm text-[var(--loombus-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingDiscussionId === item.discussion_id
                            ? "Removing…"
                            : "Remove from history"}
                        </button>
                        <Link
                          href={`/discussions/${item.discussion.id}`}
                          className="rounded-full bg-[var(--loombus-gold-strong)] px-4 py-2 text-sm font-semibold text-[var(--loombus-gold-contrast)]"
                        >
                          Continue reading
                        </Link>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {showClearConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-signal-history-title"
            className="w-full max-w-md rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-2xl"
          >
            <p className="text-xs font-bold uppercase tracking-[.2em] text-red-500">
              Clear private history
            </p>
            <h2 id="clear-signal-history-title" className="mt-3 text-2xl font-bold">
              Clear all Signal History?
            </h2>
            <p className="mt-3 leading-7 text-[var(--loombus-text-muted)]">
              This permanently removes your stored discussion-view history. Saved discussions
              and your public activity are not affected.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                onClick={() => void clearHistory()}
                disabled={clearing}
                className="rounded-full bg-red-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clearing ? "Clearing…" : "Clear all history"}
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirmation(false)}
                disabled={clearing}
                className="rounded-full border border-[var(--loombus-border)] px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep history
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
