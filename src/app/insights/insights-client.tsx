"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DiscussionViewerInsights } from "@/components/discussion-viewer-insights";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";
import { ViewTrendPanel } from "@/components/view-trend-panel";
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

type ImpactTotals = {
  views: number;
  uniqueReach: number;
  repliesReceived: number;
  savesEarned: number;
  engagedMembers: number;
  signalActions: number;
  signalContributors: number;
  signalDepth: number;
  knowledgeOriginDiscussions: number;
};

type ImpactDiscussion = {
  id: string;
  title: string;
  createdAt: string;
  views: number;
  uniqueReach: number;
  repliesReceived: number;
  savesEarned: number;
  engagedMembers: number;
  signalActions: number;
  signalContributors: number;
  signalDepth: number;
  knowledgeOrigin: boolean;
  knowledgeType: string | null;
  knowledgeStatus: string | null;
};

type ImpactPayload = {
  totals: ImpactTotals;
  discussions: ImpactDiscussion[];
};

type ComparisonSummary = {
  count: number;
  reach: number;
  replies: number;
  saves: number;
  signal: number;
};

type ComparisonRow = {
  label: string;
  data: ComparisonSummary;
};

const emptySummary: Summary = { discussions: 0, replies: 0, saved: 0, following: 0 };
const emptyImpact: ImpactPayload = {
  totals: {
    views: 0,
    uniqueReach: 0,
    repliesReceived: 0,
    savesEarned: 0,
    engagedMembers: 0,
    signalActions: 0,
    signalContributors: 0,
    signalDepth: 0,
    knowledgeOriginDiscussions: 0,
  },
  discussions: [],
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

function formatDepth(value: number) {
  return value ? value.toFixed(value % 1 === 0 ? 0 : 2) : "0";
}

function summarize(items: ImpactDiscussion[]): ComparisonSummary {
  const count = items.length;
  if (!count) return { count: 0, reach: 0, replies: 0, saves: 0, signal: 0 };
  const total = items.reduce(
    (acc, item) => ({
      reach: acc.reach + item.uniqueReach,
      replies: acc.replies + item.repliesReceived,
      saves: acc.saves + item.savesEarned,
      signal: acc.signal + item.signalActions,
    }),
    { reach: 0, replies: 0, saves: 0, signal: 0 }
  );
  return {
    count,
    reach: total.reach / count,
    replies: total.replies / count,
    saves: total.saves / count,
    signal: total.signal / count,
  };
}

function formatAverage(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export default function InsightsClient() {
  const [activeTab, setActiveTab] = useState<InsightsTab>("discussions");
  const [range, setRange] = useState<RangeKey>("30d");
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [impact, setImpact] = useState<ImpactPayload>(emptyImpact);
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

        let discussionsQuery = supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null);
        let repliesCountQuery = supabase.from("replies").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null);
        let savedQuery = supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", userId);
        let followingQuery = supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId);
        let repliesListQuery = supabase.from("replies").select("id, discussion_id, created_at").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(25);

        if (since) {
          discussionsQuery = discussionsQuery.gte("created_at", since);
          repliesCountQuery = repliesCountQuery.gte("created_at", since);
          savedQuery = savedQuery.gte("created_at", since);
          followingQuery = followingQuery.gte("created_at", since);
          repliesListQuery = repliesListQuery.gte("created_at", since);
        }

        const impactRequest = fetch(`/api/insights/summary?range=${encodeURIComponent(range)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });

        const [discussionResult, replyCountResult, savedResult, followingResult, replyRowsResult, impactResponse] = await Promise.all([
          discussionsQuery,
          repliesCountQuery,
          savedQuery,
          followingQuery,
          repliesListQuery,
          impactRequest,
        ]);

        const firstError = discussionResult.error || replyCountResult.error || savedResult.error || followingResult.error || replyRowsResult.error;
        if (firstError) throw firstError;

        const replyRows = (replyRowsResult.data ?? []) as ReplyRow[];
        const discussionIds = [...new Set(replyRows.map((item) => item.discussion_id).filter(Boolean))];
        let titles: Record<string, string> = {};

        if (discussionIds.length) {
          const { data, error } = await supabase.from("discussions").select("id, title").in("id", discussionIds);
          if (error) throw error;
          titles = Object.fromEntries(((data ?? []) as DiscussionRow[]).map((item) => [item.id, item.title]));
        }

        const impactPayload = impactResponse.ok ? ((await impactResponse.json()) as ImpactPayload) : emptyImpact;
        if (cancelled) return;

        setSummary({
          discussions: discussionResult.count ?? 0,
          replies: replyCountResult.count ?? 0,
          saved: savedResult.count ?? 0,
          following: followingResult.count ?? 0,
        });
        setImpact(impactPayload);
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

  const rangeLabel = useMemo(() => rangeOptions.find((item) => item.key === range)?.label ?? "30 days", [range]);

  const rankedDiscussions = useMemo(
    () => [...impact.discussions].sort((a, b) => b.signalActions - a.signalActions || b.signalContributors - a.signalContributors || b.engagedMembers - a.engagedMembers || b.views - a.views),
    [impact.discussions]
  );

  const originComparison = useMemo(() => {
    const knowledge = impact.discussions.filter((item) => item.knowledgeOrigin);
    const regular = impact.discussions.filter((item) => !item.knowledgeOrigin);
    return { knowledge: summarize(knowledge), regular: summarize(regular) };
  }, [impact.discussions]);

  const comparisonRows: ComparisonRow[] = [
    { label: "Knowledge-origin", data: originComparison.knowledge },
    { label: "Regular", data: originComparison.regular },
  ];

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
        <header className="mb-7 border-b border-[var(--loombus-border)] pb-6">
          <Link href="/home" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-gold)]">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Link>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[var(--loombus-gold)]">Loombus Insights</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Understand your signal.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">Private analytics for your discussions, replies, profile activity, and the members engaging with your work.</p>
        </header>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--loombus-border)]">
          <nav className="flex gap-6 overflow-x-auto" aria-label="Insights sections">
            {(["discussions", "replies", "account"] as InsightsTab[]).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`border-b-2 py-3 text-sm font-black capitalize transition ${activeTab === tab ? "border-[var(--loombus-gold)] text-[var(--loombus-text)]" : "border-transparent text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"}`}>
                {tab}
              </button>
            ))}
          </nav>
          <label className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--loombus-text-muted)]">
            Range
            <select value={range} onChange={(event) => setRange(event.target.value as RangeKey)} className="bg-transparent py-2 text-sm font-bold text-[var(--loombus-text)] outline-none" aria-label="Insights date range">
              {rangeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
        </div>

        {notice ? <p className="border-b border-[var(--loombus-border)] py-4 text-sm text-[var(--loombus-text-muted)]">{notice}</p> : null}

        <section className="grid grid-cols-2 border-b border-[var(--loombus-border)] sm:grid-cols-4">
          {[["Discussions", summary.discussions], ["Replies", summary.replies], ["Saved", summary.saved], ["Following", summary.following]].map(([label, value], index) => (
            <div key={String(label)} className={`py-5 ${index > 0 ? "border-l border-[var(--loombus-border)] pl-4" : ""}`}>
              <span className="block text-xs font-bold uppercase tracking-[.12em] text-[var(--loombus-text-subtle)]">{label}</span>
              <strong className="mt-1 block text-2xl font-black">{loadingSummary ? "—" : Number(value).toLocaleString()}</strong>
              <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">{rangeLabel}</span>
            </div>
          ))}
        </section>

        {activeTab === "discussions" ? (
          <section aria-label="Discussion insights">
            <div className="grid grid-cols-2 border-b border-[var(--loombus-border)] sm:grid-cols-5">
              {[["Views", impact.totals.views], ["Unique reach", impact.totals.uniqueReach], ["Replies received", impact.totals.repliesReceived], ["Saves earned", impact.totals.savesEarned], ["Engaged members", impact.totals.engagedMembers]].map(([label, value], index) => (
                <div key={String(label)} className={`py-5 ${index > 0 ? "border-l border-[var(--loombus-border)] pl-4" : ""}`}>
                  <span className="block text-xs text-[var(--loombus-text-muted)]">{label}</span>
                  <strong className="mt-1 block text-xl font-black">{loadingSummary ? "—" : Number(value).toLocaleString()}</strong>
                </div>
              ))}
            </div>

            <div className="border-b border-[var(--loombus-border)] py-5">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Signal v1</p>
                  <h2 className="mt-2 text-xl font-black">Meaningful action beyond viewing.</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">Signal actions are replies received plus saves earned. Signal contributors are distinct members who replied or saved. Views and reach do not increase Signal.</p>
                </div>
                <span className="text-xs text-[var(--loombus-text-muted)]">{rangeLabel}</span>
              </div>
              <div className="mt-5 grid grid-cols-3 border-t border-[var(--loombus-border)]">
                <div className="py-4"><span className="block text-xs text-[var(--loombus-text-muted)]">Signal actions</span><strong className="mt-1 block text-xl font-black">{loadingSummary ? "—" : impact.totals.signalActions.toLocaleString()}</strong></div>
                <div className="border-l border-[var(--loombus-border)] py-4 pl-4"><span className="block text-xs text-[var(--loombus-text-muted)]">Signal contributors</span><strong className="mt-1 block text-xl font-black">{loadingSummary ? "—" : impact.totals.signalContributors.toLocaleString()}</strong></div>
                <div className="border-l border-[var(--loombus-border)] py-4 pl-4"><span className="block text-xs text-[var(--loombus-text-muted)]">Signal depth</span><strong className="mt-1 block text-xl font-black">{loadingSummary ? "—" : formatDepth(impact.totals.signalDepth)}</strong><span className="mt-1 block text-xs text-[var(--loombus-text-subtle)]">actions per contributor</span></div>
              </div>
            </div>

            <div className="border-b border-[var(--loombus-border)] py-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Origin comparison</p>
                  <h2 className="mt-2 text-xl font-black">Knowledge-origin vs regular discussions.</h2>
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Per-discussion averages keep the comparison from being distorted by how many discussions are in each group.</p>
                </div>
                <span className="text-xs text-[var(--loombus-text-muted)]">{rangeLabel}</span>
              </div>

              <div className="overflow-x-auto border-t border-[var(--loombus-border)]">
                <div className="grid min-w-[620px] grid-cols-[minmax(180px,1fr)_90px_repeat(4,110px)] border-b border-[var(--loombus-border)] py-3 text-xs font-bold text-[var(--loombus-text-subtle)]">
                  <span>Origin</span><span className="text-right">Discussions</span><span className="text-right">Avg reach</span><span className="text-right">Avg replies</span><span className="text-right">Avg saves</span><span className="text-right">Avg Signal</span>
                </div>
                {comparisonRows.map(({ label, data }) => (
                  <div key={label} className="grid min-w-[620px] grid-cols-[minmax(180px,1fr)_90px_repeat(4,110px)] border-b border-[var(--loombus-border)] py-4 text-sm">
                    <strong>{label}</strong>
                    <span className="text-right">{data.count.toLocaleString()}</span>
                    {data.count ? <><span className="text-right">{formatAverage(data.reach)}</span><span className="text-right">{formatAverage(data.replies)}</span><span className="text-right">{formatAverage(data.saves)}</span><span className="text-right">{formatAverage(data.signal)}</span></> : <span className="col-span-4 text-right text-xs text-[var(--loombus-text-muted)]">Not enough data</span>}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-subtle)]">Knowledge origin describes provenance only. It does not add Signal by itself.</p>
            </div>

            <ViewTrendPanel range={range} />

            <div className="border-b border-[var(--loombus-border)] py-5">
              <div className="mb-3 flex items-end justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Discussion performance</p><h2 className="mt-2 text-xl font-black">Where your signal is forming.</h2></div>
                <span className="text-xs text-[var(--loombus-text-muted)]">{rangeLabel}</span>
              </div>
              {rankedDiscussions.length ? rankedDiscussions.map((item) => (
                <Link key={item.id} href={`/discussions/${item.id}`} className="grid gap-2 border-t border-[var(--loombus-border)] py-4 sm:grid-cols-[minmax(0,1fr)_repeat(6,88px)] sm:items-center">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{item.title}</strong>
                    <span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">Created {formatDate(item.createdAt)}{item.knowledgeOrigin ? ` · Knowledge-origin${item.knowledgeType ? ` · ${item.knowledgeType}` : ""}` : ""}</span>
                  </div>
                  {[["Views", item.views], ["Reach", item.uniqueReach], ["Replies", item.repliesReceived], ["Saves", item.savesEarned], ["Signal", item.signalActions], ["Contrib.", item.signalContributors]].map(([label, value]) => (
                    <span key={String(label)} className="text-xs text-[var(--loombus-text-muted)] sm:text-right"><b className="text-[var(--loombus-text)]">{Number(value).toLocaleString()}</b> {label}</span>
                  ))}
                </Link>
              )) : <p className="border-t border-[var(--loombus-border)] py-4 text-sm text-[var(--loombus-text-muted)]">No discussion activity recorded in this period.</p>}
            </div>

            <DiscussionViewerInsights />
          </section>
        ) : null}

        {activeTab === "replies" ? (
          <section className="py-6" aria-labelledby="reply-insights-title">
            <div className="border-b border-[var(--loombus-border)] pb-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Reply activity</p><h2 id="reply-insights-title" className="mt-2 text-xl font-black">Your recent contributions.</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Replies you contributed during the selected period.</p></div>
            {loadingSummary ? <p className="py-5 text-sm text-[var(--loombus-text-muted)]">Loading reply activity…</p> : replies.length ? <div>{replies.map((reply) => <Link key={reply.id} href={`/discussions/${reply.discussion_id}`} className="flex items-center justify-between gap-5 border-b border-[var(--loombus-border)] py-4 transition hover:text-[var(--loombus-gold)]"><div className="min-w-0"><strong className="block truncate text-sm">{discussionTitles[reply.discussion_id] ?? "Discussion"}</strong><span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">Reply contributed {formatDate(reply.created_at)}</span></div><span className="shrink-0 text-xs font-bold text-[var(--loombus-text-muted)]">Open</span></Link>)}</div> : <p className="py-5 text-sm text-[var(--loombus-text-muted)]">No replies recorded in this period.</p>}
          </section>
        ) : null}

        {activeTab === "account" ? (
          <section className="py-6" aria-labelledby="account-insights-title">
            <div className="border-b border-[var(--loombus-border)] pb-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Account signal</p><h2 id="account-insights-title" className="mt-2 text-xl font-black">Your activity and reach.</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Account-level activity for {rangeLabel.toLowerCase()}, plus your private recent profile viewers.</p></div>
            <div className="grid grid-cols-2 border-b border-[var(--loombus-border)] sm:grid-cols-4">{[["Created", summary.discussions], ["Replies given", summary.replies], ["Ideas saved", summary.saved], ["People followed", summary.following]].map(([label, value], index) => <div key={String(label)} className={`py-5 ${index > 0 ? "border-l border-[var(--loombus-border)] pl-4" : ""}`}><span className="block text-xs text-[var(--loombus-text-muted)]">{label}</span><strong className="mt-1 block text-xl font-black">{loadingSummary ? "—" : Number(value).toLocaleString()}</strong></div>)}</div>
            <ProfileViewersPanel />
          </section>
        ) : null}
      </div>
    </main>
  );
}
