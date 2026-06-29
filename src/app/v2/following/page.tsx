"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  ChevronRight,
  FlaskConical,
  Home,
  Layers,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  UserPlus,
  Users,
  VolumeX,
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
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type FollowingKind = "People" | "Rooms" | "Topics" | "Labs" | "Discussions";
type FollowingAccent = "blue" | "green" | "violet" | "slate";

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

const FILTERS = ["All", "People", "Rooms", "Topics", "Labs", "Discussions"];

const MUTED_SOURCES: SidebarItem[] = [
  { title: "Web3 Governance", meta: "Topic", href: "/v2/following", icon: Tag, accent: "green" },
  { title: "Random Debates", meta: "Room", href: "/v2/following", icon: Users, accent: "blue" },
  { title: "Off-topic Threads", meta: "Discussion", href: "/v2/following", icon: MessageCircle, accent: "slate" },
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
  if (kind === "Rooms") return Users;
  if (kind === "Topics") return Tag;
  if (kind === "Labs") return FlaskConical;
  return MessageCircle;
}

function getAccentClasses(accent: FollowingAccent) {
  if (accent === "green") return "bg-emerald-50 text-emerald-700";
  if (accent === "violet") return "bg-violet-50 text-violet-700";
  if (accent === "slate") return "bg-slate-100 text-slate-700";
  return "bg-blue-50 text-blue-700";
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
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span></Link>
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
  if (update.avatarUrl && update.kind === "People") return <img src={update.avatarUrl} alt="" className="size-16 rounded-full object-cover" />;
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
            <span>{formatRelativeTime(update.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Link href={update.href} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">{update.actionLabel}</Link>
          <button type="button" aria-label="More following actions" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><MoreHorizontal className="size-5" /></button>
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
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${getAccentClasses(item.accent)}`}><Icon className="size-4" /></span>
        <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span></span>
      </span>
      {item.actionLabel && <span className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">{item.actionLabel}</span>}
    </Link>
  );
}

export default function V2FollowingPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [updates, setUpdates] = useState<FollowingUpdate[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredUpdates = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return updates.filter((update) => {
      const matchesQuery = !cleanQuery || `${update.actor} ${update.title} ${update.description} ${update.tag ?? ""}`.toLowerCase().includes(cleanQuery);
      const matchesFilter = activeFilter === "All" || update.kind === activeFilter;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query, updates]);

  const manageCounts: SidebarCount[] = [
    { label: "People", value: Math.max(128, profiles.length), icon: Users, href: "/v2/people" },
    { label: "Rooms", value: 16, icon: Users, href: "/v2/rooms" },
    { label: "Topics", value: 24, icon: Layers, href: "/v2/discussions" },
    { label: "Labs", value: 8, icon: FlaskConical, href: "/v2/labs" },
    { label: "Discussions", value: Math.max(56, updates.length), icon: MessageCircle, href: "/v2/discussions" },
  ];

  const recommendedItems: SidebarItem[] = [
    { title: "Open Systems Lab", meta: "Research Lab", href: "/v2/labs", icon: FlaskConical, accent: "slate", actionLabel: "Follow" },
    { title: "Ethics of AI", meta: "Topic", href: "/v2/discussions", icon: Tag, accent: "green", actionLabel: "Follow" },
    { title: profiles[0]?.full_name?.trim() || profiles[0]?.username?.trim() || "Alex Rivera", meta: "Policy researcher", href: "/v2/people", icon: UserPlus, accent: "blue", actionLabel: "Follow" },
  ];

  async function loadFollowing(userId: string) {
    setFollowingLoading(true);
    setMessage("");
    try {
      const [{ data: discussionRows, error: discussionError }, { data: profileRows }] = await Promise.all([
        supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type").is("deleted_at", null).order("created_at", { ascending: false }).limit(8),
        supabase.from("profiles").select("id, full_name, username, avatar_url").neq("id", userId).limit(6),
      ]);

      if (discussionError) {
        setMessage("Unable to load V2 Following safely. Current People and Discussions remain available.");
        setUpdates([]);
        return;
      }

      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const nextProfiles = (profileRows ?? []) as ProfileRow[];
      setProfiles(nextProfiles);
      const profilesById = new Map(nextProfiles.map((profile) => [profile.id, profile]));

      const discussionUpdates: FollowingUpdate[] = discussions.slice(0, 4).map((discussion, index) => {
        const profile = profilesById.get(discussion.user_id) ?? nextProfiles[index % Math.max(1, nextProfiles.length)];
        const actor = profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
        return {
          id: `discussion-${discussion.id}`,
          kind: index % 2 === 0 ? "People" : "Discussions",
          actor: `${actor} ${index % 2 === 0 ? "started a discussion" : "replied to a discussion you follow"}`,
          title: discussion.title,
          description: truncate(stripHtml(discussion.body) || "A followed discussion has new signal worth reviewing."),
          tag: discussion.topic,
          href: `/v2/discussions/${discussion.id}`,
          createdAt: discussion.created_at,
          actionLabel: "Open",
          avatarUrl: profile?.avatar_url ?? null,
          accent: getAccent(index),
        } satisfies FollowingUpdate;
      });

      const supplementalUpdates: FollowingUpdate[] = [
        {
          id: "lab-weekly-update",
          kind: "Labs",
          actor: "Civic Futures Lab published a weekly update",
          title: "Weekly Update · May 20, 2025",
          description: "Highlights from our latest research and experiments.",
          tag: null,
          href: "/v2/labs",
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          actionLabel: "Open",
          accent: "blue",
        },
        {
          id: "topic-climate-tech",
          kind: "Topics",
          actor: "Climate Tech topic has 6 new discussions",
          title: "Top discussions this week",
          description: "From renewable infrastructure to carbon markets.",
          tag: "Environment",
          href: "/v2/discussions",
          createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          actionLabel: "Open",
          accent: "green",
        },
        {
          id: "room-builders-events",
          kind: "Rooms",
          actor: "Builders’ Room has 2 new events",
          title: "Workshop · May 23, 2025",
          description: "Hands-on session: Building on open standards.",
          tag: null,
          href: "/v2/rooms",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          actionLabel: "Open",
          accent: "blue",
        },
      ];

      setUpdates([...discussionUpdates.slice(0, 1), supplementalUpdates[0], ...discussionUpdates.slice(1, 3), supplementalUpdates[1], supplementalUpdates[2], ...discussionUpdates.slice(3)]);
    } catch {
      setMessage("Unable to load V2 Following safely. Current People and Discussions remain available.");
      setUpdates([]);
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
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Following</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Updates from the people, rooms, topics, and labs you follow.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search followed people, rooms, topics, and labs" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter}</button>)}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {followingLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading followed updates...</div>}

            <div className="space-y-4">
              {!followingLoading && filteredUpdates.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No followed updates match this V2 shell filter.</div>}
              {!followingLoading && filteredUpdates.map((update) => <FollowingUpdateCard key={update.id} update={update} />)}
            </div>

            {!followingLoading && filteredUpdates.length > 0 && <Link href="/v2/following" className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">View all activity<ChevronRight className="size-4" /></Link>}
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Manage following</h2>
              <div className="mt-4 space-y-3">
                {manageCounts.map((item) => {
                  const Icon = item.icon;
                  return <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><Icon className="size-4 text-blue-700" />{item.label}</span><span className="font-black text-blue-700">{item.value}</span></Link>;
                })}
              </div>
              <Link href="/v2/people" className="mt-4 flex items-center justify-between rounded-xl text-sm font-black text-blue-700">View all <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Recommended to follow</h2><Link href="/v2/people" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">{recommendedItems.map((item) => <SidebarItemRow key={item.title} item={item} />)}</div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Muted sources</h2><Link href="/v2/following" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">
                {MUTED_SOURCES.map((item) => (
                  <div key={item.title} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2">
                    <SidebarItemRow item={item} />
                    <VolumeX className="size-4 shrink-0 text-slate-500" />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Notification preferences</h2>
              <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-800">
                <BellRing className="mr-2 inline size-5" />Choose how you want to stay updated.
              </div>
              <Link href="/settings" className="mt-4 flex items-center justify-between text-sm font-black text-blue-700">Manage preferences <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Stay in context</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mr-2 inline size-4 text-blue-700" />Personalized updates stay read-only in this V2 shell pass.</p>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
