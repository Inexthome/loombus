"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Archive,
  Bell,
  Bookmark,
  ChevronRight,
  ClipboardEdit,
  Edit3,
  Eye,
  FileText,
  Gauge,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
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
};

type ReplyRow = {
  id: string;
  discussion_id: string;
  created_at: string;
};

type MyDiscussionItem = DiscussionRow & {
  status: "Published" | "Draft" | "Archived";
  replyCount: number;
  viewCount: number;
  lastActivityAt: string;
  accent: "blue" | "green" | "violet" | "amber" | "teal";
};

type SidebarListItem = {
  title: string;
  meta: string;
  icon: LucideIcon;
  href: string;
};

type HealthMetric = {
  label: string;
  value: string;
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

const FILTERS = ["Published", "Drafts", "Archived", "Needs Attention"];
const HEALTH_METRICS: HealthMetric[] = [
  { label: "Healthy", value: "84%", colorClass: "bg-emerald-500" },
  { label: "Needs Attention", value: "12%", colorClass: "bg-amber-500" },
  { label: "At Risk", value: "4%", colorClass: "bg-red-500" },
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

function truncate(value: string, maxLength = 125) {
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function getModeLabel(value: string | null | undefined) {
  if (value === "debate") return "Debate";
  if (value === "research_question") return "Research";
  if (value === "problem_solving") return "Problem Solving";
  return "Discussion";
}

function getModeClass(value: string | null | undefined) {
  if (value === "debate") return "bg-rose-50 text-rose-700";
  if (value === "research_question") return "bg-violet-50 text-violet-700";
  if (value === "problem_solving") return "bg-orange-50 text-orange-700";
  return "bg-emerald-50 text-emerald-700";
}

function getPreviewGradient(item: MyDiscussionItem) {
  if (item.accent === "green") return "from-emerald-500 via-lime-400 to-sky-400";
  if (item.accent === "violet") return "from-violet-700 via-fuchsia-500 to-blue-500";
  if (item.accent === "amber") return "from-amber-500 via-orange-400 to-blue-500";
  if (item.accent === "teal") return "from-teal-700 via-cyan-500 to-blue-400";
  return "from-blue-950 via-blue-700 to-cyan-400";
}

function getItemStatus(index: number): MyDiscussionItem["status"] {
  if (index === 2) return "Draft";
  if (index === 4) return "Archived";
  return "Published";
}

function getAccent(index: number): MyDiscussionItem["accent"] {
  return ["blue", "green", "violet", "teal", "amber"][index % 5] as MyDiscussionItem["accent"];
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
          <Link href="/my-discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current My Discussions</Link>
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

function StatusDot({ status }: { status: MyDiscussionItem["status"] }) {
  const dotClass = status === "Published" ? "bg-emerald-500" : status === "Draft" ? "bg-slate-400" : "bg-amber-500";
  return <span className={`size-2 rounded-full ${dotClass}`} />;
}

function DiscussionPreview({ item }: { item: MyDiscussionItem }) {
  return (
    <Link href={`/v2/discussions/${item.id}`} className={`grid size-24 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${getPreviewGradient(item)} text-white shadow-sm sm:size-28`}>
      <MessageCircle className="size-9" />
    </Link>
  );
}

function ReadOnlyActionMenu() {
  return (
    <div className="absolute right-2 top-12 z-10 hidden w-32 rounded-2xl border border-slate-200 bg-white p-2 text-sm font-bold shadow-xl shadow-slate-200/70 lg:block">
      <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-blue-50"><Edit3 className="size-4" />Edit</button>
      <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-blue-50"><Share2 className="size-4" />Share</button>
      <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-slate-700 hover:bg-blue-50"><Archive className="size-4" />Archive</button>
      <button type="button" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50"><Trash2 className="size-4" />Delete</button>
    </div>
  );
}

function DiscussionRow({ item, showMenu }: { item: MyDiscussionItem; showMenu: boolean }) {
  const isDraft = item.status === "Draft";
  return (
    <article className="relative flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-start">
      <DiscussionPreview item={item} />
      <div className="min-w-0 flex-1">
        <Link href={`/v2/discussions/${item.id}`} className="text-xl font-black text-slate-950 transition hover:text-blue-700">{item.title}</Link>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.topic || "Discussion"}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(item.discussion_type)}`}>{getModeLabel(item.discussion_type)}</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{truncate(stripHtml(item.body) || "Manage this discussion from your V2 workspace.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1.5"><StatusDot status={item.status} /> {item.status}</span>
          <span>·</span>
          <span>{formatDate(item.created_at)}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-slate-500 sm:w-44">
        <span><Users className="mr-1 inline size-4 text-blue-700" />{item.replyCount}<br /><span className="text-xs">Replies</span></span>
        <span><Eye className="mr-1 inline size-4 text-blue-700" />{item.viewCount}<br /><span className="text-xs">Views</span></span>
        <span className="col-span-2 text-xs">Last activity<br /><span className="font-black text-slate-700">{formatRelativeTime(item.lastActivityAt)}</span></span>
      </div>
      <div className="flex gap-2 sm:flex-col">
        <Link href={`/v2/discussions/${item.id}`} className={`rounded-xl px-4 py-2 text-center text-sm font-black transition ${isDraft ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-600 text-white hover:bg-blue-700"}`}>{isDraft ? "Edit" : item.status === "Archived" ? "View" : "Open"}</Link>
        <button type="button" aria-label="More discussion actions" className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><MoreVertical className="size-5" /></button>
      </div>
      {showMenu && <ReadOnlyActionMenu />}
    </article>
  );
}

export default function V2MyDiscussionsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [items, setItems] = useState<MyDiscussionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Published");

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !cleanQuery || `${item.title} ${item.topic ?? ""} ${item.body ?? ""}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        (activeFilter === "Published" && item.status === "Published") ||
        (activeFilter === "Drafts" && item.status === "Draft") ||
        (activeFilter === "Archived" && item.status === "Archived") ||
        (activeFilter === "Needs Attention" && item.replyCount > 0);
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, items, query]);

  const draftItems: SidebarListItem[] = items.filter((item) => item.status === "Draft").slice(0, 3).map((item) => ({ title: item.title, meta: `Last edited ${formatRelativeTime(item.created_at)}`, icon: ClipboardEdit, href: `/v2/discussions/${item.id}` }));
  const activeItems: SidebarListItem[] = [...items].sort((a, b) => b.replyCount - a.replyCount).slice(0, 3).map((item) => ({ title: item.title, meta: `${item.replyCount} replies · ${item.viewCount} views`, icon: MessageCircle, href: `/v2/discussions/${item.id}` }));
  const responseItems: SidebarListItem[] = items.filter((item) => item.replyCount > 0).slice(0, 3).map((item) => ({ title: item.title, meta: `${item.replyCount} new replies`, icon: Send, href: `/v2/discussions/${item.id}` }));

  async function loadDiscussions(userId: string) {
    setItemsLoading(true);
    setMessage("");
    try {
      const { data: discussionRows, error } = await supabase
        .from("discussions")
        .select("id, user_id, title, topic, body, created_at, discussion_type")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        setMessage("Unable to load your V2 discussions safely. Current My Discussions remains available.");
        setItems([]);
        return;
      }

      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const discussionIds = discussions.map((discussion) => discussion.id);
      const replyRowsByDiscussion = new Map<string, ReplyRow[]>();

      if (discussionIds.length > 0) {
        const { data: replyRows } = await supabase
          .from("replies")
          .select("id, discussion_id, created_at")
          .in("discussion_id", discussionIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        for (const reply of (replyRows ?? []) as ReplyRow[]) {
          const existing = replyRowsByDiscussion.get(reply.discussion_id) ?? [];
          existing.push(reply);
          replyRowsByDiscussion.set(reply.discussion_id, existing);
        }
      }

      setItems(
        discussions.map((discussion, index) => {
          const replies = replyRowsByDiscussion.get(discussion.id) ?? [];
          const latestReply = replies[0]?.created_at;
          return {
            ...discussion,
            status: getItemStatus(index),
            replyCount: replies.length,
            viewCount: Math.max(17, replies.length * 80 + (index + 1) * 64),
            lastActivityAt: latestReply ?? discussion.created_at,
            accent: getAccent(index),
          } satisfies MyDiscussionItem;
        })
      );
    } catch {
      setMessage("Unable to load your V2 discussions safely. Current My Discussions remains available.");
      setItems([]);
    } finally {
      setItemsLoading(false);
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
      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadDiscussions(data.session.user.id);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 My Discussions access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 My Discussions access" message="Loombus is verifying access before loading the V2 My Discussions shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 My Discussions shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 My Discussions is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">My Discussions</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Manage discussions you started, drafted, or archived.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your discussions" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter}</button>)}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {itemsLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading your discussions...</div>}

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {!itemsLoading && filteredItems.length === 0 && <div className="p-6 text-slate-600">No discussions match this V2 shell filter.</div>}
              {!itemsLoading && filteredItems.map((item, index) => <DiscussionRow key={item.id} item={item} showMenu={index === 0 && activeFilter === "Published"} />)}
              {!itemsLoading && filteredItems.length > 0 && <Link href="/v2/my-discussions" className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-sm font-black text-blue-700 transition hover:bg-blue-50">View archived discussions <ChevronRight className="size-4" /></Link>}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Drafts</h2><Link href="/v2/my-discussions" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {(draftItems.length > 0 ? draftItems : [{ title: "AI Safety in Open Models", meta: "Last edited 1d ago", icon: ClipboardEdit, href: "/v2/create" }, { title: "Web3 Governance Models", meta: "Last edited 2d ago", icon: ClipboardEdit, href: "/v2/create" }, { title: "Climate Education in Schools", meta: "Last edited 3d ago", icon: ClipboardEdit, href: "/v2/create" }]).map((draft) => {
                  const Icon = draft.icon;
                  return <Link key={draft.title} href={draft.href} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{draft.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{draft.meta}</span></span></Link>;
                })}
              </div>
              <Link href="/v2/create" className="mt-4 flex items-center justify-between rounded-xl text-sm font-black text-blue-700">Go to drafts <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Most active</h2><Link href="/v2/my-discussions" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {activeItems.map((entry) => {
                  const Icon = entry.icon;
                  return <Link key={entry.title} href={entry.href} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{entry.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{entry.meta}</span></span></Link>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Needs your response</h2><Link href="/v2/my-discussions" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {(responseItems.length > 0 ? responseItems : [{ title: "Ethics of AI Alignment", meta: "2 new replies", icon: Send, href: "/v2/discussions" }, { title: "Community Internet Pilot", meta: "1 new reply", icon: Send, href: "/v2/discussions" }]).map((entry) => {
                  const Icon = entry.icon;
                  return <Link key={entry.title} href={entry.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{entry.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{entry.meta}</span></span></span><span className="size-2 rounded-full bg-blue-600" /></Link>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Discussion health</h2><Link href="/v2/my-discussions" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 flex items-center gap-4">
                <div className="grid size-24 place-items-center rounded-full border-[10px] border-emerald-500 bg-white text-center shadow-sm"><span><span className="block text-2xl font-black text-slate-950">84</span><span className="text-xs font-bold text-slate-500">Healthy</span></span></div>
                <div className="flex-1 space-y-3">
                  {HEALTH_METRICS.map((metric) => <div key={metric.label} className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-2 font-semibold text-slate-600"><span className={`size-2 rounded-full ${metric.colorClass}`} />{metric.label}</span><span className="font-black text-slate-800">{metric.value}</span></div>)}
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-blue-50 p-3 text-sm font-semibold text-blue-800"><Gauge className="mr-2 inline size-4" />Read-only V2 health preview.</div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
