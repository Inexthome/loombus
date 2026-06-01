"use client";

import { ProgressiveGuide } from "@/components/progressive-guide";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
          ownedDiscussionError;

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

        if (ownedDiscussionIds.length > 0) {
          const [{ count: receivedReplyCount }, { count: readerSaveCount }] =
            await withDashboardTimeout(Promise.all([
              supabase
                .from("replies")
                .select("*", { count: "exact", head: true })
                .in("discussion_id", ownedDiscussionIds)
                .neq("user_id", data.user.id)
                .is("deleted_at", null),

              supabase
                .from("bookmarks")
                .select("*", { count: "exact", head: true })
                .in("discussion_id", ownedDiscussionIds)
                .neq("user_id", data.user.id),
            ]),
              "Dashboard contribution signal summary"
            );

          repliesReceived = receivedReplyCount ?? 0;
          savedByReaders = readerSaveCount ?? 0;
        }

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
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Dashboard
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
          Welcome to Loombus.
        </h1>

        <p className="mb-6 text-sm text-zinc-400 sm:text-base">
          Signed in as {email}
        </p>

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

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <div className="mb-4 flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Organization assistant
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                What to handle next.
              </h2>
            </div>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400">
              {organizationActions.length} actions
            </span>
          </div>

          <p className="mb-4 max-w-3xl text-sm leading-relaxed text-zinc-500">
            A lightweight organization layer based on your profile, activity, saved discussions, and notifications. It suggests next actions but never acts for you.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {organizationActions.map((item) => (
              <OrganizationActionCard key={item.title} item={item} />
            ))}
          </div>
        </section>

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
                Contribution signals
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                Your private contribution snapshot.
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
