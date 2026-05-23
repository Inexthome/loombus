"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  deleted_at?: string | null;
};

type Reply = {
  id: string;
  body: string;
  discussion_id: string;
  created_at: string;
};

type Bookmark = {
  id: string;
  discussion_id: string;
  created_at: string;
};

type SavedDiscussion = {
  bookmark_id: string;
  created_at: string;
  discussion: Discussion;
};

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

type ActivityTotals = {
  discussions: number;
  replies: number;
  saved: number;
  unreadNotifications: number;
};

type Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function MyActivityPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [savedDiscussions, setSavedDiscussions] = useState<SavedDiscussion[]>([]);
  const [replyDiscussions, setReplyDiscussions] = useState<Record<string, Discussion>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [removingSavedId, setRemovingSavedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activityTotals, setActivityTotals] = useState<ActivityTotals>({
    discussions: 0,
    replies: 0,
    saved: 0,
    unreadNotifications: 0,
  });
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", userData.user.id)
        .maybeSingle();

      setCurrentProfile(profileData ?? null);

      setCurrentUserId(userData.user.id);

      const blockedRelationshipUserIds = await getBlockedRelationshipUserIds(
        supabase,
        userData.user.id
      );

      const [
        { data: discussionData },
        { data: replyData },
        { data: bookmarkData },
        { data: notificationData },
        { count: totalDiscussions },
        { count: totalReplies },
        { count: totalSaved },
        { data: unreadNotificationData },
      ] = await Promise.all([
        supabase
          .from("discussions")
          .select("id, title, topic, body, created_at")
          .eq("user_id", userData.user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("replies")
          .select("id, body, discussion_id, created_at")
          .eq("user_id", userData.user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("bookmarks")
          .select("id, discussion_id, created_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(6),

        supabase
          .from("notifications")
          .select("id, actor_id, type, target_type, target_id, message, read_at, created_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(20),

        supabase
          .from("discussions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userData.user.id)
          .is("deleted_at", null),

        supabase
          .from("replies")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userData.user.id)
          .is("deleted_at", null),

        supabase
          .from("bookmarks")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userData.user.id),

        supabase
          .from("notifications")
          .select("id, actor_id")
          .eq("user_id", userData.user.id)
          .is("read_at", null),
      ]);

      const loadedReplies = (replyData ?? []) as Reply[];
      const loadedBookmarks = (bookmarkData ?? []) as Bookmark[];
      const visibleNotifications = filterBlockedActorNotifications(
        (notificationData ?? []) as Notification[],
        blockedRelationshipUserIds
      ).slice(0, 6);
      const visibleUnreadNotifications = filterBlockedActorNotifications(
        unreadNotificationData ?? [],
        blockedRelationshipUserIds
      );

      setDiscussions((discussionData ?? []) as Discussion[]);
      setReplies(loadedReplies);
      setNotifications(visibleNotifications);
      setActivityTotals({
        discussions: totalDiscussions ?? 0,
        replies: totalReplies ?? 0,
        saved: totalSaved ?? 0,
        unreadNotifications: visibleUnreadNotifications.length,
      });

      const replyDiscussionIds = [
        ...new Set(loadedReplies.map((reply) => reply.discussion_id)),
      ];

      if (replyDiscussionIds.length > 0) {
        const { data: replyDiscussionData } = await supabase
          .from("discussions")
          .select("id, title, topic, body, created_at, deleted_at")
          .in("id", replyDiscussionIds);

        const discussionMap: Record<string, Discussion> = {};

        for (const discussion of replyDiscussionData ?? []) {
          discussionMap[discussion.id] = discussion;
        }

        setReplyDiscussions(discussionMap);
      }

      const savedDiscussionIds = [
        ...new Set(loadedBookmarks.map((bookmark) => bookmark.discussion_id)),
      ];

      if (savedDiscussionIds.length > 0) {
        const { data: savedDiscussionData } = await supabase
          .from("discussions")
          .select("id, title, topic, body, created_at, deleted_at")
          .in("id", savedDiscussionIds)
          .is("deleted_at", null);

        const savedMap = new Map(
          (savedDiscussionData ?? []).map((discussion) => [
            discussion.id,
            discussion as Discussion,
          ])
        );

        setSavedDiscussions(
          loadedBookmarks
            .map((bookmark) => {
              const discussion = savedMap.get(bookmark.discussion_id);

              if (!discussion) {
                return null;
              }

              return {
                bookmark_id: bookmark.id,
                created_at: bookmark.created_at,
                discussion,
              };
            })
            .filter((item): item is SavedDiscussion => Boolean(item))
        );
      }

      setLoading(false);
    }

    loadActivity();
  }, []);

  async function removeSavedDiscussion(bookmarkId: string) {
    setMessage("");

    if (!currentUserId || removingSavedId) {
      return;
    }

    setRemovingSavedId(bookmarkId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setRemovingSavedId(null);
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/bookmarks", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        bookmarkId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setRemovingSavedId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to remove saved discussion.");
      return;
    }

    setSavedDiscussions((current) =>
      current.filter((item) => item.bookmark_id !== bookmarkId)
    );

    setMessage("Saved discussion removed.");
  }

  function getNotificationHref(notification: Notification) {
    if (notification.target_type === "discussion" && notification.target_id) {
      return `/discussions/${notification.target_id}`;
    }

    return "/notifications";
  }

  async function openNotification(notification: Notification) {
    const href = getNotificationHref(notification);

    if (!notification.read_at && currentUserId) {
      const readAt = new Date().toISOString();

      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id
            ? { ...item, read_at: readAt }
            : item
        )
      );

      setActivityTotals((current) => ({
        ...current,
        unreadNotifications: Math.max(0, current.unreadNotifications - 1),
      }));

      const { error } = await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id)
        .eq("user_id", currentUserId);

      if (error) {
        console.error("Unable to mark notification as read:", error.message);
      }
    }

    window.location.href = href;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading your activity...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/dashboard"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to dashboard
        </Link>

        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
              My Activity
            </p>

            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              Activity Overview
            </h1>

            <p className="mt-4 text-zinc-500">
              A consolidated view of your discussions, replies, saved items, and notifications.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <ProfileAvatar profile={currentProfile} size="xl" />

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                Signed in as
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                {getProfileDisplayName(currentProfile)}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="mb-4 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Activity shortcuts
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/my-discussions"
              className="rounded-xl border border-zinc-900 bg-black px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              My Discussions →
            </Link>

            <Link
              href="/my-replies"
              className="rounded-xl border border-zinc-900 bg-black px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              My Replies →
            </Link>

            <Link
              href="/following"
              className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-700"
            >
              <p className="mb-2 text-sm uppercase tracking-[0.2em] text-zinc-600">
                Social Feed
              </p>

              <h3 className="text-xl font-medium">
                Following Feed →
              </h3>

              <p className="mt-3 text-sm text-zinc-500">
                See discussions from the people you follow.
              </p>
            </Link>

            {currentProfile?.username && (
              <>
                <Link
                  href={`/u/${currentProfile.username}/followers`}
                  className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-700"
                >
                  <p className="mb-2 text-sm uppercase tracking-[0.2em] text-zinc-600">
                    Social
                  </p>

                  <h3 className="text-xl font-medium">
                    Followers →
                  </h3>

                  <p className="mt-3 text-sm text-zinc-500">
                    See who follows your public Loombus profile.
                  </p>
                </Link>

                <Link
                  href={`/u/${currentProfile.username}/following`}
                  className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-700"
                >
                  <p className="mb-2 text-sm uppercase tracking-[0.2em] text-zinc-600">
                    Social
                  </p>

                  <h3 className="text-xl font-medium">
                    Following List →
                  </h3>

                  <p className="mt-3 text-sm text-zinc-500">
                    See the profiles you follow.
                  </p>
                </Link>
              </>
            )}

            <Link
              href="/saved"
              className="rounded-xl border border-zinc-900 bg-black px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Saved →
            </Link>

            <Link
              href="/notifications"
              className="rounded-xl border border-zinc-900 bg-black px-4 py-3 text-sm text-zinc-300 transition hover:border-zinc-700 hover:text-white"
            >
              Notifications →
            </Link>
          </div>
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/my-discussions"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-700"
          >
            <p className="mb-2 text-sm text-zinc-500">Total discussions</p>
            <p className="text-4xl font-semibold">{activityTotals.discussions}</p>
          </Link>

          <Link
            href="/my-replies"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-700"
          >
            <p className="mb-2 text-sm text-zinc-500">Total replies</p>
            <p className="text-4xl font-semibold">{activityTotals.replies}</p>
          </Link>

          <Link
            href="/saved"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-700"
          >
            <p className="mb-2 text-sm text-zinc-500">Total saved</p>
            <p className="text-4xl font-semibold">{activityTotals.saved}</p>
          </Link>

          <Link
            href="/notifications"
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition hover:border-zinc-700"
          >
            <p className="mb-2 text-sm text-zinc-500">Unread notifications</p>
            <p className="text-4xl font-semibold">{activityTotals.unreadNotifications}</p>
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-medium">My Discussions</h2>
              <Link href="/my-discussions" className="text-sm text-zinc-400 hover:text-white">
                View all →
              </Link>
            </div>

            <div className="space-y-4">
              {discussions.map((discussion) => (
                <Link
                  key={discussion.id}
                  href={`/discussions/${discussion.id}`}
                  className="block rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700"
                >
                  <p className="mb-2 text-sm text-zinc-500">{discussion.topic}</p>
                  <h3 className="mb-2 text-lg font-medium">{discussion.title}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-zinc-500">
                    {discussion.body}
                  </p>
                </Link>
              ))}

              {discussions.length === 0 && (
                <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                  <p className="mb-2 text-sm font-medium text-zinc-300">
                    No discussions yet.
                  </p>

                  <p className="mb-4 text-sm leading-relaxed text-zinc-600">
                    Start one clear question, claim, or idea so people have something useful to respond to.
                  </p>

                  <Link
                    href="/create"
                    className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
                  >
                    Create your first discussion →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-medium">My Replies</h2>
              <Link href="/my-replies" className="text-sm text-zinc-400 hover:text-white">
                View all →
              </Link>
            </div>

            <div className="space-y-4">
              {replies.map((reply) => {
                const discussion = replyDiscussions[reply.discussion_id];

                return (
                  <Link
                    key={reply.id}
                    href={`/discussions/${reply.discussion_id}`}
                    className="block rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700"
                  >
                    <p className="mb-2 text-sm text-zinc-500">
                      {discussion?.title ?? "Discussion unavailable"}
                    </p>

                    <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                      {reply.body}
                    </p>
                  </Link>
                );
              })}

              {replies.length === 0 && (
                <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                  <p className="mb-2 text-sm font-medium text-zinc-300">
                    No replies yet.
                  </p>

                  <p className="mb-4 text-sm leading-relaxed text-zinc-600">
                    Join a discussion with context, examples, experience, or a useful counterpoint.
                  </p>

                  <Link
                    href="/discussions"
                    className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
                  >
                    Find a discussion to join →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-medium">Saved</h2>
              <Link href="/saved" className="text-sm text-zinc-400 hover:text-white">
                View all →
              </Link>
            </div>

            <div className="space-y-4">
              {savedDiscussions.map((savedItem) => {
                const discussion = savedItem.discussion;

                return (
                  <div
                    key={savedItem.bookmark_id}
                    className="rounded-2xl border border-zinc-900 bg-black p-4"
                  >
                    <Link
                      href={`/discussions/${discussion.id}`}
                      className="block transition hover:opacity-90"
                    >
                      <p className="mb-2 text-sm text-zinc-500">{discussion.topic}</p>
                      <h3 className="mb-4 text-lg font-medium">{discussion.title}</h3>
                    </Link>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-zinc-600">
                        Saved {new Date(savedItem.created_at).toLocaleDateString()}
                      </p>

                      <button
                        type="button"
                        onClick={() => removeSavedDiscussion(savedItem.bookmark_id)}
                        disabled={removingSavedId === savedItem.bookmark_id}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {removingSavedId === savedItem.bookmark_id
                          ? "Removing..."
                          : "Unsave"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {savedDiscussions.length === 0 && (
                <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                  <p className="mb-2 text-sm font-medium text-zinc-300">
                    No saved discussions yet.
                  </p>

                  <p className="mb-4 text-sm leading-relaxed text-zinc-600">
                    Save discussions that are worth revisiting, comparing, citing, or building on later.
                  </p>

                  <Link
                    href="/discussions"
                    className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
                  >
                    Browse discussions to save →
                  </Link>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-medium">Notifications</h2>
              <Link href="/notifications" className="text-sm text-zinc-400 hover:text-white">
                View all →
              </Link>
            </div>

            <div className="space-y-4">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="block w-full rounded-2xl border border-zinc-900 bg-black p-4 text-left transition hover:border-zinc-700"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {!notification.read_at && (
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-black">
                        New
                      </span>
                    )}

                    <span className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                      {notification.type}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed text-zinc-400">
                    {notification.message}
                  </p>
                </button>
              ))}

              {notifications.length === 0 && (
                <div className="rounded-2xl border border-zinc-900 bg-black p-5">
                  <p className="mb-2 text-sm font-medium text-zinc-300">
                    No notifications yet.
                  </p>

                  <p className="mb-4 text-sm leading-relaxed text-zinc-600">
                    Notifications appear when people reply, follow, or interact with activity connected to you.
                  </p>

                  <Link
                    href="/profile"
                    className="text-sm text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
                  >
                    Review notification settings →
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
