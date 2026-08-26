"use client";

import { ProfileAvatar } from "@/components/profile-avatar";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import {
  Check,
  Ellipsis,
  Eye,
  EyeOff,
  Flag,
  Search,
  Settings,
  Trash2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./notifications-v2.css";

type Notification = {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string;
  target_id: string | null;
  room_id?: string | null;
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

type NotificationCategory =
  | "replies"
  | "follows"
  | "discussions"
  | "messages"
  | "system";
type InboxFilter = "all" | "unread" | NotificationCategory;
type TimeGroup = "new" | "today" | "earlier";

type NotificationPreferences = {
  repliesEnabled: boolean;
  followsEnabled: boolean;
  mentionsEnabled: boolean;
  followedDiscussionsEnabled: boolean;
  followedRepliesEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: "daily" | "weekly";
  pushMessagesEnabled: boolean;
  pushRepliesEnabled: boolean;
  pushFollowsEnabled: boolean;
  pushAdminReportsEnabled: boolean;
};

type NotificationPreferenceKey =
  | "repliesEnabled"
  | "followsEnabled"
  | "mentionsEnabled"
  | "followedDiscussionsEnabled"
  | "followedRepliesEnabled";

const FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "discussions", label: "Discussions" },
  { value: "messages", label: "Messages" },
  { value: "replies", label: "Replies" },
  { value: "follows", label: "Follows" },
  { value: "system", label: "System" },
];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  repliesEnabled: true,
  followsEnabled: true,
  mentionsEnabled: true,
  followedDiscussionsEnabled: true,
  followedRepliesEnabled: false,
  emailDigestEnabled: false,
  emailDigestFrequency: "weekly",
  pushMessagesEnabled: true,
  pushRepliesEnabled: true,
  pushFollowsEnabled: true,
  pushAdminReportsEnabled: true,
};

const GROUP_LABELS: Record<TimeGroup, string> = {
  new: "New",
  today: "Today",
  earlier: "Earlier",
};

function getProfileName(profile: Profile | undefined) {
  return profile?.full_name?.trim() || profile?.username || "Someone";
}

function getNotificationMessage(
  notification: Notification,
  profiles: Record<string, Profile>,
) {
  if (notification.type === "follow") {
    const actor = notification.actor_id
      ? profiles[notification.actor_id]
      : undefined;
    return `${getProfileName(actor)} followed you.`;
  }

  return normalizePublicText(notification.message);
}

function getNotificationCategory(
  notification: Notification,
): NotificationCategory {
  const type = notification.type.toLowerCase();
  const targetType = notification.target_type.toLowerCase();

  if (
    targetType === "conversation" ||
    type === "new_message" ||
    type === "message_reply"
  ) {
    return "messages";
  }

  if (
    type === "reply" ||
    type === "mention" ||
    type === "followed_reply" ||
    type === "room_reply"
  ) {
    return "replies";
  }

  if (
    type === "followed_discussion" ||
    targetType === "discussion" ||
    type.includes("discussion")
  ) {
    return "discussions";
  }

  if (type === "follow" || type.includes("follow_request")) {
    return "follows";
  }

  return "system";
}

function getNotificationHref(
  notification: Notification,
  profiles: Record<string, Profile>,
) {
  if (notification.room_id) {
    if (notification.target_type === "room_moderation_item") {
      return `/rooms/${encodeURIComponent(notification.room_id)}/moderation`;
    }
    return `/rooms/${encodeURIComponent(notification.room_id)}`;
  }

  if (notification.target_type === "discussion" && notification.target_id) {
    return `/discussions/${notification.target_id}`;
  }

  if (notification.target_type === "conversation" && notification.target_id) {
    return `/messages?conversation=${encodeURIComponent(notification.target_id)}`;
  }

  if (notification.target_type === "floor_live_program") {
    return "/the-floor/live";
  }

  if (notification.target_type === "floor_contributor_assignment") {
    return "/the-floor/contributors";
  }

  if (notification.target_type === "identity_verification") {
    return "/profile";
  }

  if (notification.target_type === "profile") {
    const actor = notification.actor_id
      ? profiles[notification.actor_id]
      : undefined;
    return actor?.username
      ? `/u/${encodeURIComponent(actor.username)}`
      : "/people";
  }

  return null;
}

function getNotificationPreferenceKey(
  notification: Notification,
): NotificationPreferenceKey | null {
  if (notification.type === "follow") return "followsEnabled";
  if (notification.type === "mention") return "mentionsEnabled";
  if (notification.type === "followed_discussion") {
    return "followedDiscussionsEnabled";
  }
  if (notification.type === "followed_reply") return "followedRepliesEnabled";
  if (
    notification.type === "reply" ||
    notification.type === "room_reply"
  ) {
    return "repliesEnabled";
  }
  return null;
}

function getMuteLabel(notification: Notification) {
  const key = getNotificationPreferenceKey(notification);
  if (key === "followsEnabled") return "Turn off follow notifications";
  if (key === "mentionsEnabled") return "Turn off mention notifications";
  if (key === "followedDiscussionsEnabled") {
    return "Turn off followed discussion notifications";
  }
  if (key === "followedRepliesEnabled") {
    return "Turn off followed reply notifications";
  }
  if (key === "repliesEnabled") return "Turn off reply notifications";
  return null;
}

function canReportNotification(notification: Notification) {
  return Boolean(
    notification.actor_id &&
      ["discussion", "conversation", "profile"].includes(
        notification.target_type,
      ),
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "now";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  return `${Math.floor(days / 365)}y`;
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTimeGroup(value: string): TimeGroup {
  const createdAt = new Date(value);
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (createdAt >= sixHoursAgo) return "new";
  if (createdAt >= startOfToday) return "today";
  return "earlier";
}

function getEmptyMessage(filter: InboxFilter, query: string) {
  if (query.trim()) return "No notifications match your search.";
  if (filter === "unread") return "You have no unread notifications.";
  if (filter === "all") return "No notifications are available.";
  return `No ${filter} notifications are available.`;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export default function NotificationsV2Client({
  roomId = null,
}: {
  roomId?: string | null;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [bulkWorking, setBulkWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const loadingRef = useRef(true);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!loadingRef.current) return;
      setNotice(
        "Notifications took too long to load. Refresh if the list looks incomplete.",
      );
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
        Object.fromEntries(
          ((data ?? []) as Profile[]).map((profile) => [profile.id, profile]),
        ),
      );
    }

    async function loadPreferences() {
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) return;
        const response = await fetch("/api/settings/notification-preferences", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as {
          preferences?: Partial<NotificationPreferences>;
        };
        if (!alive) return;
        setPreferences({
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(payload.preferences ?? {}),
        });
      } catch {
        // The inbox remains usable even if preference metadata is unavailable.
      }
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

        const [blockedIds, notificationResult] = await Promise.all([
          getBlockedRelationshipUserIds(supabase, user.id),
          (() => {
            let notificationQuery = supabase
              .from("notifications")
              .select("*")
              .eq("user_id", user.id);
            if (roomId) {
              notificationQuery = notificationQuery.eq("room_id", roomId);
            }
            return notificationQuery.order("created_at", { ascending: false });
          })(),
        ]);

        if (notificationResult.error) throw notificationResult.error;

        const visible = filterBlockedActorNotifications(
          (notificationResult.data ?? []) as Notification[],
          blockedIds,
        ) as Notification[];

        if (!alive) return;
        setNotifications(visible);
        setLoading(false);

        const actorIds = [
          ...new Set(
            visible
              .map((notification) => notification.actor_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        void loadActorProfiles(actorIds);
        void loadPreferences();
      } catch (error) {
        console.error("Unable to load notifications.", error);
        if (alive) {
          setNotice("Notifications could not load. Refresh and try again.");
          setLoading(false);
        }
      }
    }

    void loadNotifications();
    return () => {
      alive = false;
    };
  }, [roomId]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      if (!target.closest("[data-notifications-top-menu]")) {
        setTopMenuOpen(false);
      }

      if (!target.closest("[data-notifications-item-menu]")) {
        setOpenItemMenuId(null);
      }

      if (searchOpen && !target.closest("[data-notifications-search]")) {
        setSearchOpen(false);
        setQuery("");
      }

      if (!shellRef.current?.contains(target)) {
        setTopMenuOpen(false);
        setOpenItemMenuId(null);
      }
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setTopMenuOpen(false);
      setOpenItemMenuId(null);
      if (searchOpen) {
        setSearchOpen(false);
        setQuery("");
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [searchOpen]);

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return notifications.filter((notification) => {
      if (filter === "unread" && notification.read_at) return false;
      if (
        filter !== "all" &&
        filter !== "unread" &&
        getNotificationCategory(notification) !== filter
      ) {
        return false;
      }

      if (!needle) return true;

      const actor = notification.actor_id
        ? profiles[notification.actor_id]
        : undefined;
      return [
        getNotificationMessage(notification, profiles),
        getProfileName(actor),
        notification.type,
        notification.target_type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [filter, notifications, profiles, query]);

  const groups = useMemo(() => {
    const next: Record<TimeGroup, Notification[]> = {
      new: [],
      today: [],
      earlier: [],
    };

    for (const notification of results) {
      next[getTimeGroup(notification.created_at)].push(notification);
    }

    return next;
  }, [results]);

  async function setNotificationReadState(
    notificationId: string,
    shouldBeRead: boolean,
  ) {
    if (!currentUserId || workingId) return;
    setWorkingId(notificationId);
    setNotice("");

    const readAt = shouldBeRead ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", currentUserId)
      .eq("id", notificationId);

    setWorkingId(null);
    if (error) {
      setNotice(
        shouldBeRead
          ? "Unable to mark this notification as read."
          : "Unable to mark this notification as unread.",
      );
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, read_at: readAt }
          : notification,
      ),
    );
    setOpenItemMenuId(null);
    window.dispatchEvent(new Event("loombus:notifications-changed"));
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
        ids.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification,
      ),
    );
    window.dispatchEvent(new Event("loombus:notifications-changed"));
    return true;
  }

  async function markAllRead() {
    if (bulkWorking) return;
    const ids = notifications
      .filter((notification) => !notification.read_at)
      .map((notification) => notification.id);

    if (ids.length === 0) {
      setNotice("All notifications are already read.");
      setTopMenuOpen(false);
      return;
    }

    setBulkWorking(true);
    setNotice("");
    const success = await markNotificationIdsRead(ids);
    setBulkWorking(false);
    setTopMenuOpen(false);
    if (success) setNotice("All notifications marked as read.");
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
      current.filter((notification) => notification.id !== notificationId),
    );
    setOpenItemMenuId(null);
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function muteNotificationType(notification: Notification) {
    const preferenceKey = getNotificationPreferenceKey(notification);
    if (!preferenceKey || workingId) return;

    setWorkingId(notification.id);
    setNotice("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        window.location.href = "/login?next=/notifications";
        return;
      }

      const nextPreferences: NotificationPreferences = {
        ...preferences,
        [preferenceKey]: false,
      };
      const response = await fetch("/api/settings/notification-preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextPreferences),
      });

      if (!response.ok) {
        throw new Error("Unable to update notification preferences.");
      }

      const payload = (await response.json().catch(() => ({}))) as {
        preferences?: Partial<NotificationPreferences>;
      };
      setPreferences({
        ...nextPreferences,
        ...(payload.preferences ?? {}),
      });
      setNotice(`${getMuteLabel(notification) ?? "Notification type"} turned off.`);
      setOpenItemMenuId(null);
    } catch (error) {
      console.error("Unable to mute notification type.", error);
      setNotice("Unable to update notification settings.");
    } finally {
      setWorkingId(null);
    }
  }

  async function openNotification(notification: Notification, href: string) {
    if (!notification.read_at) {
      await markNotificationIdsRead([notification.id]);
    }
    window.location.href = href;
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    notification: Notification,
    href: string | null,
  ) {
    if (!href) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void openNotification(notification, href);
    }
  }

  function toggleItemMenu(
    event: MouseEvent<HTMLButtonElement>,
    notificationId: string,
  ) {
    event.stopPropagation();
    setTopMenuOpen(false);
    setOpenItemMenuId((current) =>
      current === notificationId ? null : notificationId,
    );
  }

  const settingsHref = roomId
    ? `/rooms/${encodeURIComponent(roomId)}/notifications`
    : "/settings";

  if (loading) {
    return (
      <main className="notifications-v2-page">
        <section className="notifications-v2-state" aria-live="polite">
          <div className="notifications-v2-skeleton-heading" />
          <div className="notifications-v2-skeleton-row" />
          <div className="notifications-v2-skeleton-row" />
          <div className="notifications-v2-skeleton-row" />
        </section>
      </main>
    );
  }

  return (
    <main className="notifications-v2-page">
      <div className="notifications-v2-shell" ref={shellRef}>
        <header className="notifications-v2-header">
          <div>
            <h1>{roomId ? "Room notifications" : "Notifications"}</h1>
            {roomId ? <p>Activity from this Room</p> : null}
          </div>

          <div className="notifications-v2-header-actions">
            <button
              type="button"
              data-notifications-search
              className={searchOpen ? "is-active" : ""}
              onClick={() => {
                setSearchOpen((current) => !current);
                setTopMenuOpen(false);
                setOpenItemMenuId(null);
                if (searchOpen) setQuery("");
              }}
              aria-label={
                searchOpen ? "Close notification search" : "Search notifications"
              }
              aria-expanded={searchOpen}
            >
              {searchOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
            </button>

            <div
              className="notifications-v2-top-menu-wrap"
              data-notifications-top-menu
            >
              <button
                type="button"
                onClick={() => {
                  setTopMenuOpen((current) => !current);
                  setOpenItemMenuId(null);
                }}
                aria-label="Notification actions"
                aria-expanded={topMenuOpen}
                aria-haspopup="menu"
              >
                <Ellipsis aria-hidden="true" />
              </button>

              {topMenuOpen ? (
                <div
                  className="notifications-v2-menu notifications-v2-top-menu"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void markAllRead()}
                    disabled={bulkWorking || unreadCount === 0}
                  >
                    <Check aria-hidden="true" />
                    <span>Mark all as read</span>
                  </button>
                  <Link href={settingsHref} role="menuitem">
                    <Settings aria-hidden="true" />
                    <span>Notification settings</span>
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {searchOpen ? (
          <div className="notifications-v2-search" data-notifications-search>
            <Search aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notifications"
              aria-label="Search notifications"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear notification search"
              >
                <X aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div
          className="notifications-v2-tabs"
          role="tablist"
          aria-label="Notification filters"
        >
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className={filter === item.value ? "is-active" : ""}
              onClick={() => {
                setFilter(item.value);
                setTopMenuOpen(false);
                setOpenItemMenuId(null);
              }}
            >
              {item.label}
              {item.value === "unread" && unreadCount > 0 ? (
                <span>{unreadCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        {notice ? (
          <div className="notifications-v2-notice" role="status">
            {notice}
          </div>
        ) : null}

        {notifications.length === 0 ? (
          <section className="notifications-v2-empty">
            <h2>You are all caught up.</h2>
            <p>New activity connected to you will appear here.</p>
          </section>
        ) : results.length === 0 ? (
          <section className="notifications-v2-empty">
            <h2>No notifications here.</h2>
            <p>{getEmptyMessage(filter, query)}</p>
            {(query || filter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Show all notifications
              </button>
            )}
          </section>
        ) : (
          <section className="notifications-v2-list" aria-label="Notifications">
            {(["new", "today", "earlier"] as TimeGroup[]).map((group) => {
              const groupNotifications = groups[group];
              if (groupNotifications.length === 0) return null;

              return (
                <section className="notifications-v2-group" key={group}>
                  <h2>{GROUP_LABELS[group]}</h2>
                  <div className="notifications-v2-group-list">
                    {groupNotifications.map((notification) => {
                      const actor = notification.actor_id
                        ? profiles[notification.actor_id]
                        : undefined;
                      const href = getNotificationHref(notification, profiles);
                      const unread = !notification.read_at;
                      const menuOpen = openItemMenuId === notification.id;
                      const muteLabel = getMuteLabel(notification);

                      return (
                        <article
                          key={notification.id}
                          className={`notifications-v2-row${
                            unread ? " is-unread" : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="notifications-v2-row-main"
                            disabled={!href}
                            onClick={() => {
                              if (href) void openNotification(notification, href);
                            }}
                            onKeyDown={(event) =>
                              handleRowKeyDown(event, notification, href)
                            }
                            aria-label={`${getNotificationMessage(
                              notification,
                              profiles,
                            )}. ${formatRelativeTime(notification.created_at)} ago`}
                          >
                            <ProfileAvatar profile={actor} size="lg" />
                            <span className="notifications-v2-row-copy">
                              <span className="notifications-v2-row-message">
                                {getNotificationMessage(notification, profiles)}
                              </span>
                              <time
                                dateTime={notification.created_at}
                                title={formatFullDate(notification.created_at)}
                              >
                                {formatRelativeTime(notification.created_at)}
                              </time>
                            </span>
                          </button>

                          <div
                            className="notifications-v2-row-tools"
                            data-notifications-item-menu
                          >
                            <button
                              type="button"
                              className="notifications-v2-item-menu-button"
                              onClick={(event) =>
                                toggleItemMenu(event, notification.id)
                              }
                              aria-label="More notification actions"
                              aria-expanded={menuOpen}
                              aria-haspopup="menu"
                            >
                              <Ellipsis aria-hidden="true" />
                            </button>
                            {unread ? (
                              <span
                                className="notifications-v2-unread-dot"
                                aria-label="Unread"
                              />
                            ) : null}

                            {menuOpen ? (
                              <div
                                className="notifications-v2-menu notifications-v2-item-menu"
                                role="menu"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() =>
                                    void setNotificationReadState(
                                      notification.id,
                                      !unread,
                                    )
                                  }
                                  disabled={workingId === notification.id}
                                >
                                  {unread ? (
                                    <Eye aria-hidden="true" />
                                  ) : (
                                    <EyeOff aria-hidden="true" />
                                  )}
                                  <span>
                                    {unread ? "Mark as read" : "Mark as unread"}
                                  </span>
                                </button>

                                {muteLabel ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() =>
                                      void muteNotificationType(notification)
                                    }
                                    disabled={workingId === notification.id}
                                  >
                                    <VolumeX aria-hidden="true" />
                                    <span>{muteLabel}</span>
                                  </button>
                                ) : (
                                  <Link href={settingsHref} role="menuitem">
                                    <Settings aria-hidden="true" />
                                    <span>Manage notifications like this</span>
                                  </Link>
                                )}

                                <button
                                  type="button"
                                  role="menuitem"
                                  className="is-danger"
                                  onClick={() =>
                                    void deleteNotification(notification.id)
                                  }
                                  disabled={workingId === notification.id}
                                >
                                  <Trash2 aria-hidden="true" />
                                  <span>Delete notification</span>
                                </button>

                                {canReportNotification(notification) ? (
                                  <Link href="/contact" role="menuitem">
                                    <Flag aria-hidden="true" />
                                    <span>Report issue</span>
                                  </Link>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
