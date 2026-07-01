"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  Bookmark,
  ChevronRight,
  EyeOff,
  FolderOpen,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type DiscussionRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
  discussion_type?: string | null;
  deleted_at?: string | null;
};

type ReplyRow = {
  id: string;
  user_id: string;
  discussion_id: string;
  body: string | null;
  created_at: string;
};

type BookmarkRow = {
  id: string;
  discussion_id: string;
  created_at: string;
};

type ActivityKind = "reply" | "discussion" | "save";
type ActivityAccent = "blue" | "green" | "violet" | "amber" | "slate";
type ActivityFilter = "All" | "Replies" | "Discussions" | "Saves";
type ActivitySort = "recent" | "oldest" | "type" | "title";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  eyebrow: string;
  title: string;
  description: string;
  topic: string | null;
  mode?: string | null;
  createdAt: string;
  href: string;
  actionLabel: string;
  accent: ActivityAccent;
  available: boolean;
};

type SidebarMetric = {
  label: string;
  value: number;
};

type QuickLinkItem = {
  title: string;
  meta: string;
  href: string;
  icon: LucideIcon;
};

type AchievementItem = {
  title: string;
  meta: string;
  count: number;
  icon: LucideIcon;
};

type PrivacyItem = {
  label: string;
  value: string;
  icon: LucideIcon;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "People", href: "/v2/people", icon: Users, active: true },
];

const FILTERS: ActivityFilter[] = ["All", "Replies", "Discussions", "Saves"];

const PRIVACY_CONTROLS: PrivacyItem[] = [
  { label: "Profile visibility", value: "Private", icon: EyeOff },
  { label: "Activity visibility", value: "Only me", icon: ShieldCheck },
  { label: "Data & permissions", value: "Manage", icon: FolderOpen },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function stripHtml(value: string | null | undefined) {
  return (value ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength = 140) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

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

function isThisWeek(value: string) {
  return Date.now() - new Date(value).getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research Question";
  if (value === "problem_solving") return "Problem Solving";
  return "Discussion";
}

function getModeClass(value: string | null | undefined) {
  if (value === "debate") return "bg-rose-50 text-rose-700";
  if (value === "research_question") return "bg-violet-50 text-violet-700";
  if (value === "problem_solving") return "bg-orange-50 text-orange-700";
  return "bg-emerald-50 text-emerald-700";
}

function getPreviewGradient(activity: ActivityItem) {
  if (activity.accent === "green") return "from-emerald-500 via-lime-400 to-sky-400";
  if (activity.accent === "violet") return "from-violet-700 via-fuchsia-500 to-blue-500";
  if (activity.accent === "amber") return "from-amber-500 via-orange-400 to-blue-500";
  if (activity.accent === "slate") return "from-slate-900 via-slate-700 to-blue-500";
  return "from-blue-950 via-blue-700 to-cyan-400";
}

function getActivityIcon(kind: ActivityKind) {
  if (kind === "save") return Bookmark;
  return MessageCircle;
}

function getFilterCount(filter: ActivityFilter, items: ActivityItem[]) {
  if (filter === "Replies") return items.filter((item) => item.kind === "reply").length;
  if (filter === "Discussions") return items.filter((item) => item.kind === "discussion").length;
  if (filter === "Saves") return items.filter((item) => item.kind === "save").length;
  return items.length;
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && <p className="mt-5 text-xs text-slate-300">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Back to V2 Home</Link>
          <Link href="/profile" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current profile</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-600" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ActivityVisual({ activity }: { activity: ActivityItem }) {
  const Icon = getActivityIcon(activity.kind);
  return (
    <span className={`grid size-24 place-items-center rounded-2xl bg-gradient-to-br ${getPreviewGradient(activity)} text-white sm:size-28`}>
      <Icon className="size-10" />
    </span>
  );
}

function ActivityRow({ activity }: { activity: ActivityItem }) {
  const Icon = getActivityIcon(activity.kind);
  return (
    <article className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 sm:grid-cols-[56px_minmax(0,1fr)]">
      <div className="relative flex justify-center">
        <span className="grid size-11 place-items-center rounded-full bg-blue-50 text-blue-700 ring-8 ring-[#f7fbff]"><Icon className="size-5" /></span>
        <span className="absolute bottom-[-1rem] top-12 w-px bg-slate-200" />
      </div>
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link href={activity.href} className="shrink-0"><ActivityVisual activity={activity} /></Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-500">{activity.eyebrow}</p>
            <Link href={activity.href} className="mt-1 block text-xl font-black text-slate-950 transition hover:text-blue-700">{activity.title}</Link>
            <div className="mt-2 flex flex-wrap gap-2">
              {activity.topic && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{activity.topic}</span>}
              {activity.mode && <span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(activity.mode)}`}>{getModeLabel(activity.mode)}</span>}
              {!activity.available && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Unavailable</span>}
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{activity.description}</p>
            <p className="mt-2 text-xs font-semibold text-slate-400">{formatRelativeTime(activity.createdAt)}</p>
          </div>
          <Link href={activity.href} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">{activity.actionLabel}<ChevronRight className="size-4" /></Link>
        </div>
      </div>
    </article>
  );
}

export default function V2MyActivityPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>("All");
  const [sortBy, setSortBy] = useState<ActivitySort>("recent");
  const [showFilters, setShowFilters] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filterCounts = useMemo(() => ({
    All: getFilterCount("All", activity),
    Replies: getFilterCount("Replies", activity),
    Discussions: getFilterCount("Discussions", activity),
    Saves: getFilterCount("Saves", activity),
  }), [activity]);

  const filteredActivity = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const nextActivity = activity.filter((item) => {
      const matchesQuery = !cleanQuery || `${item.eyebrow} ${item.title} ${item.description} ${item.topic ?? ""}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Replies" && item.kind === "reply") ||
        (activeFilter === "Discussions" && item.kind === "discussion") ||
        (activeFilter === "Saves" && item.kind === "save");
      return matchesQuery && matchesFilter;
    });

    return [...nextActivity].sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "type") return a.kind.localeCompare(b.kind) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeFilter, activity, query, sortBy]);

  const counts = useMemo(() => ({
    replies: activity.filter((item) => item.kind === "reply").length,
    discussions: activity.filter((item) => item.kind === "discussion").length,
    saves: activity.filter((item) => item.kind === "save").length,
    thisWeek: activity.filter((item) => isThisWeek(item.createdAt)).length,
  }), [activity]);

  const summaryMetrics: SidebarMetric[] = [
    { label: "Replies", value: counts.replies },
    { label: "Discussions", value: counts.discussions },
    { label: "Saves", value: counts.saves },
    { label: "This week", value: counts.thisWeek },
    { label: "Total", value: activity.length },
  ];

  const quickLinks: QuickLinkItem[] = activity.slice(0, 3).map((item) => ({
    title: item.title,
    meta: `${item.eyebrow} · ${formatRelativeTime(item.createdAt)}`,
    href: item.href,
    icon: getActivityIcon(item.kind),
  }));

  const achievements: AchievementItem[] = [
    { title: "Conversation Builder", meta: `${counts.discussions} discussions started`, count: counts.discussions, icon: Award },
    { title: "Thoughtful Contributor", meta: `${counts.replies} replies posted`, count: counts.replies, icon: Trophy },
    { title: "Knowledge Library", meta: `${counts.saves} discussions saved`, count: counts.saves, icon: Star },
  ];

  function focusList() {
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function resetFilters() {
    setActiveFilter("All");
    setSortBy("recent");
    setQuery("");
    setShowFilters(false);
    focusList();
  }

  async function loadActivity(userId: string) {
    setActivityLoading(true);
    setMessage("");
    try {
      const [{ data: discussionRows }, { data: replyRows }, { data: bookmarkRows }] = await Promise.all([
        supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type, deleted_at").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(25),
        supabase.from("replies").select("id, user_id, discussion_id, body, created_at").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(25),
        supabase.from("bookmarks").select("id, discussion_id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(25),
      ]);

      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const replies = (replyRows ?? []) as ReplyRow[];
      const bookmarks = (bookmarkRows ?? []) as BookmarkRow[];
      const linkedDiscussionIds = [...new Set([...replies.map((reply) => reply.discussion_id), ...bookmarks.map((bookmark) => bookmark.discussion_id)].filter(Boolean))];
      const linkedDiscussionsById = new Map<string, DiscussionRow>();

      if (linkedDiscussionIds.length > 0) {
        const { data: linkedDiscussionRows } = await supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type, deleted_at").in("id", linkedDiscussionIds).is("deleted_at", null);
        for (const discussion of (linkedDiscussionRows ?? []) as DiscussionRow[]) linkedDiscussionsById.set(discussion.id, discussion);
      }

      const discussionActivities: ActivityItem[] = discussions.map((discussion) => ({
        id: `discussion-${discussion.id}`,
        kind: "discussion",
        eyebrow: "You started a discussion",
        title: discussion.title,
        description: truncate(stripHtml(discussion.body) || "You opened a discussion for the community."),
        topic: discussion.topic,
        mode: discussion.discussion_type,
        createdAt: discussion.created_at,
        href: `/v2/discussions/${discussion.id}`,
        actionLabel: "Open Thread",
        accent: "violet",
        available: true,
      }));

      const replyActivities: ActivityItem[] = replies.map((reply) => {
        const discussion = linkedDiscussionsById.get(reply.discussion_id);
        const available = Boolean(discussion && !discussion.deleted_at);
        return {
          id: `reply-${reply.id}`,
          kind: "reply",
          eyebrow: "You replied to",
          title: discussion?.title ?? "Discussion unavailable",
          description: truncate(stripHtml(reply.body) || "You added a reply to this discussion."),
          topic: discussion?.topic ?? null,
          mode: discussion?.discussion_type ?? null,
          createdAt: reply.created_at,
          href: available ? `/v2/discussions/${reply.discussion_id}?reply=${reply.id}` : "/v2/my-replies",
          actionLabel: available ? "Open Reply" : "Review Replies",
          accent: "blue",
          available,
        } satisfies ActivityItem;
      });

      const saveActivities: ActivityItem[] = bookmarks.map((bookmark) => {
        const discussion = linkedDiscussionsById.get(bookmark.discussion_id);
        const available = Boolean(discussion && !discussion.deleted_at);
        return {
          id: `save-${bookmark.id}`,
          kind: "save",
          eyebrow: "You saved",
          title: discussion?.title ?? "Saved discussion unavailable",
          description: truncate(stripHtml(discussion?.body) || "Saved to your personal library for later review."),
          topic: discussion?.topic ?? null,
          mode: discussion?.discussion_type ?? null,
          createdAt: bookmark.created_at,
          href: available ? `/v2/discussions/${bookmark.discussion_id}` : "/v2/saved",
          actionLabel: available ? "Open Saved" : "Open Saved",
          accent: "green",
          available,
        } satisfies ActivityItem;
      });

      setActivity([...replyActivities, ...saveActivities, ...discussionActivities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      setMessage("Unable to load V2 My Activity safely. Current account activity remains available through existing pages.");
      setActivity([]);
    } finally {
      setActivityLoading(false);
    }
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadActivity(data.session.user.id);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 My Activity access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 My Activity access" message="Loombus is verifying access before loading the V2 My Activity shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 My Activity shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 My Activity is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">My Activity</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review your recent discussions, replies, and saved items in one private activity timeline.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your activity" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)} className={`grid size-12 place-items-center rounded-2xl border shadow-sm transition ${showFilters ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter} <span className="ml-1 opacity-75">{filterCounts[filter]}</span></button>)}
            </div>

            {showFilters && <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Filters</h2><p className="mt-1 text-xs font-semibold text-slate-400">Refine your private activity timeline.</p></div><button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-700">Reset</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Type<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActivityFilter)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none">{FILTERS.map((filter) => <option key={filter}>{filter}</option>)}</select></label><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as ActivitySort)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option value="recent">Newest activity</option><option value="oldest">Oldest activity</option><option value="type">Activity type</option><option value="title">Title A-Z</option></select></label></div></section>}

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {activityLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading activity...</div>}

            <div ref={listRef} className="space-y-3">
              {!activityLoading && filteredActivity.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No activity matches this V2 shell filter.</div>}
              {!activityLoading && filteredActivity.map((item) => <ActivityRow key={item.id} activity={item} />)}
            </div>

            {!activityLoading && filteredActivity.length > 0 && <button type="button" onClick={resetFilters} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">Showing {filteredActivity.length} of {activity.length} activity items <ChevronRight className="size-4" /></button>}
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Activity summary</h2><button type="button" onClick={resetFilters} className="text-sm font-black text-blue-700">View all</button></div>
              <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-100 text-center text-xs font-semibold text-slate-500 sm:grid-cols-3">
                {summaryMetrics.map((metric) => <div key={metric.label} className="border-b border-r border-slate-100 p-3"><p className="text-xl font-black text-slate-950">{metric.value}</p><p>{metric.label}</p></div>)}
              </div>
              <p className="mt-4 text-sm text-slate-500">This page is read-only and private to your account.</p>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Recent activity</h2><button type="button" onClick={() => { setSortBy("recent"); setActiveFilter("All"); focusList(); }} className="text-sm font-black text-blue-700">View all</button></div>
              <div className="mt-4 space-y-4">
                {quickLinks.map((item) => {
                  const Icon = item.icon;
                  return <Link key={`${item.href}-${item.title}`} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span></span></span><ChevronRight className="size-4 shrink-0 text-slate-400" /></Link>;
                })}
                {quickLinks.length === 0 && <p className="text-sm text-slate-500">Recent activity will appear here after you participate.</p>}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Contribution signals</h2><Link href="/v2/profile" className="text-sm font-black text-blue-700">Profile</Link></div>
              <div className="mt-4 space-y-4">
                {achievements.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.title} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2"><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span><span className="block text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">{item.meta}</span></span></span><span className="grid size-7 place-items-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{item.count}</span></div>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Privacy controls</h2><Link href="/settings" className="text-sm font-black text-blue-700">Manage</Link></div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                {PRIVACY_CONTROLS.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2"><span className="inline-flex items-center gap-3 font-black text-slate-800"><Icon className="size-4 text-blue-700" />{item.label}</span><span className="font-semibold text-slate-500">{item.value}</span></div>;
                })}
              </div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
