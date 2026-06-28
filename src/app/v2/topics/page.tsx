"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ChevronDown,
  ChevronRight,
  Filter,
  Landmark,
  Leaf,
  LineChart,
  Network,
  Search,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type Discussion = {
  id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  user_id: string;
  discussion_type?: string | null;
  purpose_lane?: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type TopicStats = {
  name: string;
  description: string;
  discussionCount: number;
  newToday: number;
  signalScore: number;
  latestDiscussion: Discussion | null;
  latestAuthor: Profile | null;
  icon: LucideIcon;
  tone: string;
};

type FollowedTopic = {
  name: string;
  created_at?: string | null;
};

type ContributorStats = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  discussionCount: number;
  signalScore: number;
};

const STATIC_FILTERS = ["All Topics", "Following", "Trending", "Technology", "Society", "Governance", "Science", "Local", "Climate"];

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatCount(value: number, singular: string, plural: string) {
  const count = Math.max(0, value);
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function getTopicTone(topic: string) {
  const value = topic.toLowerCase();
  if (value.includes("climate") || value.includes("energy")) return "bg-emerald-600 text-white";
  if (value.includes("govern") || value.includes("civic")) return "bg-indigo-700 text-white";
  if (value.includes("identity") || value.includes("privacy") || value.includes("security")) return "bg-cyan-700 text-white";
  if (value.includes("ai") || value.includes("technology") || value.includes("tech")) return "bg-violet-700 text-white";
  if (value.includes("local") || value.includes("community")) return "bg-green-700 text-white";
  return "bg-blue-700 text-white";
}

function getTopicIcon(topic: string) {
  const value = topic.toLowerCase();
  if (value.includes("climate") || value.includes("energy")) return Leaf;
  if (value.includes("govern") || value.includes("policy") || value.includes("civic")) return Landmark;
  if (value.includes("identity") || value.includes("privacy") || value.includes("security")) return Shield;
  if (value.includes("community") || value.includes("people") || value.includes("society")) return Users;
  if (value.includes("network") || value.includes("web") || value.includes("digital")) return Network;
  return Sparkles;
}

function getTopicDescription(topic: string, latestDiscussion: Discussion | null) {
  const body = (latestDiscussion?.body ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (body) return body.length > 110 ? `${body.slice(0, 110)}...` : body;
  return `Live conversations currently filed under ${topic}.`;
}

function getAuthorLabel(profile: Profile | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function getInitials(label: string) {
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "L";
}

function buildTopicStats(discussions: Discussion[], profiles: Record<string, Profile>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const topicMap = new Map<string, TopicStats>();

  for (const discussion of discussions) {
    const topic = discussion.topic?.trim() || "Discussion";
    const existing = topicMap.get(topic);
    const createdAt = new Date(discussion.created_at).getTime();
    const isNewToday = Number.isFinite(createdAt) && createdAt >= today.getTime();
    const signalScore = 1 + (discussion.body?.trim() ? 1 : 0) + (discussion.purpose_lane ? 1 : 0);

    if (!existing) {
      topicMap.set(topic, {
        name: topic,
        description: getTopicDescription(topic, discussion),
        discussionCount: 1,
        newToday: isNewToday ? 1 : 0,
        signalScore,
        latestDiscussion: discussion,
        latestAuthor: profiles[discussion.user_id] ?? null,
        icon: getTopicIcon(topic),
        tone: getTopicTone(topic),
      });
      continue;
    }

    const existingTime = new Date(existing.latestDiscussion?.created_at ?? 0).getTime();
    const shouldReplaceLatest = Number.isFinite(createdAt) && (!Number.isFinite(existingTime) || createdAt > existingTime);

    topicMap.set(topic, {
      ...existing,
      discussionCount: existing.discussionCount + 1,
      newToday: existing.newToday + (isNewToday ? 1 : 0),
      signalScore: existing.signalScore + signalScore,
      latestDiscussion: shouldReplaceLatest ? discussion : existing.latestDiscussion,
      latestAuthor: shouldReplaceLatest ? profiles[discussion.user_id] ?? null : existing.latestAuthor,
      description: shouldReplaceLatest ? getTopicDescription(topic, discussion) : existing.description,
    });
  }

  return [...topicMap.values()].sort((a, b) => b.signalScore - a.signalScore || b.discussionCount - a.discussionCount);
}

function buildContributorStats(discussions: Discussion[], profiles: Record<string, Profile>) {
  const contributorMap = new Map<string, ContributorStats>();

  for (const discussion of discussions) {
    const profile = profiles[discussion.user_id] ?? null;
    const name = getAuthorLabel(profile);
    const existing = contributorMap.get(discussion.user_id) ?? {
      id: discussion.user_id,
      name,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      discussionCount: 0,
      signalScore: 0,
    };

    contributorMap.set(discussion.user_id, {
      ...existing,
      discussionCount: existing.discussionCount + 1,
      signalScore: existing.signalScore + 1 + (discussion.body?.trim() ? 1 : 0),
    });
  }

  return [...contributorMap.values()].sort((a, b) => b.signalScore - a.signalScore).slice(0, 5);
}

async function fetchFollowedTopics(userId: string): Promise<FollowedTopic[]> {
  const attempts = [
    { table: "topic_follows", ownerColumn: "user_id", topicColumn: "topic" },
    { table: "user_topic_follows", ownerColumn: "user_id", topicColumn: "topic" },
    { table: "followed_topics", ownerColumn: "user_id", topicColumn: "topic" },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select("*")
      .eq(attempt.ownerColumn, userId)
      .limit(25);

    if (!error) {
      return ((data ?? []) as Record<string, unknown>[])
        .map((row) => ({
          name: typeof row[attempt.topicColumn] === "string" ? (row[attempt.topicColumn] as string) : typeof row.name === "string" ? row.name : "",
          created_at: typeof row.created_at === "string" ? row.created_at : null,
        }))
        .filter((topic) => topic.name.trim().length > 0);
    }
  }

  return [];
}

function TopicCardView({ topic, followed, onSelectTopic }: { topic: TopicStats; followed: boolean; onSelectTopic: (topic: string) => void }) {
  const Icon = topic.icon;
  const author = getAuthorLabel(topic.latestAuthor);

  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5">
      <div className="flex gap-4">
        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${topic.tone} sm:size-16`}>
          <Icon className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-950 sm:text-lg">{topic.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{topic.description}</p>
            </div>
            <button type="button" onClick={() => onSelectTopic(topic.name)} className="hidden shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:inline-flex">View Topic</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-slate-500">
            <span>{formatCount(topic.discussionCount, "discussion", "discussions")}</span>
            <span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-blue-600" />{formatCount(topic.newToday, "new today", "new today")}</span>
            {followed && <span className="text-blue-700">Following</span>}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-900">{getInitials(author)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-950">{author} <span className="text-blue-600">●</span></p>
              <p className="truncate text-xs font-semibold text-slate-500">{topic.latestDiscussion?.title ?? "No discussion title available"}</p>
              <p className="text-xs font-semibold text-slate-500">{formatRelativeTime(topic.latestDiscussion?.created_at)}</p>
            </div>
            <button type="button" onClick={() => onSelectTopic(topic.name)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:hidden">View</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FollowedTopicsCard({ topics, stats, onSelectTopic }: { topics: FollowedTopic[]; stats: TopicStats[]; onSelectTopic: (topic: string) => void }) {
  const topicStats = new Map(stats.map((topic) => [topic.name, topic]));

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Followed Topics</h2>
        <Link href="/v2/following" className="text-xs font-black text-blue-700">View all</Link>
      </div>
      <div className="space-y-4">
        {topics.map((topic) => {
          const liveTopic = topicStats.get(topic.name);
          const Icon = liveTopic?.icon ?? getTopicIcon(topic.name);
          return (
            <button key={topic.name} type="button" onClick={() => onSelectTopic(topic.name)} className="flex w-full items-center gap-3 text-left">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${liveTopic?.tone ?? getTopicTone(topic.name)}`}><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-950">{topic.name}</span>
                <span className="block text-xs font-semibold text-slate-500">{liveTopic ? formatCount(liveTopic.discussionCount, "discussion", "discussions") : "No live discussions yet"}</span>
              </span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </button>
          );
        })}
        {topics.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No followed topics found for this account yet.</p>}
      </div>
    </section>
  );
}

function TrendingTopicsCard({ topics, onSelectTopic }: { topics: TopicStats[]; onSelectTopic: (topic: string) => void }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Trending Topics</h2>
        <LineChart className="size-4 text-blue-700" />
      </div>
      <div className="space-y-3">
        {topics.slice(0, 5).map((topic, index) => (
          <button key={topic.name} type="button" onClick={() => onSelectTopic(topic.name)} className="flex w-full items-center gap-3 text-left text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-black text-slate-950">{topic.name}</span>
            <span className="text-xs font-semibold text-slate-500">{topic.signalScore} signals</span>
          </button>
        ))}
        {topics.length === 0 && <p className="text-sm font-semibold text-slate-500">No live topic activity yet.</p>}
      </div>
      <Link href="/v2/topics" className="mt-5 flex w-full items-center justify-between text-sm font-black text-blue-700">View all topics <ChevronRight className="size-4" /></Link>
    </section>
  );
}

function ContributorsCard({ contributors }: { contributors: ContributorStats[] }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Top Contributors</h2>
        <Link href="/v2/people" className="text-xs font-black text-blue-700">View all</Link>
      </div>
      <div className="space-y-4">
        {contributors.map((contributor) => (
          <article key={contributor.id} className="flex items-center gap-3">
            {contributor.avatarUrl ? <img src={contributor.avatarUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" /> : <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-900">{getInitials(contributor.name)}</span>}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-slate-950">{contributor.name}</h3>
              <p className="truncate text-xs font-semibold text-slate-500">{contributor.username ? `@${contributor.username}` : formatCount(contributor.discussionCount, "discussion", "discussions")}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-500">{contributor.signalScore} signals</p>
              <Link href="/v2/people" className="mt-1 rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">View</Link>
            </div>
          </article>
        ))}
        {contributors.length === 0 && <p className="text-sm font-semibold text-slate-500">No live contributor activity yet.</p>}
      </div>
    </section>
  );
}

function SuggestedTopicsCard({ topics, followedTopics, onSelectTopic }: { topics: TopicStats[]; followedTopics: FollowedTopic[]; onSelectTopic: (topic: string) => void }) {
  const followedSet = new Set(followedTopics.map((topic) => topic.name));
  const suggestions = topics.filter((topic) => !followedSet.has(topic.name)).slice(0, 3);

  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Suggested Topics</h2>
        <Link href="/v2/topics" className="text-xs font-black text-blue-700">View all</Link>
      </div>
      <div className="space-y-4">
        {suggestions.map((topic) => {
          const Icon = topic.icon;
          return (
            <button key={topic.name} type="button" onClick={() => onSelectTopic(topic.name)} className="flex w-full items-center gap-3 text-left">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${topic.tone}`}><Icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-950">{topic.name}</span>
                <span className="block text-xs font-semibold text-slate-500">{formatCount(topic.discussionCount, "discussion", "discussions")}</span>
              </span>
              <span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">View</span>
            </button>
          );
        })}
        {suggestions.length === 0 && <p className="text-sm font-semibold text-slate-500">No live suggestions available yet.</p>}
      </div>
    </section>
  );
}

export default function V2TopicsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [topicStats, setTopicStats] = useState<TopicStats[]>([]);
  const [followedTopics, setFollowedTopics] = useState<FollowedTopic[]>([]);
  const [contributors, setContributors] = useState<ContributorStats[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Topics");
  const [message, setMessage] = useState("");

  const followedTopicNames = useMemo(() => new Set(followedTopics.map((topic) => topic.name)), [followedTopics]);

  const filters = useMemo(() => {
    const liveNames = topicStats.slice(0, 8).map((topic) => topic.name);
    return [...new Set([...STATIC_FILTERS, ...liveNames])];
  }, [topicStats]);

  const filteredTopics = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return topicStats.filter((topic) => {
      const matchesQuery = !cleanQuery || [topic.name, topic.description, topic.latestDiscussion?.title, getAuthorLabel(topic.latestAuthor)].join(" ").toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All Topics" ||
        (activeFilter === "Following" && followedTopicNames.has(topic.name)) ||
        (activeFilter === "Trending" && topic.signalScore > 0) ||
        topic.name.toLowerCase().includes(activeFilter.toLowerCase());
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, followedTopicNames, query, topicStats]);

  function handleSelectTopic(topic: string) {
    setQuery(topic);
    setActiveFilter("All Topics");
  }

  async function loadTopics() {
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData.session?.user.id ?? null;

      const { data: discussionRows, error } = await supabase
        .from("discussions")
        .select("id, title, topic, body, created_at, user_id, discussion_type, purpose_lane")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        setMessage("Unable to load live topic activity safely.");
        setTopicStats([]);
        setFollowedTopics([]);
        setContributors([]);
        return;
      }

      const discussions = (discussionRows ?? []) as Discussion[];
      const authorIds = [...new Set(discussions.map((discussion) => discussion.user_id).filter(Boolean))];
      let profiles: Record<string, Profile> = {};

      if (authorIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", authorIds);
        profiles = Object.fromEntries(((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile]));
      }

      const nextStats = buildTopicStats(discussions, profiles);
      setTopicStats(nextStats);
      setContributors(buildContributorStats(discussions, profiles));
      setFollowedTopics(currentUserId ? await fetchFollowedTopics(currentUserId) : []);
    } catch {
      setMessage("Unable to load live topics safely.");
      setTopicStats([]);
      setFollowedTopics([]);
      setContributors([]);
    }
  }

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (accessToken && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadTopics();
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <V2ShellGateCard title="Checking V2 Topics access" message="Loombus is verifying access before loading the V2 Topics shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 Topics shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Topics is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Topics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Explore conversations organized by live ideas, themes, and real discussion activity.</p>
        </header>

        {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{message}</div>}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <div className="flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search topics</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search live topics" className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
              </label>
              <button type="button" aria-label="Topic filters" className="grid size-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50">
                <Filter className="size-5" />
              </button>
            </div>

            <nav className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((filter) => (
                <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${activeFilter === filter ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>{filter}</button>
              ))}
            </nav>

            <section className="grid gap-4 lg:grid-cols-2">
              {filteredTopics.map((topic) => <TopicCardView key={topic.name} topic={topic} followed={followedTopicNames.has(topic.name)} onSelectTopic={handleSelectTopic} />)}
            </section>

            {filteredTopics.length === 0 && <div className="rounded-[1.25rem] border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500 shadow-sm">No live topics match this filter yet.</div>}

            {topicStats.length > filteredTopics.length && (
              <div className="flex justify-center">
                <button type="button" onClick={() => setActiveFilter("All Topics")} className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-6 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                  Show all live topics
                  <ChevronDown className="size-4" />
                </button>
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <FollowedTopicsCard topics={followedTopics} stats={topicStats} onSelectTopic={handleSelectTopic} />
            <TrendingTopicsCard topics={topicStats} onSelectTopic={handleSelectTopic} />
            <ContributorsCard contributors={contributors} />
            <SuggestedTopicsCard topics={topicStats} followedTopics={followedTopics} onSelectTopic={handleSelectTopic} />
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
