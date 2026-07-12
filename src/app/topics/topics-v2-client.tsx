"use client";

import { normalizePublicText } from "@/lib/public-text";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";
import {
  Activity,
  Bell,
  BellOff,
  Bookmark,
  ChevronRight,
  Clock3,
  Eye,
  Flame,
  MessageCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import "./topics-v2.css";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
};

type TopicView = "all" | "following" | "trending" | "newest";
type ActivityFilter = "all" | "active" | "quiet";

type TopicStat = {
  name: string;
  description: string;
  discussionCount: number;
  replyCount: number;
  viewCount: number;
  saveCount: number;
  signalScore: number;
  newThisWeek: number;
  latestDiscussion: Discussion | null;
  latestAuthor: Profile | null;
  latestAt: string | null;
  active: boolean;
  followable: boolean;
};

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  "AI & Society": "How artificial intelligence changes institutions, culture, responsibility, and daily life.",
  "Books & Writing": "Books, publishing, storytelling, authorship, and the craft of clear written ideas.",
  Business: "Companies, markets, operations, strategy, leadership, and sustainable value creation.",
  Culture: "The beliefs, habits, media, traditions, and social forces shaping how people live together.",
  Education: "Learning systems, schools, teaching, credentials, access, and the future of knowledge.",
  Entrepreneurship: "Building organizations, validating ideas, serving customers, and navigating founder decisions.",
  Environment: "Climate, conservation, energy, resilience, and the systems connecting people to the natural world.",
  "Faith & Values": "Belief, ethics, meaning, moral responsibility, and the values guiding public and private life.",
  "Future of Work": "Automation, labor, skills, organizations, careers, and the changing relationship between people and work.",
  General: "Broad discussions that do not fit a narrower topic lane but still deserve focused Signal.",
  Healthcare: "Health systems, medicine, care delivery, prevention, access, and patient experience.",
  "Law & Justice": "Law, rights, courts, enforcement, accountability, and fair institutional outcomes.",
  "Local Community": "Neighborhoods, cities, local institutions, events, services, and practical community problem-solving.",
  Media: "Journalism, entertainment, information systems, attention, trust, and public understanding.",
  "Money & Finance": "Personal finance, investing, banking, markets, economic choices, and financial systems.",
  "Parenting & Family": "Family life, caregiving, childhood, relationships, household decisions, and shared responsibility.",
  Philosophy: "Reasoning, knowledge, ethics, meaning, consciousness, and foundational questions about human life.",
  "Politics & Policy": "Government, elections, public policy, institutions, civic tradeoffs, and democratic participation.",
  Psychology: "Behavior, cognition, emotion, relationships, mental health, and how people make decisions.",
  Science: "Research, evidence, discovery, scientific institutions, and the interpretation of the natural world.",
  Systems: "Infrastructure, incentives, feedback loops, coordination, and the design of complex organizations.",
  Technology: "Software, hardware, platforms, security, emerging tools, and their real-world consequences.",
  Other: "Specialized discussions that do not yet map cleanly to an established Loombus topic.",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function getTopicName(value: string | null | undefined) {
  return value?.trim() || "Other";
}

function getTopicDescription(topic: string) {
  return TOPIC_DESCRIPTIONS[topic] ?? `Focused discussions, current questions, and live Signal filed under ${topic}.`;
}

function getProfileName(profile: Profile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function formatDate(value: string | null) {
  if (!value) return "No activity yet";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No activity yet";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return formatDate(value);
}

function buildTopicStats({
  discussions,
  profiles,
  replyCounts,
  viewCounts,
  saveCounts,
}: {
  discussions: Discussion[];
  profiles: Record<string, Profile>;
  replyCounts: Record<string, number>;
  viewCounts: Record<string, number>;
  saveCounts: Record<string, number>;
}) {
  const now = Date.now();
  const topicNames = new Set<string>(DISCUSSION_TOPICS);

  for (const discussion of discussions) {
    topicNames.add(getTopicName(discussion.topic));
  }

  const stats = new Map<string, TopicStat>();

  for (const topic of topicNames) {
    stats.set(topic, {
      name: topic,
      description: getTopicDescription(topic),
      discussionCount: 0,
      replyCount: 0,
      viewCount: 0,
      saveCount: 0,
      signalScore: 0,
      newThisWeek: 0,
      latestDiscussion: null,
      latestAuthor: null,
      latestAt: null,
      active: false,
      followable: (DISCUSSION_TOPICS as readonly string[]).includes(topic),
    });
  }

  for (const discussion of discussions) {
    const topic = getTopicName(discussion.topic);
    const current = stats.get(topic);
    if (!current) continue;

    const replies = replyCounts[discussion.id] ?? 0;
    const views = viewCounts[discussion.id] ?? 0;
    const saves = saveCounts[discussion.id] ?? 0;
    const createdAt = new Date(discussion.created_at).getTime();
    const latestAt = current.latestAt ? new Date(current.latestAt).getTime() : 0;
    const isNewest = Number.isFinite(createdAt) && createdAt >= latestAt;

    current.discussionCount += 1;
    current.replyCount += replies;
    current.viewCount += views;
    current.saveCount += saves;
    current.signalScore += replies * 3 + saves * 5 + views;
    current.newThisWeek += now - createdAt <= WEEK_MS ? 1 : 0;

    if (isNewest) {
      current.latestDiscussion = discussion;
      current.latestAuthor = profiles[discussion.user_id] ?? null;
      current.latestAt = discussion.created_at;
    }
  }

  return [...stats.values()].map((topic) => ({
    ...topic,
    active:
      topic.latestAt !== null &&
      now - new Date(topic.latestAt).getTime() <= ACTIVE_WINDOW_MS,
  }));
}

export default function TopicsV2Client() {
  const [topics, setTopics] = useState<TopicStat[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [canFollowTopics, setCanFollowTopics] = useState(false);
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<TopicView>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadTopics() {
      setLoading(true);
      setMessage("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id ?? null;
        const accessToken = sessionData.session?.access_token ?? "";

        if (mounted) setViewerId(userId);

        const { data: discussionRows, error: discussionError } = await supabase
          .from("discussions")
          .select("id, user_id, title, topic, body, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

        if (discussionError) throw discussionError;

        const hiddenUserIds = new Set<string>();

        if (userId) {
          const { data: blockRows } = await supabase
            .from("user_blocks")
            .select("blocker_id, blocked_id")
            .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

          for (const block of (blockRows ?? []) as BlockRow[]) {
            hiddenUserIds.add(
              block.blocker_id === userId ? block.blocked_id : block.blocker_id
            );
          }
        }

        const discussions = ((discussionRows ?? []) as Discussion[]).filter(
          (discussion) => !hiddenUserIds.has(discussion.user_id)
        );
        const discussionIds = discussions.map((discussion) => discussion.id);
        const authorIds = [...new Set(discussions.map((discussion) => discussion.user_id))];

        const [profileResult, replyResult, viewResult, saveResult, alertResult] =
          await Promise.all([
            authorIds.length
              ? supabase
                  .from("profiles")
                  .select("id, full_name, username")
                  .in("id", authorIds)
              : Promise.resolve({ data: [], error: null }),
            discussionIds.length
              ? supabase
                  .from("replies")
                  .select("discussion_id, user_id")
                  .in("discussion_id", discussionIds)
                  .is("deleted_at", null)
              : Promise.resolve({ data: [], error: null }),
            discussionIds.length
              ? supabase
                  .from("discussion_views")
                  .select("discussion_id")
                  .in("discussion_id", discussionIds)
              : Promise.resolve({ data: [], error: null }),
            discussionIds.length
              ? supabase
                  .from("bookmarks")
                  .select("discussion_id")
                  .in("discussion_id", discussionIds)
              : Promise.resolve({ data: [], error: null }),
            accessToken
              ? fetch("/api/topic-alerts", {
                  headers: { Authorization: `Bearer ${accessToken}` },
                })
              : Promise.resolve(null),
          ]);

        const profiles = Object.fromEntries(
          ((profileResult.data ?? []) as Profile[]).map((profile) => [
            profile.id,
            profile,
          ])
        );
        const replyCounts: Record<string, number> = {};
        const viewCounts: Record<string, number> = {};
        const saveCounts: Record<string, number> = {};

        for (const reply of replyResult.data ?? []) {
          if (hiddenUserIds.has(reply.user_id)) continue;
          replyCounts[reply.discussion_id] =
            (replyCounts[reply.discussion_id] ?? 0) + 1;
        }

        for (const row of viewResult.data ?? []) {
          viewCounts[row.discussion_id] = (viewCounts[row.discussion_id] ?? 0) + 1;
        }

        for (const row of saveResult.data ?? []) {
          saveCounts[row.discussion_id] = (saveCounts[row.discussion_id] ?? 0) + 1;
        }

        const nextTopics = buildTopicStats({
          discussions,
          profiles,
          replyCounts,
          viewCounts,
          saveCounts,
        });

        if (mounted) setTopics(nextTopics);

        if (alertResult) {
          const alertPayload = await alertResult.json().catch(() => ({}));

          if (mounted && alertResult.ok) {
            setCanFollowTopics(Boolean(alertPayload.canUseTopicAlerts));
            setFollowedTopics(
              Array.isArray(alertPayload.selectedTopics)
                ? alertPayload.selectedTopics
                : []
            );
          }
        } else if (mounted) {
          setCanFollowTopics(false);
          setFollowedTopics([]);
        }
      } catch (error) {
        console.error("Unable to load Signal Topics.", error);
        if (mounted) {
          setTopics([]);
          setMessage("Signal Topics could not load. Refresh and try again.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTopics();

    return () => {
      mounted = false;
    };
  }, []);

  const followedSet = useMemo(() => new Set(followedTopics), [followedTopics]);

  const filteredTopics = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let next = topics.filter((topic) => {
      if (activityFilter === "active" && !topic.active) return false;
      if (activityFilter === "quiet" && topic.active) return false;
      if (view === "following" && !followedSet.has(topic.name)) return false;
      if (view === "trending" && topic.signalScore === 0) return false;

      if (!needle) return true;

      return [
        topic.name,
        topic.description,
        topic.latestDiscussion?.title,
        topic.latestDiscussion?.body,
        getProfileName(topic.latestAuthor),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    if (view === "trending") {
      next = [...next].sort(
        (a, b) =>
          b.signalScore - a.signalScore ||
          b.discussionCount - a.discussionCount ||
          a.name.localeCompare(b.name)
      );
    } else if (view === "newest" || view === "following") {
      next = [...next].sort((a, b) => {
        const aTime = a.latestAt ? new Date(a.latestAt).getTime() : 0;
        const bTime = b.latestAt ? new Date(b.latestAt).getTime() : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      });
    } else {
      next = [...next].sort(
        (a, b) =>
          Number(b.active) - Number(a.active) ||
          b.discussionCount - a.discussionCount ||
          a.name.localeCompare(b.name)
      );
    }

    return next;
  }, [activityFilter, followedSet, query, topics, view]);

  const activeCount = topics.filter((topic) => topic.active).length;
  const totalDiscussions = topics.reduce(
    (total, topic) => total + topic.discussionCount,
    0
  );
  const totalSignal = topics.reduce(
    (total, topic) => total + topic.signalScore,
    0
  );
  const trendingTopics = useMemo(
    () =>
      [...topics]
        .filter((topic) => topic.signalScore > 0)
        .sort(
          (a, b) =>
            b.signalScore - a.signalScore ||
            b.discussionCount - a.discussionCount
        )
        .slice(0, 5),
    [topics]
  );
  const latestTopic = useMemo(
    () =>
      [...topics]
        .filter((topic) => topic.latestAt)
        .sort(
          (a, b) =>
            new Date(b.latestAt ?? 0).getTime() -
            new Date(a.latestAt ?? 0).getTime()
        )[0] ?? null,
    [topics]
  );

  async function toggleFollow(topic: TopicStat) {
    if (!topic.followable || savingTopic) return;

    if (!viewerId) {
      window.location.href = "/login?next=/topics";
      return;
    }

    if (!canFollowTopics) {
      setMessage(
        "Following a topic turns on its in-app topic alerts and requires Premium or Admin access."
      );
      return;
    }

    const nextTopics = followedSet.has(topic.name)
      ? followedTopics.filter((item) => item !== topic.name)
      : [...followedTopics, topic.name];

    setSavingTopic(topic.name);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=/topics";
        return;
      }

      const response = await fetch("/api/topic-alerts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topics: nextTopics }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update this topic.");
        return;
      }

      setFollowedTopics(
        Array.isArray(result.selectedTopics) ? result.selectedTopics : nextTopics
      );
      setMessage(
        followedSet.has(topic.name)
          ? `${topic.name} removed from Following.`
          : `${topic.name} added to Following. New-discussion alerts are on.`
      );
    } catch {
      setMessage("Unable to update this topic. Try again.");
    } finally {
      setSavingTopic(null);
    }
  }

  function resetView() {
    setQuery("");
    setView("all");
    setActivityFilter("all");
  }

  return (
    <main className="topics-v2-page">
      <div className="topics-v2-shell">
        <header className="topics-v2-hero">
          <div>
            <p className="topics-v2-eyebrow">Signal directory</p>
            <h1>Signal Topics</h1>
            <p>
              Find the subject lanes where Loombus Signal is forming. Explore active
              discussions, follow the topics that matter, and return directly to the
              conversations behind each topic.
            </p>
          </div>

          <div className="topics-v2-hero-actions">
            <Link href="/discussions" className="topics-v2-secondary-action">
              Browse discussions
            </Link>
            <Link href="/create" className="topics-v2-primary-action">
              Create Signal
            </Link>
          </div>
        </header>

        <section className="topics-v2-metrics" aria-label="Signal Topics overview">
          <article>
            <span>Topic lanes</span>
            <strong>{topics.length}</strong>
          </article>
          <article>
            <span>Active topics</span>
            <strong>{activeCount}</strong>
          </article>
          <article>
            <span>Discussions</span>
            <strong>{totalDiscussions}</strong>
          </article>
          <article className="is-accent">
            <span>Total Signal</span>
            <strong>{totalSignal.toLocaleString()}</strong>
          </article>
        </section>

        <div className="topics-v2-layout">
          <section className="topics-v2-main">
            <section className="topics-v2-tools" aria-label="Topic directory controls">
              <label className="topics-v2-search">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search topic names, descriptions, and recent discussions"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                    <X aria-hidden="true" />
                  </button>
                )}
              </label>

              <div className="topics-v2-view-tabs" aria-label="Topic views">
                {[
                  ["all", "All topics"],
                  ["following", `Following ${followedTopics.length}`],
                  ["trending", "Trending"],
                  ["newest", "Newest"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setView(value as TopicView)}
                    className={view === value ? "is-active" : ""}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="topics-v2-status-filter">
                <span>Activity</span>
                <select
                  value={activityFilter}
                  onChange={(event) =>
                    setActivityFilter(event.target.value as ActivityFilter)
                  }
                >
                  <option value="all">All activity levels</option>
                  <option value="active">Active topics</option>
                  <option value="quiet">Quiet topics</option>
                </select>
              </label>
            </section>

            {message && (
              <div className="topics-v2-notice" role="status">
                {message}
                {!canFollowTopics && viewerId && (
                  <Link href="/premium">View Premium</Link>
                )}
              </div>
            )}

            {loading ? (
              <section className="topics-v2-state">
                <p>Signal directory</p>
                <h2>Reading current topic activity…</h2>
                <span>Counting discussions, replies, saves, views, and recent activity.</span>
              </section>
            ) : filteredTopics.length === 0 ? (
              <section className="topics-v2-state">
                <Search aria-hidden="true" />
                <p>No matching Signal</p>
                <h2>No topics match this directory view.</h2>
                <span>Broaden the search or return to all activity levels.</span>
                <button type="button" onClick={resetView}>
                  Reset topic view
                </button>
              </section>
            ) : (
              <section className="topics-v2-grid" aria-label="Signal topic directory">
                {filteredTopics.map((topic) => {
                  const isFollowing = followedSet.has(topic.name);
                  const discussionHref = `/discussions?topic=${encodeURIComponent(
                    topic.name
                  )}`;

                  return (
                    <article key={topic.name} className={topic.active ? "is-active" : "is-quiet"}>
                      <div className="topics-v2-card-topline">
                        <span className="topics-v2-topic-mark">
                          <Sparkles aria-hidden="true" />
                        </span>
                        <div>
                          <span className={topic.active ? "is-live" : "is-muted"}>
                            {topic.active ? "Active Signal" : "Quiet topic"}
                          </span>
                          {topic.newThisWeek > 0 && (
                            <span className="is-new">{topic.newThisWeek} new this week</span>
                          )}
                        </div>

                        <button
                          type="button"
                          className={isFollowing ? "topics-v2-follow is-following" : "topics-v2-follow"}
                          onClick={() => void toggleFollow(topic)}
                          disabled={savingTopic === topic.name || !topic.followable}
                          title={
                            topic.followable
                              ? "Following a topic turns on new-discussion alerts"
                              : "This legacy topic is not part of the current followable topic list"
                          }
                        >
                          {isFollowing ? <BellOff aria-hidden="true" /> : <Bell aria-hidden="true" />}
                          {savingTopic === topic.name
                            ? "Saving…"
                            : isFollowing
                              ? "Following"
                              : viewerId && !canFollowTopics
                                ? "Premium follow"
                                : "Follow topic"}
                        </button>
                      </div>

                      <div className="topics-v2-card-heading">
                        <h2>{topic.name}</h2>
                        <p>{topic.description}</p>
                      </div>

                      <div className="topics-v2-card-metrics">
                        <span><Activity aria-hidden="true" />{topic.discussionCount} discussions</span>
                        <span><MessageCircle aria-hidden="true" />{topic.replyCount} replies</span>
                        <span><Eye aria-hidden="true" />{topic.viewCount} views</span>
                        <span><Bookmark aria-hidden="true" />{topic.saveCount} saves</span>
                      </div>

                      <div className="topics-v2-signal-score">
                        <div>
                          <Flame aria-hidden="true" />
                          <span>Topic Signal</span>
                        </div>
                        <strong>{topic.signalScore.toLocaleString()}</strong>
                      </div>

                      {topic.latestDiscussion ? (
                        <div className="topics-v2-latest">
                          <p>Latest discussion</p>
                          <Link href={`/discussions/${topic.latestDiscussion.id}`}>
                            {normalizePublicText(topic.latestDiscussion.title)}
                          </Link>
                          <span>
                            {getProfileName(topic.latestAuthor)} · {formatRelativeTime(topic.latestAt)}
                          </span>
                        </div>
                      ) : (
                        <div className="topics-v2-latest is-empty">
                          <p>No discussion activity yet</p>
                          <span>This topic is ready for its first focused discussion.</span>
                        </div>
                      )}

                      <div className="topics-v2-card-actions">
                        <Link href={discussionHref}>
                          Open topic Signal <ChevronRight aria-hidden="true" />
                        </Link>
                        {!topic.latestDiscussion && (
                          <Link href={`/create?topic=${encodeURIComponent(topic.name)}`}>
                            Start discussion
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </section>

          <aside className="topics-v2-sidebar">
            <section>
              <p className="topics-v2-eyebrow">Following standard</p>
              <h2>Follow means informed, not distracted.</h2>
              <p>
                Loombus uses the existing Premium topic-alert system for Following.
                Following a topic turns on an in-app alert when a new discussion enters
                that topic lane.
              </p>
              {!viewerId ? (
                <Link href="/login?next=/topics">Sign in to follow topics</Link>
              ) : !canFollowTopics ? (
                <Link href="/premium">Unlock topic following</Link>
              ) : (
                <span className="topics-v2-sidebar-count">
                  <Bell aria-hidden="true" /> {followedTopics.length} followed topics
                </span>
              )}
            </section>

            <section>
              <p className="topics-v2-eyebrow">Trending Signal</p>
              <div className="topics-v2-ranking">
                {trendingTopics.map((topic, index) => (
                  <Link
                    key={topic.name}
                    href={`/discussions?topic=${encodeURIComponent(topic.name)}`}
                  >
                    <span>{index + 1}</span>
                    <div>
                      <strong>{topic.name}</strong>
                      <small>{topic.signalScore.toLocaleString()} Signal</small>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                ))}
                {trendingTopics.length === 0 && <p>No trending activity yet.</p>}
              </div>
            </section>

            <section>
              <p className="topics-v2-eyebrow">Latest topic activity</p>
              {latestTopic ? (
                <>
                  <h2>{latestTopic.name}</h2>
                  <p>{latestTopic.latestDiscussion?.title}</p>
                  <span className="topics-v2-sidebar-count">
                    <Clock3 aria-hidden="true" /> {formatRelativeTime(latestTopic.latestAt)}
                  </span>
                </>
              ) : (
                <p>No live topic activity yet.</p>
              )}
            </section>

            <section>
              <p className="topics-v2-eyebrow">Directory standard</p>
              <h2>Active and quiet topics both belong.</h2>
              <p>
                Active topics surface current momentum. Quiet topics remain visible so a
                subject does not disappear merely because it has not received recent Signal.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
