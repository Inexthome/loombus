"use client";

import { normalizePublicText } from "@/lib/public-text";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bookmark,
  ChevronRight,
  Eye,
  Folder,
  MessageCircle,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import {
  ProfileAvatar,
  getProfileDisplayName,
} from "@/components/profile-avatar";

const MAX_SIDE_TOPICS = 7;
const MAX_TRENDING_TOPICS = 5;
const MAX_TOP_CONTRIBUTORS = 5;
const MAX_SAVED_FOLDERS = 4;

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  reality_lens: string | null;
  purpose_lane: string | null;
  body: string;
  created_at: string;
  discussion_status?: "open" | "resolved" | null;
  resolved_at?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type FeedMode = "all" | "following" | "research" | "debate" | "problem" | "saved";

type TopicStat = {
  topic: string;
  count: number;
  signals: number;
};

type ContributorStat = {
  userId: string;
  profile: Profile | undefined;
  discussions: number;
  signals: number;
};

const feedTabs: { key: FeedMode; label: string }[] = [
  { key: "all", label: "All" },
  { key: "following", label: "Following" },
  { key: "research", label: "Research Questions" },
  { key: "debate", label: "Debates" },
  { key: "problem", label: "Problem Solving" },
  { key: "saved", label: "Saved" },
];

function escapeLimitedHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hasLimitedFormattingHtml(value: string) {
  return /<\/?(strong|b|em|i|br|p|div)\b/i.test(value);
}

function sanitizeLimitedDiscussionHtml(value: string) {
  const pattern = /<\/?(strong|b|em|i|br|p|div)\b[^>]*>/gi;
  let safe = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    safe += escapeLimitedHtml(value.slice(lastIndex, match.index));

    const rawTag = match[0].toLowerCase();
    const tagName = match[1].toLowerCase();
    const normalizedTag =
      tagName === "b" ? "strong" : tagName === "i" ? "em" : tagName;

    if (normalizedTag === "br") {
      safe += "<br>";
    } else if (rawTag.startsWith("</")) {
      safe += `</${normalizedTag}>`;
    } else {
      safe += `<${normalizedTag}>`;
    }

    lastIndex = pattern.lastIndex;
  }

  safe += escapeLimitedHtml(value.slice(lastIndex));

  return safe
    .replace(/<div><br><\/div>/gi, "<br>")
    .replace(/<p><br><\/p>/gi, "<br>");
}

function legacyMarkdownBodyToSafeHtml(value: string) {
  const escaped = escapeLimitedHtml(value)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  return escaped
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function discussionBodyToSafeHtml(content: string) {
  if (hasLimitedFormattingHtml(content)) {
    return sanitizeLimitedDiscussionHtml(content);
  }

  return sanitizeLimitedDiscussionHtml(legacyMarkdownBodyToSafeHtml(content));
}

function getPlainDiscussionExcerpt(content: string) {
  return normalizePublicText(content)
    .replace(/<[^>]*>/g, " ")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function getDiscussionTopic(discussion: Discussion) {
  return discussion.topic?.trim() || "Other";
}

function getDiscussionModeLabel(discussion: Discussion) {
  const label = discussion.purpose_lane?.trim() || discussion.reality_lens?.trim();

  if (!label || label.toLowerCase() === "open discussion") {
    return "Discussion";
  }

  return label;
}

function getSignalScore(
  discussionId: string,
  replyCounts: Record<string, number>,
  bookmarkCounts: Record<string, number>,
  viewCounts: Record<string, number>
) {
  return (
    (replyCounts[discussionId] ?? 0) * 3 +
    (bookmarkCounts[discussionId] ?? 0) * 5 +
    (viewCounts[discussionId] ?? 0)
  );
}

function getProfileHandle(profile: Profile | undefined) {
  return profile?.username ? `@${profile.username}` : "@loombus";
}

function formatDiscussionDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function matchesModeFilter(discussion: Discussion, feedMode: FeedMode) {
  if (feedMode === "all" || feedMode === "following" || feedMode === "saved") {
    return true;
  }

  const text = [discussion.purpose_lane, discussion.reality_lens, discussion.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (feedMode === "research") {
    return text.includes("research") || text.includes("question");
  }

  if (feedMode === "debate") {
    return text.includes("debate");
  }

  return text.includes("problem") || text.includes("solving");
}

function matchesSearchQuery(
  discussion: Discussion,
  profile: Profile | undefined,
  query: string
) {
  if (!query) {
    return true;
  }

  const searchable = [
    discussion.title,
    discussion.body,
    discussion.topic,
    discussion.purpose_lane,
    discussion.reality_lens,
    profile?.full_name,
    profile?.username,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(query);
}

export default function DiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [latestReplyDates, setLatestReplyDates] = useState<Record<string, string>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});
  const [discussionTags, setDiscussionTags] = useState<Record<string, string[]>>({});
  const [followingUserIds, setFollowingUserIds] = useState<string[]>([]);
  const [savedDiscussionIds, setSavedDiscussionIds] = useState<Set<string>>(() => new Set());
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [feedMode, setFeedMode] = useState<FeedMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDiscussions() {
      setLoading(true);

      const { data, error } = await supabase
        .from("discussions")
        .select(
          "id, user_id, title, topic, reality_lens, purpose_lane, body, created_at, discussion_status, resolved_at"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error || !data) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      const { data: viewerData } = await supabase.auth.getUser();
      const viewerId = viewerData.user?.id ?? null;
      const hiddenProfileIds = new Set<string>();
      let viewerSavedDiscussionIds = new Set<string>();

      if (viewerId) {
        const { data: blockRows } = await supabase
          .from("user_blocks")
          .select("blocker_id, blocked_id")
          .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

        for (const block of (blockRows ?? []) as BlockRow[]) {
          hiddenProfileIds.add(
            block.blocker_id === viewerId ? block.blocked_id : block.blocker_id
          );
        }

        const { data: followsData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", viewerId);

        if (isMounted) {
          setFollowingUserIds(
            (followsData ?? [])
              .map((follow) => follow.following_id)
              .filter(
                (id): id is string =>
                  typeof id === "string" && !hiddenProfileIds.has(id)
              )
          );
        }
      } else if (isMounted) {
        setFollowingUserIds([]);
      }

      const visibleDiscussions = ((data ?? []) as Discussion[]).filter(
        (discussion) => !hiddenProfileIds.has(discussion.user_id)
      );

      const discussionIds = visibleDiscussions.map((discussion) => discussion.id);
      const userIds = [...new Set(visibleDiscussions.map((discussion) => discussion.user_id))];

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", userIds);

        if (isMounted) {
          const profileMap: Record<string, Profile> = {};

          for (const profile of (profileData ?? []) as Profile[]) {
            profileMap[profile.id] = profile;
          }

          setProfiles(profileMap);
        }
      } else if (isMounted) {
        setProfiles({});
      }

      if (discussionIds.length > 0) {
        const [replyResponse, viewResponse, bookmarkResponse, tagResponse] = await Promise.all([
          supabase
            .from("replies")
            .select("discussion_id, user_id, created_at")
            .in("discussion_id", discussionIds)
            .is("deleted_at", null),
          supabase
            .from("discussion_views")
            .select("discussion_id")
            .in("discussion_id", discussionIds),
          supabase
            .from("bookmarks")
            .select("discussion_id, user_id")
            .in("discussion_id", discussionIds),
          supabase
            .from("discussion_tags")
            .select("discussion_id, tag")
            .in("discussion_id", discussionIds),
        ]);

        const counts: Record<string, number> = {};
        const latestReplies: Record<string, string> = {};

        for (const reply of replyResponse.data ?? []) {
          if (hiddenProfileIds.has(reply.user_id)) {
            continue;
          }

          counts[reply.discussion_id] = (counts[reply.discussion_id] ?? 0) + 1;

          const existingLatest = latestReplies[reply.discussion_id];
          if (
            !existingLatest ||
            new Date(reply.created_at).getTime() > new Date(existingLatest).getTime()
          ) {
            latestReplies[reply.discussion_id] = reply.created_at;
          }
        }

        const views: Record<string, number> = {};
        for (const view of viewResponse.data ?? []) {
          views[view.discussion_id] = (views[view.discussion_id] ?? 0) + 1;
        }

        const bookmarks: Record<string, number> = {};
        for (const bookmark of bookmarkResponse.data ?? []) {
          bookmarks[bookmark.discussion_id] =
            (bookmarks[bookmark.discussion_id] ?? 0) + 1;

          if (viewerId && bookmark.user_id === viewerId) {
            viewerSavedDiscussionIds.add(bookmark.discussion_id);
          }
        }

        const tagMap: Record<string, string[]> = {};
        for (const row of tagResponse.data ?? []) {
          tagMap[row.discussion_id] = [
            ...(tagMap[row.discussion_id] ?? []),
            row.tag,
          ];
        }

        if (isMounted) {
          setReplyCounts(counts);
          setLatestReplyDates(latestReplies);
          setViewCounts(views);
          setBookmarkCounts(bookmarks);
          setDiscussionTags(tagMap);
          setSavedDiscussionIds(viewerSavedDiscussionIds);
        }
      } else if (isMounted) {
        setReplyCounts({});
        setLatestReplyDates({});
        setViewCounts({});
        setBookmarkCounts({});
        setDiscussionTags({});
        setSavedDiscussionIds(new Set());
      }

      if (isMounted) {
        setDiscussions(visibleDiscussions);
        setLoading(false);
      }
    }

    void loadDiscussions();

    function refreshDiscussionMetrics() {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      void loadDiscussions();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshDiscussionMetrics();
      }
    }

    window.addEventListener("focus", refreshDiscussionMetrics);
    window.addEventListener("pageshow", refreshDiscussionMetrics);
    window.addEventListener("loombus:discussion-metrics-changed", refreshDiscussionMetrics);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener("focus", refreshDiscussionMetrics);
      window.removeEventListener("pageshow", refreshDiscussionMetrics);
      window.removeEventListener("loombus:discussion-metrics-changed", refreshDiscussionMetrics);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const topicStats = useMemo(() => {
    const map = new Map<string, TopicStat>();

    for (const discussion of discussions) {
      const topic = getDiscussionTopic(discussion);
      const current = map.get(topic) ?? { topic, count: 0, signals: 0 };
      current.count += 1;
      current.signals += getSignalScore(
        discussion.id,
        replyCounts,
        bookmarkCounts,
        viewCounts
      );
      map.set(topic, current);
    }

    return [...map.values()].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return b.signals - a.signals;
    });
  }, [discussions, replyCounts, bookmarkCounts, viewCounts]);

  const visibleTopics = topicStats.slice(0, MAX_SIDE_TOPICS);
  const trendingTopics = [...topicStats]
    .sort((a, b) => b.signals - a.signals || b.count - a.count)
    .slice(0, MAX_TRENDING_TOPICS);

  const contributorStats = useMemo(() => {
    const map = new Map<string, ContributorStat>();

    for (const discussion of discussions) {
      const current = map.get(discussion.user_id) ?? {
        userId: discussion.user_id,
        profile: profiles[discussion.user_id],
        discussions: 0,
        signals: 0,
      };

      current.profile = profiles[discussion.user_id];
      current.discussions += 1;
      current.signals += getSignalScore(
        discussion.id,
        replyCounts,
        bookmarkCounts,
        viewCounts
      );
      map.set(discussion.user_id, current);
    }

    return [...map.values()]
      .sort((a, b) => b.signals - a.signals || b.discussions - a.discussions)
      .slice(0, MAX_TOP_CONTRIBUTORS);
  }, [discussions, profiles, replyCounts, bookmarkCounts, viewCounts]);

  const savedFolderStats = useMemo(() => {
    const map = new Map<string, number>();

    for (const discussion of discussions) {
      if (!savedDiscussionIds.has(discussion.id)) {
        continue;
      }

      const topic = getDiscussionTopic(discussion);
      map.set(topic, (map.get(topic) ?? 0) + 1);
    }

    return [...map.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_SAVED_FOLDERS);
  }, [discussions, savedDiscussionIds]);

  const filteredDiscussions = useMemo(() => {
    const followingUserIdSet = new Set(followingUserIds);
    const cleanQuery = searchQuery.trim().toLowerCase();

    return discussions.filter((discussion) => {
      const topic = getDiscussionTopic(discussion);
      const profile = profiles[discussion.user_id];
      const matchesTopic = selectedTopic === "All" || topic === selectedTopic;
      const matchesFollowing =
        feedMode !== "following" || followingUserIdSet.has(discussion.user_id);
      const matchesSaved =
        feedMode !== "saved" || savedDiscussionIds.has(discussion.id);
      const matchesMode = matchesModeFilter(discussion, feedMode);
      const matchesQuery = matchesSearchQuery(discussion, profile, cleanQuery);

      return matchesTopic && matchesFollowing && matchesSaved && matchesMode && matchesQuery;
    });
  }, [
    discussions,
    profiles,
    selectedTopic,
    feedMode,
    followingUserIds,
    savedDiscussionIds,
    searchQuery,
  ]);

  const hasActiveFilters =
    selectedTopic !== "All" || feedMode !== "all" || searchQuery.trim().length > 0;

  function resetFilters() {
    setSelectedTopic("All");
    setFeedMode("all");
    setSearchQuery("");
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[88rem] gap-6 xl:grid-cols-[14.5rem_minmax(0,1fr)_20rem]">
        <aside className="hidden xl:block">
          <section className="sticky top-28 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-2xl shadow-black/10">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text)]">
              Browse topics
            </p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedTopic("All")}
                className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                  selectedTopic === "All"
                    ? "bg-[color:var(--loombus-surface-muted)] text-[#b45309]"
                    : "bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-surface)] text-[#b45309]">
                    <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                  </span>
                  <span className="truncate">All topics</span>
                </span>
                <span className="text-xs text-[#b45309]">{discussions.length}</span>
              </button>

              {visibleTopics.map((item) => (
                <button
                  key={item.topic}
                  type="button"
                  onClick={() => setSelectedTopic(item.topic)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                    selectedTopic === item.topic
                      ? "bg-[color:var(--loombus-surface-muted)] text-[#b45309]"
                      : "bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-surface)] text-[color:var(--loombus-text-muted)]">
                      <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                    </span>
                    <span className="truncate">{item.topic}</span>
                  </span>
                  <span className="text-xs text-[#b45309]">{item.count}</span>
                </button>
              ))}
            </div>

            <Link
              href="/topics"
              className="mt-5 flex w-full items-center justify-between rounded-2xl px-1 py-2 text-sm font-semibold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
            >
              View all topics
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-6">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[color:var(--loombus-text)] sm:text-5xl">
              Discussions
            </h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Explore signal-rich conversations. Browse by topic, mode, and relevance.
            </p>
          </div>

          <div className="mb-4 flex gap-3">
            <label className="relative flex-1">
              <span className="sr-only">Search discussions, topics, and contributors</span>
              <Search
                aria-hidden="true"
                className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[color:var(--loombus-text-subtle)]"
                strokeWidth={2.1}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search discussions, topics, and contributors"
                className="h-14 w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] pl-14 pr-5 text-base text-[color:var(--loombus-text)] outline-none shadow-sm transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-text-subtle)]"
              />
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] text-[color:var(--loombus-text)] shadow-sm transition hover:border-[color:var(--loombus-text-subtle)]"
              aria-label="Reset discussion filters"
              title="Reset filters"
            >
              <SlidersHorizontal aria-hidden="true" className="h-5 w-5" strokeWidth={2.1} />
            </button>
          </div>

          <div className="mb-7 flex gap-2 overflow-x-auto pb-1">
            {feedTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFeedMode(tab.key)}
                className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition ${
                  feedMode === tab.key
                    ? "border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] text-[color:var(--loombus-text)]"
                    : "border-transparent bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text)] hover:border-[color:var(--loombus-border)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
              Loading discussions...
            </section>
          ) : null}

          {!loading && filteredDiscussions.length === 0 ? (
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-7 shadow-xl shadow-black/10">
              <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--loombus-text)]">
                No discussions found.
              </h2>
              <p className="mt-3 max-w-2xl text-[color:var(--loombus-text-muted)]">
                No discussions match the current topic, mode, saved view, or search.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-full bg-[color:var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-primary-text)] transition hover:opacity-90"
                  >
                    Clear filters
                  </button>
                ) : null}
                <Link
                  href="/create"
                  className="rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-text)] transition hover:border-[color:var(--loombus-text-subtle)]"
                >
                  Start a discussion
                </Link>
              </div>
            </section>
          ) : null}

          <div className="space-y-5">
            {filteredDiscussions.map((discussion) => {
              const profile = profiles[discussion.user_id];
              const signalScore = getSignalScore(
                discussion.id,
                replyCounts,
                bookmarkCounts,
                viewCounts
              );

              return (
                <article
                  key={discussion.id}
                  className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10 transition hover:border-[color:var(--loombus-text-subtle)]"
                >
                  <Link href={`/discussions/${discussion.id}`} className="block p-5 sm:p-6">
                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#b45309] dark:bg-orange-400/10">
                        {getDiscussionTopic(discussion)}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200">
                        {getDiscussionModeLabel(discussion)}
                      </span>
                    </div>

                    <h2 className="text-2xl font-semibold leading-tight tracking-[-0.035em] text-[color:var(--loombus-text)] sm:text-3xl">
                      {normalizePublicText(discussion.title)}
                    </h2>

                    <div
                      className="mt-4 line-clamp-2 text-base leading-7 text-[color:var(--loombus-text-muted)] [&_em]:italic [&_strong]:font-semibold [&_strong]:text-[color:var(--loombus-text)]"
                      dangerouslySetInnerHTML={{
                        __html: discussionBodyToSafeHtml(
                          getPlainDiscussionExcerpt(discussion.body)
                        ),
                      }}
                    />

                    <div className="mt-5 flex items-center gap-3">
                      <ProfileAvatar profile={profile} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[color:var(--loombus-text)]">
                          {getProfileDisplayName(profile)}
                        </p>
                        <p className="truncate text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                          {getProfileHandle(profile)} · {formatDiscussionDate(discussion.created_at)}
                          {latestReplyDates[discussion.id]
                            ? ` · Active ${formatDiscussionDate(latestReplyDates[discussion.id])}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {discussionTags[discussion.id]?.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {discussionTags[discussion.id].slice(0, 4).map((tag) => (
                          <span
                            key={`${discussion.id}-${tag}`}
                            className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-text-muted)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Link>

                  <div className="flex items-center gap-4 border-t border-[color:var(--loombus-border-muted)] px-5 py-4 text-sm font-semibold text-[color:var(--loombus-text)] sm:px-6">
                    <span className="inline-flex items-center gap-2" title="Replies">
                      <MessageCircle aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                      {replyCounts[discussion.id] ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-2" title="Views">
                      <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                      {viewCounts[discussion.id] ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-2" title="Saves">
                      <Bookmark aria-hidden="true" className="h-4 w-4" strokeWidth={2.1} />
                      {bookmarkCounts[discussion.id] ?? 0}
                    </span>
                    <span className="ml-auto rounded-full border border-orange-200 px-4 py-2 text-sm font-bold text-[color:var(--loombus-text)] dark:border-orange-400/30">
                      Signal {signalScore}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-28 space-y-5">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text-muted)]">
                  Trending topics
                </p>
                <TrendingUp aria-hidden="true" className="h-5 w-5 text-[color:var(--loombus-text-muted)]" />
              </div>

              <div className="space-y-4">
                {trendingTopics.map((item, index) => (
                  <button
                    type="button"
                    key={item.topic}
                    onClick={() => setSelectedTopic(item.topic)}
                    className="flex w-full items-center gap-4 text-left"
                  >
                    <span className="w-5 text-center text-sm font-bold text-[#b45309]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[color:var(--loombus-text)]">
                      {item.topic}
                    </span>
                    <span className="text-xs font-bold text-[color:var(--loombus-text-subtle)]">
                      {item.signals} signals
                    </span>
                  </button>
                ))}
              </div>

              <Link
                href="/topics"
                className="mt-7 flex w-full items-center justify-between text-sm font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
              >
                View all topics
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text-muted)]">
                  Top contributors
                </p>
                <Link href="/people" className="text-sm font-bold text-[#b45309]">
                  View all
                </Link>
              </div>

              <div className="space-y-4">
                {contributorStats.map((contributor) => (
                  <div key={contributor.userId} className="flex items-center gap-3">
                    <ProfileAvatar profile={contributor.profile} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[color:var(--loombus-text)]">
                        {getProfileDisplayName(contributor.profile)}
                      </p>
                      <p className="truncate text-xs font-bold text-[color:var(--loombus-text-muted)]">
                        {getProfileHandle(contributor.profile)} · {contributor.signals} signals
                      </p>
                    </div>
                    <Link
                      href={contributor.profile?.username ? `/u/${contributor.profile.username}` : "/people"}
                      className="rounded-full bg-[color:var(--loombus-surface-muted)] px-3 py-2 text-xs font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
                    >
                      <UserPlus aria-hidden="true" className="h-4 w-4 sm:hidden" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.34em] text-[color:var(--loombus-text-muted)]">
                Saved folders
              </p>

              {savedFolderStats.length > 0 ? (
                <div className="space-y-3">
                  {savedFolderStats.map((item) => (
                    <button
                      key={item.topic}
                      type="button"
                      onClick={() => {
                        setSelectedTopic(item.topic);
                        setFeedMode("saved");
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-left transition hover:bg-[color:var(--loombus-surface-muted)]"
                    >
                      <Folder aria-hidden="true" className="h-5 w-5 text-[color:var(--loombus-text-muted)]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-[color:var(--loombus-text)]">
                          {item.topic}
                        </span>
                        <span className="block text-xs font-bold text-[color:var(--loombus-text-muted)]">
                          {item.count} saved discussion{item.count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Saved discussion folders will appear here after you save discussions.
                </p>
              )}

              <Link
                href="/saved#folders"
                className="mt-5 flex items-center justify-between text-sm font-bold text-[#b45309] transition hover:text-[color:var(--loombus-text)]"
              >
                View all folders
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </Link>
            </section>
          </div>
        </aside>
      </div>
    </main>
  );
}
