"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Bot,
  Check,
  Clock3,
  FileText,
  Loader2,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import { PLATFORM_ROUTE_REGISTRY, type PlatformRouteEntry } from "@/lib/platform-route-registry";

type SearchTab = "all" | "discussions" | "people" | "saved" | "pages";

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  user_id: string;
  reality_lens: string | null;
  purpose_lane: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type SavedResult = {
  id: string;
  created_at: string;
  private_note: string | null;
  discussions: {
    id: string;
    title: string;
    topic: string;
    body: string;
    created_at: string;
    reality_lens: string | null;
    purpose_lane: string | null;
  } | null;
};

type PlatformSearchResult = PlatformRouteEntry;

const SEARCH_HISTORY_KEY = "loombus:search-history";

const PLATFORM_SEARCH_RESULTS: PlatformSearchResult[] = PLATFORM_ROUTE_REGISTRY;

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function scoreTextMatch(value: string | null | undefined, cleanQuery: string) {
  const text = normalizeSearchValue(value);
  if (!text) return 100;
  if (text === cleanQuery) return 0;
  if (text.startsWith(cleanQuery)) return 1;
  if (text.includes(cleanQuery)) return 2;
  return 100;
}

function scorePlatformResult(result: PlatformSearchResult, cleanQuery: string) {
  return Math.min(
    scoreTextMatch(result.title, cleanQuery),
    scoreTextMatch(result.category, cleanQuery) + 1,
    ...result.keywords.map((keyword) => scoreTextMatch(keyword, cleanQuery) + 1),
    scoreTextMatch(result.description, cleanQuery) + 3
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitialSearchState() {
  if (typeof window === "undefined") {
    return { query: "", tab: "all" as SearchTab };
  }

  const params = new URLSearchParams(window.location.search);
  const query = params.get("q")?.trim() ?? "";
  const requestedTab = params.get("type") as SearchTab | null;
  const tab: SearchTab = ["all", "discussions", "people", "saved", "pages"].includes(
    requestedTab ?? ""
  )
    ? (requestedTab as SearchTab)
    : "all";

  return { query, tab };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("all");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [savedResults, setSavedResults] = useState<SavedResult[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [aiUpgradeRequired, setAiUpgradeRequired] = useState(false);

  useEffect(() => {
    const initial = getInitialSearchState();
    setQuery(initial.query);
    setActiveQuery(initial.query);
    setActiveTab(initial.tab);

    try {
      const stored = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) ?? "[]");
      if (Array.isArray(stored)) {
        setRecentSearches(stored.filter((item) => typeof item === "string").slice(0, 6));
      }
    } catch {
      setRecentSearches([]);
    }

    function handlePopState() {
      const next = getInitialSearchState();
      setQuery(next.query);
      setActiveQuery(next.query);
      setActiveTab(next.tab);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function resolveViewer() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setCurrentUserId(data.user?.id ?? null);
      setAuthResolved(true);
    }

    resolveViewer();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authResolved) return;

    const cleanQuery = normalizeSearchValue(activeQuery);
    if (cleanQuery.length < 2) {
      setDiscussions([]);
      setProfiles([]);
      setSavedResults([]);
      setProfileMap({});
      setLoading(false);
      setMessage("");
      setAiAnswer("");
      setAiMessage("");
      setAiUpgradeRequired(false);
      return;
    }

    let mounted = true;

    async function loadSearchResults() {
      setLoading(true);
      setMessage("");
      setAiAnswer("");
      setAiMessage("");
      setAiUpgradeRequired(false);

      try {
        const escapedQuery = cleanQuery.replace(/[%_]/g, "");
        const pattern = `%${escapedQuery}%`;
        const blockedIds = new Set<string>();

        if (currentUserId) {
          const { data: blockRows } = await supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${currentUserId},blocked_id.eq.${currentUserId}`);

          for (const block of (blockRows ?? []) as BlockRow[]) {
            blockedIds.add(
              block.blocker_id === currentUserId ? block.blocked_id : block.blocker_id
            );
          }
        }

        const discussionSelect =
          "id, title, topic, body, created_at, user_id, reality_lens, purpose_lane";

        const discussionQueries = [
          supabase
            .from("discussions")
            .select(discussionSelect)
            .is("deleted_at", null)
            .ilike("title", pattern)
            .order("created_at", { ascending: false })
            .limit(16),
          supabase
            .from("discussions")
            .select(discussionSelect)
            .is("deleted_at", null)
            .ilike("topic", pattern)
            .order("created_at", { ascending: false })
            .limit(16),
          supabase
            .from("discussions")
            .select(discussionSelect)
            .is("deleted_at", null)
            .ilike("body", pattern)
            .order("created_at", { ascending: false })
            .limit(16),
          supabase
            .from("discussions")
            .select(discussionSelect)
            .is("deleted_at", null)
            .ilike("reality_lens", pattern)
            .order("created_at", { ascending: false })
            .limit(16),
          supabase
            .from("discussions")
            .select(discussionSelect)
            .is("deleted_at", null)
            .ilike("purpose_lane", pattern)
            .order("created_at", { ascending: false })
            .limit(16),
        ];

        const profileQueries = currentUserId
          ? [
              supabase
                .from("profiles")
                .select("id, username, full_name, avatar_url, bio")
                .ilike("username", pattern)
                .limit(16),
              supabase
                .from("profiles")
                .select("id, username, full_name, avatar_url, bio")
                .ilike("full_name", pattern)
                .limit(16),
              supabase
                .from("profiles")
                .select("id, username, full_name, avatar_url, bio")
                .ilike("bio", pattern)
                .limit(16),
            ]
          : [];

        const [discussionResponses, profileResponses] = await Promise.all([
          Promise.all(discussionQueries),
          Promise.all(profileQueries),
        ]);

        const profileMatches = new Map<string, Profile>();
        for (const response of profileResponses) {
          if (response.error) throw response.error;
          for (const profile of (response.data ?? []) as Profile[]) {
            if (!blockedIds.has(profile.id)) profileMatches.set(profile.id, profile);
          }
        }

        const contributorIds = [...profileMatches.keys()];
        let contributorDiscussions: Discussion[] = [];
        if (contributorIds.length > 0) {
          const { data, error } = await supabase
            .from("discussions")
            .select(discussionSelect)
            .is("deleted_at", null)
            .in("user_id", contributorIds)
            .order("created_at", { ascending: false })
            .limit(16);
          if (error) throw error;
          contributorDiscussions = (data ?? []) as unknown as Discussion[];
        }

        const discussionMatches = new Map<string, Discussion>();
        for (const response of discussionResponses) {
          if (response.error) throw response.error;
          for (const discussion of (response.data ?? []) as unknown as Discussion[]) {
            if (!blockedIds.has(discussion.user_id)) {
              discussionMatches.set(discussion.id, discussion);
            }
          }
        }
        for (const discussion of contributorDiscussions) {
          if (!blockedIds.has(discussion.user_id)) {
            discussionMatches.set(discussion.id, discussion);
          }
        }

        const authorIds = [...new Set([...discussionMatches.values()].map((item) => item.user_id))];
        const nextProfileMap: Record<string, Profile> = {};
        if (authorIds.length > 0) {
          const { data: authorRows, error: authorError } = await supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, bio")
            .in("id", authorIds);
          if (authorError) throw authorError;
          for (const profile of (authorRows ?? []) as Profile[]) {
            nextProfileMap[profile.id] = profile;
          }
        }

        const rankedDiscussions = [...discussionMatches.values()]
          .sort((left, right) => {
            const leftAuthor = nextProfileMap[left.user_id];
            const rightAuthor = nextProfileMap[right.user_id];
            const leftScore = Math.min(
              scoreTextMatch(left.title, cleanQuery),
              scoreTextMatch(left.topic, cleanQuery) + 1,
              scoreTextMatch(left.purpose_lane, cleanQuery) + 2,
              scoreTextMatch(left.reality_lens, cleanQuery) + 2,
              scoreTextMatch(leftAuthor?.username, cleanQuery) + 2,
              scoreTextMatch(leftAuthor?.full_name, cleanQuery) + 2,
              scoreTextMatch(left.body, cleanQuery) + 4
            );
            const rightScore = Math.min(
              scoreTextMatch(right.title, cleanQuery),
              scoreTextMatch(right.topic, cleanQuery) + 1,
              scoreTextMatch(right.purpose_lane, cleanQuery) + 2,
              scoreTextMatch(right.reality_lens, cleanQuery) + 2,
              scoreTextMatch(rightAuthor?.username, cleanQuery) + 2,
              scoreTextMatch(rightAuthor?.full_name, cleanQuery) + 2,
              scoreTextMatch(right.body, cleanQuery) + 4
            );
            if (leftScore !== rightScore) return leftScore - rightScore;
            return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
          })
          .slice(0, 12);

        const rankedProfiles = [...profileMatches.values()]
          .sort((left, right) => {
            const leftScore = Math.min(
              scoreTextMatch(left.username, cleanQuery),
              scoreTextMatch(left.full_name, cleanQuery),
              scoreTextMatch(left.bio, cleanQuery) + 3
            );
            const rightScore = Math.min(
              scoreTextMatch(right.username, cleanQuery),
              scoreTextMatch(right.full_name, cleanQuery),
              scoreTextMatch(right.bio, cleanQuery) + 3
            );
            return leftScore - rightScore;
          })
          .slice(0, 12);

        let nextSavedResults: SavedResult[] = [];
        if (currentUserId) {
          const { data: savedData, error: savedError } = await supabase
            .from("bookmarks")
            .select(`
              id,
              created_at,
              private_note,
              discussions (
                id,
                title,
                topic,
                body,
                created_at,
                reality_lens,
                purpose_lane
              )
            `)
            .eq("user_id", currentUserId)
            .order("created_at", { ascending: false })
            .limit(100);

          if (savedError) throw savedError;

          nextSavedResults = ((savedData ?? []) as Array<{
            id: string;
            created_at: string;
            private_note: string | null;
            discussions: SavedResult["discussions"] | SavedResult["discussions"][];
          }>)
            .map((item) => ({
              ...item,
              discussions: Array.isArray(item.discussions)
                ? item.discussions[0] ?? null
                : item.discussions,
            }))
            .filter((item) => {
              const discussion = item.discussions;
              return [
                discussion?.title,
                discussion?.topic,
                discussion?.body,
                discussion?.reality_lens,
                discussion?.purpose_lane,
                item.private_note,
              ].some((value) => normalizeSearchValue(value).includes(cleanQuery));
            })
            .sort((left, right) => {
              const leftScore = Math.min(
                scoreTextMatch(left.discussions?.title, cleanQuery),
                scoreTextMatch(left.discussions?.topic, cleanQuery) + 1,
                scoreTextMatch(left.private_note, cleanQuery) + 2,
                scoreTextMatch(left.discussions?.body, cleanQuery) + 4
              );
              const rightScore = Math.min(
                scoreTextMatch(right.discussions?.title, cleanQuery),
                scoreTextMatch(right.discussions?.topic, cleanQuery) + 1,
                scoreTextMatch(right.private_note, cleanQuery) + 2,
                scoreTextMatch(right.discussions?.body, cleanQuery) + 4
              );
              return leftScore - rightScore;
            })
            .slice(0, 12);
        }

        if (!mounted) return;
        setDiscussions(rankedDiscussions);
        setProfiles(rankedProfiles);
        setSavedResults(nextSavedResults);
        setProfileMap(nextProfileMap);
      } catch (error) {
        console.error("Unable to load search results.", error);
        if (mounted) {
          setDiscussions([]);
          setProfiles([]);
          setSavedResults([]);
          setProfileMap({});
          setMessage("Search could not load. Refresh the page and try again.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timeoutId = window.setTimeout(loadSearchResults, 180);
    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [activeQuery, authResolved, currentUserId]);

  const cleanActiveQuery = normalizeSearchValue(activeQuery);

  const platformResults = useMemo(() => {
    if (cleanActiveQuery.length < 2) return [];
    return PLATFORM_SEARCH_RESULTS.map((result) => ({
      result,
      score: scorePlatformResult(result, cleanActiveQuery),
    }))
      .filter((item) => item.score < 100)
      .sort((left, right) => left.score - right.score)
      .map((item) => item.result)
      .slice(0, 12);
  }, [cleanActiveQuery]);

  const counts = {
    discussions: discussions.length,
    people: profiles.length,
    saved: savedResults.length,
    pages: platformResults.length,
  };
  const totalResults = counts.discussions + counts.people + counts.saved + counts.pages;
  const hasQuery = cleanActiveQuery.length >= 2;
  const hasResults = totalResults > 0;

  function persistSearch(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (trimmed.length < 2) return;
    const nextHistory = [trimmed, ...recentSearches.filter((item) => item !== trimmed)].slice(0, 6);
    setRecentSearches(nextHistory);
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
  }

  function updateSearchUrl(nextQuery: string, nextTab: SearchTab, mode: "push" | "replace") {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextTab !== "all") params.set("type", nextTab);
    const nextUrl = params.toString() ? `/search?${params.toString()}` : "/search";
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", nextUrl);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    setActiveQuery(trimmed);
    persistSearch(trimmed);
    updateSearchUrl(trimmed, activeTab, "push");
  }

  function runRecentSearch(value: string) {
    setQuery(value);
    setActiveQuery(value);
    persistSearch(value);
    updateSearchUrl(value, activeTab, "push");
  }

  function clearSearch() {
    setQuery("");
    setActiveQuery("");
    setActiveTab("all");
    setAiAnswer("");
    setAiMessage("");
    updateSearchUrl("", "all", "replace");
  }

  function selectTab(tab: SearchTab) {
    setActiveTab(tab);
    updateSearchUrl(activeQuery, tab, "replace");
  }

  function getAiContext() {
    const context = [
      {
        kind: "Context summary",
        title: "Available matching Loombus results",
        description: `Discussions: ${counts.discussions} · People: ${counts.people} · Saved: ${counts.saved} · Pages: ${counts.pages}`,
        href: "",
      },
      ...discussions.map((discussion) => ({
        kind: "Discussion",
        title: discussion.title,
        description: [
          discussion.topic,
          discussion.purpose_lane ?? "",
          discussion.reality_lens ?? "",
          discussion.body,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/discussions/${discussion.id}`,
      })),
      ...profiles.map((profile) => ({
        kind: "Person",
        title: getProfileDisplayName(profile),
        description: [profile.username ? `@${profile.username}` : "", profile.bio ?? ""]
          .filter(Boolean)
          .join(" · "),
        href: profile.username ? `/u/${profile.username}` : "/people",
      })),
      ...savedResults.map((item) => ({
        kind: "Saved",
        title: item.discussions?.title ?? "Saved discussion",
        description: [
          item.discussions?.topic ?? "",
          item.discussions?.purpose_lane ?? "",
          item.private_note ? `Private note: ${item.private_note}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        href: item.discussions ? `/discussions/${item.discussions.id}` : "/saved",
      })),
      ...platformResults.map((result) => ({
        kind: "Page",
        title: result.title,
        description: result.description,
        href: result.href,
      })),
    ];

    return context.slice(0, 12);
  }

  async function askLoombusAi() {
    if (!currentUserId || !hasQuery || aiWorking || loading) return;

    setAiWorking(true);
    setAiAnswer("");
    setAiMessage("");
    setAiUpgradeRequired(false);

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setAiMessage("Log in to use Ask Loombus AI.");
      setAiWorking(false);
      return;
    }

    try {
      const response = await fetch("/api/search/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ query: activeQuery.trim(), context: getAiContext() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setAiUpgradeRequired(Boolean(result.upgradeRequired));
        setAiMessage(result.error ?? "Unable to ask Loombus AI.");
        return;
      }
      setAiAnswer(String(result.answer ?? ""));
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "Unable to ask Loombus AI.");
    } finally {
      setAiWorking(false);
    }
  }

  const tabs: Array<{ id: SearchTab; label: string; count: number }> = [
    { id: "all", label: "All", count: totalResults },
    { id: "discussions", label: "Discussions", count: counts.discussions },
    { id: "people", label: "People", count: counts.people },
    { id: "saved", label: "Saved", count: counts.saved },
    { id: "pages", label: "Pages", count: counts.pages },
  ];

  return (
    <main className="search-v2-page loombus-shell-with-right-rail">
      <div className="search-v2-shell">
        <section className="search-v2-hero">
          <div className="search-v2-hero-copy">
            <p className="search-v2-eyebrow">Loombus Search</p>
            <h1>Find the signal you came for.</h1>
            <p>
              Search discussions, contributors, saved knowledge, and platform destinations from one focused workspace.
            </p>
          </div>

          <form className="search-v2-form" onSubmit={submitSearch}>
            <Search aria-hidden="true" size={22} />
            <label className="search-v2-sr-only" htmlFor="search-v2-input">
              Search Loombus
            </label>
            <input
              id="search-v2-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a topic, question, contributor, saved note, or page"
              autoComplete="off"
              autoFocus
            />
            {query ? (
              <button type="button" className="search-v2-clear-input" onClick={() => setQuery("")} aria-label="Clear search field">
                <X aria-hidden="true" size={18} />
              </button>
            ) : null}
            <button type="submit" className="search-v2-submit" disabled={query.trim().length < 2}>
              Search
              <ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>

          <div className="search-v2-hero-footer">
            <span>Matches are ordered by direct relevance, not popularity.</span>
            {activeQuery ? (
              <button type="button" onClick={clearSearch}>Clear all</button>
            ) : null}
          </div>
        </section>

        {!hasQuery && recentSearches.length > 0 ? (
          <section className="search-v2-recent" aria-labelledby="recent-searches-heading">
            <div>
              <p className="search-v2-eyebrow">On this device</p>
              <h2 id="recent-searches-heading">Recent searches</h2>
            </div>
            <div className="search-v2-recent-chips">
              {recentSearches.map((item) => (
                <button key={item} type="button" onClick={() => runRecentSearch(item)}>
                  <Clock3 aria-hidden="true" size={15} />
                  {item}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {hasQuery ? (
          <nav className="search-v2-tabs" aria-label="Search result types">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-current={activeTab === tab.id ? "page" : undefined}
                onClick={() => selectTab(tab.id)}
              >
                <span>{tab.label}</span>
                <strong>{loading ? "·" : tab.count}</strong>
              </button>
            ))}
          </nav>
        ) : null}

        {message ? <p className="search-v2-notice is-error">{message}</p> : null}

        {hasQuery && currentUserId ? (
          <section className="search-v2-ai-card" aria-labelledby="search-ai-heading">
            <div className="search-v2-ai-icon">
              <Bot aria-hidden="true" size={23} />
            </div>
            <div className="search-v2-ai-copy">
              <p className="search-v2-eyebrow">Grounded assistance</p>
              <h2 id="search-ai-heading">Ask Loombus AI about these results</h2>
              <p>
                The answer is restricted to the discussions, people, saved items, and pages currently returned by this search.
              </p>
              {aiAnswer ? <div className="search-v2-ai-answer">{aiAnswer}</div> : null}
              {aiMessage ? <p className="search-v2-ai-message">{aiMessage}</p> : null}
              <div className="search-v2-ai-actions">
                <button type="button" onClick={askLoombusAi} disabled={aiWorking || loading}>
                  {aiWorking ? <Loader2 aria-hidden="true" className="search-v2-spin" size={16} /> : <Sparkles aria-hidden="true" size={16} />}
                  {aiWorking ? "Reviewing results" : aiAnswer ? "Ask again" : "Ask Loombus AI"}
                </button>
                {aiUpgradeRequired ? <Link href="/premium">Review Premium</Link> : null}
              </div>
            </div>
          </section>
        ) : null}

        {hasQuery && !currentUserId ? (
          <p className="search-v2-notice">
            Discussion and page search are available now. <Link href={`/login?next=${encodeURIComponent(`/search?q=${activeQuery}`)}`}>Log in</Link> to search people, saved items, and use grounded AI assistance.
          </p>
        ) : null}

        {loading ? (
          <section className="search-v2-loading" aria-live="polite">
            <Loader2 aria-hidden="true" className="search-v2-spin" size={22} />
            <div>
              <strong>Searching Loombus</strong>
              <span>Matching your exact terms across connected content.</span>
            </div>
          </section>
        ) : null}

        {!hasQuery ? (
          <section className="search-v2-start-state">
            <div className="search-v2-start-icon"><Search aria-hidden="true" size={26} /></div>
            <p className="search-v2-eyebrow">Start with two characters</p>
            <h2>Search by subject, question, person, purpose, or destination.</h2>
            <p>
              Results appear only after you submit a search. Loombus does not label the most popular result as the best result.
            </p>
            <div className="search-v2-start-links">
              <Link href="/discussions">Browse discussions</Link>
              <Link href="/people">Find contributors</Link>
              <Link href="/saved">Open saved</Link>
            </div>
          </section>
        ) : null}

        {hasQuery && !loading && !hasResults ? (
          <section className="search-v2-empty-state">
            <div className="search-v2-start-icon"><Search aria-hidden="true" size={25} /></div>
            <p className="search-v2-eyebrow">No direct matches</p>
            <h2>Nothing matched “{activeQuery}”.</h2>
            <p>Try a shorter phrase, a contributor name, a topic, or the main idea instead of a full sentence.</p>
            <div className="search-v2-empty-actions">
              <button type="button" onClick={clearSearch}>Clear search</button>
              <Link href={`/create?prompt=${encodeURIComponent(activeQuery)}`}>Create a discussion</Link>
            </div>
          </section>
        ) : null}

        {hasQuery && !loading && hasResults ? (
          <div className="search-v2-results" aria-live="polite">
            {(activeTab === "all" || activeTab === "discussions") && discussions.length > 0 ? (
              <section className="search-v2-result-section" aria-labelledby="discussion-results-heading">
                <div className="search-v2-section-heading">
                  <div>
                    <p className="search-v2-eyebrow">Discussions</p>
                    <h2 id="discussion-results-heading">Signal threads</h2>
                  </div>
                  <span>{discussions.length} matched</span>
                </div>
                <div className="search-v2-discussion-list">
                  {discussions.map((discussion) => {
                    const author = profileMap[discussion.user_id];
                    return (
                      <Link key={discussion.id} href={`/discussions/${discussion.id}`} className="search-v2-discussion-card">
                        <div className="search-v2-card-author">
                          <ProfileAvatar profile={author} size="md" />
                          <div>
                            <strong>{author ? getProfileDisplayName(author) : "Loombus member"}</strong>
                            <span>{formatDate(discussion.created_at)}</span>
                          </div>
                          <em>{discussion.topic || "Discussion"}</em>
                        </div>
                        <h3>{normalizePublicText(discussion.title)}</h3>
                        <p>{normalizePublicText(discussion.body)}</p>
                        <div className="search-v2-card-meta">
                          {discussion.purpose_lane ? <span>{discussion.purpose_lane}</span> : null}
                          {discussion.reality_lens ? <span>{discussion.reality_lens}</span> : null}
                          <span className="search-v2-open-link">Open discussion <ArrowRight aria-hidden="true" size={15} /></span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {(activeTab === "all" || activeTab === "people") && currentUserId && profiles.length > 0 ? (
              <section className="search-v2-result-section" aria-labelledby="people-results-heading">
                <div className="search-v2-section-heading">
                  <div>
                    <p className="search-v2-eyebrow">People</p>
                    <h2 id="people-results-heading">Contributors</h2>
                  </div>
                  <span>{profiles.length} matched</span>
                </div>
                <div className="search-v2-people-grid">
                  {profiles.map((profile) => (
                    <Link key={profile.id} href={profile.username ? `/u/${profile.username}` : "/people"} className="search-v2-person-card">
                      <ProfileAvatar profile={profile} size="lg" />
                      <div>
                        <h3>{getProfileDisplayName(profile)}</h3>
                        <span>{profile.username ? `@${profile.username}` : "Username not set"}</span>
                        {profile.bio ? <p>{profile.bio}</p> : null}
                      </div>
                      <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {(activeTab === "all" || activeTab === "saved") && currentUserId && savedResults.length > 0 ? (
              <section className="search-v2-result-section" aria-labelledby="saved-results-heading">
                <div className="search-v2-section-heading">
                  <div>
                    <p className="search-v2-eyebrow">Saved</p>
                    <h2 id="saved-results-heading">Your private library</h2>
                  </div>
                  <span>{savedResults.length} matched</span>
                </div>
                <div className="search-v2-saved-grid">
                  {savedResults.map((item) => (
                    <Link key={item.id} href={item.discussions ? `/discussions/${item.discussions.id}` : "/saved"} className="search-v2-saved-card">
                      <span className="search-v2-result-icon"><Bookmark aria-hidden="true" size={19} /></span>
                      <div>
                        <em>{item.discussions?.topic ?? "Saved item"}</em>
                        <h3>{item.discussions?.title ?? "Saved discussion"}</h3>
                        {item.private_note ? <p>Private note: {item.private_note}</p> : <p>Saved {formatDate(item.created_at)}</p>}
                      </div>
                      <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {(activeTab === "all" || activeTab === "pages") && platformResults.length > 0 ? (
              <section className="search-v2-result-section" aria-labelledby="page-results-heading">
                <div className="search-v2-section-heading">
                  <div>
                    <p className="search-v2-eyebrow">Platform</p>
                    <h2 id="page-results-heading">Pages and tools</h2>
                  </div>
                  <span>{platformResults.length} matched</span>
                </div>
                <div className="search-v2-page-grid">
                  {platformResults.map((result) => (
                    <Link key={result.href} href={result.href} className="search-v2-page-card">
                      <span className="search-v2-result-icon"><FileText aria-hidden="true" size={19} /></span>
                      <div>
                        <em>{result.category}</em>
                        <h3>{result.title}</h3>
                        <p>{result.description}</p>
                      </div>
                      <ArrowRight aria-hidden="true" size={17} />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            {activeTab !== "all" && tabs.find((tab) => tab.id === activeTab)?.count === 0 ? (
              <section className="search-v2-empty-tab">
                <Check aria-hidden="true" size={20} />
                <p>No {activeTab} results matched this search. Other result types may still contain useful matches.</p>
                <button type="button" onClick={() => selectTab("all")}>View all results</button>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className="loombus-right-rail search-v2-right-rail" aria-label="Search summary">
        <div className="search-v2-right-stack">
          <section className="search-v2-side-card">
            <p className="search-v2-eyebrow">Search summary</p>
            <h2>{hasQuery ? `Results for “${activeQuery}”` : "Search Loombus"}</h2>
            <div className="search-v2-count-grid">
              <div><strong>{loading ? "·" : counts.discussions}</strong><span>Discussions</span></div>
              <div><strong>{loading ? "·" : counts.people}</strong><span>People</span></div>
              <div><strong>{loading ? "·" : counts.saved}</strong><span>Saved</span></div>
              <div><strong>{loading ? "·" : counts.pages}</strong><span>Pages</span></div>
            </div>
          </section>

          <section className="search-v2-side-card">
            <p className="search-v2-eyebrow">How results are ordered</p>
            <h2>Direct relevance first.</h2>
            <div className="search-v2-principles">
              <p><strong>1.</strong> Exact title, topic, name, or username matches.</p>
              <p><strong>2.</strong> Matching purpose, lens, notes, and descriptions.</p>
              <p><strong>3.</strong> Newer content only breaks equal relevance scores.</p>
            </div>
          </section>

          <section className="search-v2-side-card">
            <p className="search-v2-eyebrow">Useful destinations</p>
            <div className="search-v2-side-links">
              <Link href="/discussions">Browse discussions <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link href="/people">Find contributors <ArrowRight aria-hidden="true" size={15} /></Link>
              <Link href="/saved">Open saved <ArrowRight aria-hidden="true" size={15} /></Link>
            </div>
          </section>
        </div>
      </aside>
    </main>
  );
}
