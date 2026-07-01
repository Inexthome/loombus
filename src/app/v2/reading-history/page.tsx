"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  ShieldCheck,
  SlidersHorizontal,
  User,
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
  body: string | null;
  created_at: string;
};

type BookmarkRow = {
  id: string;
  discussion_id: string;
  created_at: string;
  private_note: string | null;
};

type HistoryKind = "Saved" | "Discussion" | "Reply";
type HistoryAccent = "blue" | "green" | "violet" | "slate";
type HistoryFilter = "All" | "Saved" | "Discussions" | "Replies";
type HistorySort = "recent" | "oldest" | "title";

type HistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  subtitle: string;
  topic: string | null;
  mode?: string | null;
  href: string;
  occurredAt: string;
  actionLabel: string;
  accent: HistoryAccent;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home, active: true },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home, active: true },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const FILTERS: HistoryFilter[] = ["All", "Saved", "Discussions", "Replies"];

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
  if (diffDays < 2) return "Yesterday";
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
  return "bg-blue-50 text-blue-700";
}

function getAccent(index: number): HistoryAccent {
  return ["blue", "green", "violet", "slate"][index % 4] as HistoryAccent;
}

function getAccentClasses(accent: HistoryAccent) {
  if (accent === "green") return "bg-emerald-50 text-emerald-700";
  if (accent === "violet") return "bg-violet-50 text-violet-700";
  if (accent === "slate") return "bg-slate-100 text-slate-700";
  return "bg-blue-50 text-blue-700";
}

function getFilterCount(filter: HistoryFilter, items: HistoryItem[]) {
  if (filter === "Saved") return items.filter((item) => item.kind === "Saved").length;
  if (filter === "Discussions") return items.filter((item) => item.kind === "Discussion").length;
  if (filter === "Replies") return items.filter((item) => item.kind === "Reply").length;
  return items.length;
}

function KindIcon({ kind, className = "size-4 text-blue-700" }: { kind: HistoryKind | "Total"; className?: string }) {
  if (kind === "Saved") return <Bookmark className={className} />;
  if (kind === "Reply") return <MessageCircle className={className} />;
  if (kind === "Total") return <ShieldCheck className={className} />;
  return <User className={className} />;
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
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Discussions</Link>
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

function HistoryVisual({ item }: { item: HistoryItem }) {
  return <span className={`grid size-16 shrink-0 place-items-center rounded-2xl ${getAccentClasses(item.accent)}`}><KindIcon kind={item.kind} className="size-7" /></span>;
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <article className="flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-start">
      <Link href={item.href} className="shrink-0"><HistoryVisual item={item} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="text-lg font-black text-slate-950 transition hover:text-blue-700">{item.title}</Link>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.kind === "Saved" ? "bg-emerald-50 text-emerald-700" : item.kind === "Reply" ? "bg-slate-100 text-slate-700" : getModeClass(item.mode)}`}>{item.kind === "Discussion" ? getModeLabel(item.mode) : item.kind}</span>
          {item.topic && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.topic}</span>}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{item.subtitle}</p>
        <p className="mt-2 text-xs font-semibold text-slate-400">{formatRelativeTime(item.occurredAt)}</p>
      </div>
      <div className="flex gap-2 sm:justify-end">
        <Link href={item.href} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">{item.actionLabel}<ChevronRight className="size-4" /></Link>
      </div>
    </article>
  );
}

function SidebarList({ title, items, kind }: { title: string; items: HistoryItem[]; kind: HistoryKind }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 && <p className="text-sm leading-6 text-slate-500">No items yet.</p>}
        {items.map((item, index) => (
          <Link key={`${title}-${item.id}`} href={item.href} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
            <span className="flex min-w-0 items-center gap-3"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${getAccentClasses(getAccent(index))}`}><KindIcon kind={kind} /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{formatRelativeTime(item.occurredAt)}</span></span></span>
            <ChevronRight className="size-4 shrink-0 text-slate-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function makeDiscussionItem(discussion: DiscussionRow, index: number): HistoryItem {
  return {
    id: `discussion-${discussion.id}`,
    kind: "Discussion",
    title: discussion.title,
    subtitle: truncate(stripHtml(discussion.body) || "You started this discussion."),
    topic: discussion.topic,
    mode: discussion.discussion_type ?? null,
    href: `/v2/discussions/${discussion.id}`,
    occurredAt: discussion.created_at,
    actionLabel: "Open",
    accent: getAccent(index),
  };
}

export default function V2ReadingHistoryPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>("All");
  const [sortBy, setSortBy] = useState<HistorySort>("recent");
  const [showFilters, setShowFilters] = useState(false);

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const nextItems = items.filter((item) => {
      const matchesQuery = !cleanQuery || `${item.title} ${item.subtitle} ${item.topic ?? ""} ${item.kind}`.toLowerCase().includes(cleanQuery);
      const matchesFilter = activeFilter === "All" || (activeFilter === "Saved" && item.kind === "Saved") || (activeFilter === "Discussions" && item.kind === "Discussion") || (activeFilter === "Replies" && item.kind === "Reply");
      return matchesQuery && matchesFilter;
    });

    return [...nextItems].sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
      if (sortBy === "title") return a.title.localeCompare(b.title);
      return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
    });
  }, [activeFilter, items, query, sortBy]);

  const savedItems = useMemo(() => items.filter((item) => item.kind === "Saved").slice(0, 4), [items]);
  const replyItems = useMemo(() => items.filter((item) => item.kind === "Reply").slice(0, 4), [items]);
  const savedCount = getFilterCount("Saved", items);
  const discussionCount = getFilterCount("Discussions", items);
  const replyCount = getFilterCount("Replies", items);
  const totalCount = getFilterCount("All", items);

  function resetFilters() {
    setActiveFilter("All");
    setSortBy("recent");
    setQuery("");
    setShowFilters(false);
  }

  async function loadHistory(userId: string) {
    setHistoryLoading(true);
    setMessage("");
    try {
      const [discussionResult, replyResult, bookmarkResult] = await Promise.all([
        supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(24),
        supabase.from("replies").select("id, discussion_id, body, created_at").eq("user_id", userId).is("deleted_at", null).order("created_at", { ascending: false }).limit(24),
        supabase.from("bookmarks").select("id, discussion_id, created_at, private_note").eq("user_id", userId).order("created_at", { ascending: false }).limit(24),
      ]);

      const discussions = (discussionResult.data ?? []) as DiscussionRow[];
      const replies = replyResult.error ? [] : ((replyResult.data ?? []) as ReplyRow[]);
      const bookmarks = bookmarkResult.error ? [] : ((bookmarkResult.data ?? []) as BookmarkRow[]);
      const discussionIds = [...new Set([...replies.map((reply) => reply.discussion_id), ...bookmarks.map((bookmark) => bookmark.discussion_id)].filter(Boolean))];
      const linkedDiscussionsById = new Map<string, DiscussionRow>();

      if (discussionIds.length > 0) {
        const { data: linkedDiscussionRows } = await supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type").in("id", discussionIds).is("deleted_at", null);
        for (const discussion of (linkedDiscussionRows ?? []) as DiscussionRow[]) linkedDiscussionsById.set(discussion.id, discussion);
      }

      const discussionItems = discussions.map(makeDiscussionItem);
      const replyItemsForHistory: HistoryItem[] = replies.flatMap((reply, index) => {
        const discussion = linkedDiscussionsById.get(reply.discussion_id);
        if (!discussion) return [];
        return [{
          id: `reply-${reply.id}`,
          kind: "Reply",
          title: discussion.title,
          subtitle: truncate(stripHtml(reply.body) || "You replied to this discussion."),
          topic: discussion.topic,
          mode: discussion.discussion_type ?? null,
          href: `/v2/discussions/${reply.discussion_id}?reply=${reply.id}`,
          occurredAt: reply.created_at,
          actionLabel: "Open Reply",
          accent: getAccent(index + discussionItems.length),
        }];
      });
      const savedItemsForHistory: HistoryItem[] = bookmarks.flatMap((bookmark, index) => {
        const discussion = linkedDiscussionsById.get(bookmark.discussion_id);
        if (!discussion) return [];
        return [{
          id: `saved-${bookmark.id}`,
          kind: "Saved",
          title: discussion.title,
          subtitle: bookmark.private_note?.trim() ? truncate(bookmark.private_note.trim()) : truncate(stripHtml(discussion.body) || "Saved discussion ready to revisit."),
          topic: discussion.topic,
          mode: discussion.discussion_type ?? null,
          href: `/v2/discussions/${discussion.id}`,
          occurredAt: bookmark.created_at,
          actionLabel: "Resume",
          accent: getAccent(index + discussionItems.length + replyItemsForHistory.length),
        }];
      });

      setItems([...savedItemsForHistory, ...discussionItems, ...replyItemsForHistory].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()));
    } catch {
      setMessage("Unable to load V2 Reading History safely. Current navigation remains available.");
      setItems([]);
    } finally {
      setHistoryLoading(false);
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
      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadHistory(data.session.user.id);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Reading History access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Reading History access" message="Loombus is verifying access before loading the V2 Reading History shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Reading History shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Reading History is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Reading History</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Return to saved discussions, discussions you started, and replies you recently made.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved items, discussions, and replies" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters((current) => !current)} className={`grid size-12 place-items-center rounded-2xl border shadow-sm transition ${showFilters ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}><SlidersHorizontal className="size-5" /></button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter} <span className="ml-1 opacity-75">{getFilterCount(filter, items)}</span></button>)}
            </div>

            {showFilters && <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Filters</h2><p className="mt-1 text-xs font-semibold text-slate-400">Refine recent history by source and order.</p></div><button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-700">Reset</button></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Source<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as HistoryFilter)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none">{FILTERS.map((filter) => <option key={filter}>{filter}</option>)}</select></label><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as HistorySort)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option value="recent">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A-Z</option></select></label></div></section>}

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {historyLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading reading history...</div>}

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {!historyLoading && filteredItems.length === 0 && <div className="p-6 text-slate-600">No real reading history sources are available yet.</div>}
              {!historyLoading && filteredItems.map((item) => <HistoryRow key={item.id} item={item} />)}
              {!historyLoading && filteredItems.length > 0 && <button type="button" onClick={resetFilters} className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-sm font-black text-blue-700 transition hover:bg-blue-50">Showing {filteredItems.length} of {items.length} history items<ChevronRight className="size-4" /></button>}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">History sources</h2>
              <div className="mt-4 space-y-3">
                <Link href="/v2/saved" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><KindIcon kind="Saved" />Saved items</span><span className="font-black text-blue-700">{savedCount}</span></Link>
                <Link href="/v2/my-discussions" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><KindIcon kind="Discussion" />Your discussions</span><span className="font-black text-blue-700">{discussionCount}</span></Link>
                <Link href="/v2/my-replies" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><KindIcon kind="Reply" />Your replies</span><span className="font-black text-blue-700">{replyCount}</span></Link>
                <Link href="/v2/reading-history" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="inline-flex items-center gap-3 text-sm font-black text-slate-800"><KindIcon kind="Total" />Total</span><span className="font-black text-blue-700">{totalCount}</span></Link>
              </div>
            </section>

            <SidebarList title="Saved to resume" items={savedItems} kind="Saved" />
            <SidebarList title="Recent replies" items={replyItems} kind="Reply" />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Tracking source</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mr-2 inline size-4 text-blue-700" />This view uses existing saved items, discussions, and replies only. Dedicated page-view tracking can be added later with a database migration.</p>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
