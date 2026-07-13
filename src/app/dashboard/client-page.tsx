"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Bookmark,
  BookOpen,
  Compass,
  Edit3,
  FolderOpen,
  MessageCircle,
  MessageSquareReply,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { WelcomeEmailTrigger } from "@/components/welcome-email-trigger";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { PURPOSE_LANES } from "@/lib/purpose-lanes";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";
import { supabase } from "@/lib/supabase/client";
import {
  DashboardAttentionCard,
  DashboardDiscussionCard,
  DashboardEmptyState,
  DashboardGoalCard,
  DashboardMetricCard,
  DashboardQuickAction,
  DashboardSectionHeading,
  DashboardTopicCard,
} from "./dashboard-v2-components";
import {
  type DashboardAction,
  type DashboardActivityCounts,
  type DashboardAiEntitlement,
  type DashboardDiscussion,
  type DashboardMetric,
  type DashboardProfile,
  type DashboardPurposeGoal,
  type DashboardPurposeGoalStatus,
  type DashboardTopicSignal,
  getDashboardName,
  getGreetingLabel,
  getMissingProfileFields,
} from "./dashboard-v2-model";

const EMPTY_COUNTS: DashboardActivityCounts = {
  discussions: 0,
  replies: 0,
  saved: 0,
  unreadNotifications: 0,
  topicsContributed: 0,
  savedByReaders: 0,
  repliesReceived: 0,
  resolvedDiscussions: 0,
};

function withDashboardTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 9000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please reload the dashboard.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

export default function DashboardClientPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [counts, setCounts] = useState<DashboardActivityCounts>(EMPTY_COUNTS);
  const [topicSignals, setTopicSignals] = useState<DashboardTopicSignal[]>([]);
  const [recentDiscussions, setRecentDiscussions] = useState<DashboardDiscussion[]>([]);
  const [purposeGoals, setPurposeGoals] = useState<DashboardPurposeGoal[]>([]);
  const [aiEntitlement, setAiEntitlement] = useState<DashboardAiEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPurposeLane, setGoalPurposeLane] = useState("");
  const [goalPrivateNote, setGoalPrivateNote] = useState("");
  const [goalMessage, setGoalMessage] = useState("");
  const [goalWorking, setGoalWorking] = useState(false);
  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoadError("");

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

        if (!mounted) return;
        setEmail(user.email ?? null);

        const blockedRelationshipUserIds = await withDashboardTimeout(
          getBlockedRelationshipUserIds(supabase, user.id),
          "Dashboard blocked-user check"
        );

        const [
          profileResult,
          discussionsResult,
          repliesResult,
          savedResult,
          notificationsResult,
          entitlementResult,
          goalsResult,
        ] = await withDashboardTimeout(
          Promise.all([
            supabase
              .from("profiles")
              .select("full_name, username, bio, avatar_url")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("discussions")
              .select("id, title, topic, discussion_status, created_at", {
                count: "exact",
              })
              .eq("user_id", user.id)
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(8),
            supabase
              .from("replies")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .is("deleted_at", null),
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
            supabase
              .from("user_purpose_goals")
              .select(
                "id, user_id, title, purpose_lane, private_note, status, created_at, updated_at, completed_at"
              )
              .eq("user_id", user.id)
              .order("updated_at", { ascending: false })
              .limit(8),
          ]),
          "Dashboard activity summary"
        );

        const firstError =
          profileResult.error ||
          discussionsResult.error ||
          repliesResult.error ||
          savedResult.error ||
          notificationsResult.error ||
          entitlementResult.error ||
          goalsResult.error;

        if (firstError) throw firstError;

        const discussionRows = (discussionsResult.data ?? []) as DashboardDiscussion[];
        const discussionIds = discussionRows.map((discussion) => discussion.id);
        const visibleUnreadNotifications = filterBlockedActorNotifications(
          notificationsResult.data ?? [],
          blockedRelationshipUserIds
        );

        let repliesReceived = 0;
        let savedByReaders = 0;
        let replyRows: { discussion_id: string }[] = [];
        let bookmarkRows: { discussion_id: string }[] = [];

        if (discussionIds.length > 0) {
          const [receivedRepliesResult, readerSavesResult] = await withDashboardTimeout(
            Promise.all([
              supabase
                .from("replies")
                .select("discussion_id", { count: "exact" })
                .in("discussion_id", discussionIds)
                .neq("user_id", user.id)
                .is("deleted_at", null),
              supabase
                .from("bookmarks")
                .select("discussion_id", { count: "exact" })
                .in("discussion_id", discussionIds)
                .neq("user_id", user.id),
            ]),
            "Dashboard contribution signal summary"
          );

          if (receivedRepliesResult.error) throw receivedRepliesResult.error;
          if (readerSavesResult.error) throw readerSavesResult.error;

          repliesReceived = receivedRepliesResult.count ?? 0;
          savedByReaders = readerSavesResult.count ?? 0;
          replyRows = (receivedRepliesResult.data ?? []) as { discussion_id: string }[];
          bookmarkRows = (readerSavesResult.data ?? []) as { discussion_id: string }[];
        }

        const topicMap: Record<string, DashboardTopicSignal> = {};
        const topicByDiscussionId = new Map<string, string>();

        for (const discussion of discussionRows) {
          const topic = discussion.topic?.trim();
          if (!topic) continue;

          topicByDiscussionId.set(discussion.id, topic);
          topicMap[topic] ??= {
            topic,
            discussions: 0,
            repliesReceived: 0,
            savedByReaders: 0,
            resolved: 0,
          };

          topicMap[topic].discussions += 1;
          if (discussion.discussion_status === "resolved") {
            topicMap[topic].resolved += 1;
          }
        }

        for (const row of replyRows) {
          const topic = topicByDiscussionId.get(row.discussion_id);
          if (topic && topicMap[topic]) topicMap[topic].repliesReceived += 1;
        }

        for (const row of bookmarkRows) {
          const topic = topicByDiscussionId.get(row.discussion_id);
          if (topic && topicMap[topic]) topicMap[topic].savedByReaders += 1;
        }

        const nextTopicSignals = Object.values(topicMap)
          .sort((a, b) => {
            const scoreA =
              a.discussions * 3 + a.repliesReceived * 2 + a.savedByReaders * 3 + a.resolved * 2;
            const scoreB =
              b.discussions * 3 + b.repliesReceived * 2 + b.savedByReaders * 3 + b.resolved * 2;
            return scoreB - scoreA || a.topic.localeCompare(b.topic);
          })
          .slice(0, 6);

        if (!mounted) return;

        setProfile((profileResult.data as DashboardProfile | null) ?? null);
        setRecentDiscussions(discussionRows.slice(0, 4));
        setPurposeGoals((goalsResult.data ?? []) as DashboardPurposeGoal[]);
        setAiEntitlement(
          (entitlementResult.data as DashboardAiEntitlement | null) ?? null
        );
        setTopicSignals(nextTopicSignals);
        setCounts({
          discussions: discussionsResult.count ?? 0,
          replies: repliesResult.count ?? 0,
          saved: savedResult.count ?? 0,
          unreadNotifications: visibleUnreadNotifications.length,
          topicsContributed: Object.keys(topicMap).length,
          savedByReaders,
          repliesReceived,
          resolvedDiscussions: discussionRows.filter(
            (discussion) => discussion.discussion_status === "resolved"
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

  const missingProfileFields = useMemo(
    () => getMissingProfileFields(profile),
    [profile]
  );
  const profileCompletionPercent = Math.round(
    ((4 - missingProfileFields.length) / 4) * 100
  );
  const profileComplete = missingProfileFields.length === 0;
  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const aiUsageLabel = getAiUsageLabel(aiEntitlement);

  const attentionItems = useMemo(() => {
    const items: DashboardAction[] = [];

    if (!profileComplete) {
      items.push({
        title: "Finish your member foundation",
        description: `Add your ${missingProfileFields.join(", ")} so people have clearer context behind your contributions.`,
        href: "/onboarding",
        action: "Continue onboarding",
        tone: "foundation",
      });
    }

    if (counts.unreadNotifications > 0) {
      items.push({
        title: "Review current attention",
        description: `You have ${counts.unreadNotifications} unread notification${counts.unreadNotifications === 1 ? "" : "s"} waiting for review.`,
        href: "/notifications",
        action: "Open notifications",
        tone: "attention",
      });
    }

    if (counts.discussions === 0) {
      items.push({
        title: "Start your first signal thread",
        description: "Create one clear discussion that gives other members something substantive to build on.",
        href: "/create",
        action: "Create discussion",
        tone: "foundation",
      });
    }

    if (counts.replies === 0) {
      items.push({
        title: "Add one useful reply",
        description: "Participate in an existing discussion with context, evidence, experience, or a serious counterpoint.",
        href: "/discussions",
        action: "Find a discussion",
        tone: "growth",
      });
    }

    if (counts.saved === 0) {
      items.push({
        title: "Save something worth revisiting",
        description: "Build your private knowledge path by saving one discussion that deserves a second look.",
        href: "/discussions",
        action: "Browse discussions",
        tone: "growth",
      });
    }

    if (items.length === 0) {
      items.push({
        title: "Your dashboard is clear",
        description: "Your foundation is complete and no immediate account action is required. Continue where your signal is strongest.",
        href: "/discussions",
        action: "Explore discussions",
        tone: "steady",
      });
    }

    return items.slice(0, 4);
  }, [counts, missingProfileFields, profileComplete]);

  const topNextAction = attentionItems[0];

  const metrics: DashboardMetric[] = [
    {
      label: "Discussions started",
      value: counts.discussions,
      description: "Original threads you have contributed.",
      href: "/my-discussions",
    },
    {
      label: "Replies contributed",
      value: counts.replies,
      description: "Responses you have added across Loombus.",
      href: "/my-replies",
    },
    {
      label: "Replies received",
      value: counts.repliesReceived,
      description: "Responses other members added to your threads.",
      href: "/my-discussions",
    },
    {
      label: "Saved by readers",
      value: counts.savedByReaders,
      description: "Times readers saved discussions you started.",
      href: "/my-discussions",
    },
  ];

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? null;

    if (!accessToken) window.location.href = "/login";
    return accessToken;
  }

  async function createPurposeGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalMessage("");

    const cleanTitle = goalTitle.trim();
    if (!cleanTitle) {
      setGoalMessage("Enter a private goal title.");
      return;
    }

    if (goalWorking) return;
    setGoalWorking(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch("/api/purpose-goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          purposeLane: goalPurposeLane || null,
          privateNote: goalPrivateNote,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGoalMessage(result.error ?? "Unable to create private goal.");
        return;
      }

      const goal = result.goal as DashboardPurposeGoal;
      setPurposeGoals((current) => [goal, ...current].slice(0, 8));
      setGoalTitle("");
      setGoalPurposeLane("");
      setGoalPrivateNote("");
      setGoalMessage("Private goal created.");
    } catch {
      setGoalMessage("Unable to create private goal.");
    } finally {
      setGoalWorking(false);
    }
  }

  async function updatePurposeGoalStatus(
    goalId: string,
    status: DashboardPurposeGoalStatus
  ) {
    if (updatingGoalId) return;
    setUpdatingGoalId(goalId);
    setGoalMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch("/api/purpose-goals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ goalId, status }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGoalMessage(result.error ?? "Unable to update private goal.");
        return;
      }

      const goal = result.goal as DashboardPurposeGoal;
      setPurposeGoals((current) =>
        current.map((item) => (item.id === goal.id ? goal : item))
      );
      setGoalMessage("Private goal updated.");
    } catch {
      setGoalMessage("Unable to update private goal.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  async function deletePurposeGoal(goalId: string) {
    if (updatingGoalId) return;

    const goal = purposeGoals.find((item) => item.id === goalId);
    const confirmed = window.confirm(
      `Delete${goal?.title ? ` “${goal.title}”` : " this private goal"}? This cannot be undone.`
    );
    if (!confirmed) return;

    setUpdatingGoalId(goalId);
    setGoalMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch("/api/purpose-goals", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ goalId }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGoalMessage(result.error ?? "Unable to delete private goal.");
        return;
      }

      setPurposeGoals((current) => current.filter((item) => item.id !== goalId));
      setGoalMessage("Private goal deleted.");
    } catch {
      setGoalMessage("Unable to delete private goal.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  if (loading) {
    return (
      <main className="dashboard-v2-page">
        <WelcomeEmailTrigger />
        <div className="dashboard-v2-shell dashboard-v2-loading-shell" aria-live="polite">
          <div className="dashboard-v2-loading-hero" />
          <div className="dashboard-v2-loading-grid">
            <div />
            <div />
            <div />
            <div />
          </div>
          <p>Loading dashboard…</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="dashboard-v2-page">
        <div className="dashboard-v2-shell">
          <section className="dashboard-v2-error-card">
            <span><RefreshCw aria-hidden="true" size={22} /></span>
            <p className="dashboard-v2-eyebrow">Dashboard unavailable</p>
            <h1>Your dashboard could not load.</h1>
            <p>{loadError}</p>
            <button type="button" onClick={() => window.location.reload()}>
              Reload dashboard
            </button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-v2-page">
      <WelcomeEmailTrigger />
      <div className="dashboard-v2-shell">
        <section className="dashboard-v2-hero">
          <div className="dashboard-v2-hero-copy">
            <p className="dashboard-v2-eyebrow">Dashboard</p>
            <h1>
              {getGreetingLabel()}, {getDashboardName(profile, email)}.
            </h1>
            <p className="dashboard-v2-hero-description">
              This is your private Loombus command center: what needs attention, where your contributions are landing, and what deserves your next move.
            </p>
            <div className="dashboard-v2-hero-actions">
              <Link href={topNextAction.href} className="dashboard-v2-button dashboard-v2-button-primary">
                {topNextAction.action}
                <ArrowRight aria-hidden="true" size={17} />
              </Link>
              <Link href="/discussions" className="dashboard-v2-button dashboard-v2-button-quiet">
                Browse discussions
              </Link>
            </div>
            <div className="dashboard-v2-hero-next">
              <span>Recommended next</span>
              <strong>{topNextAction.title}</strong>
              <p>{topNextAction.description}</p>
            </div>
          </div>

          <aside className="dashboard-v2-member-card">
            <div className="dashboard-v2-member-profile">
              <ProfileAvatar
                profile={{
                  avatar_url: profile?.avatar_url ?? null,
                  full_name: profile?.full_name ?? null,
                  username: profile?.username ?? null,
                }}
                size="lg"
              />
              <div>
                <strong>{profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member"}</strong>
                <span>{profile?.username ? `@${profile.username}` : email ?? "Profile incomplete"}</span>
              </div>
            </div>

            <div className="dashboard-v2-completion">
              <div>
                <span>Profile completion</span>
                <strong>{profileCompletionPercent}%</strong>
              </div>
              <div className="dashboard-v2-progress-track" aria-hidden="true">
                <span style={{ width: `${profileCompletionPercent}%` }} />
              </div>
              {!profileComplete ? (
                <Link href="/onboarding">
                  Continue onboarding
                  <ArrowRight aria-hidden="true" size={14} />
                </Link>
              ) : (
                <span className="dashboard-v2-complete-label">Member foundation complete</span>
              )}
            </div>

            <dl className="dashboard-v2-member-facts">
              <div>
                <dt>Plan</dt>
                <dd>{subscriptionDisplay.label}</dd>
              </div>
              <div>
                <dt>AI access</dt>
                <dd>{aiUsageLabel}</dd>
              </div>
              <div>
                <dt>Topics</dt>
                <dd>{counts.topicsContributed}</dd>
              </div>
              <div>
                <dt>Resolved</dt>
                <dd>{counts.resolvedDiscussions}</dd>
              </div>
            </dl>
          </aside>
        </section>

        <section className="dashboard-v2-section">
          <DashboardSectionHeading
            eyebrow="Attention center"
            title="Handle what matters before adding more noise."
            description="These recommendations come from your actual profile, notifications, discussions, replies, and saved activity."
            action={{ href: "/notifications", label: "All notifications" }}
          />
          <div className="dashboard-v2-attention-grid">
            {attentionItems.map((item) => (
              <DashboardAttentionCard key={item.title} item={item} />
            ))}
          </div>
        </section>

        <section className="dashboard-v2-section">
          <DashboardSectionHeading
            eyebrow="Contribution snapshot"
            title="Your signal at a glance."
            description="Activity measures what you contributed. Reader response shows what other members did with it."
            action={{ href: "/my-activity", label: "Open my activity" }}
          />
          <div className="dashboard-v2-metric-grid">
            {metrics.map((metric) => (
              <DashboardMetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>

        <section className="dashboard-v2-section">
          <DashboardSectionHeading
            eyebrow="Quick return"
            title="Move directly to the work."
            description="Create, respond, organize, or continue reading without searching through the platform."
          />
          <div className="dashboard-v2-quick-grid">
            <DashboardQuickAction
              title="Create"
              description="Start a focused discussion with a clear purpose."
              href="/create"
              label="Open composer"
              icon={Edit3}
              stat={`${counts.discussions} started`}
            />
            <DashboardQuickAction
              title="Reply"
              description="Find a discussion where your perspective adds substance."
              href="/discussions"
              label="Browse discussions"
              icon={MessageSquareReply}
              stat={`${counts.replies} replies`}
            />
            <DashboardQuickAction
              title="Saved"
              description="Return to discussions, folders, and private notes."
              href="/saved"
              label="Open saved"
              icon={Bookmark}
              stat={`${counts.saved} saved`}
            />
            <DashboardQuickAction
              title="Messages"
              description="Continue a private conversation with a mutual follower."
              href="/messages"
              label="Open messages"
              icon={MessageCircle}
            />
            <DashboardQuickAction
              title="Reading history"
              description="Reopen discussions you recently viewed."
              href="/reading-history"
              label="Continue reading"
              icon={BookOpen}
            />
            <DashboardQuickAction
              title="People"
              description="Find contributors through the substance of their work."
              href="/people"
              label="Browse people"
              icon={Compass}
            />
          </div>
        </section>

        <div className="dashboard-v2-workspace-grid">
          <section className="dashboard-v2-panel dashboard-v2-goals-panel">
            <DashboardSectionHeading
              eyebrow="Private goals"
              title="What are you building toward?"
              description="Goals stay private and can be paused, completed, reopened, or deleted."
            />

            <form onSubmit={createPurposeGoal} className="dashboard-v2-goal-form">
              <div className="dashboard-v2-goal-form-row">
                <label>
                  <span>Goal title</span>
                  <input
                    type="text"
                    value={goalTitle}
                    onChange={(event) => setGoalTitle(event.target.value)}
                    maxLength={120}
                    placeholder="Example: Build a stronger AI reading path"
                  />
                </label>
                <label>
                  <span>Purpose lane</span>
                  <select
                    value={goalPurposeLane}
                    onChange={(event) => setGoalPurposeLane(event.target.value)}
                  >
                    <option value="">No Purpose Lane</option>
                    {PURPOSE_LANES.map((lane) => (
                      <option key={lane} value={lane}>{lane}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Private note</span>
                <textarea
                  value={goalPrivateNote}
                  onChange={(event) => setGoalPrivateNote(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Why this matters, what you may do next, or what progress would look like."
                />
              </label>
              <div className="dashboard-v2-goal-form-actions">
                <button type="submit" disabled={goalWorking}>
                  <Target aria-hidden="true" size={16} />
                  {goalWorking ? "Creating…" : "Create private goal"}
                </button>
                {goalMessage ? <p role="status">{goalMessage}</p> : null}
              </div>
            </form>

            {purposeGoals.length > 0 ? (
              <div className="dashboard-v2-goal-grid">
                {purposeGoals.map((goal) => (
                  <DashboardGoalCard
                    key={goal.id}
                    goal={goal}
                    working={updatingGoalId === goal.id}
                    onStatusChange={updatePurposeGoalStatus}
                    onDelete={deletePurposeGoal}
                  />
                ))}
              </div>
            ) : (
              <DashboardEmptyState
                icon={Target}
                title="No private goals yet"
                description="Create one concrete goal to give your reading, contribution, or community activity a direction."
                href="#"
                action="Use the form above"
              />
            )}
          </section>

          <aside className="dashboard-v2-side-stack">
            <section className="dashboard-v2-panel dashboard-v2-account-panel">
              <DashboardSectionHeading
                eyebrow="Account"
                title="Plan and tools"
                description={subscriptionDisplay.description}
              />
              <div className="dashboard-v2-plan-card">
                <span><Sparkles aria-hidden="true" size={18} /></span>
                <div>
                  <strong>{subscriptionDisplay.badge}</strong>
                  <p>{aiUsageLabel}</p>
                </div>
              </div>
              <div className="dashboard-v2-account-links">
                <Link href={subscriptionDisplay.href}>
                  {subscriptionDisplay.nextAction}
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
                <Link href="/ai-usage">
                  Review AI usage
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
                <Link href="/settings">
                  Account settings
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            </section>

            <section className="dashboard-v2-panel dashboard-v2-library-panel">
              <DashboardSectionHeading
                eyebrow="Knowledge"
                title="Your private return path"
                description="Saved items, Stickies, and history help useful discussions become working knowledge."
              />
              <div className="dashboard-v2-library-links">
                <Link href="/saved">
                  <span><FolderOpen aria-hidden="true" size={18} /></span>
                  <div><strong>{counts.saved} saved</strong><p>Folders, notes, and bookmarks</p></div>
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
                <Link href="/stickies">
                  <span><Bookmark aria-hidden="true" size={18} /></span>
                  <div><strong>Signal Board</strong><p>Pinned ideas and working reminders</p></div>
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
                <Link href="/reading-history">
                  <span><BookOpen aria-hidden="true" size={18} /></span>
                  <div><strong>Reading history</strong><p>Recently viewed discussions</p></div>
                  <ArrowRight aria-hidden="true" size={15} />
                </Link>
              </div>
            </section>
          </aside>
        </div>

        <section className="dashboard-v2-section">
          <DashboardSectionHeading
            eyebrow="Topic performance"
            title="Where your contribution is producing response."
            description="Topic signal combines your discussions, replies received, reader saves, and resolved threads."
            action={{ href: "/my-discussions", label: "All my discussions" }}
          />
          {topicSignals.length > 0 ? (
            <div className="dashboard-v2-topic-grid">
              {topicSignals.map((signal) => (
                <DashboardTopicCard key={signal.topic} signal={signal} />
              ))}
            </div>
          ) : (
            <DashboardEmptyState
              icon={Search}
              title="No topic signal yet"
              description="Start a discussion in a focused topic lane. Reader response will appear here as the thread develops."
              href="/create"
              action="Create a discussion"
            />
          )}
        </section>

        <section className="dashboard-v2-section">
          <DashboardSectionHeading
            eyebrow="Recent threads"
            title="Return to what you started."
            description="Your latest discussions remain close so open questions do not disappear into the feed."
            action={{ href: "/my-discussions", label: "View all" }}
          />
          {recentDiscussions.length > 0 ? (
            <div className="dashboard-v2-discussion-grid">
              {recentDiscussions.map((discussion) => (
                <DashboardDiscussionCard key={discussion.id} discussion={discussion} />
              ))}
            </div>
          ) : (
            <DashboardEmptyState
              icon={Edit3}
              title="You have not started a discussion"
              description="Create one specific question, claim, or problem that invites thoughtful replies."
              href="/create"
              action="Start your first discussion"
            />
          )}
        </section>

        {!profileComplete ? (
          <section className="dashboard-v2-onboarding-card">
            <span><UserRound aria-hidden="true" size={22} /></span>
            <div>
              <p className="dashboard-v2-eyebrow">Onboarding incomplete</p>
              <h2>Finish the foundation behind your signal.</h2>
              <p>
                Your dashboard will remain available, but completing your profile makes discussions, replies, follows, and messages easier for other members to trust.
              </p>
            </div>
            <Link href="/onboarding">
              Continue onboarding
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </section>
        ) : null}
      </div>
    </main>
  );
}
