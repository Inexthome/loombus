"use client";

import Link from "next/link";
import {
  Bell,
  ChevronDown,
  DoorOpen,
  LogOut,
  Search,
  Settings,
  UserRound,
} from "lucide-react";
import { useParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ProfileAvatar,
  getProfileDisplayName,
} from "@/components/profile-avatar";
import { useRoomWorkspace } from "@/components/room-workspace-context";
import { signOutCurrentDevice } from "@/lib/auth-sign-out";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";

type ViewerProfile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type RoomNotification = {
  id: string;
  message: string;
  created_at: string;
  target_type: string;
};

function notificationTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "New";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function RoomTopbarActions() {
  const params = useParams();
  const pathname = usePathname();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const { openFeature } = useRoomWorkspace();
  const [authorized, setAuthorized] = useState(false);
  const [profile, setProfile] = useState<ViewerProfile | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [roomNotifications, setRoomNotifications] = useState<RoomNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadViewer = useCallback(async () => {
    if (!roomId) {
      setAuthorized(false);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    const user = session?.user;
    if (!user || !session?.access_token) {
      setAuthorized(false);
      setProfile(null);
      setUnreadCount(0);
      setRoomNotifications([]);
      return;
    }

    const shellResponse = await fetch(
      `/api/rooms/${encodeURIComponent(roomId)}/shell`,
      {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      }
    );
    if (!shellResponse.ok) {
      setAuthorized(false);
      setMenuOpen(false);
      return;
    }
    setAuthorized(true);

    const [profileResult, notificationResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("notifications")
        .select("id, message, created_at, target_type", { count: "exact" })
        .eq("user_id", user.id)
        .eq("room_id", roomId)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (!profileResult.error) {
      setProfile((profileResult.data ?? null) as ViewerProfile | null);
    }
    if (!notificationResult.error) {
      setUnreadCount(notificationResult.count ?? 0);
      setRoomNotifications((notificationResult.data ?? []) as RoomNotification[]);
    }
  }, [roomId]);

  useEffect(() => {
    setAuthorized(false);
    void loadViewer();
    const refresh = () => void loadViewer();
    window.addEventListener("loombus:notifications-changed", refresh);
    window.addEventListener("loombus:room-activity-changed", refresh);
    const interval = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("loombus:notifications-changed", refresh);
      window.removeEventListener("loombus:room-activity-changed", refresh);
      window.clearInterval(interval);
    };
  }, [loadViewer]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const close = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);

  if (!roomId || !authorized || pathname.endsWith("/billing/success")) return null;

  async function signOut() {
    await signOutCurrentDevice();
    window.location.href = "/login";
  }

  async function markRoomNotificationRead(notificationId: string) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("user_id", data.user.id);
    setRoomNotifications((current) => current.filter((item) => item.id !== notificationId));
    setUnreadCount((current) => Math.max(0, current - 1));
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  return (
    <div className="room-phase4-topbar-actions" aria-label="Room quick actions">
      <button
        type="button"
        className="room-phase4-search-action"
        onClick={(event) =>
          openFeature(
            {
              id: "foundation:search",
              kind: "foundation",
              panel: "search",
              label: "Search this Room",
            },
            event.currentTarget
          )
        }
      >
        <Search aria-hidden="true" />
        <span>Search this Room</span>
        <kbd>⌘ K</kbd>
      </button>

      <div className="room-phase4-notifications" ref={notificationsRef}>
        <button
          type="button"
          className="room-phase4-icon-action"
          aria-haspopup="menu"
          aria-expanded={notificationsOpen}
          aria-label={
            unreadCount > 0
              ? `${unreadCount} unread Room notifications`
              : "Room notifications"
          }
          onClick={() => {
            setMenuOpen(false);
            setNotificationsOpen((current) => !current);
          }}
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong>
          ) : null}
        </button>

        {notificationsOpen ? (
          <div className="room-phase4-notification-menu" role="menu">
            <div className="room-phase4-notification-head">
              <div><span>Room notifications</span><strong>New activity</strong></div>
              <small>{unreadCount} unread</small>
            </div>
            {roomNotifications.length > 0 ? (
              <div className="room-phase4-notification-list">
                {roomNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={
                      notification.target_type === "room_moderation_item"
                        ? `/rooms/${encodeURIComponent(roomId)}/moderation`
                        : `/rooms/${encodeURIComponent(roomId)}`
                    }
                    role="menuitem"
                    onClick={() => {
                      setNotificationsOpen(false);
                      void markRoomNotificationRead(notification.id);
                    }}
                  >
                    <span>{normalizePublicText(notification.message)}</span>
                    <time>{notificationTime(notification.created_at)}</time>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="room-phase4-notification-empty">You are all caught up.</p>
            )}
            <Link
              href={`/notifications?room=${encodeURIComponent(roomId)}`}
              className="room-phase4-notification-all"
              onClick={() => setNotificationsOpen(false)}
            >
              View all Room notifications
            </Link>
          </div>
        ) : null}
      </div>

      <div className="room-phase4-account" ref={menuRef}>
        <button
          type="button"
          className="room-phase4-account-trigger"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => {
            setNotificationsOpen(false);
            setMenuOpen((current) => !current);
          }}
        >
          <ProfileAvatar profile={profile} size="md" />
          <ChevronDown aria-hidden="true" />
          <span className="sr-only">Open account menu</span>
        </button>

        {menuOpen ? (
          <div className="room-phase4-account-menu" role="menu">
            <div className="room-phase4-account-summary">
              <ProfileAvatar profile={profile} size="md" />
              <div>
                <strong>{getProfileDisplayName(profile)}</strong>
                {profile?.username ? <span>@{profile.username}</span> : null}
              </div>
            </div>
            <Link href="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
              <UserRound aria-hidden="true" /> Profile
            </Link>
            <Link href="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
              <Settings aria-hidden="true" /> Account settings
            </Link>
            <Link href="/rooms" role="menuitem" onClick={() => setMenuOpen(false)}>
              <DoorOpen aria-hidden="true" /> All Rooms
            </Link>
            <button type="button" role="menuitem" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
