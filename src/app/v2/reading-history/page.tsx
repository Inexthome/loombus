"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bookmark,
  ChevronDown,
  FileText,
  FlaskConical,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  PauseCircle,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
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

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type HistoryKind = "Discussion" | "Room" | "People" | "Lab" | "File";
type HistoryAccent = "blue" | "green" | "violet" | "red" | "slate";

type HistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  subtitle: string;
  topic: string | null;
  mode?: string | null;
  href: string;
  viewedAt: string;
  progress: number;
  actionLabel: string;
  accent: HistoryAccent;
  avatarUrl?: string | null;
};

type SidebarItem = {
  title: string;
  meta: string;
  href: string;
  progress?: number;
  icon: LucideIcon;
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

const FILTERS = ["All", "Discussions", "Rooms", "People", "Labs", "Files"];
const SINCE_ITEMS = [
  { label: "8 new replies in discussions", icon: MessageCircle },
  { label: "3 updates in labs", icon: FlaskConical },
  { label: "2 new messages in rooms", icon: Home },
  { label: "5 new files added", icon: FileText },
];
const QUICK_CLEAR = ["Clear today", "Clear last 7 days", "Clear all history"];

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

function truncate(value: string, maxLength = 120) {
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
  return ["blue", "green", "violet", "slate", "red"][index % 5] as HistoryAccent;
}

function getHistoryIcon(kind: HistoryKind) {
  if (kind === "Room") return Home;
  if (kind === "People") return User;
  if (kind === "Lab") return FlaskConical;
  if (kind === "File") return FileText;
  return MessageCircle;
}

function getPreviewGradient(item: HistoryItem) {
  if (item.accent === "green") return "from-emerald-500 via-lime-400 to-sky-400";
  if (item.accent === "violet") return "from-violet-700 via-fuchsia-500 to-blue-500";
  if (item.accent === "red") return "from-red-600 via-rose-500 to-orange-400";
  if (item.accent === "slate") return "from-slate-900 via-slate-700 to-blue-500";
  return "from-blue-950 via-blue-700 to-cyan-400";
}

function getSidebarAccentClass(accent: HistoryAccent) {
  if (accent === "green") return "bg-emerald-50 text-emerald-700";
  if (accent === "violet") return "bg-violet-50 text-violet-700";
  if (accent === "red") return "bg-red-50 text-red-700";
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
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Discussions</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] text-white shadow-sm">
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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
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
  const Icon = getHistoryIcon(item.kind);
  if (item.avatarUrl && item.kind === "People") return <img src={item.avatarUrl} alt="" className="size-20 rounded-2xl object-cover" />;
  return (
    <span className={`grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${getPreviewGradient(item)} text-white shadow-sm`}>
      <Icon className="size-8" />
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-[128px] items-center gap-3 text-xs font-semibold text-slate-500">
      <span className="h-1.5 flex-1 rounded-full bg-slate-200"><span className="block h-1.5 rounded-full bg-blue-600" style={{ width: `${value}%` }} /></span>
      Read {value}%
    </span>
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  return (
    <article className="flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center">
      <Link href={item.href} className="shrink-0"><HistoryVisual item={item} /></Link>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="text-lg font-black text-slate-950 transition hover:text-blue-700">{item.title}</Link>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.kind === "File" ? "bg-orange-50 text-orange-700" : item.kind === "People" ? "bg-emerald-50 text-emerald-700" : getModeClass(item.mode)}`}>{item.kind === "Discussion" ? getModeLabel(item.mode) : item.kind}</span>
          {item.topic && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.topic}</span>}
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-600">{item.subtitle}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="size-1.5 rounded-full bg-blue-600" />
          <ProgressBar value={item.progress} />
        </div>
      </div>
      <span className="text-sm font-semibold text-slate-500 sm:w-24">{formatRelativeTime(item.viewedAt)}</span>
      <div className="flex gap-2 sm:w-40 sm:justify-end">
        <Link href={item.href} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white transition hover:bg-blue-700">{item.actionLabel}</Link>
        <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Save</button>
        <button type="button" aria-label="More history actions" className="grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"><MoreHorizontal className="size-5" /></button>
      </div>
    </article>
  );
}

function SidebarList({ title, items }: { title: string; items: SidebarItem[] }) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">{title}</h2><Link href="/v2/reading-history" className="text-sm font-black text-blue-700">View all</Link></div>
      <div className="mt-4 space-y-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={`${title}-${item.title}`} href={item.href} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
              <span className={`grid size-16 shrink-0 place-items-center rounded-xl ${getSidebarAccentClass(item.accent)}`}><Icon className="size-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-slate-800">{item.title}</span>
                <span className="block truncate text-xs font-semibold text-slate-500">{item.meta}</span>
                {typeof item.progress === "number" && <span className="mt-2 block"><ProgressBar value={item.progress} /></span>}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function V2ReadingHistoryPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !cleanQuery || `${item.title} ${item.subtitle} ${item.topic ?? ""} ${item.kind}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Discussions" && item.kind === "Discussion") ||
        (activeFilter === "Rooms" && item.kind === "Room") ||
        (activeFilter === "People" && item.kind === "People") ||
        (activeFilter === "Labs" && item.kind === "Lab") ||
        (activeFilter === "Files" && item.kind === "File");
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, items, query]);

  const todayItems = filteredItems.slice(0, 5);
  const yesterdayItems = filteredItems.slice(5);
  const continueReading: SidebarItem[] = items.slice(0, 2).map((item) => ({
    title: item.title,
    meta: item.kind,
    href: item.href,
    progress: item.progress,
    icon: getHistoryIcon(item.kind),
    accent: item.accent,
  }));

  async function loadHistory(userId: string) {
    setHistoryLoading(true);
    setMessage("");
    try {
      const { data: discussionRows, error } = await supabase
        .from("discussions")
        .select("id, user_id, title, topic, body, created_at, discussion_type")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) {
        setMessage("Unable to load V2 Reading History safely. Current navigation remains available.");
        setItems([]);
        return;
      }

      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url")
        .neq("id", userId)
        .limit(1);
      const profile = ((profileRows ?? []) as ProfileRow[])[0];

      const discussionItems: HistoryItem[] = discussions.map((discussion, index) => ({
        id: `discussion-${discussion.id}`,
        kind: "Discussion",
        title: discussion.title,
        subtitle: index === 0 ? "3 new replies since you viewed" : truncate(stripHtml(discussion.body) || "Return to this discussion and continue reading."),
        topic: discussion.topic,
        mode: discussion.discussion_type ?? null,
        href: `/v2/discussions/${discussion.id}`,
        viewedAt: new Date(Date.now() - (index + 1) * 60 * 60 * 1000).toISOString(),
        progress: Math.max(30, 80 - index * 10),
        actionLabel: "Resume",
        accent: getAccent(index),
      }));

      const supplementalItems: HistoryItem[] = [
        {
          id: "room-builders",
          kind: "Room",
          title: "Builders’ Room",
          subtitle: "12 new messages",
          topic: null,
          href: "/v2/rooms",
          viewedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          progress: 65,
          actionLabel: "Resume",
          accent: "blue",
        },
        {
          id: "profile-person",
          kind: "People",
          title: profile?.full_name?.trim() || profile?.username?.trim() || "Nadia Karim",
          subtitle: "Viewed profile",
          topic: null,
          href: "/v2/people",
          viewedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          progress: 100,
          actionLabel: "View Again",
          accent: "slate",
          avatarUrl: profile?.avatar_url ?? null,
        },
        {
          id: "lab-research",
          kind: "Lab",
          title: "Loombus Research Lab",
          subtitle: "2 new updates since you viewed",
          topic: null,
          href: "/v2/labs",
          viewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          progress: 40,
          actionLabel: "Resume",
          accent: "blue",
        },
        {
          id: "file-trust-models",
          kind: "File",
          title: "Trust Models Overview.pdf",
          subtitle: "Read 100%",
          topic: null,
          href: "/v2/saved",
          viewedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
          progress: 100,
          actionLabel: "Open",
          accent: "red",
        },
      ];

      setItems([...discussionItems.slice(0, 1), ...supplementalItems.slice(0, 4), ...discussionItems.slice(1)]);
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
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Reading History</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Return to discussions, rooms, people, and labs you recently viewed.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 xl:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your history" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <div className="flex gap-3">
                <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50"><Trash2 className="size-4" />Clear History</button>
                <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"><PauseCircle className="size-4" />Pause History</button>
                <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-5" /></button>
              </div>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter}</button>)}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {historyLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading reading history...</div>}

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {!historyLoading && filteredItems.length === 0 && <div className="p-6 text-slate-600">No history matches this V2 shell filter.</div>}
              {!historyLoading && todayItems.length > 0 && <h2 className="border-b border-slate-100 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-600">Today</h2>}
              {!historyLoading && todayItems.map((item) => <HistoryRow key={item.id} item={item} />)}
              {!historyLoading && yesterdayItems.length > 0 && <h2 className="border-y border-slate-100 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-slate-600">Yesterday</h2>}
              {!historyLoading && yesterdayItems.map((item) => <HistoryRow key={item.id} item={item} />)}
              {!historyLoading && filteredItems.length > 0 && <Link href="/v2/reading-history" className="flex items-center justify-center gap-2 border-t border-slate-100 px-4 py-4 text-sm font-black text-blue-700 transition hover:bg-blue-50">Load more history <ChevronDown className="size-4" /></Link>}
            </section>
          </div>

          <aside className="space-y-4">
            <SidebarList title="Continue reading" items={continueReading} />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Since you viewed</h2><Link href="/v2/notifications" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {SINCE_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return <Link key={item.label} href="/v2/notifications" className="flex items-center gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="text-sm font-semibold text-slate-700">{item.label}</span></Link>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Privacy settings</h2><Link href="/settings" className="text-sm font-black text-blue-700">Manage</Link></div>
              <div className="mt-4 space-y-4 text-sm text-slate-600">
                <div className="flex items-center justify-between"><span>History is recording</span><span className="font-black text-emerald-600">On ·</span></div>
                <div className="flex items-center justify-between"><span>Auto-delete history</span><span className="font-black text-slate-700">30 days ›</span></div>
                <div className="flex items-center justify-between"><span>Private mode</span><span className="font-black text-slate-700">Off ›</span></div>
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Quick clear</h2><button type="button" className="text-sm font-black text-blue-700">Clear all</button></div>
              <div className="mt-4 space-y-3">
                {QUICK_CLEAR.map((item) => <button key={item} type="button" className="flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-red-50 hover:text-red-700"><Trash2 className="size-4 text-red-500" />{item}</button>)}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Smart recall</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mr-2 inline size-4 text-blue-700" />Quickly find what matters with read-only context-aware suggestions.</p>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
