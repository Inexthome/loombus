"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DiscussionViewerInsights } from "@/components/discussion-viewer-insights";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";
import { supabase } from "@/lib/supabase/client";

type InsightsTab = "discussions" | "replies" | "account";
type RangeKey = "7d" | "30d" | "90d" | "all";

type Summary = {
  discussions: number;
  replies: number;
  saved: number;
  following: number;
};

type ReplyRow = {
  id: string;
  discussion_id: string;
  created_at: string;
};

type DiscussionRow = {
  id: string;
  title: string;
};

const emptySummary: Summary = {
  discussions: 0,
  replies: 0,
  saved: 0,
  following: 0,
};

const rangeOptions: Array<{ key: RangeKey; label: string; days: number | null }> = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "all", label: "All time", days: null },
];

function rangeStart(range: RangeKey) {
  const option = rangeOptions.find((item) => item.key === range);
  if (!option?.days) return null;
  const date = new Date();
  date.setDate(date.getDate() - option.days);
  return date.toISOString();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export default function InsightsClient() {
  const [activeTab, setActiveTab] = useState<InsightsTab>("discussions");
  const [range, setRange] = useState<RangeKey>("30d");
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [discussionTitles, setDiscussionTitles] = useState<Record<string, string>>({});
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingSummary(true);
      setNotice("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        if (!session) {
          window.location.replace("/login?next=%2Finsights");
          return;
        }

        const userId = session.user.id;
        const since = rangeStart(range);

        let discussionsQuery = supabase
          .from("discussions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null);

        let repliesCountQuery = supabase
          .from("replies")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null);

        let savedQuery = supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId);

        let followingQuery = supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", userId);

        let repliesListQuery = supabase
          .from("replies")
          .select("id, discussion_id, created_at")
          .eq("user_id", userId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(25);

        if (since) {
          discussionsQuery = discussionsQuery.gte("created_at", since);
          repliesCountQuery = repliesCountQuery.gte("created_at", since);
          savedQuery = savedQuery.gte("created_at", since);
          followingQuery = followingQuery.gte("created_at", since);
          repliesListQuery = repliesListQuery.gte("created_at", since);
        }

        const [discussionResult, replyCountResult, savedResult, followingResult, replyRowsResult] =
          await Promise.all([
            discussionsQuery,
            repliesCountQuery,
            savedQuery,
            followingQuery,
            repliesListQuery,
          ]);

        const firstError =
          discussionResult.error ||
          replyCountResult.error ||
          savedResult.error ||
          followingResult.error ||
          replyRowsResult.error;
        if (firstError) throw firstError;

        const replyRows = (replyRowsResult.data ?? []) as ReplyRow[];
        const discussionIds = [...new Set(replyRows.map((item) => item.discussion_id).filter(Boolean))];
        let titles: Record<string, string> = {};

        if (discussionIds.length) {
          const { data, error } = await supabase
            .from("discussions")
            .select("id, title")
            .in("id", discussionIds);
          if (error) throw error;
          titles = Object.fromEntries(
            ((data ?? []) as DiscussionRow[]).map((item) => [item.id, item.title])
          );
        }

        if (cancelled) return;

        setSummary({
          discussions: discussionResult.count ?? 0,
          replies: replyCountResult.count ?? 0,
          saved: savedResult.count ?? 0,
          following: followingResult.count ?? 0,
        });
        setReplies(replyRows);
        setDiscussionTitles(titles);
      } catch (error) {
        console.error("Unable to load Insights summary", error);
        if (!cancelled) setNotice("Some Insights data could not be loaded. Refresh to try again.");
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const rangeLabel = useMemo(
    () => rangeOptions.find((item) => item.key === range)?.label ?? "30 days",
    [range]
  );

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
        <header className="mb-7 border-b border-[var(--loombus-border)] pb-6">
          <Link
            href="/home"
            className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-gold)]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Link>

          <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--loombus-gold)]">
            Loombus Insights
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Understand your signal.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">
            Private analytics for your discussions, replies, profile activity, and the members engaging with your work.
          </p>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--loombus-border)]">
          <nav className="flex gap-6 overflow-x-auto" aria-label="Insights sections">
            {(["discussions", "replies", "account"] as InsightsTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`border-b-2 py-3 text-sm font-black capitalize transition ${
                  activeTab === tab
                    ? "border-[var(--loombus-gold)] text-[var(--loombus-text)]"
                    : "border-transparent text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--loombus-text-muted)]">
            Range
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as RangeKey)}
              className="bg-transparent py-2 text-sm font-bold text-[var(--loombus-text)] outline-none"
              aria-label="Insights date range"
            >
              {rangeOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {notice ? (
          <p className="border-b border-[var(--loombus-border)] py-4 text-sm text-[var(--loombus-text-muted)]">
            {notice}
          </p>
        ) : null}

        <section className="grid grid-cols-2 border-b border-[var(--loombus-border)] sm:grid-cols-4">
          {[
            ["Discussions", summary.discussions],
            ["Replies", summary.replies],
            ["Saved", summary.saved],
            ["Following", summary.following],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={`py-5 ${index > 0 ? "border-l border-[var(--loombus-border)] pl-4" : ""}`}
            >
              <span className="block text-xs font-bold uppercase tracking-[.12em] text-[var(--loombus-text-subtle)]">
                {label}
              </span>
              <strong className="mt-1 block text-2xl font-black">
                {loadingSummary ? "—" : Number(value).toLocaleString()}
              </strong>
              <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">{rangeLabel}</span>
            </div>
          ))}
        </section>

        {activeTab === "discussions" ? (
          <section aria-label="Discussion insights">
            <DiscussionViewerInsights />
          </section>
        ) : null}

        {activeTab === "replies" ? (
          <section className="py-6" aria-labelledby="reply-insights-title">
            <div className="border-b border-[var(--loombus-border)] pb-4">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">
                Reply activity
              </p>
              <h2 id="reply-insights-title" className="mt-2 text-xl font-black">
                Your recent contributions.
              </h2>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                Replies you contributed during the selected period.
              </p>
            </div>

            {loadingSummary ? (
              <p className="py-5 text-sm text-[var(--loombus-text-muted)]">Loading reply activity…</p>
            ) : replies.length ? (
              <div>
                {replies.map((reply) => (
                  <Link
                    key={reply.id}
                    href={`/discussions/${reply.discussion_id}`}
                    className="flex items-center justify-between gap-5 border-b border-[var(--loombus-border)] py-4 transition hover:text-[var(--loombus-gold)]"
                  >
                    <div className="min-w-0">
                      <strong className="block truncate text-sm">
                        {discussionTitles[reply.discussion_id] ?? "Discussion"}
                      </strong>
                      <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">
                        Reply contributed {formatDate(reply.created_at)}
                      </span>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[var(--loombus-text-muted)]">Open</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-5 text-sm text-[var(--loombus-text-muted)]">
                No replies recorded in this period.
              </p>
            )}
          </section>
        ) : null}

        {activeTab === "account" ? (
          <section className="py-6" aria-labelledby="account-insights-title">
            <div className="border-b border-[var(--loombus-border)] pb-4">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">
                Account signal
              </p>
              <h2 id="account-insights-title" className="mt-2 text-xl font-black">
                Your activity and reach.
              </h2>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                Account-level activity for {rangeLabel.toLowerCase()}, plus your private recent profile viewers.
              </p>
            </div>

            <div className="grid grid-cols-2 border-b border-[var(--loombus-border)] sm:grid-cols-4">
              {[
                ["Created", summary.discussions],
                ["Replies given", summary.replies],
                ["Ideas saved", summary.saved],
                ["People followed", summary.following],
              ].map(([label, value], index) => (
                <div
                  key={String(label)}
                  className={`py-5 ${index > 0 ? "border-l border-[var(--loombus-border)] pl-4" : ""}`}
                >
                  <span className="block text-xs text-[var(--loombus-text-muted)]">{label}</span>
                  <strong className="mt-1 block text-xl font-black">
                    {loadingSummary ? "—" : Number(value).toLocaleString()}
                  </strong>
                </div>
              ))}
            </div>

            <ProfileViewersPanel />
          </section>
        ) : null}
      </div>
    </main>
  );
}
