"use client";

import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import "./notifications-v2.css";

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
  id?: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type InboxFilter =
  | "all"
  | "unread"
  | "replies"
  | "follows"
  | "discussions"
  | "messages"
  | "system";

type SortMode = "newest" | "oldest";
type Category = Exclude<InboxFilter, "all" | "unread">;

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "replies", label: "Replies" },
  { value: "follows", label: "Follows" },
  { value: "discussions", label: "Discussions" },
  { value: "messages", label: "Messages" },
  { value: "system", label: "System" },
];

function hasAdvancedNotificationAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  return (
    isAdmin ||
    (entitlement?.ai_assisted_enabled === true && entitlement.tier === "premium")
  );
}

function getCategory(notification: Notification): Category {
  if (
    notification.target_type === "conversation" ||
    notification.type === "new_message" ||
    notification.type === "message_reply"
  ) {
    return "messages";
  }

  if (notification.type === "follow") {
    return "follows";
  }

  if (
    notification.type === "reply" ||
    notification.type === "mention" ||
    notification.type === "followed_reply"
  ) {
    return "replies";
  }

  if (
    notification.type === "followed_discussion" ||
    notification.type.includes("discussion")
  ) {
    return "discussions";
  }

  return "system";
}

function getCategoryLabel(category: Category) {
  return {
    replies: "Reply signal",
    follows: "Network signal",
    discussions: "Discussion signal",
    messages: "Message",
    system: "System",
  }[category];
}

function getProfileName(profile: Profile | undefined) {
  return profile?.full_name?.trim() || profile?.username || "Someone";
}

function getNotificationMessage(
  notification: Notification,
  profiles: Record<string, Profile>
) {
  if (notification.type === "follow") {
    const actor = notification.actor_id ? profiles[notification.actor_id] : undefined;
    return `${getProfileName(actor)} followed you.`;
  }

  return normalizePublicText(notification.message);
}

function getNotificationHref(
  notification: Notification,
  profiles: Record<string, Profile>
) {
  if (notification.target_type === "discussion" && notification.target_id) {
    return `/discussions/${notification.target_id}`;
  }

  if (notification.target_type === "conversation" && notification.target_id) {
    return `/messages?conversation=${encodeURIComponent(notification.target_id)}`;
  }

  if (notification.target_type === "identity_verification") {
    return "/profile";
  }

  if (notification.target_type === "profile") {
    const actor = notification.actor_id ? profiles[notification.actor_id] : undefined;
    return actor?.username ? `/u/${encodeURIComponent(actor.username)}` : "/people";
  }

  return null;
}

function getActionLabel(notification: Notification) {
  if (notification.target_type === "discussion") return "Open discussion";
  if (notification.target_type === "conversation") return "Open message";
  if (notification.target_type === "identity_verification") return "Open verification";
  if (notification.target_type === "profile") return "Open profile";
  return "Open source";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function NotificationsV2Client() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const loadingRef = useRef(true);

  const canUseAdvancedControls = hasAdvancedNotificationAccess(entitlement, isAdmin);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!loadingRef.current) return;
      setNotice("Signal Inbox took too long to load. Refresh if the list looks incomplete.");
      setLoading(false);
    }, 10000);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadActorProfiles(actorIds: string[]) {
      if (actorIds.length === 0) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", actorIds);

      if (error) {
        console.error("Unable to load notification actor profiles.", error);
        return;
      }

      if (!alive) return;
      setProfiles(
        Object.fromEntries(((data ?? []) as Profile[]).map((profile) => [profile.id, profile]))
      );
    }

    async function loadNotifications() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          window.location.href = "/login";
          return;
        }

        if (!alive) return;
        setCurrentUserId(user.id);

        const [profileResult, entitlementResult, blockedIds, notificationResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("id, username, full_name, avatar_url, is_admin")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("user_ai_entitlements")
              .select("tier, ai_assisted_enabled, monthly_summary_limit")
              .eq("user_id", user.id)
              .maybeSingle(),
            getBlockedRelationshipUserIds(supabase, user.id),
            supabase
              .from("notifications")
              .select("id, actor_id, type, target_type, target_id, message, read_at, created_at")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false }),
          ]);

        const firstError = profileResult.error || entitlementResult.error || notificationResult.error;
        if (firstError) throw firstError;

        const visible = filterBlockedActorNotifications(
          (notificationResult.data ?? []) as Notification[],
          blockedIds
        ) as Notification[];

        if (!alive) return;
        const profileData = profileResult.data;
        setCurrentProfile(
          profileData
            ? {
                id: profileData.id,
                username: profileData.username,
                full_name: profileData.full_name,
                avatar_url: profileData.avatar_url,
              }
            : null
        );
        setIsAdmin(Boolean(profileData?.is_admin));
        setEntitlement((entitlementResult.data ?? null) as AiEntitlement);
        setNotifications(visible);
        setLoading(false);

        const actorIds = [
          ...new Set(
            visible
              .map((notification) => notification.actor_id)
              .filter((id): id is string => Boolean(id))
          ),
        ];
        void loadActorProfiles(actorIds);
      } catch (error) {
        console.error("Unable to load Signal Inbox.", error);
        if (alive) {
          setNotice("Signal Inbox could not load. Refresh and try again.");
          setLoading(false);
        }
      }
    }

    void loadNotifications();
    return () => {
      alive = false;
    };
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  const readCount = notifications.length - unreadCount;

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      replies: 0,
      follows: 0,
      discussions: 0,
      messages: 0,
      system: 0,
    };

    for (const notification of notifications) {
      counts[getCategory(notification)] += 1;
    }

    return counts;
  }, [notifications]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const activeFilter =
      canUseAdvancedControls || filter === "all" || filter === "unread" ? filter : "all";
    const activeSort = canUseAdvancedControls ? sort : "newest";

    return notifications
      .filter((notification) => {
        if (activeFilter === "unread") return !notification.read_at;
        if (activeFilter !== "all") return getCategory(notification) === activeFilter;
        return true;
      })
      .filter((notification) => {
        if (!needle) return true;
        const actor = notification.actor_id ? profiles[notification.actor_id] : undefined;
        return [
          getNotificationMessage(notification, profiles),
          getProfileName(actor),
          getCategoryLabel(getCategory(notification)),
          notification.type,
          notification.target_type,
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return activeSort === "newest" ? delta : -delta;
      });
  }, [canUseAdvancedControls, filter, notifications, profiles, query, sort]);

  function getFilterCount(value: InboxFilter) {
    if (value === "all") return notifications.length;
    if (value === "unread") return unreadCount;
    return categoryCounts[value];
  }

  async function markNotificationIdsRead(ids: string[]) {
    if (!currentUserId || ids.length === 0) return false;
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", currentUserId)
      .in("id", ids)
      .is("read_at", null);

    if (error) {
      setNotice("Unable to mark notifications as read.");
      return false;
    }

    setNotifications((current) =>
      current.map((notification) =>
        ids.includes(notification.id) ? { ...notification, read_at: readAt } : notification
      )
    );
    window.dispatchEvent(new Event("loombus:notifications-changed"));
    return true;
  }

  async function markRead(notificationId: string) {
    if (workingId) return;
    setWorkingId(notificationId);
    setNotice("");
    await markNotificationIdsRead([notificationId]);
    setWorkingId(null);
  }

  async function markAllRead() {
    if (bulkWorking) return;
    const ids = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);

    if (ids.length === 0) {
      setNotice("Your Signal Inbox is already caught up.");
      return;
    }

    setBulkWorking(true);
    setNotice("");
    const success = await markNotificationIdsRead(ids);
    setBulkWorking(false);
    if (success) setNotice("All notifications marked read.");
  }

  async function deleteNotification(notificationId: string) {
    if (!currentUserId || workingId) return;
    setWorkingId(notificationId);
    setNotice("");

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", currentUserId)
      .eq("id", notificationId);

    setWorkingId(null);
    if (error) {
      setNotice("Unable to delete this notification.");
      return;
    }

    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId)
    );
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function clearReadNotifications() {
    if (!currentUserId || bulkWorking) return;
    const ids = notifications
      .filter((notification) => notification.read_at)
      .map((notification) => notification.id);

    if (ids.length === 0) {
      setNotice("There are no read notifications to clear.");
      return;
    }

    setBulkWorking(true);
    setNotice("");
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", currentUserId)
      .in("id", ids);
    setBulkWorking(false);

    if (error) {
      setNotice("Unable to clear read notifications.");
      return;
    }

    setNotifications((current) => current.filter((notification) => !ids.includes(notification.id)));
    setNotice("Read notifications cleared.");
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function openNotification(notification: Notification, href: string) {
    if (!notification.read_at) await markNotificationIdsRead([notification.id]);
    window.location.href = href;
  }

  function resetView() {
    setQuery("");
    setFilter("all");
    setSort("newest");
  }

  if (loading) {
    return (
      <main className="notifications-v2-page">
        <section className="notifications-v2-state">
          <p>Signal Inbox</p>
          <h1>Gathering the updates that need your attention…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="notifications-v2-page">
      <div className="notifications-v2-shell">
        <header className="notifications-v2-hero">
          <div className="notifications-v2-hero-copy">
            <p className="notifications-v2-eyebrow">Signal Inbox</p>
            <h1>Attention without the noise.</h1>
            <p>
              Review replies, discussions, follows, messages, and account updates connected
              to you, then return to the Signal that matters.
            </p>
          </div>

          <div className="notifications-v2-member-card">
            <ProfileAvatar profile={currentProfile} size="xl" />
            <div>
              <span>Member inbox</span>
              <strong>{getProfileDisplayName(currentProfile)}</strong>
              <small>{unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}</small>
            </div>
          </div>
        </header>

        <section className="notifications-v2-actions" aria-label="Signal Inbox actions">
          <button type="button" onClick={markAllRead} disabled={bulkWorking || unreadCount === 0}>
            Mark all read
          </button>
          <button
            type="button"
            className="is-secondary"
            onClick={clearReadNotifications}
            disabled={bulkWorking || readCount === 0}
          >
            Clear read
          </button>
          <Link href="/settings">Notification settings</Link>
        </section>

        <section className="notifications-v2-metrics" aria-label="Signal Inbox overview">
          <article><span>Total</span><strong>{notifications.length}</strong></article>
          <article className="is-accent"><span>Unread</span><strong>{unreadCount}</strong></article>
          <article><span>Reply signal</span><strong>{categoryCounts.replies}</strong></article>
          <article><span>Messages</span><strong>{categoryCounts.messages}</strong></article>
        </section>

        {notice && <div className="notifications-v2-notice" role="status">{notice}</div>}

        {notifications.length > 0 && (
          <section className="notifications-v2-controls">
            <div className="notifications-v2-search-row">
              <label>
                <span>Search Signal Inbox</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search messages, members, or notification types"
                />
              </label>
              <label>
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortMode)}
                  disabled={!canUseAdvancedControls}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>

            <div className="notifications-v2-filter-rail" aria-label="Signal Inbox filters">
              {FILTERS.map((option) => {
                const advanced = option.value !== "all" && option.value !== "unread";
                const disabled = advanced && !canUseAdvancedControls;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFilter(option.value)}
                    disabled={disabled}
                    className={filter === option.value ? "is-active" : ""}
                  >
                    {option.label}
                    <span>{getFilterCount(option.value)}</span>
                    {disabled && <small>Premium</small>}
                  </button>
                );
              })}
            </div>

            <div className="notifications-v2-control-summary">
              <p>Showing {results.length} of {notifications.length} notifications</p>
              {!canUseAdvancedControls && (
                <Link href="/premium">Unlock category filters and oldest-first sorting</Link>
              )}
              {(query || filter !== "all" || sort !== "newest") && (
                <button type="button" onClick={resetView}>Reset view</button>
              )}
            </div>
          </section>
        )}

        {notifications.length === 0 ? (
          <section className="notifications-v2-empty">
            <p>Signal Inbox</p>
            <h2>You are all caught up.</h2>
            <span>
              New replies, follows, discussion updates, messages, and account notices will
              appear here when they need your attention.
            </span>
            <div>
              <Link className="is-primary" href="/discussions">Browse discussions</Link>
              <Link href="/following">Open following feed</Link>
              <Link href="/profile">Review profile</Link>
            </div>
          </section>
        ) : results.length === 0 ? (
          <section className="notifications-v2-empty">
            <p>Filtered view</p>
            <h2>No notifications match this view.</h2>
            <span>Broaden the search or reset the active filters.</span>
            <button type="button" onClick={resetView}>Reset Signal Inbox</button>
          </section>
        ) : (
          <section className="notifications-v2-list" aria-label="Notifications">
            {results.map((notification) => {
              const actor = notification.actor_id ? profiles[notification.actor_id] : undefined;
              const href = getNotificationHref(notification, profiles);
              const category = getCategory(notification);
              const unread = !notification.read_at;

              return (
                <article
                  key={notification.id}
                  className={unread ? "notifications-v2-card is-unread" : "notifications-v2-card"}
                >
                  <div className="notifications-v2-card-head">
                    <div className="notifications-v2-card-labels">
                      {unread && <span className="is-new">New</span>}
                      <span>{getCategoryLabel(category)}</span>
                    </div>
                    <time dateTime={notification.created_at}>{formatDate(notification.created_at)}</time>
                  </div>

                  <div className="notifications-v2-card-body">
                    <ProfileAvatar profile={actor} size="lg" />
                    <div>
                      <p>{getNotificationMessage(notification, profiles)}</p>
                      {actor && <span>From {getProfileName(actor)}</span>}
                    </div>
                  </div>

                  <div className="notifications-v2-card-actions">
                    {href && (
                      <button type="button" onClick={() => openNotification(notification, href)}>
                        {getActionLabel(notification)}
                      </button>
                    )}
                    {unread && (
                      <button
                        type="button"
                        className="is-secondary"
                        onClick={() => markRead(notification.id)}
                        disabled={workingId === notification.id}
                      >
                        Mark read
                      </button>
                    )}
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => deleteNotification(notification.id)}
                      disabled={workingId === notification.id}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <aside className="notifications-v2-standard">
          <div>
            <p>Signal standard</p>
            <h2>Use the inbox as a return path, not another feed.</h2>
          </div>
          <ul>
            <li>Open the source before reacting.</li>
            <li>Reply when you can add context or clarity.</li>
            <li>Mark read when the update no longer needs attention.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
