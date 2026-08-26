"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  ChartNoAxesCombined,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Eye,
  History,
  LayoutDashboard,
  MessageCircle,
  MessageSquareReply,
  MessagesSquare,
  Settings,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";
import { supabase } from "@/lib/supabase/client";
import {
  type DashboardAiEntitlement,
  type DashboardProfile,
  getMissingProfileFields,
} from "./dashboard-v2-model";

type DiscussionRow = {
  id: string;
  title: string;
  topic: string | null;
  discussion_status: string | null;
  created_at: string;
};

type ReplyRow = {
  id: string;
  discussion_id: string;
  created_at: string;
  user_id?: string;
};

type DiscussionMetricRow = {
  discussion_id: string;
};

type RangeDays = 7 | 30 | 90 | 180 | 365;

type DashboardData = {
  profile: DashboardProfile | null;
  email: string | null;
  entitlement: DashboardAiEntitlement | null;
  discussions: DiscussionRow[];
  ownReplies: ReplyRow[];
  readerReplies: ReplyRow[];
  readerSaves: DiscussionMetricRow[];
  discussionViews: DiscussionMetricRow[];
  savedByMe: number;
  unreadNotifications: number;
};

const EMPTY_DATA: DashboardData = {
  profile: null,
  email: null,
  entitlement: null,
  discussions: [],
  ownReplies: [],
  readerReplies: [],
  readerSaves: [],
  discussionViews: [],
  savedByMe: 0,
  unreadNotifications: 0,
};

const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: 7, label: "Past 7 days" },
  { value: 30, label: "Past 30 days" },
  { value: 90, label: "Past 3 months" },
  { value: 180, label: "Past 6 months" },
  { value: 365, label: "Past year" },
];

function withDashboardTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 9000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out.`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function displayName(profile: DashboardProfile | null, email: string | null) {
  return (
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "Loombus member"
  );
}

function handleLabel(profile: DashboardProfile | null) {
  return profile?.username?.trim() ? `@${profile.username.trim()}` : "Loombus member";
}

function isWithinDays(value: string, days: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function buildSignalSeries(
  discussions: DiscussionRow[],
  ownReplies: ReplyRow[],
  readerReplies: ReplyRow[],
  days: RangeDays
) {
  const bucketCount = days <= 7 ? 7 : days <= 30 ? 10 : 12;
  const bucketMs = (days * 24 * 60 * 60 * 1000) / bucketCount;
  const start = Date.now() - days * 24 * 60 * 60 * 1000;
  const values = Array.from({ length: bucketCount }, () => 0);

  const addEvent = (value: string, weight: number) => {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp) || timestamp < start) return;
    const rawIndex = Math.floor((timestamp - start) / bucketMs);
    const index = Math.min(bucketCount - 1, Math.max(0, rawIndex));
    values[index] += weight;
  };

  for (const discussion of discussions) addEvent(discussion.created_at, 3);
  for (const reply of ownReplies) addEvent(reply.created_at, 1);
  for (const reply of readerReplies) addEvent(reply.created_at, 2);

  return values;
}

function Sparkline({ values }: { values: number[] }) {
  const width = 720;
  const height = 190;
  const padding = 14;
  const max = Math.max(1, ...values);
  const denominator = Math.max(1, values.length - 1);
  const points = values
    .map((value, index) => {
      const x = padding + (index / denominator) * (width - padding * 2);
      const y = height - padding - (value / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Signal activity trend"
      className="dashboard-compact-chart"
      preserveAspectRatio="none"
    >
      <line x1="14" y1="47" x2="706" y2="47" className="dashboard-chart-grid" />
      <line x1="14" y1="95" x2="706" y2="95" className="dashboard-chart-grid" />
      <line x1="14" y1="143" x2="706" y2="143" className="dashboard-chart-grid" />
      <polyline points={points} className="dashboard-chart-line" />
      {values.map((value, index) => {
        const x = padding + (index / denominator) * (width - padding * 2);
        const y = height - padding - (value / max) * (height - padding * 2);
        return <circle key={`${index}-${value}`} cx={x} cy={y} r="3.5" className="dashboard-chart-dot" />;
      })}
    </svg>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`dashboard-compact-sidebar-link${active ? " is-active" : ""}`}
    >
      <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
      <span>{label}</span>
    </Link>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof TrendingUp;
}) {
  return (
    <div className="dashboard-compact-metric">
      <div className="dashboard-compact-metric-icon">
        <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
      </div>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

export default function DashboardCompactClient() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoadError("");
      setLoading(true);

      try {
        const { data: userData, error: userError } = await withDashboardTimeout(
          supabase.auth.getUser(),
          "Dashboard authentication check"
        );
        if (userError) throw userError;

        const user = userData.user;
        if (!user) {
          window.location.replace("/login");
          return;
        }

        const blockedRelationshipUserIds = await withDashboardTimeout(
          getBlockedRelationshipUserIds(supabase, user.id),
          "Dashboard blocked-user check"
        );

        const [
          profileResult,
          discussionsResult,
          ownRepliesResult,
          savedResult,
          notificationsResult,
          entitlementResult,
        ] = await withDashboardTimeout(
          Promise.all([
            supabase
              .from("profiles")
              .select("full_name, username, bio, avatar_url")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("discussions")
              .select("id, title, topic, discussion_status, created_at")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false }),
            supabase
              .from("replies")
              .select("id, discussion_id, created_at")
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false }),
            supabase
              .from("bookmarks")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id),
            supabase
              .from("notifications")
              .select("id, actor_id")
              .eq("user_id", user.id)
              .is("read_at", null),
            supabase
              .from("user_ai_entitlements")
              .select("tier, ai_assisted_enabled, monthly_summary_limit")
              .eq("user_id", user.id)
              .maybeSingle(),
          ]),
          "Dashboard overview"
        );

        const firstError =
          profileResult.error ||
          discussionsResult.error ||
          ownRepliesResult.error ||
          savedResult.error ||
          notificationsResult.error ||
          entitlementResult.error;
        if (firstError) throw firstError;

        const discussions = (discussionsResult.data ?? []) as DiscussionRow[];
        const discussionIds = discussions.map((discussion) => discussion.id);
        let readerReplies: ReplyRow[] = [];
        let readerSaves: DiscussionMetricRow[] = [];
        let discussionViews: DiscussionMetricRow[] = [];

        if (discussionIds.length > 0) {
          const [readerRepliesResult, readerSavesResult, viewsResult] =
            await withDashboardTimeout(
              Promise.all([
                supabase
                  .from("replies")
                  .select("id, discussion_id, created_at, user_id")
                  .in("discussion_id", discussionIds)
                  .neq("user_id", user.id)
                  .is("deleted_at", null),
                supabase
                  .from("bookmarks")
                  .select("discussion_id")
                  .in("discussion_id", discussionIds)
                  .neq("user_id", user.id),
                supabase
                  .from("discussion_views")
                  .select("discussion_id")
                  .in("discussion_id", discussionIds),
              ]),
              "Dashboard engagement summary"
            );

          if (readerRepliesResult.error) throw readerRepliesResult.error;
          if (readerSavesResult.error) throw readerSavesResult.error;
          if (viewsResult.error) throw viewsResult.error;

          readerReplies = (readerRepliesResult.data ?? []) as ReplyRow[];
          readerSaves = (readerSavesResult.data ?? []) as DiscussionMetricRow[];
          discussionViews = (viewsResult.data ?? []) as DiscussionMetricRow[];
        }

        if (!mounted) return;

        setData({
          profile: (profileResult.data as DashboardProfile | null) ?? null,
          email: user.email ?? null,
          entitlement:
            (entitlementResult.data as DashboardAiEntitlement | null) ?? null,
          discussions,
          ownReplies: (ownRepliesResult.data ?? []) as ReplyRow[],
          readerReplies,
          readerSaves,
          discussionViews,
          savedByMe: savedResult.count ?? 0,
          unreadNotifications: filterBlockedActorNotifications(
            notificationsResult.data ?? [],
            blockedRelationshipUserIds
          ).length,
        });
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const periodDiscussions = useMemo(
    () => data.discussions.filter((row) => isWithinDays(row.created_at, rangeDays)),
    [data.discussions, rangeDays]
  );
  const periodReplies = useMemo(
    () => data.ownReplies.filter((row) => isWithinDays(row.created_at, rangeDays)),
    [data.ownReplies, rangeDays]
  );
  const periodReaderReplies = useMemo(
    () => data.readerReplies.filter((row) => isWithinDays(row.created_at, rangeDays)),
    [data.readerReplies, rangeDays]
  );

  const signalSeries = useMemo(
    () =>
      buildSignalSeries(
        data.discussions,
        data.ownReplies,
        data.readerReplies,
        rangeDays
      ),
    [data.discussions, data.ownReplies, data.readerReplies, rangeDays]
  );

  const periodSignal =
    periodDiscussions.length * 3 + periodReplies.length + periodReaderReplies.length * 2;

  const repliesByDiscussion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.readerReplies) {
      counts.set(row.discussion_id, (counts.get(row.discussion_id) ?? 0) + 1);
    }
    return counts;
  }, [data.readerReplies]);

  const savesByDiscussion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.readerSaves) {
      counts.set(row.discussion_id, (counts.get(row.discussion_id) ?? 0) + 1);
    }
    return counts;
  }, [data.readerSaves]);

  const viewsByDiscussion = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data.discussionViews) {
      counts.set(row.discussion_id, (counts.get(row.discussion_id) ?? 0) + 1);
    }
    return counts;
  }, [data.discussionViews]);

  const missingProfileFields = getMissingProfileFields(data.profile);
  const profileCompletionPercent = Math.round(
    ((4 - missingProfileFields.length) / 4) * 100
  );
  const subscriptionDisplay = getSubscriptionDisplay(data.entitlement);
  const aiUsageLabel = getAiUsageLabel(data.entitlement);
  const recentDiscussions = data.discussions.slice(0, 5);
  const rangeLabel = RANGE_OPTIONS.find((item) => item.value === rangeDays)?.label ?? "Past 30 days";

  if (loading) {
    return (
      <main className="dashboard-compact-route">
        <div className="dashboard-compact-loading">Loading dashboard…</div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="dashboard-compact-route">
        <section className="dashboard-compact-error">
          <h1>Dashboard</h1>
          <p>{loadError}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-compact-route">
      <div className="dashboard-compact-shell">
        <aside className="dashboard-compact-sidebar" aria-label="Dashboard navigation">
          <div className="dashboard-compact-sidebar-title">Dashboard</div>
          <nav>
            <SidebarLink href="/dashboard" label="Overview" icon={LayoutDashboard} active />
            <SidebarLink href="#performance" label="Performance" icon={ChartNoAxesCombined} />
            <SidebarLink href="/discussions" label="Discussions" icon={MessagesSquare} />
            <SidebarLink href="#engagement" label="Engagement" icon={UsersRound} />
            <SidebarLink href="/saved" label="Saved" icon={Bookmark} />
          </nav>

          <div className="dashboard-compact-sidebar-group">
            <span>Tools</span>
            <nav>
              <SidebarLink href="/history" label="Reading history" icon={History} />
              <SidebarLink href="/messages" label="Messages" icon={MessageCircle} />
              <SidebarLink href="/notifications" label="Notifications" icon={Bell} />
            </nav>
          </div>

          <div className="dashboard-compact-sidebar-group">
            <span>Account</span>
            <nav>
              <SidebarLink href="/premium" label="Premium" icon={Sparkles} />
              <SidebarLink href="/settings" label="Settings" icon={Settings} />
            </nav>
          </div>
        </aside>

        <section className="dashboard-compact-main">
          <header className="dashboard-compact-page-header">
            <div>
              <h1>Dashboard</h1>
              <p>Your performance, discussions, and engagement in one place.</p>
            </div>
          </header>

          <section id="performance" className="dashboard-compact-panel dashboard-performance-panel">
            <div className="dashboard-compact-panel-heading">
              <div>
                <h2>Performance overview</h2>
                <p>Track contribution and reader response without leaving the dashboard.</p>
              </div>
              <label className="dashboard-range-select">
                <span className="sr-only">Performance time range</span>
                <select
                  value={rangeDays}
                  onChange={(event) => setRangeDays(Number(event.target.value) as RangeDays)}
                >
                  {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="dashboard-compact-metrics-grid">
              <MetricCard
                label="Signal"
                value={periodSignal}
                detail="Contribution + response"
                icon={TrendingUp}
              />
              <MetricCard
                label="Discussions"
                value={periodDiscussions.length}
                detail={rangeLabel}
                icon={MessagesSquare}
              />
              <MetricCard
                label="Replies"
                value={periodReplies.length}
                detail="You contributed"
                icon={MessageSquareReply}
              />
              <MetricCard
                label="Reader replies"
                value={periodReaderReplies.length}
                detail="Received on your threads"
                icon={UsersRound}
              />
            </div>

            <div className="dashboard-compact-chart-wrap">
              <div className="dashboard-chart-copy">
                <strong>Signal activity</strong>
                <span>{rangeLabel}</span>
              </div>
              <Sparkline values={signalSeries} />
              <p className="dashboard-chart-note">
                Signal activity combines discussions started, replies contributed, and replies received during the selected period.
              </p>
            </div>
          </section>

          <section className="dashboard-compact-panel dashboard-content-panel">
            <div className="dashboard-compact-panel-heading">
              <div>
                <h2>Recent discussions</h2>
                <p>Your latest threads and how readers are responding.</p>
              </div>
              <Link href="/discussions" className="dashboard-compact-see-all">
                See all <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>

            {recentDiscussions.length > 0 ? (
              <div className="dashboard-discussion-list">
                {recentDiscussions.map((discussion) => (
                  <Link
                    href={`/discussions/${discussion.id}`}
                    key={discussion.id}
                    className="dashboard-discussion-row"
                  >
                    <div className="dashboard-discussion-copy">
                      <span>{discussion.topic?.trim() || "Discussion"}</span>
                      <strong>{discussion.title}</strong>
                      <small>{formatCompactDate(discussion.created_at)}</small>
                    </div>
                    <div className="dashboard-discussion-stats" aria-label="Discussion performance">
                      <span title="Views">
                        <Eye aria-hidden="true" className="size-4" />
                        {viewsByDiscussion.get(discussion.id) ?? 0}
                      </span>
                      <span title="Replies received">
                        <MessageSquareReply aria-hidden="true" className="size-4" />
                        {repliesByDiscussion.get(discussion.id) ?? 0}
                      </span>
                      <span title="Reader saves">
                        <Bookmark aria-hidden="true" className="size-4" />
                        {savesByDiscussion.get(discussion.id) ?? 0}
                      </span>
                      <ChevronRight aria-hidden="true" className="size-4 dashboard-discussion-arrow" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dashboard-compact-empty">
                <strong>No discussions yet.</strong>
                <p>Start one focused conversation and its performance will appear here.</p>
                <Link href="/create">Start a discussion</Link>
              </div>
            )}
          </section>

          <section id="engagement" className="dashboard-compact-panel dashboard-engagement-panel">
            <div className="dashboard-compact-panel-heading">
              <div>
                <h2>Engagement</h2>
                <p>A compact view of what is asking for your attention.</p>
              </div>
              <Link href="/notifications" className="dashboard-compact-see-all">
                Open notifications <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>

            <div className="dashboard-engagement-grid">
              <Link href="/notifications" className="dashboard-engagement-card">
                <Bell aria-hidden="true" className="size-5" />
                <strong>{data.unreadNotifications.toLocaleString()}</strong>
                <span>Unread notifications</span>
              </Link>
              <Link href="/discussions" className="dashboard-engagement-card">
                <MessageSquareReply aria-hidden="true" className="size-5" />
                <strong>{data.readerReplies.length.toLocaleString()}</strong>
                <span>Replies received</span>
              </Link>
              <Link href="/saved" className="dashboard-engagement-card">
                <Bookmark aria-hidden="true" className="size-5" />
                <strong>{data.readerSaves.length.toLocaleString()}</strong>
                <span>Saved by readers</span>
              </Link>
            </div>
          </section>
        </section>

        <aside className="dashboard-compact-rail">
          <section className="dashboard-compact-panel dashboard-profile-panel">
            <div className="dashboard-profile-heading">
              <ProfileAvatar profile={data.profile} size="md" />
              <div>
                <strong>{displayName(data.profile, data.email)}</strong>
                <span>{handleLabel(data.profile)}</span>
              </div>
            </div>

            <div className="dashboard-profile-completion">
              <div>
                <span>Profile status</span>
                <strong>{profileCompletionPercent}%</strong>
              </div>
              <div className="dashboard-profile-progress" aria-hidden="true">
                <span style={{ width: `${profileCompletionPercent}%` }} />
              </div>
              <p>
                {missingProfileFields.length === 0
                  ? "Member foundation complete"
                  : `${missingProfileFields.length} profile item${missingProfileFields.length === 1 ? "" : "s"} remaining`}
              </p>
            </div>

            <div className="dashboard-profile-facts">
              <div>
                <span>Plan</span>
                <strong>{subscriptionDisplay.label}</strong>
              </div>
              <div>
                <span>AI access</span>
                <strong>{aiUsageLabel}</strong>
              </div>
              <div>
                <span>Saved</span>
                <strong>{data.savedByMe}</strong>
              </div>
            </div>

            <Link href="/settings" className="dashboard-profile-action">
              Account settings <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </section>

          <section className="dashboard-compact-panel dashboard-progress-panel">
            <div className="dashboard-compact-panel-heading compact">
              <div>
                <h2>This period</h2>
                <p>{rangeLabel}</p>
              </div>
            </div>

            <div className="dashboard-progress-list">
              <div>
                <CheckCircle2 aria-hidden="true" className="size-5" />
                <span>
                  <strong>{periodDiscussions.length}</strong>
                  Discussions started
                </span>
              </div>
              <div>
                <MessageSquareReply aria-hidden="true" className="size-5" />
                <span>
                  <strong>{periodReplies.length}</strong>
                  Replies contributed
                </span>
              </div>
              <div>
                <UsersRound aria-hidden="true" className="size-5" />
                <span>
                  <strong>{periodReaderReplies.length}</strong>
                  Reader replies
                </span>
              </div>
            </div>
          </section>

          <section className="dashboard-compact-panel dashboard-tools-panel">
            <div className="dashboard-compact-panel-heading compact">
              <div>
                <h2>Tools</h2>
                <p>Continue where you left off.</p>
              </div>
            </div>
            <Link href="/saved">
              <Bookmark aria-hidden="true" className="size-4" />
              <span>Saved</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/history">
              <BookOpen aria-hidden="true" className="size-4" />
              <span>Reading history</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
            <Link href="/people">
              <CircleUserRound aria-hidden="true" className="size-4" />
              <span>People</span>
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </section>
        </aside>
      </div>
    </main>
  );
}
