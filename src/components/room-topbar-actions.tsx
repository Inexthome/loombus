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
import { supabase } from "@/lib/supabase/client";

type ViewerProfile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

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
  const [menuOpen, setMenuOpen] = useState(false);
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
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("room_id", roomId)
        .is("read_at", null),
    ]);

    if (!profileResult.error) {
      setProfile((profileResult.data ?? null) as ViewerProfile | null);
    }
    if (!notificationResult.error) {
      setUnreadCount(notificationResult.count ?? 0);
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

  if (!roomId || !authorized || pathname.endsWith("/billing/success")) return null;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
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

      <Link
        href={`/notifications?room=${encodeURIComponent(roomId)}`}
        className="room-phase4-icon-action"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread Room notifications`
            : "Room notifications"
        }
      >
        <Bell aria-hidden="true" />
        {unreadCount > 0 ? (
          <strong>{unreadCount > 99 ? "99+" : unreadCount}</strong>
        ) : null}
      </Link>

      <div className="room-phase4-account" ref={menuRef}>
        <button
          type="button"
          className="room-phase4-account-trigger"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
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
