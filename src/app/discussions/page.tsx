"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
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

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

type AdvancedFilterMode =
  | "All activity"
  | "Has replies"
  | "Has saves"
  | "High signal"
  | "Recently active";

const ADVANCED_FILTERS: AdvancedFilterMode[] = [
  "All activity",
  "Has replies",
  "Has saves",
  "High signal",
  "Recently active",
];

function hasAdvancedFilterAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) {
    return true;
  }

  return (
    entitlement?.ai_assisted_enabled === true &&
    entitlement.tier === "premium"
  );
}

function getDiscussionStatusLabel(discussion: Discussion) {
  return discussion.discussion_status === "resolved" ? "Resolved" : "Open";
}

function getDiscussionStatusClassName(discussion: Discussion) {
  return discussion.discussion_status === "resolved"
    ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
    : "border-zinc-800 bg-zinc-950 text-zinc-400";
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

function matchesAdvancedFilter(
  discussion: Discussion,
  advancedFilter: AdvancedFilterMode,
  replyCounts: Record<string, number>,
  bookmarkCounts: Record<string, number>,
  viewCounts: Record<string, number>,
  latestReplyDates: Record<string, string>
) {
  if (advancedFilter === "All activity") {
    return true;
  }

  if (advancedFilter === "Has replies") {
    return (replyCounts[discussion.id] ?? 0) > 0;
  }

  if (advancedFilter === "Has saves") {
    return (bookmarkCounts[discussion.id] ?? 0) > 0;
  }

  if (advancedFilter === "High signal") {
    return getSignalScore(
      discussion.id,
      replyCounts,
      bookmarkCounts,
      viewCounts
    ) >= 5;
  }

  const latestActivity = latestReplyDates[discussion.id] ?? discussion.created_at;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return new Date(latestActivity).getTime() >= sevenDaysAgo;
}

function getTopicDiscoveryDescription(topic: string) {
  const normalized = topic.toLowerCase();

  if (normalized.includes("faith") || normalized.includes("values")) {
    return "Belief, principle, ethics, purpose, and the values behind decisions.";
  }

  if (normalized.includes("ai")) {
    return "Artificial intelligence, platforms, automation, and how intelligence changes society.";
  }

  if (normalized.includes("book") || normalized.includes("writing")) {
    return "Books, authorship, publishing, reading, and long-form ideas worth developing.";
  }

  if (normalized.includes("entrepreneur")) {
    return "Founders, building, risk, ownership, and turning ideas into durable ventures.";
  }

  if (normalized.includes("business")) {
    return "Companies, ownership, markets, strategy, and practical business decisions.";
  }

  if (normalized.includes("culture")) {
    return "Social behavior, media, values, identity, and how people make meaning.";
  }

  if (normalized.includes("education")) {
    return "Learning, schools, skills, self-education, and intellectual development.";
  }

  if (normalized.includes("work")) {
    return "Careers, labor, productivity, leadership, and the future of work.";
  }

  if (normalized.includes("politics") || normalized.includes("policy")) {
    return "Policy, governance, institutions, civic tradeoffs, and public decision-making.";
  }

  if (normalized.includes("technology") || normalized.includes("systems")) {
    return "Systems, tools, infrastructure, and technical change with real-world impact.";
  }

  if (normalized.includes("healthcare")) {
    return "Health systems, care access, patient experience, medicine, and public health tradeoffs.";
  }

  if (normalized.includes("law") || normalized.includes("justice")) {
    return "Rights, fairness, courts, accountability, and the systems that shape justice.";
  }

  if (normalized.includes("environment")) {
    return "Climate, land, energy, stewardship, resilience, and environmental tradeoffs.";
  }

  if (normalized.includes("general")) {
    return "Open-ended discussions that still aim for depth, context, and useful signal.";
  }

  return `Focused conversations about ${topic.toLowerCase()} with depth, context, and signal.`;
}


export default function DiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [latestReplyDates, setLatestReplyDates] = useState<Record<string, string>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<string, number>>({});
  const [discussionTags, setDiscussionTags] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState("All");
  const [showAllTopicDiscovery, setShowAllTopicDiscovery] = useState(false);
  const [showAllTopicFilters, setShowAllTopicFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState("Newest");
  const [advancedFilter, setAdvancedFilter] =
    useState<AdvancedFilterMode>("All activity");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const canUseAdvancedFilters = hasAdvancedFilterAccess(aiEntitlement, isAdmin);

  useEffect(() => {
    async function loadDiscussions() {
      const { data, error } = await supabase
        .from("discussions")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const { data: viewerData } = await supabase.auth.getUser();
        const hiddenProfileIds = new Set<string>();

        if (viewerData.user) {
          const [{ data: viewerProfile }, { data: entitlementData }] =
            await Promise.all([
              supabase
                .from("profiles")
                .select("is_admin")
                .eq("id", viewerData.user.id)
                .maybeSingle(),
              supabase
                .from("user_ai_entitlements")
                .select("tier, ai_assisted_enabled, monthly_summary_limit")
                .eq("user_id", viewerData.user.id)
                .maybeSingle(),
            ]);

          setIsAdmin(Boolean(viewerProfile?.is_admin));
          setAiEntitlement((entitlementData ?? null) as AiEntitlement);

          const { data: blockRows } = await supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${viewerData.user.id},blocked_id.eq.${viewerData.user.id}`);

          for (const block of (blockRows ?? []) as BlockRow[]) {
            hiddenProfileIds.add(
              block.blocker_id === viewerData.user.id ? block.blocked_id : block.blocker_id
            );
          }
        }

        const visibleDiscussions = data.filter(
          (item) => !hiddenProfileIds.has(item.user_id)
        );

        setDiscussions(visibleDiscussions);

        const userIds = [...new Set(visibleDiscussions.map((item) => item.user_id))];

        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);

          const profileMap: Record<string, Profile> = {};

          for (const profile of profileData ?? []) {
            profileMap[profile.id] = profile;
          }

          setProfiles(profileMap);
        }

        const discussionIds = visibleDiscussions.map((item) => item.id);

        if (discussionIds.length > 0) {
          const { data: replyData } = await supabase
            .from("replies")
            .select("discussion_id, user_id, created_at")
            .in("discussion_id", discussionIds);

          const counts: Record<string, number> = {};
          const latestReplies: Record<string, string> = {};

          for (const reply of replyData ?? []) {
            if (hiddenProfileIds.has(reply.user_id)) {
              continue;
            }

            counts[reply.discussion_id] =
              (counts[reply.discussion_id] ?? 0) + 1;

            const existingLatest = latestReplies[reply.discussion_id];

            if (
              !existingLatest ||
              new Date(reply.created_at).getTime() > new Date(existingLatest).getTime()
            ) {
              latestReplies[reply.discussion_id] = reply.created_at;
            }
          }

          setReplyCounts(counts);
          setLatestReplyDates(latestReplies);

          const { data: viewData } = await supabase
            .from("discussion_views")
            .select("discussion_id")
            .in("discussion_id", discussionIds);

          const views: Record<string, number> = {};

          for (const view of viewData ?? []) {
            views[view.discussion_id] =
              (views[view.discussion_id] ?? 0) + 1;
          }

          setViewCounts(views);

          const { data: bookmarkData } = await supabase
            .from("bookmarks")
            .select("discussion_id")
            .in("discussion_id", discussionIds);

          const bookmarks: Record<string, number> = {};

          for (const bookmark of bookmarkData ?? []) {
            bookmarks[bookmark.discussion_id] =
              (bookmarks[bookmark.discussion_id] ?? 0) + 1;
          }

          setBookmarkCounts(bookmarks);

          const { data: tagData } = await supabase
            .from("discussion_tags")
            .select("discussion_id, tag")
            .in("discussion_id", discussionIds);

          const tagMap: Record<string, string[]> = {};

          for (const row of tagData ?? []) {
            tagMap[row.discussion_id] = [
              ...(tagMap[row.discussion_id] ?? []),
              row.tag,
            ];
          }

          setDiscussionTags(tagMap);
        }
      }

      setLoading(false);
    }

    loadDiscussions();
  }, []);

  const activeTopics = useMemo(() => {
    return [...new Set(discussions.map((discussion) => discussion.topic).filter(Boolean))];
  }, [discussions]);

  const topics = useMemo(() => {
    if (!showAllTopicFilters) {
      return ["All", ...activeTopics];
    }

    const officialTopics = [...DISCUSSION_TOPICS];
    const legacyTopics = activeTopics.filter(
      (topic) => !officialTopics.includes(topic as typeof DISCUSSION_TOPICS[number])
    );

    return ["All", ...officialTopics, ...legacyTopics];
  }, [activeTopics, showAllTopicFilters]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get("topic");

    if (!topicParam) {
      return;
    }

    const officialTopic = DISCUSSION_TOPICS.find(
      (topic) => topic.toLowerCase() === topicParam.toLowerCase()
    );
    const activeTopic = activeTopics.find(
      (topic) => topic.toLowerCase() === topicParam.toLowerCase()
    );
    const matchedTopic = officialTopic ?? activeTopic;

    if (!matchedTopic) {
      return;
    }

    setSelectedTopic(matchedTopic);

    if (!activeTopics.includes(matchedTopic)) {
      setShowAllTopicFilters(true);
    }
  }, [activeTopics]);

  function setTopicFilter(topic: string) {
    setSelectedTopic(topic);

    const params = new URLSearchParams(window.location.search);

    if (topic === "All") {
      params.delete("topic");
    } else {
      params.set("topic", topic);
    }

    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", nextUrl);
  }

  const filteredDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const activeAdvancedFilter = canUseAdvancedFilters
      ? advancedFilter
      : "All activity";

    const filtered = discussions.filter((discussion) => {
      const profile = profiles[discussion.user_id];

      const matchesTopic =
        selectedTopic === "All" || discussion.topic === selectedTopic;

      const matchesSearch =
        !query ||
        discussion.title.toLowerCase().includes(query) ||
        discussion.body.toLowerCase().includes(query) ||
        discussion.topic.toLowerCase().includes(query) ||
        (profile?.username ?? "").toLowerCase().includes(query) ||
        (profile?.full_name ?? "").toLowerCase().includes(query);

      const matchesAdvanced = matchesAdvancedFilter(
        discussion,
        activeAdvancedFilter,
        replyCounts,
        bookmarkCounts,
        viewCounts,
        latestReplyDates
      );

      return matchesTopic && matchesSearch && matchesAdvanced;
    });

    if (sortMode === "Most replied") {
      return [...filtered].sort((a, b) => {
        const replyDifference =
          (replyCounts[b.id] ?? 0) - (replyCounts[a.id] ?? 0);

        if (replyDifference !== 0) {
          return replyDifference;
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    if (sortMode === "Signal") {
      return [...filtered].sort((a, b) => {
        const scoreA =
          (replyCounts[a.id] ?? 0) * 3 +
          (bookmarkCounts[a.id] ?? 0) * 5 +
          (viewCounts[a.id] ?? 0);

        const scoreB =
          (replyCounts[b.id] ?? 0) * 3 +
          (bookmarkCounts[b.id] ?? 0) * 5 +
          (viewCounts[b.id] ?? 0);

        const scoreDifference = scoreB - scoreA;

        if (scoreDifference !== 0) {
          return scoreDifference;
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return filtered;
  }, [
    discussions,
    profiles,
    selectedTopic,
    searchQuery,
    sortMode,
    advancedFilter,
    canUseAdvancedFilters,
    replyCounts,
    bookmarkCounts,
    viewCounts,
    latestReplyDates,
  ]);

  const activeFilterLabels = [
    searchQuery.trim() ? `Search: “${searchQuery.trim()}”` : "",
    selectedTopic !== "All" ? `Topic: ${selectedTopic}` : "",
    sortMode !== "Newest" ? `Sort: ${sortMode}` : "",
    advancedFilter !== "All activity" ? `Filter: ${advancedFilter}` : "",
  ].filter(Boolean);

  const hasActiveDiscussionFilters = activeFilterLabels.length > 0;

  const topicDiscoveryItems = (
    showAllTopicDiscovery ? DISCUSSION_TOPICS : DISCUSSION_TOPICS.slice(0, 12)
  ).map((topic) => ({
    topic,
    description: getTopicDiscoveryDescription(topic),
  }));

  function resetDiscussionFilters() {
    setSearchQuery("");
    setTopicFilter("All");
    setSortMode("Newest");
    setAdvancedFilter("All activity");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Discussions
            </h1>

            <p className="mt-3 text-zinc-500">
              Explore thoughtful, high-signal conversations.
            </p>
          </div>

          <Link
            href="/create"
            className="inline-flex rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
          >
            Create Discussion
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Finding signal
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Browse with a purpose.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Use topics, search, sort controls, and Signal Score to find discussions
            worth reading carefully. A useful reply usually adds context, evidence,
            experience, a counterpoint, or a clearer framing.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Start with topics
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Filter by a subject area first, then use search when you know what you are looking for.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Sort for intent
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Use Newest for fresh posts, Most replied for active threads, and Signal for stronger engagement.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Reply with value
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Add something another reader can use: examples, experience, questions, or better structure.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Topic discovery
              </p>

              <h2 className="text-2xl font-medium">
                Choose a lane before scrolling.
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                Loombus works best when readers start with a focused lane. Pick a topic to narrow the feed into conversations that match your intent.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAllTopicDiscovery((current) => !current)}
              className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            >
              {showAllTopicDiscovery ? "Show fewer topics" : "Show all topics"}
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topicDiscoveryItems.map(({ topic, description }) => (
              <Link
                key={topic}
                href={`/discussions?topic=${encodeURIComponent(topic)}`}
                onClick={() => setTopicFilter(topic)}
                className="rounded-2xl border border-zinc-800 bg-black p-4 transition hover:border-zinc-600 hover:bg-zinc-900"
              >
                <p className="text-sm font-medium text-white">{topic}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <label htmlFor="discussion-search" className="mb-2 block text-sm font-medium text-zinc-300">
                Search discussions
              </label>

              <input
                id="discussion-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search titles, bodies, topics, or contributors..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-5 py-4 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
              />
            </div>

            {hasActiveDiscussionFilters && (
              <button
                type="button"
                onClick={resetDiscussionFilters}
                className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Clear search and filters
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {activeFilterLabels.length > 0 ? (
              activeFilterLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400"
                >
                  {label}
                </span>
              ))
            ) : (
              <p className="text-sm text-zinc-600">
                Search scans discussion titles, bodies, topics, and contributor names.
              </p>
            )}
          </div>
        </section>

        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setSortMode("Newest")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sortMode === "Newest"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            Newest
          </button>

          <button
            onClick={() => setSortMode("Most replied")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              sortMode === "Most replied"
                ? "bg-white text-black"
                : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
            }`}
          >
            Most replied
          </button>

            <button
              onClick={() => setSortMode("Signal")}
              className={`rounded-full px-4 py-2 text-sm transition ${
                sortMode === "Signal"
                  ? "bg-white text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              Signal
            </button>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-zinc-600">
            Signal Score ranks discussions using replies, saves, and views.
            Replies count more than views, and saves count the most.
          </p>
        </div>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                Advanced filters
              </p>

              <h2 className="text-2xl font-medium">
                Refine by discussion signal
              </h2>
            </div>

            {!canUseAdvancedFilters && (
              <Link
                href="/premium"
                className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
              >
                Unlock with Premium
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {ADVANCED_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setAdvancedFilter(filter)}
                disabled={!canUseAdvancedFilters && filter !== "All activity"}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  advancedFilter === filter
                    ? "border-zinc-400 text-white"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                } disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700`}
              >
                {filter}
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-zinc-600">
            Premium filters use replies, saves, Signal Score, and recent activity
            to help cut through low-signal browsing.
          </p>
        </section>

        <div className="mb-6 flex flex-wrap gap-3">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => setTopicFilter(topic)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                selectedTopic === topic
                  ? "bg-white text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              {topic}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              if (showAllTopicFilters && !activeTopics.includes(selectedTopic) && selectedTopic !== "All") {
                setTopicFilter("All");
              }

              setShowAllTopicFilters((current) => !current);
            }}
            className="rounded-full border border-zinc-800 bg-black px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-700 hover:text-white"
          >
            {showAllTopicFilters ? "Show active topics" : "Show all topics"}
          </button>
        </div>

        {!loading && (
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-zinc-600">
              Showing {filteredDiscussions.length} of {discussions.length} discussions
            </p>

            {hasActiveDiscussionFilters && (
              <button
                type="button"
                onClick={resetDiscussionFilters}
                className="w-fit text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
              >
                Reset view
              </button>
            )}
          </div>
        )}

        {loading && (
          <p className="text-zinc-500">
            Loading discussions...
          </p>
        )}

        {!loading && filteredDiscussions.length === 0 && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
            <h2 className="mb-3 text-2xl font-medium">
              No discussions found.
            </h2>

            <p className="max-w-2xl text-zinc-400">
              No discussions match the current search, topic, sort, or advanced filter selection.
              Try clearing the filters, using a broader search term, or starting a new discussion in this topic.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {hasActiveDiscussionFilters && (
                <button
                  type="button"
                  onClick={resetDiscussionFilters}
                  className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200"
                >
                  Clear filters
                </button>
              )}

              <Link
                href="/create"
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Start a discussion
              </Link>
            </div>
          </div>
        )}

        <div className="space-y-5">
          {filteredDiscussions.map((discussion) => {
            const profile = profiles[discussion.user_id];

            return (
              <div
                key={discussion.id}
                className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/20 transition hover:border-zinc-700"
              >
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="block"
                >
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <p className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                      {discussion.topic}
                    </p>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getDiscussionStatusClassName(discussion)}`}
                    >
                      {getDiscussionStatusLabel(discussion)}
                    </span>
                  </div>

                  <h2 className="mb-3 text-2xl font-medium transition group-hover:text-white">
                    {discussion.title}
                  </h2>

                  <p className="mb-5 line-clamp-3 leading-relaxed text-zinc-400">
                    {discussion.body}
                  </p>

                  {discussionTags[discussion.id]?.length > 0 && (
                    <div className="mb-5 flex flex-wrap gap-2">
                      {discussionTags[discussion.id].map((tag) => (
                        <span
                          key={`${discussion.id}-${tag}`}
                          className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-500"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                <div className="flex flex-col gap-4 border-t border-zinc-900 pt-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <ProfileAvatar profile={profile} size="md" />

                    <p className="min-w-0 text-sm text-zinc-600">
                      by{" "}
                      {profile?.username ? (
                        <Link
                          href={`/u/${profile.username}`}
                          className="text-zinc-400 transition hover:text-white"
                        >
                          {getProfileDisplayName(profile)}
                        </Link>
                      ) : (
                        "Loombus member"
                      )}{" "}
                      · Created {new Date(discussion.created_at).toLocaleDateString()}
                      {latestReplyDates[discussion.id] && (
                        <>
                          {" "}· Last active{" "}
                          {new Date(latestReplyDates[discussion.id]).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-zinc-900 bg-black px-4 py-3 text-left md:text-right">
                    <p className="text-sm text-zinc-500">
                      {replyCounts[discussion.id] ?? 0} replies ·{" "}
                      {viewCounts[discussion.id] ?? 0} views
                    </p>

                    <p className="mt-1 text-xs uppercase tracking-wide text-zinc-600">
                      Signal Score{" "}
                      {getSignalScore(
                        discussion.id,
                        replyCounts,
                        bookmarkCounts,
                        viewCounts
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
