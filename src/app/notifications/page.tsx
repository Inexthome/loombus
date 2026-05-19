"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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
};

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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function markNotificationIdsRead(ids: string[], userId: string) {
    if (ids.length === 0) {
      return;
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
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        ids.includes(notification.id)
          ? { ...notification, read_at: readAt }
          : notification
      )
    );

    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  useEffect(() => {
    async function loadNotifications() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });

      const loadedNotifications = (data ?? []) as Notification[];

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
          .select("id, username, full_name")
          .in("id", actorIds);

        const profileMap: Record<string, Profile> = {};

        for (const profile of profileData ?? []) {
          profileMap[profile.id] = profile;
        }

        setProfiles(profileMap);
      }

      setNotifications(loadedNotifications);
      setLoading(false);

      const unreadIds = loadedNotifications
        .filter((notification) => !notification.read_at)
        .map((notification) => notification.id);

      await markNotificationIdsRead(unreadIds, userData.user.id);
    }

    loadNotifications();
  }, []);

  async function markRead(id: string) {
    if (!currentUserId) {
      return;
    }

    await markNotificationIdsRead([id], currentUserId);
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;

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
            <div className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500">
              {unreadCount === 0
                ? "All caught up"
                : `${unreadCount} unread`}
            </div>
          )}
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
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

        <div className="space-y-4">
          {notifications.map((notification) => {
            const href = getNotificationHref(notification, profiles);

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

                <p className="mb-3 text-zinc-300">
                  {getNotificationMessage(notification, profiles)}
                </p>

                <p className="mb-4 text-sm text-zinc-600">
                  {new Date(notification.created_at).toLocaleString()}
                </p>

                <div className="flex flex-wrap gap-3">
                  {href && (
                    <Link
                      href={href}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                    >
                      {getNotificationActionLabel(notification)}
                    </Link>
                  )}

                  {!notification.read_at && (
                    <button
                      onClick={() => markRead(notification.id)}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
