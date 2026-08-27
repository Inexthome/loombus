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
  ExternalLink,
  Eye,
  EyeOff,
  Settings,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TrayNotification = {
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

type TrayProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type TrayCategory =
  | "replies"
  | "follows"
  | "discussions"
  | "messages"
  | "system";
type TrayFilter = "all" | "unread" | TrayCategory;
type TrayTimeGroup = "new" | "today" | "earlier";

const FILTERS: { value: TrayFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "discussions", label: "Discussions" },
  { value: "messages", label: "Messages" },
  { value: "replies", label: "Replies" },
  { value: "follows", label: "Follows" },
  { value: "system", label: "System" },
];

const GROUP_LABELS: Record<TrayTimeGroup, string> = {
  new: "New",
  today: "Today",
  earlier: "Earlier",
};

function getProfileName(profile: TrayProfile | undefined) {
  return profile?.full_name?.trim() || profile?.username || "Someone";
}

function getMessage(
  notification: TrayNotification,
  profiles: Record<string, TrayProfile>,
) {
  if (notification.type === "follow") {
    const actor = notification.actor_id
      ? profiles[notification.actor_id]
      : undefined;
    return `${getProfileName(actor)} followed you.`;
  }
  return normalizePublicText(notification.message);
}

function getCategory(notification: TrayNotification): TrayCategory {
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

function getHref(
  notification: TrayNotification,
  profiles: Record<string, TrayProfile>,
) {
  if (notification.room_id) {
    return notification.target_type === "room_moderation_item"
      ? `/rooms/${encodeURIComponent(notification.room_id)}/moderation`
      : `/rooms/${encodeURIComponent(notification.room_id)}`;
  }
  if (notification.target_type === "discussion" && notification.target_id) {
    return `/discussions/${notification.target_id}`;
  }
  if (notification.target_type === "conversation" && notification.target_id) {
    return `/messages?conversation=${encodeURIComponent(notification.target_id)}`;
  }
  if (notification.target_type === "floor_live_program") return "/the-floor/live";
  if (notification.target_type === "floor_contributor_assignment") {
    return "/the-floor/contributors";
  }
  if (notification.target_type === "identity_verification") return "/profile";
  if (notification.target_type === "profile") {
    const actor = notification.actor_id
      ? profiles[notification.actor_id]
      : undefined;
    return actor?.username
      ? `/u/${encodeURIComponent(actor.username)}`
      : "/people";
  }
  return "/notifications";
}

function relativeTime(value: string) {
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
  return months < 12 ? `${months}mo` : `${Math.floor(days / 365)}y`;
}

function timeGroup(value: string): TrayTimeGroup {
  const createdAt = new Date(value);
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (createdAt >= sixHoursAgo) return "new";
  if (createdAt >= startOfToday) return "today";
  return "earlier";
}

export function DesktopNotificationsTray({
  userId,
  onClose,
  onUnreadCountChange,
}: {
  userId: string;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<TrayNotification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, TrayProfile>>({});
  const [filter, setFilter] = useState<TrayFilter>("all");
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const [itemMenuId, setItemMenuId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      const blockedIds = await getBlockedRelationshipUserIds(supabase, userId);
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id, actor_id, type, target_type, target_id, room_id, message, read_at, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60);

      if (!alive) return;
      if (error) {
        console.error("Unable to load desktop notification tray.", error);
        setLoading(false);
        return;
      }

      const visible = filterBlockedActorNotifications(
        (data ?? []) as TrayNotification[],
        blockedIds,
      ) as TrayNotification[];
      setNotifications(visible);
      const unreadCount = visible.filter((item) => !item.read_at).length;
      onUnreadCountChange?.(unreadCount);
      setLoading(false);

      const actorIds = [
        ...new Set(
          visible
            .map((item) => item.actor_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (actorIds.length === 0) return;

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", actorIds);
      if (!alive) return;
      setProfiles(
        Object.fromEntries(
          ((profileRows ?? []) as TrayProfile[]).map((profile) => [
            profile.id,
            profile,
          ]),
        ),
      );
    }

    void load();

    function handleChanged() {
      void load();
    }
    window.addEventListener("loombus:notifications-changed", handleChanged);

    return () => {
      alive = false;
      window.removeEventListener("loombus:notifications-changed", handleChanged);
    };
  }, [onUnreadCountChange, userId]);

  useEffect(() => {
    if (!topMenuOpen && !itemMenuId) return;

    function handlePointerDown(event: globalThis.MouseEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest("[data-notifications-tray-menu]")) {
        setTopMenuOpen(false);
        setItemMenuId(null);
      }
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setTopMenuOpen(false);
      setItemMenuId(null);
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [itemMenuId, topMenuOpen]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const visibleNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        if (filter === "unread") return !item.read_at;
        if (filter === "all") return true;
        return getCategory(item) === filter;
      }),
    [filter, notifications],
  );

  const groups = useMemo(() => {
    const next: Record<TrayTimeGroup, TrayNotification[]> = {
      new: [],
      today: [],
      earlier: [],
    };
    for (const notification of visibleNotifications) {
      next[timeGroup(notification.created_at)].push(notification);
    }
    return next;
  }, [visibleNotifications]);

  async function setReadState(notification: TrayNotification, read: boolean) {
    if (workingId) return;
    setWorkingId(notification.id);
    const readAt = read ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("id", notification.id)
      .eq("user_id", userId);
    setWorkingId(null);
    if (error) return;

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id ? { ...item, read_at: readAt } : item,
      ),
    );
    setItemMenuId(null);
    const nextUnread = unreadCount + (read ? -1 : 1);
    onUnreadCountChange?.(Math.max(0, nextUnread));
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function markAllRead() {
    const ids = notifications.filter((item) => !item.read_at).map((item) => item.id);
    if (ids.length === 0) {
      setTopMenuOpen(false);
      return;
    }
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: readAt })
      .eq("user_id", userId)
      .in("id", ids)
      .is("read_at", null);
    if (error) return;
    setNotifications((current) =>
      current.map((item) =>
        ids.includes(item.id) ? { ...item, read_at: readAt } : item,
      ),
    );
    setTopMenuOpen(false);
    onUnreadCountChange?.(0);
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function deleteNotification(notificationId: string) {
    if (workingId) return;
    setWorkingId(notificationId);
    const deleting = notifications.find((item) => item.id === notificationId);
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);
    setWorkingId(null);
    if (error) return;
    setNotifications((current) =>
      current.filter((item) => item.id !== notificationId),
    );
    setItemMenuId(null);
    if (deleting && !deleting.read_at) {
      onUnreadCountChange?.(Math.max(0, unreadCount - 1));
    }
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  return (
    <div
      className={`grid w-[min(430px,calc(100vw-24px))] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-[1.25rem] border border-[var(--loombus-border-strong)] bg-[var(--loombus-surface)] text-[var(--loombus-text)] shadow-2xl shadow-black/20 ${
        expanded
          ? "max-h-[calc(100vh-5.25rem)]"
          : "max-h-[min(650px,calc(100vh-5.25rem))]"
      }`}
      role="dialog"
      aria-label="Notifications"
    >
      <div className="relative flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="m-0 text-xl font-extrabold tracking-[-0.03em]">
          Notifications
        </h2>
        <button
          type="button"
          data-notifications-tray-menu
          aria-label="Notification actions"
          aria-expanded={topMenuOpen}
          onClick={() => {
            setTopMenuOpen((current) => !current);
            setItemMenuId(null);
          }}
          className="grid h-9 w-9 place-items-center rounded-full text-[var(--loombus-text-muted)] transition hover:bg-[var(--loombus-surface-muted)] hover:text-[var(--loombus-text)]"
        >
          <Ellipsis aria-hidden="true" className="h-5 w-5" />
        </button>

        {topMenuOpen ? (
          <div
            data-notifications-tray-menu
            className="absolute right-3 top-[3.4rem] z-[80] grid w-64 overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-2xl shadow-black/20"
          >
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={() => void markAllRead()}
              className="flex min-h-12 items-center gap-3 border-b border-[var(--loombus-border)] px-4 text-left text-sm font-semibold transition hover:bg-[var(--loombus-surface-muted)] disabled:opacity-45"
            >
              <Check aria-hidden="true" className="h-4 w-4" />
              Mark all as read
            </button>
            <Link
              href="/notifications"
              onClick={onClose}
              className="flex min-h-12 items-center gap-3 border-b border-[var(--loombus-border)] px-4 text-sm font-semibold no-underline transition hover:bg-[var(--loombus-surface-muted)]"
            >
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
              Open notifications
            </Link>
            <Link
              href="/settings"
              onClick={onClose}
              className="flex min-h-12 items-center gap-3 px-4 text-sm font-semibold no-underline transition hover:bg-[var(--loombus-surface-muted)]"
            >
              <Settings aria-hidden="true" className="h-4 w-4" />
              Notification settings
            </Link>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--loombus-border)] px-4 pb-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => {
              setFilter(item.value);
              setTopMenuOpen(false);
              setItemMenuId(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filter === item.value
                ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold-deep)]"
                : "text-[var(--loombus-text-muted)] hover:bg-[var(--loombus-surface-muted)]"
            }`}
          >
            {item.label}
            {item.value === "unread" && unreadCount > 0
              ? ` ${unreadCount}`
              : ""}
          </button>
        ))}
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-contain py-1">
        {loading ? (
          <p className="m-0 px-4 py-8 text-center text-sm text-[var(--loombus-text-muted)]">
            Loading notifications…
          </p>
        ) : visibleNotifications.length === 0 ? (
          <p className="m-0 px-4 py-8 text-center text-sm text-[var(--loombus-text-muted)]">
            {filter === "unread"
              ? "No unread notifications."
              : filter === "all"
                ? "You are all caught up."
                : `No ${filter} notifications.`}
          </p>
        ) : (
          (["new", "today", "earlier"] as TrayTimeGroup[]).map((group) => {
            const groupNotifications = groups[group];
            if (groupNotifications.length === 0) return null;
            return (
              <section key={group} className="pt-2">
                <h3 className="m-0 px-4 pb-1 text-sm font-extrabold">
                  {GROUP_LABELS[group]}
                </h3>
                <div>
                  {groupNotifications.map((notification) => {
                    const actor = notification.actor_id
                      ? profiles[notification.actor_id]
                      : undefined;
                    const unread = !notification.read_at;
                    const menuOpen = itemMenuId === notification.id;
                    return (
                      <div
                        key={notification.id}
                        className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-center transition hover:bg-[var(--loombus-surface-muted)] ${
                          menuOpen ? "z-40" : "z-0"
                        } ${
                          unread
                            ? "bg-[color:color-mix(in_srgb,var(--loombus-gold)_7%,var(--loombus-surface))]"
                            : ""
                        }`}
                      >
                        <Link
                          href={getHref(notification, profiles)}
                          onClick={() => {
                            onClose();
                            if (unread) void setReadState(notification, true);
                          }}
                          className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 no-underline"
                        >
                          <ProfileAvatar profile={actor} size="lg" />
                          <span className="min-w-0">
                            <span
                              className={`block text-sm leading-5 ${
                                unread
                                  ? "font-semibold text-[var(--loombus-text)]"
                                  : "text-[var(--loombus-text-muted)]"
                              }`}
                            >
                              {getMessage(notification, profiles)}
                            </span>
                            <time
                              dateTime={notification.created_at}
                              className={`mt-0.5 block text-xs font-semibold ${
                                unread
                                  ? "text-[var(--loombus-gold-deep)]"
                                  : "text-[var(--loombus-text-subtle)]"
                              }`}
                            >
                              {relativeTime(notification.created_at)}
                            </time>
                          </span>
                        </Link>

                        <div
                          data-notifications-tray-menu
                          className="relative flex items-center gap-1 pr-2"
                        >
                          <button
                            type="button"
                            aria-label="More notification actions"
                            aria-expanded={menuOpen}
                            onClick={() => {
                              setItemMenuId((current) =>
                                current === notification.id
                                  ? null
                                  : notification.id,
                              );
                              setTopMenuOpen(false);
                            }}
                            className="grid h-8 w-8 place-items-center rounded-full text-[var(--loombus-text-subtle)] transition hover:bg-[var(--loombus-surface-strong)] hover:text-[var(--loombus-text)]"
                          >
                            <Ellipsis aria-hidden="true" className="h-4 w-4" />
                          </button>
                          {unread ? (
                            <span
                              className="h-2 w-2 rounded-full bg-[var(--loombus-gold)]"
                              aria-label="Unread"
                            />
                          ) : null}

                          {menuOpen ? (
                            <div className="absolute right-2 top-9 z-[90] grid w-64 overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-2xl shadow-black/20">
                              <button
                                type="button"
                                disabled={workingId === notification.id}
                                onClick={() =>
                                  void setReadState(notification, !unread)
                                }
                                className="flex min-h-11 items-center gap-3 border-b border-[var(--loombus-border)] px-4 text-left text-sm font-semibold transition hover:bg-[var(--loombus-surface-muted)] disabled:opacity-45"
                              >
                                {unread ? (
                                  <Eye aria-hidden="true" className="h-4 w-4" />
                                ) : (
                                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                                )}
                                {unread ? "Mark as read" : "Mark as unread"}
                              </button>
                              <Link
                                href="/settings"
                                onClick={onClose}
                                className="flex min-h-11 items-center gap-3 border-b border-[var(--loombus-border)] px-4 text-sm font-semibold no-underline transition hover:bg-[var(--loombus-surface-muted)]"
                              >
                                <Settings aria-hidden="true" className="h-4 w-4" />
                                Manage notifications like this
                              </Link>
                              <button
                                type="button"
                                disabled={workingId === notification.id}
                                onClick={() =>
                                  void deleteNotification(notification.id)
                                }
                                className="flex min-h-11 items-center gap-3 px-4 text-left text-sm font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-45"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                                Delete notification
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setExpanded((current) => !current);
          setTopMenuOpen(false);
          setItemMenuId(null);
        }}
        className="flex min-h-12 items-center justify-center border-0 border-t border-solid border-[var(--loombus-border)] bg-transparent px-4 py-3 text-sm font-bold text-[var(--loombus-gold-deep)] transition hover:bg-[var(--loombus-surface-muted)]"
      >
        {expanded ? "Show fewer notifications" : "See earlier notifications"}
      </button>
    </div>
  );
}
