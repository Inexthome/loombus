"use client";

import { ProgressiveGuide } from "@/components/progressive-guide";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { PURPOSE_LANES } from "@/lib/purpose-lanes";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
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

type FeedMode = "all" | "following" | "signal";

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


const DISCUSSION_FILTER_DRAWER_STORAGE_KEY = "loombus-discussions-filter-drawer-v1";

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
  const [selectedPurposeLane, setSelectedPurposeLane] = useState("All");
  const [showAllTopicDiscovery, setShowAllTopicDiscovery] = useState(false);
  const [showAllTopicFilters, setShowAllTopicFilters] = useState(false);
  const [showExploreFilters, setShowExploreFilters] = useState(false);
  const [activeDiscussionTool, setActiveDiscussionTool] =
    useState<"none" | "search" | "guide" | "topics" | "purpose">("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState("Newest");
  const [feedMode, setFeedMode] = useState<FeedMode>("all");
  const [followingUserIds, setFollowingUserIds] = useState<string[]>([]);
  const [advancedFilter, setAdvancedFilter] =
    useState<AdvancedFilterMode>("All activity");
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const canUseAdvancedFilters = hasAdvancedFilterAccess(aiEntitlement, isAdmin);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(DISCUSSION_FILTER_DRAWER_STORAGE_KEY);

    if (stored === "open") {
      setShowExploreFilters(true);
    }

    if (stored === "closed") {
      setShowExploreFilters(false);
    }
  }, []);


  function toggleExploreFilters() {
    setShowExploreFilters((current) => {
      const next = !current;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          DISCUSSION_FILTER_DRAWER_STORAGE_KEY,
          next ? "open" : "closed"
        );
      }

      return next;
    });
  }

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

          const { data: followsData } = await supabase
            .from("follows")
            .select("following_id")
            .eq("follower_id", viewerData.user.id);

          setFollowingUserIds(
            (followsData ?? [])
              .map((follow) => follow.following_id)
              .filter(
                (id): id is string =>
                  typeof id === "string" && !hiddenProfileIds.has(id)
              )
          );
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
    const purposeParam = params.get("purpose");

    if (purposeParam) {
      const matchedPurposeLane = PURPOSE_LANES.find(
        (lane) => lane.toLowerCase() === purposeParam.toLowerCase()
      );

      if (matchedPurposeLane) {
        setSelectedPurposeLane(matchedPurposeLane);
      }
    }

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

  function updateUrlParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;

    window.history.replaceState(null, "", nextUrl);
  }

  function setTopicFilter(topic: string) {
    setSelectedTopic(topic);
    updateUrlParams({ topic: topic === "All" ? null : topic });
  }

  function setPurposeLaneFilter(purposeLane: string) {
    setSelectedPurposeLane(purposeLane);
    updateUrlParams({ purpose: purposeLane === "All" ? null : purposeLane });
  }

  const filteredDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const activeAdvancedFilter = canUseAdvancedFilters
      ? advancedFilter
      : "All activity";

    const followingUserIdSet = new Set(followingUserIds);

    const filtered = discussions.filter((discussion) => {
      const profile = profiles[discussion.user_id];

      const matchesFeedMode =
        feedMode !== "following" || followingUserIdSet.has(discussion.user_id);

      const matchesTopic =
        selectedTopic === "All" || discussion.topic === selectedTopic;

      const matchesPurposeLane =
        selectedPurposeLane === "All" || discussion.purpose_lane === selectedPurposeLane;

      const matchesSearch =
        !query ||
        discussion.title.toLowerCase().includes(query) ||
        discussion.body.toLowerCase().includes(query) ||
        (discussion.reality_lens ?? "").toLowerCase().includes(query) ||
        (discussion.purpose_lane ?? "").toLowerCase().includes(query) ||
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

      return matchesFeedMode && matchesTopic && matchesPurposeLane && matchesSearch && matchesAdvanced;
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
    selectedPurposeLane,
    searchQuery,
    sortMode,
    feedMode,
    followingUserIds,
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
    selectedPurposeLane !== "All" ? `Purpose: ${selectedPurposeLane}` : "",
    sortMode !== "Newest" ? `Sort: ${sortMode}` : "",
    advancedFilter !== "All activity" ? `Filter: ${advancedFilter}` : "",
  ].filter(Boolean);

  const hasActiveDiscussionFilters = activeFilterLabels.length > 0;
  const filterSummary = hasActiveDiscussionFilters
    ? activeFilterLabels.join(" · ")
    : feedMode === "following" ? "Following discussions" : feedMode === "signal" ? "Active discussions" : "All discussions";

  const topicDiscoveryItems = (
    showAllTopicDiscovery ? DISCUSSION_TOPICS : []
  ).map((topic) => ({
    topic,
    description: getTopicDiscoveryDescription(topic),
  }));

  const allFeedActive = feedMode === "all";
  const followingFeedActive = feedMode === "following";
  const signalFeedActive = feedMode === "signal";

  function resetDiscussionFilters() {
    setFeedMode("all");
    setSearchQuery("");
    setTopicFilter("All");
    setPurposeLaneFilter("All");
    setSortMode("Newest");
    setAdvancedFilter("All activity");
  }

  function getSafeFeedMode(value: string | null | undefined): FeedMode {
    if (value === "following" || value === "signal") {
      return value;
    }

    return "all";
  }

  function applyDiscussionFeedMode(nextFeedMode: FeedMode) {
    setFeedMode(nextFeedMode);
    setSearchQuery("");
    setTopicFilter("All");
    setPurposeLaneFilter("All");
    setSortMode(nextFeedMode === "signal" ? "Signal" : "Newest");
    setAdvancedFilter("All activity");
    setActiveDiscussionTool("none");

    updateUrlParams({
      feed: nextFeedMode === "all" ? null : nextFeedMode,
      topic: null,
      purpose: null,
    });
  }

  function openAllFeed() {
    setShowExploreFilters(false);
    applyDiscussionFeedMode("all");
  }

  function openFollowingFeed() {
    setShowExploreFilters(false);
    applyDiscussionFeedMode("following");
  }

  function openSignalFeed() {
    applyDiscussionFeedMode("signal");
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const initialFeedMode = getSafeFeedMode(params.get("feed"));

    if (initialFeedMode !== feedMode) {
      applyDiscussionFeedMode(initialFeedMode);
    }

    function handleMobileDiscussionFeed(event: Event) {
      const customEvent = event as CustomEvent<{ feed?: string }>;
      applyDiscussionFeedMode(getSafeFeedMode(customEvent.detail?.feed));
    }

    window.addEventListener(
      "loombus:discussion-feed",
      handleMobileDiscussionFeed
    );

    return () => {
      window.removeEventListener(
        "loombus:discussion-feed",
        handleMobileDiscussionFeed
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persistExploreFiltersOpen() {
    setShowExploreFilters(true);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISCUSSION_FILTER_DRAWER_STORAGE_KEY, "open");
    }
  }

  function openDiscussionSearch() {
    setActiveDiscussionTool((current) => current === "search" ? "none" : "search");

    window.setTimeout(() => {
      const input = document.getElementById("discussion-search") as HTMLInputElement | null;

      input?.focus();
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  function openDiscussionGuide() {
    setActiveDiscussionTool((current) => current === "guide" ? "none" : "guide");
  }

  function openDiscussionTopics() {
    setActiveDiscussionTool((current) => current === "topics" ? "none" : "topics");
  }

  function openDiscussionPurpose() {
    setActiveDiscussionTool((current) => current === "purpose" ? "none" : "purpose");
  }

  return (
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-10 lg:py-12 loombus-shell-with-right-rail">
      <div className="mx-auto max-w-[46rem]">
        <div className="discussion-shell-grid">
          <div className="min-w-0">
        <section className="sticky top-0 z-20 mb-5 hidden border-b border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 backdrop-blur-xl md:block">
          <nav
            aria-label="Discussion feed views"
            className="grid grid-cols-3 border-y border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={openAllFeed}
              className={`relative flex h-14 items-center justify-center text-sm font-semibold transition ${
                allFeedActive
                  ? "text-[var(--loombus-text)]"
                  : "text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
              }`}
            >
              All
              <span
                className={`absolute bottom-0 h-1 w-24 rounded-full transition ${
                  allFeedActive ? "bg-[var(--loombus-text)]" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={openFollowingFeed}
              className={`relative flex h-14 items-center justify-center text-sm font-semibold transition ${
                followingFeedActive
                  ? "text-[var(--loombus-text)]"
                  : "text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
              }`}
            >
              Following
              <span
                className={`absolute bottom-0 h-1 w-24 rounded-full transition ${
                  followingFeedActive ? "bg-[var(--loombus-text)]" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={openSignalFeed}
              className={`relative flex h-14 items-center justify-center text-sm font-semibold transition ${
                signalFeedActive
                  ? "text-[var(--loombus-text)]"
                  : "text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
              }`}
            >
              Active
              <span
                className={`absolute bottom-0 h-1 w-24 rounded-full transition ${
                  signalFeedActive ? "bg-[var(--loombus-text)]" : "bg-transparent"
                }`}
                aria-hidden="true"
              />
            </button>
          </nav>
        </section>

        {activeDiscussionTool === "search" && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 xl:hidden">
            <label htmlFor="discussion-search" className="block">
              <span className="sr-only">
                Search discussions
              </span>

              <input
                id="discussion-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search discussions..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3.5 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
              />
            </label>
          </section>
        )}

        {activeDiscussionTool === "guide" && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 xl:hidden">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
              Guide
            </p>

            <h2 className="mb-2 text-base font-semibold">
              Finding signal
            </h2>

            <p className="text-sm leading-relaxed text-zinc-500">
              Use search, sort, topics, purpose lanes, and Signal to find discussions worth reading carefully.
            </p>
          </section>
        )}

        {activeDiscussionTool === "topics" && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 xl:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
                Topics
              </p>

              <button
                type="button"
                onClick={() => {
                  if (showAllTopicFilters && !activeTopics.includes(selectedTopic) && selectedTopic !== "All") {
                    setTopicFilter("All");
                  }

                  setShowAllTopicFilters((current) => !current);
                }}
                className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
              >
                {showAllTopicFilters ? "Active only" : "All topics"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setTopicFilter(topic)}
                  className={`rounded-full px-3.5 py-2 text-sm transition ${
                    selectedTopic === topic
                      ? "bg-white text-black"
                      : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </section>
        )}

        {activeDiscussionTool === "purpose" && (
          <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 xl:hidden">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-zinc-600">
              Purpose
            </p>

            <div className="flex flex-wrap gap-2">
              {["All", ...PURPOSE_LANES].map((lane) => (
                <button
                  key={lane}
                  type="button"
                  onClick={() => setPurposeLaneFilter(lane)}
                  className={`rounded-full px-3.5 py-2 text-sm transition ${
                    selectedPurposeLane === lane
                      ? "bg-white text-black"
                      : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                  }`}
                >
                  {lane}
                </button>
              ))}
            </div>
          </section>
        )}

        {hasActiveDiscussionFilters && (
          <div className="mb-4 flex flex-wrap items-center gap-2 xl:hidden">
            {activeFilterLabels.map((label) => (
              <span
                key={label}
                className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400"
              >
                {label}
              </span>
            ))}

            <button
              type="button"
              onClick={resetDiscussionFilters}
              className="text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
            >
              Clear
            </button>
          </div>
        )}

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
              No discussions match the current search, topic, purpose lane, sort, or advanced filter selection.
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

        <div className="space-y-3 sm:space-y-5">
          {filteredDiscussions.map((discussion) => {
            const profile = profiles[discussion.user_id];

            return (
              <article
                key={discussion.id}
                className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20 transition hover:border-zinc-700 sm:rounded-[1.75rem]"
              >
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="block p-4 sm:p-6"
                >
                  <div className="mb-4 flex min-w-0 items-center gap-3">
                    <ProfileAvatar profile={profile} size="md" />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-300">
                        {profile?.username ? getProfileDisplayName(profile) : "Loombus member"}
                      </p>

                      <p className="mt-1 truncate text-xs text-zinc-700">
                        {new Date(discussion.created_at).toLocaleDateString()}
                        {latestReplyDates[discussion.id] && (
                          <>
                            {" "}· Active{" "}
                            {new Date(latestReplyDates[discussion.id]).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:px-3 sm:text-[11px] ${getDiscussionStatusClassName(discussion)}`}
                    >
                      {getDiscussionStatusLabel(discussion)}
                    </span>
                  </div>

                  <div className="mb-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                    <span className="shrink-0 rounded-full border border-zinc-800 bg-black px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-500 sm:px-3 sm:text-[11px] sm:tracking-[0.18em]">
                      {discussion.topic}
                    </span>

                    {discussion.reality_lens && (
                      <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400 sm:px-3 sm:text-[11px]">
                        {discussion.reality_lens}
                      </span>
                    )}

                    {discussion.purpose_lane && (
                      <span className="shrink-0 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[10px] font-medium text-zinc-400 sm:px-3 sm:text-[11px]">
                        {discussion.purpose_lane}
                      </span>
                    )}
                  </div>

                  <h2 className="mb-2 text-lg font-semibold leading-snug tracking-tight transition group-hover:text-white sm:mb-3 sm:text-2xl">
                    {discussion.title}
                  </h2>

                  <p className="mb-3 line-clamp-2 text-sm leading-relaxed text-zinc-400 sm:mb-4 sm:line-clamp-3 sm:text-base">
                    {discussion.body}
                  </p>

                  {discussionTags[discussion.id]?.length > 0 && (
                    <div className="mb-4 flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                      {discussionTags[discussion.id].map((tag) => (
                        <span
                          key={`${discussion.id}-${tag}`}
                          className="shrink-0 rounded-full border border-zinc-800 bg-black px-3 py-1 text-xs text-zinc-500"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-900 pt-4 text-xs text-zinc-500 sm:text-sm">
                    <span>
                      {replyCounts[discussion.id] ?? 0} replies
                    </span>

                    <span>
                      {bookmarkCounts[discussion.id] ?? 0} saves
                    </span>

                    <span>
                      {viewCounts[discussion.id] ?? 0} views
                    </span>

                    <span>
                      Signal {getSignalScore(
                        discussion.id,
                        replyCounts,
                        bookmarkCounts,
                        viewCounts
                      )}
                    </span>

                    <span className="ml-auto hidden text-zinc-400 sm:inline">
                      Open discussion →
                    </span>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
        </div>

        <aside className="loombus-right-rail fixed inset-y-0 right-0 z-30 hidden overflow-y-auto border-l border-zinc-900 bg-black/95 px-4 py-6 backdrop-blur-xl lg:block">
          <div className="space-y-4">
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <div className="mb-5 border-b border-zinc-900 pb-5">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Discussions
                </p>

                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Discussion feed
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                  Read everything, follow your circle, or jump into active conversations.
                </p>
              </div>

              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                    Feed controls
                  </p>

                  <h2 className="text-xl font-semibold tracking-tight">
                    Refine the discussion feed.
                  </h2>

                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    Search, filter, and sort here. The center panel stays focused on discussion results.
                  </p>
                </div>

                {hasActiveDiscussionFilters && (
                  <button
                    type="button"
                    onClick={resetDiscussionFilters}
                    className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                  >
                    Reset
                  </button>
                )}
              </div>

              <label htmlFor="discussion-search-rail" className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Search discussions
                </span>

                <input
                  id="discussion-search-rail"
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search titles, bodies, topics, or contributors..."
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                />
              </label>

              <button
                type="button"
                onClick={toggleExploreFilters}
                className="mt-4 w-full rounded-full border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                aria-expanded={showExploreFilters}
              >
                {showExploreFilters ? "Hide filters" : hasActiveDiscussionFilters ? "Edit filters" : "Explore / Filters"}
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                {hasActiveDiscussionFilters ? (
                  activeFilterLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-400"
                    >
                      {label}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-500">
                    {filterSummary}
                  </span>
                )}
              </div>

              {showExploreFilters && (
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                      Sort by
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSortMode("Newest")}
                        className={`rounded-full px-3.5 py-2 text-sm transition ${
                          sortMode === "Newest"
                            ? "bg-white text-black"
                            : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                        }`}
                      >
                        Newest
                      </button>

                      <button
                        type="button"
                        onClick={() => setSortMode("Most replied")}
                        className={`rounded-full px-3.5 py-2 text-sm transition ${
                          sortMode === "Most replied"
                            ? "bg-white text-black"
                            : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                        }`}
                      >
                        Most replied
                      </button>

                      <button
                        type="button"
                        onClick={() => setSortMode("Signal")}
                        className={`rounded-full px-3.5 py-2 text-sm transition ${
                          sortMode === "Signal"
                            ? "bg-white text-black"
                            : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                        }`}
                      >
                        Signal
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                      Topics
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {topics.map((topic) => (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => setTopicFilter(topic)}
                          className={`rounded-full px-3.5 py-2 text-sm transition ${
                            selectedTopic === topic
                              ? "bg-white text-black"
                              : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
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
                        className="rounded-full border border-zinc-800 bg-black/20 px-3.5 py-2 text-sm text-zinc-500 transition hover:border-zinc-700 hover:text-white"
                      >
                        {showAllTopicFilters ? "Show active topics" : "Show all topics"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                      Purpose lanes
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {["All", ...PURPOSE_LANES].map((lane) => (
                        <button
                          key={lane}
                          type="button"
                          onClick={() => setPurposeLaneFilter(lane)}
                          className={`rounded-full px-3.5 py-2 text-sm transition ${
                            selectedPurposeLane === lane
                              ? "bg-white text-black"
                              : "border border-zinc-800 bg-black/30 text-zinc-400 hover:border-zinc-700 hover:text-white"
                          }`}
                        >
                          {lane}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-600">
                          Advanced filters
                        </p>

                        {!canUseAdvancedFilters && (
                          <Link
                            href="/premium"
                            className="text-xs text-zinc-500 underline decoration-zinc-800 underline-offset-4 transition hover:text-white hover:decoration-white"
                          >
                            Unlock with Premium
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {ADVANCED_FILTERS.map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setAdvancedFilter(filter)}
                          disabled={!canUseAdvancedFilters && filter !== "All activity"}
                          className={`rounded-full border px-3.5 py-2 text-sm transition ${
                            advancedFilter === filter
                              ? "border-zinc-400 text-white"
                              : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                          } disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700`}
                        >
                          {filter}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>


            <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/20">
              <div className="border-b border-zinc-900 p-5">
                <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                  Loombus Signal Panel
                </p>

                <h2 className="text-xl font-semibold tracking-tight">
                  Signal discipline
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                  Read before reacting. Reply when you can add context, lived experience, evidence, a sharper question, or a clearer frame.
                </p>
              </div>

              <div className="grid grid-cols-3 border-b border-zinc-900">
                <div className="border-r border-zinc-900 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                    Showing
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-200">
                    {filteredDiscussions.length}
                  </p>
                </div>

                <div className="border-r border-zinc-900 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                    Total
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-200">
                    {discussions.length}
                  </p>
                </div>

                <div className="p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                    Sort
                  </p>
                  <p className="mt-2 truncate text-sm font-medium text-zinc-300">
                    {sortMode}
                  </p>
                </div>
              </div>

              <div className="p-5">
                <Link
                  href="/create"
                  className="inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
                >
                  Create a discussion
                </Link>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Current lens
              </p>

              <div className="space-y-2">
                <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                    Topic
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {selectedTopic}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                    Purpose
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {selectedPurposeLane}
                  </p>
                </div>

                <div className="rounded-2xl border border-zinc-900 bg-black p-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-700">
                    View
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    {filterSummary}
                  </p>
                </div>
              </div>

              {hasActiveDiscussionFilters && (
                <button
                  type="button"
                  onClick={resetDiscussionFilters}
                  className="mt-4 w-full rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                >
                  Reset lens
                </button>
              )}
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Reply standard
              </p>

              <div className="space-y-3 text-sm leading-relaxed text-zinc-500">
                <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                  Add context the original post did not have.
                </p>

                <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                  Ask a question that moves the discussion forward.
                </p>

                <p className="rounded-2xl border border-zinc-900 bg-black p-3">
                  Use experience, examples, evidence, or better framing.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20">
              <p className="mb-3 text-xs uppercase tracking-[0.22em] text-zinc-600">
                Save standard
              </p>

              <p className="text-sm leading-relaxed text-zinc-500">
                Save a discussion when it is worth returning to, comparing, citing, or building on later. A saved thread should become part of your working knowledge shelf.
              </p>

              <Link
                href="/saved"
                className="mt-4 inline-flex w-full justify-center rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
              >
                Open saved
              </Link>
            </section>
          </div>
        </aside>
        </div>
      </div>
    </main>
  );
}
