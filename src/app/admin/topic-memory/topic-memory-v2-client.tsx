"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bookmark,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Database,
  Eye,
  FileText,
  Gauge,
  Layers3,
  Lightbulb,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const MEMORY_KINDS = ["topic", "lens", "tag"] as const;
type MemoryKind = (typeof MEMORY_KINDS)[number];
type KindFilter = "all" | MemoryKind;
type CoverageFilter =
  | "all"
  | "complete"
  | "incomplete"
  | "mapped"
  | "ideas"
  | "uncovered";
type RecencyFilter = "all" | "recent" | "dormant";
type SortMode =
  | "signal"
  | "newest"
  | "discussions"
  | "replies"
  | "views"
  | "saves"
  | "coverage";

type MemoryExample = {
  id: string;
  title: string;
  topic: string;
  reality_lens: string | null;
  created_at: string;
  reply_count: number;
  view_count: number;
  save_count: number;
  has_conversation_map: boolean;
  has_related_ideas: boolean;
};

type MemoryGroup = {
  id: string;
  kind: MemoryKind;
  key: string;
  label: string;
  discussion_count: number;
  recent_count: number;
  reply_count: number;
  view_count: number;
  save_count: number;
  conversation_map_count: number;
  related_ideas_count: number;
  latest_at: string | null;
  signal_score: number;
  ai_coverage_percent: number;
  examples: MemoryExample[];
};

type TopicMemoryResponse = {
  currentAdminId?: string;
  generatedAt?: string;
  recentDays?: number;
  limits?: {
    discussions: number;
    tags: number;
    aiOutputs: number;
    activityRows: number;
    groupsPerKind: number;
    examplesPerGroup: number;
  };
  metrics?: {
    discussions: number;
    recentDiscussions: number;
    replies: number;
    views: number;
    saves: number;
    mappedDiscussions: number;
    conversationMaps: number;
    relatedIdeas: number;
    topicGroups: number;
    lensGroups: number;
    tagGroups: number;
  };
  groups?: {
    topics: MemoryGroup[];
    lenses: MemoryGroup[];
    tags: MemoryGroup[];
  };
  error?: string;
  code?: string;
};

const EMPTY_METRICS: NonNullable<TopicMemoryResponse["metrics"]> = {
  discussions: 0,
  recentDiscussions: 0,
  replies: 0,
  views: 0,
  saves: 0,
  mappedDiscussions: 0,
  conversationMaps: 0,
  relatedIdeas: 0,
  topicGroups: 0,
  lensGroups: 0,
  tagGroups: 0,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No timestamp";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No timestamp";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value);
}

function getKindLabel(kind: MemoryKind) {
  if (kind === "lens") return "Reality Lens";
  if (kind === "tag") return "Tag";
  return "Topic";
}

function getKindPlural(kind: MemoryKind) {
  if (kind === "lens") return "Reality Lenses";
  if (kind === "tag") return "Tags";
  return "Topics";
}

function groupMatchesCoverage(group: MemoryGroup, filter: CoverageFilter) {
  if (filter === "all") return true;
  if (filter === "complete") return group.ai_coverage_percent >= 100;
  if (filter === "incomplete") return group.ai_coverage_percent < 100;
  if (filter === "mapped") return group.conversation_map_count > 0;
  if (filter === "ideas") return group.related_ideas_count > 0;
  return (
    group.conversation_map_count === 0 && group.related_ideas_count === 0
  );
}

function getGroupHref(group: MemoryGroup) {
  const params = new URLSearchParams({
    type: group.kind,
    key: group.key,
  });
  return `/admin/topic-memory?${params.toString()}`;
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="topic-memory-v2-metric">
      <span className="topic-memory-v2-metric-icon">
        <Icon aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function DetailMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
}) {
  return (
    <div className="topic-memory-v2-detail-metric">
      <Icon aria-hidden="true" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function TopicMemoryV2Client() {
  const [data, setData] = useState<TopicMemoryResponse | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("signal");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [message, setMessage] = useState("");
  const [copiedValue, setCopiedValue] = useState("");

  const loadMemory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=/admin/topic-memory";
        return;
      }

      const response = await fetch("/api/admin/topic-memory", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as TopicMemoryResponse;

      if (response.status === 401) {
        window.location.href = "/login?next=/admin/topic-memory";
        return;
      }

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load Topic Memory operations.");
      }

      setData(result);
      setAccessDenied(false);

      const loadedGroups = [
        ...(result.groups?.topics ?? []),
        ...(result.groups?.lenses ?? []),
        ...(result.groups?.tags ?? []),
      ];

      setSelectedGroupId((current) => {
        const params = new URLSearchParams(window.location.search);
        const requestedKind = params.get("type");
        const requestedKey = params.get("key");
        const requestedId =
          requestedKind && requestedKey
            ? `${requestedKind}:${requestedKey}`
            : null;

        if (
          requestedId &&
          loadedGroups.some((group) => group.id === requestedId)
        ) {
          return requestedId;
        }

        if (current && loadedGroups.some((group) => group.id === current)) {
          return current;
        }

        return loadedGroups[0]?.id ?? null;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Topic Memory operations."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMemory(false);
  }, [loadMemory]);

  const allGroups = useMemo(
    () => [
      ...(data?.groups?.topics ?? []),
      ...(data?.groups?.lenses ?? []),
      ...(data?.groups?.tags ?? []),
    ],
    [data]
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const recentDays = data?.recentDays ?? 30;

    const filtered = allGroups.filter((group) => {
      if (kindFilter !== "all" && group.kind !== kindFilter) return false;
      if (!groupMatchesCoverage(group, coverageFilter)) return false;
      if (recencyFilter === "recent" && group.recent_count === 0) return false;
      if (recencyFilter === "dormant" && group.recent_count > 0) return false;

      if (!normalizedQuery) return true;
      return [group.label, group.key, getKindLabel(group.kind)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === "newest") {
        return (
          new Date(right.latest_at ?? 0).getTime() -
          new Date(left.latest_at ?? 0).getTime()
        );
      }
      if (sortMode === "discussions") {
        return right.discussion_count - left.discussion_count;
      }
      if (sortMode === "replies") {
        return right.reply_count - left.reply_count;
      }
      if (sortMode === "views") {
        return right.view_count - left.view_count;
      }
      if (sortMode === "saves") {
        return right.save_count - left.save_count;
      }
      if (sortMode === "coverage") {
        return right.ai_coverage_percent - left.ai_coverage_percent;
      }
      return right.signal_score - left.signal_score;
    });
  }, [
    allGroups,
    coverageFilter,
    data?.recentDays,
    kindFilter,
    recencyFilter,
    searchQuery,
    sortMode,
  ]);

  const selectedGroup = useMemo(
    () => allGroups.find((group) => group.id === selectedGroupId) ?? null,
    [allGroups, selectedGroupId]
  );

  useEffect(() => {
    if (filteredGroups.length === 0) return;
    if (!filteredGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(filteredGroups[0].id);
    }
  }, [filteredGroups, selectedGroupId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const selected = allGroups.find((group) => group.id === selectedGroupId);

    if (selected) {
      url.searchParams.set("type", selected.kind);
      url.searchParams.set("key", selected.key);
    } else {
      url.searchParams.delete("type");
      url.searchParams.delete("key");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [allGroups, selectedGroupId]);

  function clearFilters() {
    setSearchQuery("");
    setKindFilter("all");
    setCoverageFilter("all");
    setRecencyFilter("all");
    setSortMode("signal");
  }

  async function copyValue(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      window.setTimeout(() => setCopiedValue(""), 1800);
    } catch {
      setMessage("Unable to copy the value from this browser.");
    }
  }

  if (loading) {
    return (
      <main className="topic-memory-v2-page">
        <section className="topic-memory-v2-state">
          <Loader2 className="topic-memory-v2-spinner" aria-hidden="true" />
          <p className="topic-memory-v2-eyebrow">Administration</p>
          <h1>Loading Topic Memory…</h1>
          <p>Building the current platform-level topic and AI-coverage snapshot.</p>
        </section>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="topic-memory-v2-page">
        <section className="topic-memory-v2-state">
          <ShieldCheck aria-hidden="true" />
          <p className="topic-memory-v2-eyebrow">Admin only</p>
          <h1>Access denied.</h1>
          <p>Topic Memory operations are available only to active Loombus Admin accounts.</p>
          <Link href="/" className="topic-memory-v2-secondary-action">
            Return home
          </Link>
        </section>
      </main>
    );
  }

  const metrics = data?.metrics ?? EMPTY_METRICS;
  const recentDays = data?.recentDays ?? 30;
  const totalGroupCount =
    metrics.topicGroups + metrics.lensGroups + metrics.tagGroups;
  const overallCoverage =
    metrics.discussions > 0
      ? Math.round(
          ((metrics.conversationMaps + metrics.relatedIdeas) /
            (metrics.discussions * 2)) *
            100
        )
      : 0;

  return (
    <main className="topic-memory-v2-page">
      <div className="topic-memory-v2-shell">
        <nav className="topic-memory-v2-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/admin">
            <ArrowLeft aria-hidden="true" />
            Admin
          </Link>
          <ChevronRight aria-hidden="true" />
          <span>Topic Memory</span>
        </nav>

        <header className="topic-memory-v2-hero">
          <div>
            <p className="topic-memory-v2-eyebrow">Platform Intelligence</p>
            <h1>Topic Memory Operations</h1>
            <p>
              Inspect recurring topics, Reality Lenses, tags, engagement signals,
              and cached AI idea coverage across the current discussion window.
              This is platform-level operational memory, not personal member memory.
            </p>
          </div>
          <div className="topic-memory-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadMemory(true)}
              disabled={refreshing}
              className="topic-memory-v2-primary-action"
            >
              {refreshing ? (
                <Loader2 className="topic-memory-v2-spinner" aria-hidden="true" />
              ) : (
                <RefreshCw aria-hidden="true" />
              )}
              Refresh snapshot
            </button>
            <Link href="/admin/audit" className="topic-memory-v2-secondary-action">
              <FileText aria-hidden="true" />
              Open Audit
            </Link>
          </div>
        </header>

        <div className="topic-memory-v2-link-row" aria-label="Related Admin workspaces">
          <Link href="/admin/labs">Labs Operations</Link>
          <Link href="/admin/ai-access">AI Access</Link>
          <Link href="/admin/health">Platform Health</Link>
          <Link href="/admin/audit?search=topic">Topic audit events</Link>
        </div>

        {message && <div className="topic-memory-v2-notice is-error">{message}</div>}

        <section className="topic-memory-v2-metrics" aria-label="Topic Memory summary">
          <MetricCard
            label="Discussion window"
            value={formatNumber(metrics.discussions)}
            detail={`${formatNumber(metrics.recentDiscussions)} created in ${recentDays} days`}
            icon={MessageSquare}
          />
          <MetricCard
            label="Memory groups"
            value={formatNumber(totalGroupCount)}
            detail={`${formatNumber(metrics.topicGroups)} topics · ${formatNumber(metrics.lensGroups)} lenses · ${formatNumber(metrics.tagGroups)} tags`}
            icon={Layers3}
          />
          <MetricCard
            label="Engagement rows"
            value={formatNumber(metrics.replies + metrics.views + metrics.saves)}
            detail={`${formatNumber(metrics.replies)} replies · ${formatNumber(metrics.views)} views · ${formatNumber(metrics.saves)} saves`}
            icon={Activity}
          />
          <MetricCard
            label="AI idea coverage"
            value={`${overallCoverage}%`}
            detail={`${formatNumber(metrics.conversationMaps)} maps · ${formatNumber(metrics.relatedIdeas)} related-idea outputs`}
            icon={Bot}
          />
        </section>

        <section className="topic-memory-v2-toolbar" aria-label="Topic Memory filters">
          <label className="topic-memory-v2-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search topic, lens, tag, or key"
              aria-label="Search Topic Memory"
            />
          </label>

          <label>
            <span>Memory type</span>
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value as KindFilter)}
            >
              <option value="all">All memory types</option>
              <option value="topic">Topics</option>
              <option value="lens">Reality Lenses</option>
              <option value="tag">Tags</option>
            </select>
          </label>

          <label>
            <span>AI coverage</span>
            <select
              value={coverageFilter}
              onChange={(event) =>
                setCoverageFilter(event.target.value as CoverageFilter)
              }
            >
              <option value="all">All coverage states</option>
              <option value="complete">Complete coverage</option>
              <option value="incomplete">Incomplete coverage</option>
              <option value="mapped">Has Conversation Map</option>
              <option value="ideas">Has Related Ideas</option>
              <option value="uncovered">No cached outputs</option>
            </select>
          </label>

          <label>
            <span>Recency</span>
            <select
              value={recencyFilter}
              onChange={(event) =>
                setRecencyFilter(event.target.value as RecencyFilter)
              }
            >
              <option value="all">All activity windows</option>
              <option value="recent">Active in {recentDays} days</option>
              <option value="dormant">No recent discussions</option>
            </select>
          </label>

          <label>
            <span>Order</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="signal">Strongest signal</option>
              <option value="newest">Most recently active</option>
              <option value="discussions">Most discussions</option>
              <option value="replies">Most replies</option>
              <option value="views">Most views</option>
              <option value="saves">Most saves</option>
              <option value="coverage">Highest AI coverage</option>
            </select>
          </label>

          <button
            type="button"
            onClick={clearFilters}
            className="topic-memory-v2-clear"
          >
            Clear filters
          </button>
        </section>

        <section className="topic-memory-v2-workspace">
          <aside className="topic-memory-v2-queue">
            <div className="topic-memory-v2-panel-heading">
              <div>
                <p className="topic-memory-v2-eyebrow">Memory queue</p>
                <h2>{formatNumber(filteredGroups.length)} groups</h2>
              </div>
              <span>Generated {formatRelativeTime(data?.generatedAt)}</span>
            </div>

            <div className="topic-memory-v2-queue-list">
              {filteredGroups.length > 0 ? (
                filteredGroups.map((group) => {
                  const selected = group.id === selectedGroupId;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`topic-memory-v2-queue-card${selected ? " is-selected" : ""}`}
                      aria-pressed={selected}
                    >
                      <div className="topic-memory-v2-queue-card-top">
                        <span className={`topic-memory-v2-kind is-${group.kind}`}>
                          {getKindLabel(group.kind)}
                        </span>
                        <strong>{formatNumber(group.signal_score)}</strong>
                      </div>
                      <h3>{group.label}</h3>
                      <p>
                        {formatNumber(group.discussion_count)} discussions · {formatNumber(group.recent_count)} recent
                      </p>
                      <div className="topic-memory-v2-queue-stats">
                        <span>{formatNumber(group.reply_count)} replies</span>
                        <span>{formatNumber(group.save_count)} saves</span>
                        <span>{group.ai_coverage_percent}% AI</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="topic-memory-v2-empty">
                  <Search aria-hidden="true" />
                  <h3>No memory groups match.</h3>
                  <p>Clear or broaden the current filters.</p>
                </div>
              )}
            </div>
          </aside>

          <section className="topic-memory-v2-detail">
            {selectedGroup ? (
              <>
                <div className="topic-memory-v2-detail-heading">
                  <div>
                    <span className={`topic-memory-v2-kind is-${selectedGroup.kind}`}>
                      {getKindLabel(selectedGroup.kind)}
                    </span>
                    <h2>{selectedGroup.label}</h2>
                    <p>
                      Latest discussion {formatDateTime(selectedGroup.latest_at)} · platform signal score {formatNumber(selectedGroup.signal_score)}
                    </p>
                  </div>
                  <div className="topic-memory-v2-detail-actions">
                    <button
                      type="button"
                      onClick={() => void copyValue(selectedGroup.key)}
                      className="topic-memory-v2-secondary-action"
                    >
                      {copiedValue === selectedGroup.key ? (
                        <CheckCircle2 aria-hidden="true" />
                      ) : (
                        <Clipboard aria-hidden="true" />
                      )}
                      {copiedValue === selectedGroup.key ? "Copied" : "Copy key"}
                    </button>
                    <Link
                      href={getGroupHref(selectedGroup)}
                      className="topic-memory-v2-secondary-action"
                    >
                      <Brain aria-hidden="true" />
                      Copyable view
                    </Link>
                  </div>
                </div>

                <div className="topic-memory-v2-detail-metrics">
                  <DetailMetric
                    label="Discussions"
                    value={formatNumber(selectedGroup.discussion_count)}
                    icon={MessageSquare}
                  />
                  <DetailMetric
                    label={`Recent (${recentDays}d)`}
                    value={formatNumber(selectedGroup.recent_count)}
                    icon={Clock3}
                  />
                  <DetailMetric
                    label="Replies"
                    value={formatNumber(selectedGroup.reply_count)}
                    icon={MessageSquare}
                  />
                  <DetailMetric
                    label="Views"
                    value={formatNumber(selectedGroup.view_count)}
                    icon={Eye}
                  />
                  <DetailMetric
                    label="Saves"
                    value={formatNumber(selectedGroup.save_count)}
                    icon={Bookmark}
                  />
                  <DetailMetric
                    label="AI coverage"
                    value={`${selectedGroup.ai_coverage_percent}%`}
                    icon={Bot}
                  />
                </div>

                <div className="topic-memory-v2-coverage-grid">
                  <article>
                    <span className="topic-memory-v2-coverage-icon">
                      <TrendingUp aria-hidden="true" />
                    </span>
                    <div>
                      <span>Conversation Maps</span>
                      <strong>
                        {formatNumber(selectedGroup.conversation_map_count)} / {formatNumber(selectedGroup.discussion_count)}
                      </strong>
                      <p>Cached map coverage for discussions in this group.</p>
                    </div>
                  </article>
                  <article>
                    <span className="topic-memory-v2-coverage-icon">
                      <Lightbulb aria-hidden="true" />
                    </span>
                    <div>
                      <span>Related Ideas</span>
                      <strong>
                        {formatNumber(selectedGroup.related_ideas_count)} / {formatNumber(selectedGroup.discussion_count)}
                      </strong>
                      <p>Cached related-idea coverage for discussions in this group.</p>
                    </div>
                  </article>
                </div>

                <section className="topic-memory-v2-examples">
                  <div className="topic-memory-v2-section-heading">
                    <div>
                      <p className="topic-memory-v2-eyebrow">Discussion evidence</p>
                      <h3>Recent examples</h3>
                    </div>
                    <span>Up to {data?.limits?.examplesPerGroup ?? 8}</span>
                  </div>

                  {selectedGroup.examples.length > 0 ? (
                    <div className="topic-memory-v2-example-list">
                      {selectedGroup.examples.map((example) => (
                        <Link
                          key={example.id}
                          href={`/discussions/${example.id}`}
                          className="topic-memory-v2-example"
                        >
                          <div>
                            <strong>{example.title}</strong>
                            <span>
                              {example.topic}
                              {example.reality_lens
                                ? ` · ${example.reality_lens}`
                                : ""}
                            </span>
                          </div>
                          <div className="topic-memory-v2-example-stats">
                            <span>{formatNumber(example.reply_count)} replies</span>
                            <span>{formatNumber(example.view_count)} views</span>
                            <span>{formatNumber(example.save_count)} saves</span>
                          </div>
                          <ChevronRight aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="topic-memory-v2-empty compact">
                      <Database aria-hidden="true" />
                      <p>No discussion examples are available in this snapshot.</p>
                    </div>
                  )}
                </section>

                <section className="topic-memory-v2-contract">
                  <div>
                    <Gauge aria-hidden="true" />
                    <div>
                      <h3>How this signal is ranked</h3>
                      <p>
                        Signal score combines discussion count, recent activity,
                        replies, saves, Conversation Map coverage, and Related Ideas
                        coverage. Views remain visible but do not alter the legacy
                        ranking formula.
                      </p>
                    </div>
                  </div>
                  <div>
                    <ShieldCheck aria-hidden="true" />
                    <div>
                      <h3>Read-only operational snapshot</h3>
                      <p>
                        This workspace does not create, edit, merge, or delete topics,
                        tags, Reality Lenses, AI outputs, discussions, or member data.
                      </p>
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="topic-memory-v2-empty large">
                <Brain aria-hidden="true" />
                <h2>Select a memory group.</h2>
                <p>Choose a topic, Reality Lens, or tag from the queue.</p>
              </div>
            )}
          </section>
        </section>

        <section className="topic-memory-v2-window">
          <div className="topic-memory-v2-section-heading">
            <div>
              <p className="topic-memory-v2-eyebrow">Snapshot boundaries</p>
              <h2>Current operational window</h2>
            </div>
            <span>{formatDateTime(data?.generatedAt)}</span>
          </div>
          <div className="topic-memory-v2-window-grid">
            <div>
              <MessageSquare aria-hidden="true" />
              <span>Discussions</span>
              <strong>{formatNumber(data?.limits?.discussions ?? 500)}</strong>
            </div>
            <div>
              <Tag aria-hidden="true" />
              <span>Tag rows</span>
              <strong>{formatNumber(data?.limits?.tags ?? 2000)}</strong>
            </div>
            <div>
              <Bot aria-hidden="true" />
              <span>AI output rows</span>
              <strong>{formatNumber(data?.limits?.aiOutputs ?? 2000)}</strong>
            </div>
            <div>
              <Activity aria-hidden="true" />
              <span>Activity rows per source</span>
              <strong>{formatNumber(data?.limits?.activityRows ?? 5000)}</strong>
            </div>
          </div>
          <p className="topic-memory-v2-window-note">
            The limits preserve the existing Topic Memory data window while moving
            all Admin data reads behind a server-authorized endpoint. Group lists may
            expose up to {formatNumber(data?.limits?.groupsPerKind ?? 200)} entries per
            memory type.
          </p>
        </section>
      </div>
    </main>
  );
}
