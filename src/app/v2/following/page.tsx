"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bookmark,
  ChevronRight,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
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

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio?: string | null;
};

type FollowRow = {
  following_id: string | null;
};

type FollowingKind = "People" | "Discussions" | "Replies";
type FollowingAccent = "blue" | "green" | "violet" | "slate";
type FollowingFilter = "All" | FollowingKind;
type FollowingSort = "recent" | "oldest" | "source" | "title";

type FollowingUpdate = {
  id: string;
  kind: FollowingKind;
  actor: string;
  title: string;
  description: string;
  tag: string | null;
  href: string;
  createdAt: string;
  actionLabel: string;
  avatarUrl?: string | null;
  accent: FollowingAccent;
  available: boolean;
};

type SidebarCount = {
  label: string;
  value: number;
  icon: LucideIcon;
  href: string;
};

type SidebarItem = {
  title: string;
  meta: string;
  href: string;
  icon: LucideIcon;
  accent: FollowingAccent;
  actionLabel?: string;
  avatarUrl?: string | null;
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
  { label: "People", href: "/v2/people", icon: Users, active: true },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const FILTERS: FollowingFilter[] = ["All", "People", "Discussions", "Replies"];

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

function truncate(value: string, maxLength = 130) {
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

function getAccent(index: number): FollowingAccent {
  return ["blue", "green", "violet", "slate"][index % 4] as FollowingAccent;
}

function getKindIcon(kind: FollowingKind) {
  if (kind === "People") return UserPlus;
  if (kind === "Replies") return MessageCircle;
  return Bookmark;
}

function getAccentClasses(accent: FollowingAccent) {
  if (accent === "green") return "bg-emerald-50 text-emerald-700";
  if (accent === "violet") return "bg-violet-50 text-violet-700";
  if (accent === "slate") return "bg-slate-100 text-slate-700";
  return "bg-blue-50 text-blue-700";
}

function getFilterCount(filter: FollowingFilter, updates: FollowingUpdate[], followedCount: number) {
  if (filter === "People") return followedCount;
  if (filter === "Discussions") return updates.filter((update) => update.kind === "Discussions").length;
  if (filter === "Replies") return updates.filter((update) => update.kind === "Replies").length;
  return updates.length;
}

function profileName(profile: ProfileRow | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
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
          <Link href="/people" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current People</Link>
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
              <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.active ? "bg-white/10 text-white underline underline-offset-[18px]" : item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
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
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.primary ? "text-blue-600" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function UpdateAvatar({ update }: { update: FollowingUpdate }) {
  const Icon = getKindIcon(update.kind);
  if (update.avatarUrl) return <img src={update.avatarUrl} alt="" className="size-16 rounded-full object-cover" />;
  return <span className={`grid size-16 place-items-center rounded-full ${getAccentClasses(update.accent)}`}><Icon className="size-7" /></span>;
}

function FollowingUpdateCard({ update }: { update: FollowingUpdate }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <UpdateAvatar update={update} />
        <div className="min-w-0 flex-1">
          <Link href={update.href} className="text-xl font-black text-slate-950 transition hover:text-blue-700">{update.actor}</Link>
          <p className="mt-1 text-base font-black text-slate-800">{update.title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{update.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
            {update.tag && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{update.tag}</span>}
            {!update.available && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Unavailable</span>}
            <span>{formatRelativeTime(update.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Link href={update.href} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">{update.actionLabel}<ChevronRight className="size-4" /></Link>
        </div>
      </div>
    </article>
  );
}

function SidebarItemRow({ item }: { item: SidebarItem }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
      <span className="flex min-w-0 items-center gap-3">
        {item.avatarUrl ? <img src={item.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" /> : <span className={`grid size-10 shrink-0 place-items-center rounded-full ${getAccentClasses(item.accent)}`}><Icon className="size-4" /></span>}
        <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span></span>
      </span>
      {item.actionLabel && <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">{item.actionLabel}</span>}
    </Link>
  );
}

export default function V2FollowingPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [updates, setUpdates] = useState<FollowingUpdate[]>([]);
  const [followedProfiles, setFollowedProfiles] = useState<ProfileRow[]>([]);
  const [suggestedProfiles, setSuggestedProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FollowingFilter>("All");
  const [sortBy, setSortBy] = useState<FollowingSort>("recent");
  const [showFilters, setShowFilters] = useState(false);

  const filteredUpdates = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const nextUpdates = updates.filter((update) => {
      const matchesQuery = !cleanQuery || `${update.actor} ${update.title} ${update.description} ${update.tag ?? ""}`.toLowerCase().includes(cleanQuery);
      const matchesFilter = activeFilter === "All" || update.kind === activeFilter;
      return matchesQuery && matchesFilter;
    });

    return [...nextUpdates].sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "source") return a.actor.localeCompare(b.actor) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [activeFilter, query, sortBy, updates]);

  const filterCounts = useMemo(() => ({
    All: getFilterCount("All", updates, followedProfiles.length),
    People: getFilterCount("People", updates, followedProfiles.length),
    Discussions: getFilterCount("Discussions", updates, followedProfiles.length),
    Replies: getFilterCount("Replies", updates, followedProfiles.length),
  }), [followedProfiles.length, updates]);

  const manageCounts: SidebarCount[] = [
    { label: "Following", value: followedProfiles.length, icon: Users, href: "/v2/people" },
    { label: "Discussions", value: updates.filter((update) => update.kind === "Discussions").length, icon: MessageCircle, href: "/v2/discussions" },
    { label: "Replies", value: updates.filter((update) => update.kind === "Replies").length, icon: MessageCircle, href: "/v2/my-replies" },
    { label: "Total updates", value: updates.length, icon: Bell, href: "/v2/following" },
  ];

  const recentPeople: SidebarItem[] = followedProfiles.slice(0, 4).map((profile, index) => ({
    title: profileName(profile),
    meta: profile.username ? `@${profile.username}` : "Followed member",
    href: "/v2/people",
    icon: UserPlus,
    accent: getAccent(index),
    actionLabel: "View",
    avatarUrl: profile.avatar_url,
  }));

  const recommendedItems: SidebarItem[] = suggestedProfiles.slice(0, 3).map((profile, index) => ({
    title: profileName(profile),
    meta: profile.bio ? truncate(stripHtml(profile.bio), 56) : profile.username ? `@${profile.username}` : "Discover member",
    href: "/v2/people",
    icon: UserPlus,
    accent: getAccent(index + 1),
    actionLabel: "Open",
    avatarUrl: profile.avatar_url,
  }));

  function resetFilters() {
    setActiveFilter("All");
    setSortBy("recent");
    setQuery("");
    setShowFilters(false);
  }

  async function loadFollowing(userId: string) {
    setFollowingLoading(true);
    setMessage("");
    try {
      const { data: followRows, error: followError } = await supabase.from("follows").select("following_id").eq("follower_id", userId).limit(100);

      if (followError) throw followError;

      const followingIds = ((followRows ?? []) as FollowRow[]).map((follow) => follow.following_id).filter((profileId): profileId is string => Boolean(profileId));

      if (followingIds.length === 0) {
        const { data: suggestedRows } = await supabase.from("profiles").select("id, full_name, username, avatar_url, bio").neq("id", userId).limit(6);
        setFollowedProfiles([]);
        setSuggestedProfiles((suggestedRows ?? []) as ProfileRow[]);
        setUpdates([]);
        return;
      }

      const [{ data: profileRows }, { data: discussionRows }, { data: replyRows }, { data: suggestedRows }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, avatar_url, bio").in("id", followingIds),
        supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type, deleted_at").in("user_id", followingIds).is("deleted_at", null).order("created_at", { ascending: false }).limit(24),
        supabase.from("replies").select("id, user_id, discussion_id, body, created_at").in("user_id", followingIds).is("deleted_at", null).order("created_at", { ascending: false }).limit(24),
        supabase.from("profiles").select("id, full_name, username, avatar_url, bio").neq("id", userId).limit(12),
      ]);

      const profiles = (profileRows ?? []) as ProfileRow[];
      const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const replies = (replyRows ?? []) as ReplyRow[];
      const replyDiscussionIds = [...new Set(replies.map((reply) => reply.discussion_id).filter(Boolean))];
      const linkedDiscussionsById = new Map<string, DiscussionRow>();

      if (replyDiscussionIds.length > 0) {
        const { data: linkedDiscussionRows } = await supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type, deleted_at").in("id", replyDiscussionIds).is("deleted_at", null);
        for (const discussion of (linkedDiscussionRows ?? []) as DiscussionRow[]) linkedDiscussionsById.set(discussion.id, discussion);
      }

      const discussionUpdates: FollowingUpdate[] = discussions.map((discussion, index) => {
        const profile = profilesById.get(discussion.user_id);
        return {
          id: `discussion-${discussion.id}`,
          kind: "Discussions",
          actor: `${profileName(profile)} started a discussion`,
          title: discussion.title,
          description: truncate(stripHtml(discussion.body) || "A followed member opened a new discussion."),
          tag: discussion.topic,
          href: `/v2/discussions/${discussion.id}`,
          createdAt: discussion.created_at,
          actionLabel: "Open",
          avatarUrl: profile?.avatar_url ?? null,
          accent: getAccent(index),
          available: true,
        } satisfies FollowingUpdate;
      });

      const replyUpdates: FollowingUpdate[] = replies.map((reply, index) => {
        const profile = profilesById.get(reply.user_id);
        const discussion = linkedDiscussionsById.get(reply.discussion_id);
        const available = Boolean(discussion && !discussion.deleted_at);
        return {
          id: `reply-${reply.id}`,
          kind: "Replies",
          actor: `${profileName(profile)} replied`,
          title: discussion?.title ?? "Discussion unavailable",
          description: truncate(stripHtml(reply.body) || "A followed member added a reply."),
          tag: discussion?.topic ?? null,
          href: available ? `/v2/discussions/${reply.discussion_id}?reply=${reply.id}` : "/v2/following",
          createdAt: reply.created_at,
          actionLabel: available ? "Open Reply" : "Review",
          avatarUrl: profile?.avatar_url ?? null,
          accent: getAccent(index + discussionUpdates.length),
          available,
        } satisfies FollowingUpdate;
      });

      setFollowedProfiles(profiles);
      setSuggestedProfiles(((suggestedRows ?? []) as ProfileRow[]).filter((profile) => profile.id !== userId && !followingIds.includes(profile.id)));
      setUpdates([...discussionUpdates, ...replyUpdates].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      setMessage("Unable to load V2 Following safely. Current People and Discussions remain available.");
      setUpdates([]);
      setFollowedProfiles([]);
      setSuggestedProfiles([]);
    } finally {
      setFollowingLoading(false);
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
      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadFollowing(data.session.user.id);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Following access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Following access" message="Loombus is verifying access before loading the V2 Following shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Following shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Following is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Following</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Updates from people you follow, including their latest discussions and replies.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search followed people and updates" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)} className={`grid size-12 place-items-center rounded-2xl border shadow-sm transition ${showFilters ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter} <span className="ml-1 opacity-75">{filterCounts[filter]}</span></button>)}
            </div>

            {showFilters && <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Filters</h2><p className="mt-1 text-xs font-semibold text-slate-400">Refine followed-member updates.</p></div><button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-700">Reset</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Type<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as FollowingFilter)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none">{FILTERS.map((filter) => <option key={filter}>{filter}</option>)}</select></label><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as FollowingSort)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option value="recent">Newest updates</option><option value="oldest">Oldest updates</option><option value="source">Source A-Z</option><option value="title">Title A-Z</option></select></label></div></section>}

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {followingLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading followed updates...</div>}

            <div className="space-y-4">
              {!followingLoading && filteredUpdates.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No followed updates match this V2 shell filter.</div>}
              {!followingLoading && filteredUpdates.map((update) => <FollowingUpdateCard key={update.id} update={update} />)}
            </div>

            {!followingLoading && filteredUpdates.length > 0 && <button type="button" onClick={resetFilters} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">Showing {filteredUpdates.length} of {updates.length} updates<ChevronRight className="size-4" /></button>}
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Following summary</h2>
              <div className="mt-4 space-y-3">
                {manageCounts.map((item) => {
                  const Icon = item.icon;
                  return <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><Icon className="size-4 text-blue-700" />{item.label}</span><span className="font-black text-blue-700">{item.value}</span></Link>;
                })}
              </div>
              <Link href="/v2/people" className="mt-4 flex items-center justify-between rounded-xl text-sm font-black text-blue-700">Manage in People <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">People you follow</h2><Link href="/v2/people" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">{recentPeople.length > 0 ? recentPeople.map((item) => <SidebarItemRow key={item.title} item={item} />) : <p className="text-sm leading-6 text-slate-500">Follow people from the People page to build this feed.</p>}</div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Discover people</h2><Link href="/v2/people" className="text-sm font-black text-blue-700">Open People</Link></div>
              <div className="mt-4 space-y-3">{recommendedItems.length > 0 ? recommendedItems.map((item) => <SidebarItemRow key={item.title} item={item} />) : <p className="text-sm leading-6 text-slate-500">No recommendations are available right now.</p>}</div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
