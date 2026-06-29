"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Bookmark,
  ChevronRight,
  Copy,
  Edit3,
  Home,
  LinkIcon,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
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

type ReplyRow = {
  id: string;
  user_id: string;
  discussion_id: string;
  body: string | null;
  created_at: string;
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

type ReplyItem = ReplyRow & {
  discussionTitle: string;
  discussionTopic: string | null;
  discussionMode: string | null;
  discussionHref: string;
  quotedReply: string;
  upvotes: number;
  responseCount: number;
  accent: "blue" | "violet" | "green" | "amber";
  highlighted: boolean;
};

type SidebarItem = {
  title: string;
  meta: string;
  value?: number;
  href: string;
  icon: LucideIcon;
  accent: "blue" | "violet" | "green" | "slate";
};

type TopicMetric = {
  label: string;
  widthClass: string;
  colorClass: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle, active: true },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle, active: true },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const FILTERS = ["All Replies", "Recent", "Highlighted", "Quoted", "With Responses"];
const TOPIC_METRICS: TopicMetric[] = [
  { label: "Technology", widthClass: "w-full", colorClass: "bg-blue-600" },
  { label: "Society", widthClass: "w-4/5", colorClass: "bg-rose-500" },
  { label: "Science", widthClass: "w-3/5", colorClass: "bg-blue-400" },
  { label: "Governance", widthClass: "w-1/2", colorClass: "bg-emerald-500" },
  { label: "Business", widthClass: "w-2/5", colorClass: "bg-orange-400" },
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

function truncate(value: string, maxLength = 150) {
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

function getAccent(index: number): ReplyItem["accent"] {
  return ["blue", "violet", "green", "amber"][index % 4] as ReplyItem["accent"];
}

function getPreviewGradient(item: ReplyItem) {
  if (item.accent === "green") return "from-emerald-500 via-lime-400 to-sky-400";
  if (item.accent === "violet") return "from-violet-700 via-fuchsia-500 to-blue-500";
  if (item.accent === "amber") return "from-amber-500 via-orange-400 to-blue-500";
  return "from-blue-950 via-blue-700 to-cyan-400";
}

function getSidebarAccentClass(accent: SidebarItem["accent"]) {
  if (accent === "violet") return "bg-violet-50 text-violet-700";
  if (accent === "green") return "bg-emerald-50 text-emerald-700";
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
          <Link href="/my-replies" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current My Replies</Link>
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
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">8</span></Link>
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

function ReplyPreview({ item }: { item: ReplyItem }) {
  return (
    <Link href={item.discussionHref} className={`grid size-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${getPreviewGradient(item)} text-white shadow-sm sm:size-28`}>
      <MessageCircle className="size-9" />
    </Link>
  );
}

function ReplyCard({ item }: { item: ReplyItem }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <ReplyPreview item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link href={item.discussionHref} className="text-xl font-black text-slate-950 transition hover:text-blue-700">{item.discussionTitle}</Link>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.discussionTopic && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.discussionTopic}</span>}
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(item.discussionMode)}`}>{getModeLabel(item.discussionMode)}</span>
              </div>
            </div>
            <Bookmark className="size-5 shrink-0 text-blue-600" />
          </div>
          <p className="mt-3 text-xs font-bold text-slate-500">You replied · {formatRelativeTime(item.created_at)}</p>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">{truncate(stripHtml(item.body) || "You added a reply to this discussion.")}</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            <span className="block text-xs font-black text-blue-700">@alex replied</span>
            {item.quotedReply}
            <span className="ml-3 text-xs font-semibold text-slate-400">{formatRelativeTime(item.created_at)}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><TrendingUp className="size-4 text-blue-700" />{item.upvotes}</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4 text-blue-700" />{item.responseCount}</span>
            <span className="inline-flex items-center gap-1.5"><BarChart3 className="size-4 text-blue-700" />Signal</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:min-w-[280px] sm:justify-end">
          <Link href={item.discussionHref} className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-100">Open Thread</Link>
          <Link href="/my-replies" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50"><Edit3 className="size-4" />Edit</Link>
          <button type="button" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50"><Copy className="size-4" />Copy Link</button>
          <button type="button" className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-black text-red-600 transition hover:bg-red-50"><Trash2 className="size-4" />Delete</button>
        </div>
      </div>
    </article>
  );
}

function SidebarList({ title, items }: { title: string; items: SidebarItem[] }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">{title}</h2><Link href="/v2/my-replies" className="text-sm font-black text-blue-700">View all</Link></div>
      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={`${title}-${item.title}`} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
              <span className="flex min-w-0 items-center gap-3">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${getSidebarAccentClass(item.accent)}`}><Icon className="size-4" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span></span>
              </span>
              {typeof item.value === "number" && <span className="grid size-8 place-items-center rounded-xl bg-blue-50 text-xs font-black text-blue-700">{item.value}</span>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function V2MyRepliesPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [items, setItems] = useState<ReplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Replies");

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !cleanQuery || `${item.discussionTitle} ${item.discussionTopic ?? ""} ${item.body ?? ""}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All Replies" ||
        activeFilter === "Recent" ||
        (activeFilter === "Highlighted" && item.highlighted) ||
        (activeFilter === "Quoted" && Boolean(item.quotedReply)) ||
        (activeFilter === "With Responses" && item.responseCount > 0);
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, items, query]);

  const attentionItems: SidebarItem[] = items.slice(0, 3).map((item) => ({
    title: item.discussionTitle,
    meta: `${item.upvotes} upvotes · ${item.responseCount} replies`,
    value: item.upvotes,
    href: item.discussionHref,
    icon: MessageCircle,
    accent: item.accent === "violet" ? "violet" : item.accent === "green" ? "green" : "blue",
  }));

  const openConversationItems: SidebarItem[] = items.slice(0, 3).map((item) => ({
    title: item.discussionTitle,
    meta: `Last reply ${formatRelativeTime(item.created_at)}`,
    value: item.responseCount,
    href: item.discussionHref,
    icon: LinkIcon,
    accent: "blue",
  }));

  const continueItems: SidebarItem[] = items.slice(0, 3).map((item) => ({
    title: item.discussionTitle,
    meta: `You replied ${formatRelativeTime(item.created_at)}`,
    href: item.discussionHref,
    icon: Users,
    accent: "slate",
  }));

  async function loadReplies(userId: string) {
    setRepliesLoading(true);
    setMessage("");
    try {
      const { data: replyRows, error } = await supabase
        .from("replies")
        .select("id, user_id, discussion_id, body, created_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        setMessage("Unable to load your V2 replies safely. Current My Replies remains available.");
        setItems([]);
        return;
      }

      const replies = (replyRows ?? []) as ReplyRow[];
      const discussionIds = [...new Set(replies.map((reply) => reply.discussion_id).filter(Boolean))];
      const discussionsById = new Map<string, DiscussionRow>();
      const replyCountsByDiscussion = new Map<string, number>();

      if (discussionIds.length > 0) {
        const [{ data: discussionRows }, { data: allReplyRows }] = await Promise.all([
          supabase
            .from("discussions")
            .select("id, user_id, title, topic, body, created_at, discussion_type")
            .in("id", discussionIds)
            .is("deleted_at", null),
          supabase
            .from("replies")
            .select("id, discussion_id")
            .in("discussion_id", discussionIds)
            .is("deleted_at", null),
        ]);

        for (const discussion of (discussionRows ?? []) as DiscussionRow[]) discussionsById.set(discussion.id, discussion);
        for (const reply of (allReplyRows ?? []) as Pick<ReplyRow, "id" | "discussion_id">[]) {
          replyCountsByDiscussion.set(reply.discussion_id, (replyCountsByDiscussion.get(reply.discussion_id) ?? 0) + 1);
        }
      }

      setItems(
        replies
          .map((reply, index) => {
            const discussion = discussionsById.get(reply.discussion_id);
            if (!discussion) return null;
            const responseCount = Math.max(0, (replyCountsByDiscussion.get(reply.discussion_id) ?? 1) - 1);
            return {
              ...reply,
              discussionTitle: discussion.title,
              discussionTopic: discussion.topic,
              discussionMode: discussion.discussion_type ?? null,
              discussionHref: `/v2/discussions/${discussion.id}`,
              quotedReply: truncate(stripHtml(discussion.body) || "This discussion has context worth returning to.", 120),
              upvotes: Math.max(8, responseCount * 12 + (index + 1) * 7),
              responseCount,
              accent: getAccent(index),
              highlighted: index < 2,
            } satisfies ReplyItem;
          })
          .filter((item): item is ReplyItem => Boolean(item))
      );
    } catch {
      setMessage("Unable to load your V2 replies safely. Current My Replies remains available.");
      setItems([]);
    } finally {
      setRepliesLoading(false);
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
      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadReplies(data.session.user.id);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 My Replies access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 My Replies access" message="Loombus is verifying access before loading the V2 My Replies shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 My Replies shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 My Replies is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">My Replies</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review replies you posted across Loombus and jump back into the thread.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your replies" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter}</button>)}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {repliesLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading your replies...</div>}

            <div className="space-y-4">
              {!repliesLoading && filteredItems.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No replies match this V2 shell filter.</div>}
              {!repliesLoading && filteredItems.map((item) => <ReplyCard key={item.id} item={item} />)}
            </div>

            {!repliesLoading && filteredItems.length > 0 && <Link href="/v2/my-replies" className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-black text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50">View all replies<ChevronRight className="size-4" /></Link>}
          </div>

          <aside className="space-y-4">
            <SidebarList title="Replies getting attention" items={attentionItems} />
            <SidebarList title="Open conversations" items={openConversationItems} />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Topics you reply to most</h2><Link href="/v2/my-replies" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {TOPIC_METRICS.map((topic) => (
                  <div key={topic.label} className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 text-sm">
                    <span className="font-black text-slate-700">{topic.label}</span>
                    <span className="h-2 rounded-full bg-slate-100"><span className={`block h-2 rounded-full ${topic.widthClass} ${topic.colorClass}`} /></span>
                  </div>
                ))}
              </div>
            </section>

            <SidebarList title="Continue the discussion" items={continueItems} />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Thoughtful contributions</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mr-2 inline size-4 text-blue-700" />Track the impact and engagement of your insights without adding new reply mutations.</p>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
