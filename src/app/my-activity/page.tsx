"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      const [
        { data: discussionData },
        { data: replyData },
        { data: bookmarkData },
        { data: notificationData },
        { count: totalDiscussions },
        { count: totalReplies },
        { count: totalSaved },
        { count: unreadNotifications },
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
          .select("id, type, target_type, target_id, message, read_at, created_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false })
          .limit(6),

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
          .select("*", { count: "exact", head: true })
          .eq("user_id", userData.user.id)
          .is("read_at", null),
      ]);

      const loadedReplies = (replyData ?? []) as Reply[];
      const loadedBookmarks = (bookmarkData ?? []) as Bookmark[];

      setDiscussions((discussionData ?? []) as Discussion[]);
      setReplies(loadedReplies);
      setNotifications((notificationData ?? []) as Notification[]);
      setActivityTotals({
        discussions: totalDiscussions ?? 0,
        replies: totalReplies ?? 0,
        saved: totalSaved ?? 0,
        unreadNotifications: unreadNotifications ?? 0,
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

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", bookmarkId)
      .eq("user_id", currentUserId);

    setRemovingSavedId(null);

    if (error) {
      setMessage("Unable to remove saved discussion.");
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

        <div className="mb-12">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            My Activity
          </p>

          <h1 className="text-5xl font-semibold tracking-tight">
            Activity Overview
          </h1>

          <p className="mt-4 text-zinc-500">
            A consolidated view of your discussions, replies, saved items, and notifications.
          </p>
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
          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
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
                <p className="text-sm text-zinc-500">No discussions yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
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
                <p className="text-sm text-zinc-500">No replies yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
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
                <p className="text-sm text-zinc-500">No saved discussions yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="text-2xl font-medium">Notifications</h2>
              <Link href="/notifications" className="text-sm text-zinc-400 hover:text-white">
                View all →
              </Link>
            </div>

            <div className="space-y-4">
              {notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={getNotificationHref(notification)}
                  className="block rounded-2xl border border-zinc-900 bg-black p-4 transition hover:border-zinc-700"
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
                </Link>
              ))}

              {notifications.length === 0 && (
                <p className="text-sm text-zinc-500">No notifications yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
