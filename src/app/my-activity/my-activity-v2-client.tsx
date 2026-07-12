"use client";

import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "./my-activity-v2.css";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
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
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type ActivityType = "all" | "discussion" | "reply" | "saved" | "notification";
type SortOrder = "newest" | "oldest";

type TimelineItem = {
  id: string;
  type: Exclude<ActivityType, "all">;
  title: string;
  description: string;
  createdAt: string;
  href: string;
  topic?: string;
  bookmarkId?: string;
  notification?: Notification;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getNotificationHref(notification: Notification) {
  if (notification.target_type === "discussion" && notification.target_id) {
    return `/discussions/${notification.target_id}`;
  }

  return "/notifications";
}

export default function MyActivityV2Client() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [discussionMap, setDiscussionMap] = useState<Record<string, Discussion>>({});
  const [totals, setTotals] = useState({ discussions: 0, replies: 0, saved: 0, unread: 0 });
  const [filter, setFilter] = useState<ActivityType>("all");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadActivity() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        if (!user) {
          window.location.href = "/login";
          return;
        }

        if (!alive) return;
        setUserId(user.id);

        const blockedIds = await getBlockedRelationshipUserIds(supabase, user.id);
        const [
          profileResult,
          discussionResult,
          replyResult,
          bookmarkResult,
          notificationResult,
          discussionCount,
          replyCount,
          bookmarkCount,
          unreadResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, username, avatar_url")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("discussions")
            .select("id, title, topic, body, created_at")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("replies")
            .select("id, body, discussion_id, created_at")
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("bookmarks")
            .select("id, discussion_id, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("notifications")
            .select("id, actor_id, type, target_type, target_id, message, read_at, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(40),
          supabase
            .from("discussions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("deleted_at", null),
          supabase
            .from("replies")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .is("deleted_at", null),
          supabase
            .from("bookmarks")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id),
          supabase
            .from("notifications")
            .select("id, actor_id")
            .eq("user_id", user.id)
            .is("read_at", null),
        ]);

        const loadedDiscussions = (discussionResult.data ?? []) as Discussion[];
        const loadedReplies = (replyResult.data ?? []) as Reply[];
        const loadedBookmarks = (bookmarkResult.data ?? []) as Bookmark[];
        const visibleNotifications = filterBlockedActorNotifications(
          (notificationResult.data ?? []) as Notification[],
          blockedIds
        ) as Notification[];
        const visibleUnread = filterBlockedActorNotifications(unreadResult.data ?? [], blockedIds);

        const relatedDiscussionIds = [
          ...new Set([
            ...loadedReplies.map((reply) => reply.discussion_id),
            ...loadedBookmarks.map((bookmark) => bookmark.discussion_id),
          ]),
        ];

        let relatedMap: Record<string, Discussion> = {};
        if (relatedDiscussionIds.length > 0) {
          const { data } = await supabase
            .from("discussions")
            .select("id, title, topic, body, created_at")
            .in("id", relatedDiscussionIds)
            .is("deleted_at", null);

          relatedMap = Object.fromEntries(
            ((data ?? []) as Discussion[]).map((discussion) => [discussion.id, discussion])
          );
        }

        if (!alive) return;
        setProfile((profileResult.data ?? null) as Profile | null);
        setDiscussions(loadedDiscussions);
        setReplies(loadedReplies);
        setBookmarks(loadedBookmarks.filter((bookmark) => relatedMap[bookmark.discussion_id]));
        setNotifications(visibleNotifications);
        setDiscussionMap({
          ...Object.fromEntries(loadedDiscussions.map((discussion) => [discussion.id, discussion])),
          ...relatedMap,
        });
        setTotals({
          discussions: discussionCount.count ?? 0,
          replies: replyCount.count ?? 0,
          saved: bookmarkCount.count ?? 0,
          unread: visibleUnread.length,
        });
      } catch (error) {
        console.error("Unable to load My Activity", error);
        if (alive) setNotice("Your activity could not be loaded. Refresh and try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadActivity();
    return () => {
      alive = false;
    };
  }, []);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [
      ...discussions.map((discussion) => ({
        id: `discussion-${discussion.id}`,
        type: "discussion" as const,
        title: normalizePublicText(discussion.title),
        description: normalizePublicText(discussion.body),
        createdAt: discussion.created_at,
        href: `/discussions/${discussion.id}`,
        topic: discussion.topic,
      })),
      ...replies.map((reply) => {
        const discussion = discussionMap[reply.discussion_id];
        return {
          id: `reply-${reply.id}`,
          type: "reply" as const,
          title: discussion?.title
            ? `Replied to “${normalizePublicText(discussion.title)}”`
            : "Replied to a discussion",
          description: normalizePublicText(reply.body),
          createdAt: reply.created_at,
          href: `/discussions/${reply.discussion_id}`,
          topic: discussion?.topic,
        };
      }),
      ...bookmarks.map((bookmark) => {
        const discussion = discussionMap[bookmark.discussion_id];
        return {
          id: `saved-${bookmark.id}`,
          type: "saved" as const,
          title: discussion ? `Saved “${normalizePublicText(discussion.title)}”` : "Saved discussion",
          description: discussion ? normalizePublicText(discussion.body) : "Saved for later review.",
          createdAt: bookmark.created_at,
          href: `/discussions/${bookmark.discussion_id}`,
          topic: discussion?.topic,
          bookmarkId: bookmark.id,
        };
      }),
      ...notifications.map((notification) => ({
        id: `notification-${notification.id}`,
        type: "notification" as const,
        title: notification.read_at ? "Notification" : "New notification",
        description: normalizePublicText(notification.message),
        createdAt: notification.created_at,
        href: getNotificationHref(notification),
        topic: notification.type,
        notification,
      })),
    ];

    const needle = query.trim().toLowerCase();
    return items
      .filter((item) => filter === "all" || item.type === filter)
      .filter((item) => {
        if (!needle) return true;
        return [item.title, item.description, item.topic, item.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        const delta = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        return sort === "newest" ? delta : -delta;
      });
  }, [bookmarks, discussionMap, discussions, filter, notifications, query, replies, sort]);

  async function removeBookmark(bookmarkId: string) {
    if (!userId || removingId) return;
    setRemovingId(bookmarkId);
    setNotice("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/bookmarks", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookmarkId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to remove saved discussion.");

      setBookmarks((current) => current.filter((bookmark) => bookmark.id !== bookmarkId));
      setTotals((current) => ({ ...current, saved: Math.max(0, current.saved - 1) }));
      setNotice("Saved discussion removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to remove saved discussion.");
    } finally {
      setRemovingId(null);
    }
  }

  async function openNotification(notification: Notification) {
    if (!notification.read_at && userId) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => (item.id === notification.id ? { ...item, read_at: readAt } : item))
      );
      setTotals((current) => ({ ...current, unread: Math.max(0, current.unread - 1) }));
      await supabase
        .from("notifications")
        .update({ read_at: readAt })
        .eq("id", notification.id)
        .eq("user_id", userId);
    }

    window.location.href = getNotificationHref(notification);
  }

  if (loading) {
    return (
      <main className="my-activity-v2-page">
        <section className="my-activity-v2-state">
          <p>Personal activity</p>
          <h1>Building your activity timeline…</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="my-activity-v2-page">
      <div className="my-activity-v2-shell">
        <header className="my-activity-v2-hero">
          <div>
            <p className="my-activity-v2-eyebrow">My Activity</p>
            <h1>Your Loombus trail, in one place.</h1>
            <p>
              Review what you created, where you replied, what you saved, and the signals that need your attention.
            </p>
          </div>
          <div className="my-activity-v2-profile">
            <ProfileAvatar profile={profile} size="xl" />
            <div>
              <span>Signed in as</span>
              <strong>{getProfileDisplayName(profile)}</strong>
              {profile?.username ? <Link href={`/u/${profile.username}`}>View public profile</Link> : <Link href="/profile">Complete profile</Link>}
            </div>
          </div>
        </header>

        <section className="my-activity-v2-metrics" aria-label="Activity totals">
          {[
            ["Discussions", totals.discussions, "/my-discussions"],
            ["Replies", totals.replies, "/my-replies"],
            ["Saved", totals.saved, "/saved"],
            ["Unread", totals.unread, "/notifications"],
          ].map(([label, value, href]) => (
            <Link key={label} href={String(href)}>
              <span>{label}</span>
              <strong>{value}</strong>
            </Link>
          ))}
        </section>

        {notice ? <div className="my-activity-v2-notice">{notice}</div> : null}

        <section className="my-activity-v2-controls" aria-label="Activity filters">
          <label>
            <span>Search activity</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, replies, saves, or notifications" />
          </label>
          <label>
            <span>Type</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as ActivityType)}>
              <option value="all">All activity</option>
              <option value="discussion">Discussions</option>
              <option value="reply">Replies</option>
              <option value="saved">Saved</option>
              <option value="notification">Notifications</option>
            </select>
          </label>
          <label>
            <span>Order</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </section>

        <div className="my-activity-v2-layout">
          <section className="my-activity-v2-timeline">
            <div className="my-activity-v2-section-heading">
              <div>
                <p>Unified timeline</p>
                <h2>{timeline.length} visible activities</h2>
              </div>
              <Link href="/reading-history">Open reading history</Link>
            </div>

            {timeline.length === 0 ? (
              <div className="my-activity-v2-empty">
                <h3>No matching activity.</h3>
                <p>Adjust the filters or create a discussion to begin building your activity trail.</p>
                <Link href="/create">Start a discussion</Link>
              </div>
            ) : (
              <div className="my-activity-v2-list">
                {timeline.map((item) => (
                  <article key={item.id} className={`is-${item.type}`}>
                    <div className="my-activity-v2-rail" aria-hidden="true"><span /></div>
                    <div className="my-activity-v2-card">
                      <div className="my-activity-v2-meta">
                        <span>{item.type}</span>
                        {item.topic ? <span>{item.topic}</span> : null}
                        <time>{formatDate(item.createdAt)}</time>
                      </div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                      <div className="my-activity-v2-actions">
                        {item.notification ? (
                          <button type="button" onClick={() => void openNotification(item.notification!)}>Open</button>
                        ) : (
                          <Link href={item.href}>Open</Link>
                        )}
                        {item.bookmarkId ? (
                          <button type="button" onClick={() => void removeBookmark(item.bookmarkId!)} disabled={removingId === item.bookmarkId}>
                            {removingId === item.bookmarkId ? "Removing…" : "Unsave"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="my-activity-v2-sidebar">
            <section>
              <p>Activity shortcuts</p>
              <nav>
                <Link href="/my-discussions">My Discussions</Link>
                <Link href="/my-replies">My Replies</Link>
                <Link href="/saved">Saved</Link>
                <Link href="/notifications">Notifications</Link>
                <Link href="/following">Following feed</Link>
                <Link href="/reading-history">Reading history</Link>
              </nav>
            </section>
            <section>
              <p>Build more signal</p>
              <h2>Your activity becomes useful when it tells a story.</h2>
              <span>Create focused discussions, leave useful replies, and save work worth revisiting.</span>
              <Link href="/discussions">Browse discussions</Link>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
