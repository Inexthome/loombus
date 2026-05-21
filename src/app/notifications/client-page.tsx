"use client";

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
type NotificationTypeFilter = "all" | "reply" | "mention" | "follow";
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

  if (notification.target_type === "profile") {
    return "Open profile";
  }

  return "Open";
}

export default function NotificationsClientPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      setMessage("Unable to mark notifications as read.");
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
        current || "Notifications took too long to load. Please refresh if the list looks incomplete."
      );
      setLoading(false);
    }, 10000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    async function loadNotifications() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

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

      setIsAdmin(Boolean(profileData?.is_admin));
      setAiEntitlement((entitlementData ?? null) as AiEntitlement);

      const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(
        supabase,
        userData.user.id
      );

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      const loadedNotifications = filterBlockedActorNotifications(
        (data ?? []) as Notification[],
        blockedRelationshipUserIds
      );

      const actorIds = [
        ...new Set(
          loadedNotifications
            .map((notification) => notification.actor_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (actorIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", actorIds);

        const profileMap: Record<string, Profile> = {};

        for (const profile of profileData ?? []) {
          profileMap[profile.id] = profile;
        }

        setProfiles(profileMap);
      }

      setNotifications(loadedNotifications);
      setLoading(false);
    }

    loadNotifications();
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

    const unreadIds = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) {
      setMessage("No unread notifications to mark read.");
      return;
    }

    setMessage("");
    setWorking(true);

    const success = await markNotificationIdsRead(unreadIds, currentUserId);

    setWorking(false);

    if (success) {
      setMessage("All unread notifications marked read.");
    }
  }

  async function clearReadNotifications() {
    if (!currentUserId || working) {
      return;
    }

    const readIds = notifications
      .filter((notification) => notification.read_at)
      .map((notification) => notification.id);

    if (readIds.length === 0) {
      setMessage("No read notifications to clear.");
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

    setMessage("Read notifications cleared.");
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;

  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    const activeTypeFilter = canUseAdvancedControls ? typeFilter : "all";
    const activeSortMode = canUseAdvancedControls ? sortMode : "newest";

    const filtered = notifications.filter((notification) => {
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
    notifications,
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
      count: notifications.length,
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

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mb-4 text-5xl font-semibold tracking-tight">
              Notifications
            </h1>

            <p className="text-zinc-500">
              Updates from conversations and activity connected to you.
            </p>
          </div>

          {!loading && notifications.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500">
                {unreadCount === 0
                  ? "All caught up"
                  : `${unreadCount} unread`}
              </div>

              <button
                onClick={markAllRead}
                disabled={working || unreadCount === 0}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                Mark all read
              </button>

              <button
                onClick={clearReadNotifications}
                disabled={working || readCount === 0}
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                Clear read
              </button>
            </div>
          )}
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-3">
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

        {!loading && notifications.length > 0 && (
          <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                  Advanced notification controls
                </p>

                <h2 className="text-2xl font-medium">
                  Filter notifications by signal
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

              <div className="flex flex-wrap gap-3">
                {[
                  ["all", "All types"],
                  ["reply", "Replies"],
                  ["mention", "Mentions"],
                  ["follow", "Follows"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value as NotificationTypeFilter)}
                    disabled={!canUseAdvancedControls && value !== "all"}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
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

              <div className="flex flex-wrap gap-3">
                {[
                  ["newest", "Newest first"],
                  ["oldest", "Oldest first"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSortMode(value as NotificationSortMode)}
                    disabled={!canUseAdvancedControls && value !== "newest"}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
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
              review notifications from newest or oldest first.
            </p>
          </section>
        )}

        {loading && (
          <p className="text-zinc-500">
            Loading notifications...
          </p>
        )}

        {!loading && notifications.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No notifications yet.
            </h2>

            <p className="text-zinc-400">
              Replies, follows, and other activity will appear here.
            </p>
          </div>
        )}

        {!loading && notifications.length > 0 && filteredNotifications.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No notifications found.
            </h2>

            <p className="text-zinc-400">
              No notifications match the current filters.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const href = getNotificationHref(notification, profiles);
            const actorProfile = notification.actor_id
              ? profiles[notification.actor_id]
              : undefined;

            return (
              <div
                key={notification.id}
                className={`rounded-2xl border p-6 ${
                  notification.read_at
                    ? "border-zinc-900 bg-zinc-950"
                    : "border-zinc-700 bg-zinc-950"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  {!notification.read_at && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-black">
                      New
                    </span>
                  )}

                  <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                    {notification.type}
                  </span>
                </div>

                <div className="mb-4 flex items-start gap-4">
                  <ProfileAvatar profile={actorProfile} size="md" />

                  <div className="min-w-0">
                    <p className="text-zinc-300">
                      {getNotificationMessage(notification, profiles)}
                    </p>

                    <p className="mt-2 text-sm text-zinc-600">
                      {new Date(notification.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {href && (
                    <Link
                      href={href}
                      onClick={(event) => {
                        event.preventDefault();
                        openNotification(notification, href);
                      }}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      {getNotificationActionLabel(notification)}
                    </Link>
                  )}

                  {!notification.read_at && (
                    <button
                      onClick={() => markRead(notification.id)}
                      disabled={working}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      Mark read
                    </button>
                  )}

                  <button
                    onClick={() => deleteNotification(notification.id)}
                    disabled={working}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
