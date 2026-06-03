"use client";

import { ProgressiveGuide } from "@/components/progressive-guide";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { ProfileAvatar } from "@/components/profile-avatar";

type Notification = {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string;
  target_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NotificationFilter = "all" | "unread" | "read";
type NotificationTypeFilter =
  | "all"
  | "reply"
  | "mention"
  | "follow"
  | "followed_discussion"
  | "followed_reply";
type NotificationSortMode = "newest" | "oldest";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

function hasAdvancedNotificationAccess(
  entitlement: AiEntitlement,
  isAdmin: boolean
) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function getProfileName(profile: Profile | undefined) {
  return profile?.full_name || profile?.username || "Someone";
}

function getNotificationMessage(
  notification: Notification,
  profiles: Record<string, Profile>
) {
  const actorProfile = notification.actor_id
    ? profiles[notification.actor_id]
    : undefined;

  if (notification.type === "follow") {
    return `${getProfileName(actorProfile)} followed you.`;
  }

  return notification.message;
}

function getNotificationHref(
  notification: Notification,
  profiles: Record<string, Profile>
) {
  if (notification.target_type === "discussion" && notification.target_id) {
    return `/discussions/${notification.target_id}`;
  }

  if (notification.target_type === "identity_verification") {
    return "/profile";
  }

  if (notification.target_type === "profile") {
    const actorProfile = notification.actor_id
      ? profiles[notification.actor_id]
      : undefined;

    if (actorProfile?.username) {
      return `/u/${actorProfile.username}`;
    }
  }

  return null;
}

function getNotificationActionLabel(notification: Notification) {
  if (notification.target_type === "discussion") {
    return "Open discussion";
  }

  if (notification.target_type === "identity_verification") {
    return "Open verification";
  }

  if (notification.target_type === "profile") {
    return "Open profile";
  }

  return "Open";
}

export default function NotificationsClientPage() {
  const [alerts, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<NotificationFilter>("all");
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("all");
  const [sortMode, setSortMode] = useState<NotificationSortMode>("newest");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const loadingRef = useRef(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const canUseAdvancedControls = hasAdvancedNotificationAccess(
    aiEntitlement,
    isAdmin
  );

  async function markNotificationIdsRead(ids: string[], userId: string) {
    if (ids.length === 0) {
      return true;
    }

    const readAt = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .in("id", ids)
      .is("read_at", null);

    if (error) {
      setMessage("Unable to mark alerts as read.");
      return false;
    }

    setNotifications((current) =>
      current.map((notification) =>
        ids.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    );

    window.dispatchEvent(new Event("loombus:notifications-changed"));
    return true;
  }

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!loadingRef.current) {
        return;
      }

      setMessage((current) =>
        current || "Alerts took too long to load. Please refresh if the list looks incomplete."
      );
      setLoading(false);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadActorProfiles(actorIds: string[]) {
      if (actorIds.length === 0) {
        return;
      }

      try {
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", actorIds);

        if (error) {
          throw error;
        }

        if (!isMounted) {
          return;
        }

        const profileMap: Record<string, Profile> = {};

        for (const profile of profileData ?? []) {
          profileMap[profile.id] = profile;
        }

        setProfiles(profileMap);
      } catch (error) {
        console.error("Unable to load notification actor profiles.", error);
      }
    }

    async function loadNotifications() {
      try {
        const { data: userData } = await supabase.auth.getUser();

        if (!userData.user) {
          window.location.href = "/login";
          return;
        }

        const userId = userData.user.id;

        if (!isMounted) {
          return;
        }

        setCurrentUserId(userId);

        const [
          profileResult,
          entitlementResult,
          blockedRelationshipUserIds,
          alertsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", userId)
            .maybeSingle(),
          getBlockedRelationshipUserIds(supabase, userId),
          supabase
            .from("notifications")
            .select("id, actor_id, type, target_type, target_id, message, read_at, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        const firstError =
          profileResult.error || entitlementResult.error || alertsResult.error;

        if (firstError) {
          throw firstError;
        }

        if (!isMounted) {
          return;
        }

        setIsAdmin(Boolean(profileResult.data?.is_admin));
        setAiEntitlement((entitlementResult.data ?? null) as AiEntitlement);

        const loadedNotifications = filterBlockedActorNotifications(
          (alertsResult.data ?? []) as Notification[],
          blockedRelationshipUserIds
        );

        setNotifications(loadedNotifications);
        setLoading(false);

        const actorIds = [
          ...new Set(
            loadedNotifications
              .map((notification) => notification.actor_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];

        void loadActorProfiles(actorIds);
      } catch (error) {
        console.error("Unable to load alerts.", error);

        if (isMounted) {
          setMessage("Alerts could not load. Please refresh and try again.");
          setLoading(false);
        }
      }
    }

    loadNotifications();

    return () => {
      isMounted = false;
    };
  }, []);

  async function markRead(id: string) {
    if (!currentUserId) {
      return;
    }

    setMessage("");
    await markNotificationIdsRead([id], currentUserId);
  }

  async function openNotification(notification: Notification, href: string) {
    if (!currentUserId) {
      window.location.href = href;
      return;
    }

    setMessage("");

    if (!notification.read_at) {
      await markNotificationIdsRead([notification.id], currentUserId);
    }

    window.location.href = href;
  }

  async function deleteNotification(id: string) {
    if (!currentUserId || working) {
      return;
    }

    setMessage("");
    setWorking(true);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", currentUserId)
      .eq("id", id);

    setWorking(false);

    if (error) {
      setMessage("Unable to delete notification.");
      return;
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== id)
    );

    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function markAllRead() {
    if (!currentUserId || working) {
      return;
    }

    const unreadIds = alerts
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) {
      setMessage("No unread alerts to mark read.");
      return;
    }

    setMessage("");
    setWorking(true);

    const success = await markNotificationIdsRead(unreadIds, currentUserId);

    setWorking(false);

    if (success) {
      setMessage("All unread alerts marked read.");
    }
  }

  async function clearReadNotifications() {
    if (!currentUserId || working) {
      return;
    }

    const readIds = alerts
      .filter((notification) => notification.read_at)
      .map((notification) => notification.id);

    if (readIds.length === 0) {
      setMessage("No read alerts to clear.");
      return;
    }

    setMessage("");
    setWorking(true);

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", currentUserId)
      .in("id", readIds);

    setWorking(false);

    if (error) {
      setMessage("Unable to clear read notifications.");
      return;
    }

    setNotifications((current) =>
      current.filter((notification) => !readIds.includes(notification.id))
    );

    setMessage("Read alerts cleared.");
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  const unreadCount = alerts.filter(
    (notification) => !notification.read_at
  ).length;

  const readCount = alerts.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    const activeTypeFilter = canUseAdvancedControls ? typeFilter : "all";
    const activeSortMode = canUseAdvancedControls ? sortMode : "newest";

    const filtered = alerts.filter((notification) => {
      if (filterMode === "unread" && notification.read_at) {
        return false;
      }

      if (filterMode === "read" && !notification.read_at) {
        return false;
      }

      if (
        activeTypeFilter !== "all" &&
        notification.type !== activeTypeFilter
      ) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();

      return activeSortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [
    alerts,
    filterMode,
    typeFilter,
    sortMode,
    canUseAdvancedControls,
  ]);

  const filterOptions: {
    label: string;
    value: NotificationFilter;
    count: number;
  }[] = [
    {
      label: "All",
      value: "all",
      count: alerts.length,
    },
    {
      label: "Unread",
      value: "unread",
      count: unreadCount,
    },
    {
      label: "Read",
      value: "read",
      count: readCount,
    },
  ];

  function showAllAlerts() {
    setFilterMode("all");
    setTypeFilter("all");
    setSortMode("newest");
  }

  function showUnreadAlerts() {
    setFilterMode("unread");
    setTypeFilter("all");
    setSortMode("newest");
  }

  function showTypeAlerts(type: NotificationTypeFilter) {
    setFilterMode("all");
    setTypeFilter(type);
    setSortMode("newest");
  }

  const activeMobileAlertsView =
    filterMode === "unread"
      ? "Unread"
      : canUseAdvancedControls && typeFilter === "reply"
        ? "Replies"
        : canUseAdvancedControls && typeFilter === "follow"
          ? "Follows"
          : canUseAdvancedControls && typeFilter === "mention"
            ? "Mentions"
            : "All alerts";

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-10 lg:py-12 loombus-shell-with-right-rail">
      <div className="mx-auto max-w-[46rem]">
        <div className="alerts-shell-grid">
          <div className="min-w-0">
        <section className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:mb-8 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Alerts
              </p>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
                Alerts inbox
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
                Updates from replies, follows, mentions, and conversations connected to you.
              </p>
            </div>

            {!loading && alerts.length > 0 && (
              <div className="flex flex-col gap-2 sm:items-end">
                <span className="rounded-full border border-zinc-800 px-4 py-2 text-center text-sm text-zinc-500">
                  {unreadCount === 0
                    ? "All caught up"
                    : `${unreadCount} unread`}
                </span>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={markAllRead}
                    disabled={working || unreadCount === 0}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-center text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    Mark all read
                  </button>

                  <button
                    onClick={clearReadNotifications}
                    disabled={working || readCount === 0}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-center text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    Clear read
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {!loading && alerts.length > 0 && (
          <section className="mb-4 xl:hidden">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Alerts tools rail">
              <button
                type="button"
                onClick={showAllAlerts}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  filterMode === "all" && typeFilter === "all"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                All
              </button>

              <button
                type="button"
                onClick={showUnreadAlerts}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  filterMode === "unread"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white"
                }`}
              >
                Unread
              </button>

              <button
                type="button"
                onClick={() => showTypeAlerts("reply")}
                disabled={!canUseAdvancedControls}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  canUseAdvancedControls && typeFilter === "reply"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                }`}
              >
                Replies
              </button>

              <button
                type="button"
                onClick={() => showTypeAlerts("follow")}
                disabled={!canUseAdvancedControls}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  canUseAdvancedControls && typeFilter === "follow"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                }`}
              >
                Follows
              </button>

              <button
                type="button"
                onClick={() => showTypeAlerts("mention")}
                disabled={!canUseAdvancedControls}
                className={`shrink-0 rounded-full px-4 py-2.5 text-base transition ${
                  canUseAdvancedControls && typeFilter === "mention"
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-black/40 text-zinc-400 hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                }`}
              >
                Mentions
              </button>

              <Link
                href="/settings"
                className="shrink-0 rounded-full border border-zinc-800 bg-black/40 px-4 py-2.5 text-base text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                Settings
              </Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {activeMobileAlertsView}
              </span>

              <span className="rounded-full border border-zinc-900 bg-black px-3 py-1.5 text-xs text-zinc-600">
                {filteredNotifications.length} of {alerts.length} alerts
              </span>

              {!canUseAdvancedControls && (
                <Link
                  href="/premium"
                  className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                >
                  Unlock type filters
                </Link>
              )}
            </div>
          </section>
        )}

        <div className="hidden md:block">
          <ProgressiveGuide
          storageKey="loombus-guide-notifications-v1"
          eyebrow="Guide"
          title="Alerts guide"
          description="Reopen this when you want help managing alerts without distraction."
          collapsedClassName="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-6"
          defaultCollapsed
        >
        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Alerts guide
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Keep up without getting pulled off course.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Alerts help you return to replies, follows, and mentions that
            matter. Use unread status for what needs attention, then mark read or
            clear older items when they stop being useful.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Prioritize unread
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Start with unread alerts so you can respond to current activity first.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Open the source
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Use each notification as a path back to the discussion or profile that caused it.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Clean up read items
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Mark items read when handled, and clear read notifications when the list gets noisy.
              </p>
            </div>
          </div>
        </section>

          </ProgressiveGuide>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        {!loading && alerts.length > 0 && (
          <div className="mb-5 hidden grid-cols-3 gap-2 sm:mb-8 sm:flex sm:flex-wrap sm:gap-3 xl:flex">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterMode(option.value)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  filterMode === option.value
                    ? "bg-white text-black"
                    : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
                }`}
              >
                {option.label}
                <span className="ml-2 opacity-70">
                  {option.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {!loading && alerts.length > 0 && (
          <section className="mb-5 hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-4 sm:mb-8 sm:p-6 md:block">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                  Advanced notification controls
                </p>

                <h2 className="text-xl font-medium sm:text-2xl">
                  Filter alerts by signal
                </h2>
              </div>

              {!canUseAdvancedControls && (
                <Link
                  href="/premium"
                  className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                >
                  Unlock with Premium
                </Link>
              )}
            </div>

            <div className="mb-5">
              <p className="mb-3 text-sm text-zinc-500">
                Type filter
              </p>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                {[
                  ["all", "All types"],
                  ["reply", "Replies"],
                  ["mention", "Mentions"],
                  ["follow", "Follows"],
                  ["followed_discussion", "Followed discussions"],
                  ["followed_reply", "Followed replies"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value as NotificationTypeFilter)}
                    disabled={!canUseAdvancedControls && value !== "all"}
                    className={`rounded-full border px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${
                      typeFilter === value
                        ? "border-zinc-400 text-white"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                    } disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm text-zinc-500">
                Sort order
              </p>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                {[
                  ["newest", "Newest first"],
                  ["oldest", "Oldest first"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSortMode(value as NotificationSortMode)}
                    disabled={!canUseAdvancedControls && value !== "newest"}
                    className={`rounded-full border px-3 py-2 text-xs transition sm:px-4 sm:text-sm ${
                      sortMode === value
                        ? "border-zinc-400 text-white"
                        : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                    } disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-zinc-600">
              Premium controls let you isolate replies, mentions, follows, and
              review alerts from newest or oldest first.
            </p>
          </section>
        )}

        {loading && (
          <p className="text-sm leading-relaxed text-zinc-500 sm:text-base">
            Loading alerts...
          </p>
        )}

        {!loading && alerts.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              No alerts yet.
            </h2>

            <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:mb-6 sm:text-base">
              Alerts appear when people reply, mention you, follow you, or
              interact with activity connected to your contributions. The best way
              to make this page useful is to participate where people can respond.
            </p>

            <div className="mb-5 hidden gap-3 md:grid md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Start a discussion
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Create a focused thread so other members have something clear to reply to.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Join conversations
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  Reply with context, examples, experience, or a useful counterpoint.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="mb-2 text-sm font-medium text-zinc-300">
                  Make yourself recognizable
                </p>

                <p className="text-sm leading-relaxed text-zinc-600">
                  A complete profile helps people recognize and follow your contributions.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/create"
                className="inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Create a discussion
              </Link>

              <Link
                href="/discussions"
                className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Browse discussions
              </Link>

              <Link
                href="/profile"
                className="inline-flex justify-center rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                Review profile
              </Link>
            </div>
          </div>
        )}

        {!loading && alerts.length > 0 && filteredNotifications.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:rounded-3xl sm:p-8">
            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              No alerts found.
            </h2>

            <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:mb-6 sm:text-base">
              No alerts match the current filters. Broaden the view or
              return to all alerts to review everything connected to you.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setFilterMode("all");
                  setTypeFilter("all");
                  setSortMode("newest");
                }}
                className="inline-flex justify-center rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Clear filters
              </button>

              <Link
                href="/discussions"
                className="inline-flex justify-center rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Browse discussions
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-3 pb-4 sm:space-y-4 sm:pb-0">
          {filteredNotifications.map((notification) => {
            const href = getNotificationHref(notification, profiles);
            const actorProfile = notification.actor_id
              ? profiles[notification.actor_id]
              : undefined;

            return (
              <article
                key={notification.id}
                className={`group rounded-2xl border p-4 shadow-2xl shadow-black/15 transition hover:border-zinc-700 sm:p-5 ${
                  notification.read_at
                    ? "border-zinc-900 bg-zinc-950/80"
                    : "border-zinc-700 bg-zinc-950"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {!notification.read_at && (
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-black">
                      New
                    </span>
                  )}

                  <span className="rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500">
                    {notification.type}
                  </span>

                  <span className="ml-auto text-xs text-zinc-700">
                    {new Date(notification.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="mb-4 flex items-start gap-3">
                  <ProfileAvatar profile={actorProfile} size="md" />

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-relaxed sm:text-base ${
                      notification.read_at ? "text-zinc-500" : "text-zinc-300"
                    }`}>
                      {getNotificationMessage(notification, profiles)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-zinc-900 pt-4">
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Alert card action rail">
                    {href && (
                      <button
                        type="button"
                        onClick={() => openNotification(notification, href)}
                        className="shrink-0 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                      >
                        {getNotificationActionLabel(notification)}
                      </button>
                    )}

                    {!notification.read_at && (
                      <button
                        type="button"
                        onClick={() => markRead(notification.id)}
                        disabled={working}
                        className="shrink-0 rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        Mark read
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => deleteNotification(notification.id)}
                      disabled={working}
                      className="shrink-0 rounded-full border border-zinc-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-900 hover:bg-red-950/20 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
          </div>

          <aside className="loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl xl:block">
            <div className="space-y-4">
              <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
                <div className="border-b border-zinc-900 p-5">
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Alerts Panel
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight">
                    Attention without noise.
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Alerts should help you return to meaningful activity, not pull you away from deeper discussions.
                  </p>
                </div>

                <div className="grid grid-cols-3 border-b border-zinc-900">
                  <div className="border-r border-zinc-900 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Total
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {alerts.length}
                    </p>
                  </div>

                  <div className="border-r border-zinc-900 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Unread
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {unreadCount}
                    </p>
                  </div>

                  <div className="p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Read
                    </p>
                    <p className="mt-2 text-lg font-semibold text-zinc-200">
                      {readCount}
                    </p>
                  </div>
                </div>

                <div className="p-5">
                  <Link
                    href="/discussions"
                    className="inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                  >
                    Browse discussions
                  </Link>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Current inbox
                </p>

                <div className="space-y-2">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      View
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {filterMode}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Type
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {canUseAdvancedControls ? typeFilter : "all"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                      Sort
                    </p>
                    <p className="mt-1 text-sm text-zinc-300">
                      {canUseAdvancedControls ? sortMode : "newest"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Response standard
                </p>

                <div className="space-y-3 text-sm leading-relaxed text-zinc-500">
                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Open the source before reacting.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Reply when you can add context or clarity.
                  </p>

                  <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                    Mark read when the alert no longer needs attention.
                  </p>
                </div>
              </section>

              <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                  Quiet inbox
                </p>

                <p className="text-sm leading-relaxed text-zinc-500">
                  A useful alert inbox is not a place to live. Use it as a return path, then go back to reading, replying, saving, or creating.
                </p>

                <div className="mt-4 grid gap-2">
                  <Link
                    href="/settings"
                    className="inline-flex justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Alert settings
                  </Link>

                  <Link
                    href="/create"
                    className="inline-flex justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    Create discussion
                  </Link>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
