"use client";

import { ProgressiveGuide } from "@/components/progressive-guide";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { WelcomeEmailTrigger } from "@/components/welcome-email-trigger";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";
import { PURPOSE_LANES } from "@/lib/purpose-lanes";

type Profile = {
  full_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
};

type ActivityCounts = {
  discussions: number;
  replies: number;
  saved: number;
  unreadNotifications: number;
  topicsContributed: number;
  savedByReaders: number;
  repliesReceived: number;
  resolvedDiscussions: number;
};

type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
};

type OrganizationAction = {
  title: string;
  description: string;
  href: string;
  action: string;
  priority: "foundation" | "attention" | "growth";
};

type ContributionSignal = {
  label: string;
  value: number;
  description: string;
  href: string;
};

type TopicContributionSignal = {
  topic: string;
  discussions: number;
  repliesReceived: number;
  savedByReaders: number;
  resolved: number;
};

type ContributionFoundationItem = {
  label: string;
  status: string;
  description: string;
  href: string;
  action: string;
};

type PurposeGoalStatus = "active" | "paused" | "completed";

type PurposeGoal = {
  id: string;
  user_id: string;
  title: string;
  purpose_lane: string | null;
  private_note: string | null;
  status: PurposeGoalStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function getMissingProfileFields(profile: Profile | null) {
  const missing = [];

  if (!profile?.username?.trim()) {
    missing.push("username");
  }

  if (!profile?.full_name?.trim()) {
    missing.push("full name");
  }

  if (!profile?.bio?.trim()) {
    missing.push("bio");
  }

  if (!profile?.avatar_url?.trim()) {
    missing.push("profile image");
  }

  return missing;
}

function withDashboardTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 8000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out. Please reload the dashboard.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}


type MobileDashboardShellProps = {
  eyebrow: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  storageKey?: string;
  children: ReactNode;
};

function MobileDashboardShell({
  eyebrow,
  title,
  summary,
  defaultOpen = false,
  storageKey,
  children,
}: MobileDashboardShellProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(storageKey);

    if (stored === "open") {
      setOpen(true);
    }

    if (stored === "closed") {
      setOpen(false);
    }
  }, [storageKey]);

  function toggleOpen() {
    setOpen((current) => {
      const next = !current;

      if (storageKey && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, next ? "open" : "closed");
      }

      return next;
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:rounded-3xl sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500 sm:text-sm sm:tracking-[0.25em]">
            {eyebrow}
          </p>

          <h2 className="text-xl font-medium sm:text-3xl">
            {title}
          </h2>

          {summary && (
            <p className="mt-2 text-sm leading-relaxed text-zinc-500 sm:text-base">
              {summary}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={toggleOpen}
          className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:border-zinc-600 hover:text-white md:hidden"
          aria-expanded={open}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>

      <div className={open ? "block" : "hidden md:block"}>
        {children}
      </div>
    </section>
  );
}

function ContributionFoundationCard({ item }: { item: ContributionFoundationItem }) {
  return (
    <Link
      href={item.href}
      className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-zinc-200">
          {item.label}
        </h3>

        <span className="shrink-0 rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
          {item.status}
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-zinc-600">
        {item.description}
      </p>

      <span className="text-sm text-zinc-300">
        {item.action} →
      </span>
    </Link>
  );
}

function TopicContributionCard({ signal }: { signal: TopicContributionSignal }) {
  return (
    <Link
      href={`/discussions?topic=${encodeURIComponent(signal.topic)}`}
      className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-zinc-200">
          {signal.topic}
        </h3>

        <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
          topic
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-500">
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-2">
          <p className="text-zinc-600">Discussions</p>
          <p className="mt-1 text-base font-semibold text-zinc-200">
            {signal.discussions}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-2">
          <p className="text-zinc-600">Replies</p>
          <p className="mt-1 text-base font-semibold text-zinc-200">
            {signal.repliesReceived}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-2">
          <p className="text-zinc-600">Saves</p>
          <p className="mt-1 text-base font-semibold text-zinc-200">
            {signal.savedByReaders}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-2">
          <p className="text-zinc-600">Resolved</p>
          <p className="mt-1 text-base font-semibold text-zinc-200">
            {signal.resolved}
          </p>
        </div>
      </div>
    </Link>
  );
}

function ContributionSignalCard({ signal }: { signal: ContributionSignal }) {
  return (
    <Link
      href={signal.href}
      className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
    >
      <p className="mb-2 text-sm text-zinc-500">
        {signal.label}
      </p>

      <p className="mb-3 text-3xl font-semibold sm:text-4xl">
        {signal.value}
      </p>

      <p className="text-sm leading-relaxed text-zinc-600">
        {signal.description}
      </p>
    </Link>
  );
}

function OrganizationActionCard({ item }: { item: OrganizationAction }) {
  const priorityClass =
    item.priority === "foundation"
      ? "border-sky-900 text-sky-300"
      : item.priority === "attention"
        ? "border-amber-900 text-amber-300"
        : "border-emerald-900 text-emerald-300";

  return (
    <Link
      href={item.href}
      className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-zinc-200">
          {item.title}
        </h3>

        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${priorityClass}`}>
          {item.priority}
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-zinc-500">
        {item.description}
      </p>

      <span className="text-sm text-zinc-300">
        {item.action} →
      </span>
    </Link>
  );
}

export default function DashboardClientPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activityCounts, setActivityCounts] = useState<ActivityCounts>({
    discussions: 0,
    replies: 0,
    saved: 0,
    unreadNotifications: 0,
    topicsContributed: 0,
    savedByReaders: 0,
    repliesReceived: 0,
    resolvedDiscussions: 0,
  });
  const [topicContributionSignals, setTopicContributionSignals] = useState<TopicContributionSignal[]>([]);
  const [purposeGoals, setPurposeGoals] = useState<PurposeGoal[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalPurposeLane, setGoalPurposeLane] = useState("");
  const [goalPrivateNote, setGoalPrivateNote] = useState("");
  const [goalMessage, setGoalMessage] = useState("");
  const [goalWorking, setGoalWorking] = useState(false);
  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadUser() {
      setLoadError("");

      try {
        const { data, error: userError } = await withDashboardTimeout(
          supabase.auth.getUser(),
          "Dashboard authentication check"
        );

        if (userError) {
          throw userError;
        }

        if (!data.user) {
          window.location.replace("/login");
          return;
        }

        setEmail(data.user.email ?? null);

        const blockedRelationshipUserIds = await withDashboardTimeout(
          getBlockedRelationshipUserIds(
            supabase,
            data.user.id
          ),
          "Dashboard blocked-user check"
        );

        const [
          { data: profileData, error: profileError },
          { count: discussionCount, error: discussionError },
          { count: replyCount, error: replyError },
          { count: savedCount, error: savedError },
          { data: unreadNotificationData, error: notificationError },
          { data: entitlementData, error: entitlementError },
          { data: ownedDiscussionData, error: ownedDiscussionError },
          { data: purposeGoalData, error: purposeGoalError },
        ] = await withDashboardTimeout(Promise.all([
          supabase
            .from("profiles")
            .select("full_name, username, bio, avatar_url")
            .eq("id", data.user.id)
            .maybeSingle(),

          supabase
            .from("discussions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", data.user.id)
            .is("deleted_at", null),

          supabase
            .from("replies")
            .select("*", { count: "exact", head: true })
            .eq("user_id", data.user.id)
            .is("deleted_at", null),

          supabase
            .from("bookmarks")
            .select("*", { count: "exact", head: true })
            .eq("user_id", data.user.id),

          supabase
            .from("notifications")
            .select("id, actor_id")
            .eq("user_id", data.user.id)
            .is("read_at", null),

          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", data.user.id)
            .maybeSingle(),

          supabase
            .from("discussions")
            .select("id, topic, discussion_status")
            .eq("user_id", data.user.id)
            .is("deleted_at", null),

          supabase
            .from("user_purpose_goals")
            .select("id, user_id, title, purpose_lane, private_note, status, created_at, updated_at, completed_at")
            .eq("user_id", data.user.id)
            .order("updated_at", { ascending: false })
            .limit(6),
        ]),
          "Dashboard activity summary"
        );

        const firstError =
          profileError ||
          discussionError ||
          replyError ||
          savedError ||
          notificationError ||
          entitlementError ||
          ownedDiscussionError ||
          purposeGoalError;

        if (firstError) {
          throw firstError;
        }

        const visibleUnreadNotifications = filterBlockedActorNotifications(
          unreadNotificationData ?? [],
          blockedRelationshipUserIds
        );

        const ownedDiscussionRows = (ownedDiscussionData ?? []) as {
          id: string;
          topic: string | null;
          discussion_status: string | null;
        }[];

        const ownedDiscussionIds = ownedDiscussionRows.map((discussion) => discussion.id);

        let repliesReceived = 0;
        let savedByReaders = 0;
        let replyTopicRows: { discussion_id: string }[] = [];
        let saveTopicRows: { discussion_id: string }[] = [];

        if (ownedDiscussionIds.length > 0) {
          const [
            { count: receivedReplyCount, data: receivedReplyRows },
            { count: readerSaveCount, data: readerSaveRows },
          ] =
            await withDashboardTimeout(Promise.all([
              supabase
                .from("replies")
                .select("discussion_id", { count: "exact" })
                .in("discussion_id", ownedDiscussionIds)
                .neq("user_id", data.user.id)
                .is("deleted_at", null),

              supabase
                .from("bookmarks")
                .select("discussion_id", { count: "exact" })
                .in("discussion_id", ownedDiscussionIds)
                .neq("user_id", data.user.id),
            ]),
              "Dashboard contribution signal summary"
            );

          repliesReceived = receivedReplyCount ?? 0;
          savedByReaders = readerSaveCount ?? 0;
          replyTopicRows = (receivedReplyRows ?? []) as { discussion_id: string }[];
          saveTopicRows = (readerSaveRows ?? []) as { discussion_id: string }[];
        }

        const topicMap: Record<string, TopicContributionSignal> = {};
        const discussionTopicById = new Map<string, string>();

        for (const discussion of ownedDiscussionRows) {
          const topic = discussion.topic?.trim();

          if (!topic) {
            continue;
          }

          discussionTopicById.set(discussion.id, topic);

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

        for (const reply of replyTopicRows) {
          const topic = discussionTopicById.get(reply.discussion_id);

          if (topic && topicMap[topic]) {
            topicMap[topic].repliesReceived += 1;
          }
        }

        for (const save of saveTopicRows) {
          const topic = discussionTopicById.get(save.discussion_id);

          if (topic && topicMap[topic]) {
            topicMap[topic].savedByReaders += 1;
          }
        }

        const nextTopicContributionSignals = Object.values(topicMap)
          .sort((a, b) => {
            const signalA =
              a.discussions * 3 +
              a.repliesReceived * 2 +
              a.savedByReaders * 3 +
              a.resolved * 2;
            const signalB =
              b.discussions * 3 +
              b.repliesReceived * 2 +
              b.savedByReaders * 3 +
              b.resolved * 2;

            if (signalB !== signalA) {
              return signalB - signalA;
            }

            return a.topic.localeCompare(b.topic);
          })
          .slice(0, 6);

        setTopicContributionSignals(nextTopicContributionSignals);
        setPurposeGoals((purposeGoalData ?? []) as PurposeGoal[]);

        setProfile(profileData ?? null);
        setAiEntitlement(entitlementData ?? null);
        setActivityCounts({
          discussions: discussionCount ?? 0,
          replies: replyCount ?? 0,
          saved: savedCount ?? 0,
          unreadNotifications: visibleUnreadNotifications.length,
          topicsContributed: new Set(
            ownedDiscussionRows
              .map((discussion) => discussion.topic)
              .filter(Boolean)
          ).size,
          savedByReaders,
          repliesReceived,
          resolvedDiscussions: ownedDiscussionRows.filter(
            (discussion) => discussion.discussion_status === "resolved"
          ).length,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load dashboard.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  const missingProfileFields = useMemo(
    () => getMissingProfileFields(profile),
    [profile]
  );

  const totalProfileFields = 4;

  const profileCompletionPercent =
    Math.round(((totalProfileFields - missingProfileFields.length) / totalProfileFields) * 100);

  const profileComplete = missingProfileFields.length === 0;

  const subscriptionDisplay = getSubscriptionDisplay(aiEntitlement);
  const aiUsageLabel = getAiUsageLabel(aiEntitlement);

  const gettingStartedSteps = [
    {
      title: "Complete your profile",
      description: profileComplete
        ? "Your profile has the basics people need to recognize your contributions."
        : `Use the new member setup guide to add your ${missingProfileFields.join(", ")} and understand what to do next.`,
      href: profileComplete ? "/profile" : "/onboarding",
      action: profileComplete ? "Review profile" : "Open setup guide",
      complete: profileComplete,
    },
    {
      title: "Create your first discussion",
      description:
        activityCounts.discussions > 0
          ? "You have started contributing original discussions."
          : "Start with one clear question, claim, or idea that invites thoughtful replies.",
      href: "/create",
      action: activityCounts.discussions > 0 ? "Create another" : "Create discussion",
      complete: activityCounts.discussions > 0,
    },
    {
      title: "Join a discussion",
      description:
        activityCounts.replies > 0
          ? "You have replied to an existing discussion."
          : "Reply to one discussion with context, evidence, or a useful perspective.",
      href: "/discussions",
      action: activityCounts.replies > 0 ? "Browse discussions" : "Find a discussion",
      complete: activityCounts.replies > 0,
    },
    {
      title: "Save something worth revisiting",
      description:
        activityCounts.saved > 0
          ? "You have saved discussions for later."
          : "Use Save on discussions that are useful for future reading or research.",
      href: "/discussions",
      action: activityCounts.saved > 0 ? "Open saved" : "Explore discussions",
      complete: activityCounts.saved > 0,
    },
  ];

  const gettingStartedCompleteCount = gettingStartedSteps.filter(
    (step) => step.complete
  ).length;

  const contributionSignals: ContributionSignal[] = [
    {
      label: "Discussions started",
      value: activityCounts.discussions,
      description: "Original discussions you have contributed to Loombus.",
      href: "/my-discussions",
    },
    {
      label: "Replies contributed",
      value: activityCounts.replies,
      description: "Replies you have added to other conversations.",
      href: "/my-replies",
    },
    {
      label: "Topics contributed to",
      value: activityCounts.topicsContributed,
      description: "Distinct topic lanes where you have started discussions.",
      href: "/my-discussions",
    },
    {
      label: "Saved by readers",
      value: activityCounts.savedByReaders,
      description: "Times other members saved discussions you started.",
      href: "/my-discussions",
    },
    {
      label: "Replies received",
      value: activityCounts.repliesReceived,
      description: "Replies other members added to discussions you started.",
      href: "/my-discussions",
    },
    {
      label: "Resolved discussions",
      value: activityCounts.resolvedDiscussions,
      description: "Your discussions marked resolved after the thread developed.",
      href: "/my-discussions",
    },
  ];

  const contributionFoundationItems: ContributionFoundationItem[] = [
    {
      label: "Foundation",
      status: profileComplete ? "ready" : "needs setup",
      description: profileComplete
        ? "Your profile has the basic identity context people need when reading your contributions."
        : "Complete your profile so your contributions have clearer context behind them.",
      href: profileComplete ? "/profile" : "/onboarding",
      action: profileComplete ? "Review profile" : "Finish setup",
    },
    {
      label: "Participation",
      status: activityCounts.replies > 0 ? "active" : "not started",
      description: activityCounts.replies > 0
        ? "You are participating through replies, not only starting your own discussions."
        : "Add one thoughtful reply to begin building participation beyond your own posts.",
      href: activityCounts.replies > 0 ? "/my-replies" : "/discussions",
      action: activityCounts.replies > 0 ? "Review replies" : "Find a discussion",
    },
    {
      label: "Topic depth",
      status: `${activityCounts.topicsContributed} topic${activityCounts.topicsContributed === 1 ? "" : "s"}`,
      description: activityCounts.topicsContributed > 0
        ? "Your contribution footprint is forming across topic lanes."
        : "Start a focused discussion in one topic lane to begin forming topic depth.",
      href: activityCounts.topicsContributed > 0 ? "/my-discussions" : "/create",
      action: activityCounts.topicsContributed > 0 ? "View discussions" : "Create discussion",
    },
    {
      label: "Reader response",
      status: `${activityCounts.repliesReceived + activityCounts.savedByReaders} signal${activityCounts.repliesReceived + activityCounts.savedByReaders === 1 ? "" : "s"}`,
      description: activityCounts.repliesReceived + activityCounts.savedByReaders > 0
        ? "Other members have responded to or saved discussions you started."
        : "Reader response appears when other members reply to or save discussions you start.",
      href: "/my-discussions",
      action: "Review started threads",
    },
  ];

  const organizationActions: OrganizationAction[] = [
    !profileComplete
      ? {
          title: "Finish your member foundation",
          description: "Complete your profile so your discussions, replies, and follows have a clearer identity behind them.",
          href: "/onboarding",
          action: "Open setup guide",
          priority: "foundation",
        }
      : null,
    activityCounts.unreadNotifications > 0
      ? {
          title: "Clear current attention",
          description: `You have ${activityCounts.unreadNotifications} unread notification${activityCounts.unreadNotifications === 1 ? "" : "s"}. Handle those before starting more activity.`,
          href: "/notifications",
          action: "Review notifications",
          priority: "attention",
        }
      : null,
    activityCounts.saved > 0
      ? {
          title: "Continue your saved learning path",
          description: "Your saved discussions now include a private knowledge snapshot and learning path. Use it to decide what to revisit next.",
          href: "/saved",
          action: "Open saved",
          priority: "growth",
        }
      : {
          title: "Save one useful discussion",
          description: "Saving one strong discussion gives Loombus something to organize into your personal knowledge path.",
          href: "/discussions",
          action: "Find a discussion",
          priority: "growth",
        },
    activityCounts.discussions === 0
      ? {
          title: "Start your first signal thread",
          description: "Create one clear discussion that invites thoughtful replies instead of noise.",
          href: "/create",
          action: "Create discussion",
          priority: "foundation",
        }
      : null,
    activityCounts.replies === 0
      ? {
          title: "Add one useful reply",
          description: "A thoughtful reply helps you participate before starting too many new threads.",
          href: "/discussions",
          action: "Browse discussions",
          priority: "growth",
        }
      : null,
  ].filter((item): item is OrganizationAction => Boolean(item)).slice(0, 4);

  const primaryHomeActions = [
    {
      title: "Create",
      description: "Start a clear discussion.",
      href: "/create",
      action: "Start",
      stat: activityCounts.discussions,
      statLabel: "started",
    },
    {
      title: "Browse",
      description: "Find conversations worth reading.",
      href: "/discussions",
      action: "Explore",
      stat: activityCounts.replies,
      statLabel: "replies",
    },
    {
      title: "Saved",
      description: "Return to useful discussions.",
      href: "/saved",
      action: "Open",
      stat: activityCounts.saved,
      statLabel: "saved",
    },
  ];

  const topNextAction =
    organizationActions[0] ?? {
      title: "Keep building your Loombus signal",
      description: "Create, reply, save, or follow one useful thing today.",
      href: "/discussions",
      action: "Browse discussions",
      priority: "growth" as const,
    };

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return null;
    }

    return accessToken;
  }

  async function createPurposeGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGoalMessage("");

    if (goalWorking) {
      return;
    }

    const cleanTitle = goalTitle.trim();

    if (!cleanTitle) {
      setGoalMessage("Enter a private goal title.");
      return;
    }

    setGoalWorking(true);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

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

      const goal = result.goal as PurposeGoal;
      setPurposeGoals((current) => [goal, ...current].slice(0, 6));
      setGoalTitle("");
      setGoalPurposeLane("");
      setGoalPrivateNote("");
      setGoalMessage("Private goal created.");
    } finally {
      setGoalWorking(false);
    }
  }

  async function updatePurposeGoalStatus(goalId: string, status: PurposeGoalStatus) {
    setGoalMessage("");

    if (updatingGoalId) {
      return;
    }

    setUpdatingGoalId(goalId);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch("/api/purpose-goals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          goalId,
          status,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGoalMessage(result.error ?? "Unable to update private goal.");
        return;
      }

      const goal = result.goal as PurposeGoal;
      setPurposeGoals((current) =>
        current.map((item) => (item.id === goal.id ? goal : item))
      );
      setGoalMessage("Private goal updated.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  async function deletePurposeGoal(goalId: string) {
    setGoalMessage("");

    if (updatingGoalId) {
      return;
    }

    setUpdatingGoalId(goalId);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        return;
      }

      const response = await fetch("/api/purpose-goals", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          goalId,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setGoalMessage(result.error ?? "Unable to delete private goal.");
        return;
      }

      setPurposeGoals((current) => current.filter((item) => item.id !== goalId));
      setGoalMessage("Private goal deleted.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
      <WelcomeEmailTrigger />
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading dashboard...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
          <h1 className="mb-3 text-2xl font-medium">
            Dashboard could not load.
          </h1>

          <p className="mb-5 text-sm leading-relaxed text-zinc-500">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Reload dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
      <WelcomeEmailTrigger />
      <div className="mx-auto max-w-6xl">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Home
        </p>

        <MobileDashboardShell
          eyebrow="Home"
          title="What Matters Now"
          summary="Start, browse, or return to something useful. Loombus works best when the next step is clear."
          storageKey="loombus-dashboard-shell-what-matters-now-v1"
          defaultOpen
        >
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            {primaryHomeActions.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium text-zinc-100">
                      {item.title}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-600">
                      {item.description}
                    </p>
                  </div>

                  <span className="text-xs text-zinc-600">
                    {item.stat} {item.statLabel}
                  </span>
                </div>

                <span className="text-sm text-zinc-300">
                  {item.action} →
                </span>
              </Link>
            ))}
          </div>

          <Link
            href={topNextAction.href}
            className="block rounded-2xl border border-zinc-900 bg-black/40 p-4 transition hover:border-zinc-700"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Next step
                </p>

                <h2 className="text-base font-medium text-zinc-200">
                  {topNextAction.title}
                </h2>

                <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                  {topNextAction.description}
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-white px-4 py-2 text-sm text-black">
                {topNextAction.action}
              </span>
            </div>
          </Link>
        </MobileDashboardShell>

        <ProgressiveGuide
          storageKey="loombus-guide-dashboard-getting-started-v1"
          eyebrow="Guide"
          title="Getting started"
          description="Review your setup steps when you need them."
          collapsedClassName="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6"
          autoCollapse={gettingStartedCompleteCount === gettingStartedSteps.length}
        >
        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Getting started
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                Build your Loombus foundation.
              </h2>
            </div>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
              {gettingStartedCompleteCount}/{gettingStartedSteps.length} complete
            </span>
          </div>

          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
            A strong first setup helps other members understand who you are,
            what you contribute, and which discussions are worth returning to.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {gettingStartedSteps.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium sm:text-lg">
                    {step.title}
                  </h3>

                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs ${
                      step.complete
                        ? "border-emerald-900 text-emerald-400"
                        : "border-zinc-800 text-zinc-500"
                    }`}
                  >
                    {step.complete ? "Done" : "Next"}
                  </span>
                </div>

                <p className="mb-4 text-sm leading-relaxed text-zinc-500">
                  {step.description}
                </p>

                <span className="text-sm text-zinc-300">
                  {step.action} →
                </span>
              </Link>
            ))}
          </div>
        </section>

        </ProgressiveGuide>

        <MobileDashboardShell
          eyebrow="Next steps"
          title="What to handle next."
          summary={`A lightweight organization layer based on your profile, activity, saved discussions, and notifications. ${organizationActions.length} actions suggested.`}
          storageKey="loombus-dashboard-shell-next-steps-v1"
          defaultOpen
        >
          <div className="grid gap-4 md:grid-cols-2">
            {organizationActions.map((item) => (
              <OrganizationActionCard key={item.title} item={item} />
            ))}
          </div>
        </MobileDashboardShell>

        <MobileDashboardShell
          eyebrow="Private goals"
          title="What you want to build toward."
          summary="Private goals around learning, mastery, contribution, or community."
          storageKey="loombus-dashboard-shell-private-goals-v1"
        >
          <form onSubmit={createPurposeGoal} className="mb-5 rounded-2xl border border-zinc-900 bg-black/40 p-4">
            <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
              <input
                type="text"
                value={goalTitle}
                onChange={(event) => setGoalTitle(event.target.value)}
                maxLength={120}
                placeholder="Example: Build a stronger AI and work reading path"
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
              />

              <select
                value={goalPurposeLane}
                onChange={(event) => setGoalPurposeLane(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition focus:border-zinc-600"
              >
                <option value="">No Purpose Lane</option>
                {PURPOSE_LANES.map((lane) => (
                  <option key={lane} value={lane}>
                    {lane}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={goalPrivateNote}
              onChange={(event) => setGoalPrivateNote(event.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Optional private note: why this goal matters or what you may do next..."
              className="mt-3 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-zinc-600">
                {goalPrivateNote.length}/1000 characters
              </p>

              <button
                type="submit"
                disabled={goalWorking}
                className="w-full rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 sm:w-fit"
              >
                {goalWorking ? "Creating..." : "Create private goal"}
              </button>
            </div>
          </form>

          {goalMessage && (
            <p className="mb-4 text-sm text-zinc-500">
              {goalMessage}
            </p>
          )}

          {purposeGoals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {purposeGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-2xl border border-zinc-900 bg-black p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-medium text-zinc-200">
                      {goal.title}
                    </h3>

                    <span className="shrink-0 rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500">
                      {goal.status}
                    </span>
                  </div>

                  {goal.purpose_lane && (
                    <p className="mb-3 w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                      {goal.purpose_lane}
                    </p>
                  )}

                  {goal.private_note && (
                    <p className="mb-4 text-sm leading-relaxed text-zinc-600">
                      {goal.private_note}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {(["active", "paused", "completed"] as PurposeGoalStatus[]).map((status) => (
                      <button
                        key={`${goal.id}-${status}`}
                        type="button"
                        onClick={() => updatePurposeGoalStatus(goal.id, status)}
                        disabled={updatingGoalId === goal.id || goal.status === status}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {status}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => deletePurposeGoal(goal.id)}
                      disabled={updatingGoalId === goal.id}
                      className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-600">
              No private contribution goals yet. Add one goal to connect your activity to a direction.
            </p>
          )}
        </MobileDashboardShell>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Subscription
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                {subscriptionDisplay.label}
              </h2>
            </div>

            <span className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
              {subscriptionDisplay.badge}
            </span>
          </div>

          <p className="mb-3 leading-relaxed text-zinc-400">
            {subscriptionDisplay.description}
          </p>

          <p className="mb-5 text-sm text-zinc-500">
            Included AI usage: {aiUsageLabel}
          </p>

          <Link
            href={subscriptionDisplay.href}
            className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            {subscriptionDisplay.nextAction}
          </Link>
        </section>

        <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Profile setup
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                {profileComplete ? "Your public profile is complete." : "Complete your public profile."}
              </h2>
            </div>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
              {profileCompletionPercent}%
            </span>
          </div>

          <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${profileCompletionPercent}%` }}
            />
          </div>

          {!profileComplete ? (
            <>
              <p className="mb-5 leading-relaxed text-zinc-400">
                Add your {missingProfileFields.join(", ")} so other members know
                who they are reading and interacting with.
              </p>

              <Link
                href="/profile"
                className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Complete Profile
              </Link>
            </>
          ) : (
            <p className="text-sm text-zinc-400">
              Your profile is ready for people, mentions, follows, and discussion attribution.
            </p>
          )}
        </div>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Contribution basics
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                How your contribution base is forming.
              </h2>
            </div>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
              Private
            </span>
          </div>

          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
            This private view summarizes your contribution pattern without assigning a public score, rank, or expert label.
          </p>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {contributionFoundationItems.map((item) => (
              <ContributionFoundationCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Your activity signals
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                Your private activity snapshot.
              </h2>
            </div>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
              Private
            </span>
          </div>

          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
            These are private signals based on your discussions, replies, topics, saves, and resolved threads. They are not public scores or rankings.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {contributionSignals.map((signal) => (
              <ContributionSignalCard key={signal.label} signal={signal} />
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-zinc-900 bg-black/40 p-4 sm:p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Topic activity
                </p>

                <h3 className="text-lg font-medium text-zinc-200">
                  Where your contribution is forming.
                </h3>
              </div>

              <span className="w-fit rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                Private
              </span>
            </div>

            {topicContributionSignals.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {topicContributionSignals.map((signal) => (
                  <TopicContributionCard key={signal.topic} signal={signal} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-600">
                Start discussions in topic lanes to build private topic contribution signals.
              </p>
            )}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                My Activity
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                Your Loombus footprint
              </h2>
            </div>

            <Link
              href="/my-activity"
              className="text-sm text-zinc-400 transition hover:text-white"
            >
              View all activity →
            </Link>

            <Link
              href="/following"
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-zinc-600">
                Social Feed
              </p>

              <h2 className="mb-3 text-xl font-medium">
                Following Feed →
              </h2>

              <p className="text-sm leading-relaxed text-zinc-500">
                See discussions from the people you follow.
              </p>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/my-discussions"
              className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
            >
              <p className="mb-2 text-sm text-zinc-500">
                Discussions
              </p>

              <p className="text-3xl font-semibold sm:text-4xl">
                {activityCounts.discussions}
              </p>
            </Link>

            <Link
              href="/my-replies"
              className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
            >
              <p className="mb-2 text-sm text-zinc-500">
                Replies
              </p>

              <p className="text-3xl font-semibold sm:text-4xl">
                {activityCounts.replies}
              </p>
            </Link>

            <Link
              href="/saved"
              className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
            >
              <p className="mb-2 text-sm text-zinc-500">
                Saved
              </p>

              <p className="text-3xl font-semibold sm:text-4xl">
                {activityCounts.saved}
              </p>
            </Link>

            <Link
              href="/notifications"
              className="rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700 sm:p-5"
            >
              <p className="mb-2 text-sm text-zinc-500">
                Unread
              </p>

              <p className="text-3xl font-semibold sm:text-4xl">
                {activityCounts.unreadNotifications}
              </p>
            </Link>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <Link
            href="/discussions"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
          >
            <h2 className="mb-3 text-xl font-medium">Explore discussions</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Browse high-signal conversations and thoughtful contributions.
            </p>
          </Link>

          <Link
            href="/create"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
          >
            <h2 className="mb-3 text-xl font-medium">Create discussion</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Start a structured conversation around a meaningful idea.
            </p>
          </Link>

          <Link
            href="/ai-usage"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
          >
            <h2 className="mb-3 text-xl font-medium">AI usage</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Review your monthly AI activity, cached outputs, usage remaining,
              and recent AI-assisted actions.
            </p>
          </Link>

          <Link
            href="/settings"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
          >
            <h2 className="mb-3 text-xl font-medium">Settings</h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Manage your profile, activity, saved items, notifications, and platform links.
            </p>
          </Link>
        </div>

        <button
          onClick={handleLogout}
          className="mt-10 rounded-full border border-zinc-700 px-6 py-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
