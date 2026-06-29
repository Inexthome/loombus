"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  ChevronRight,
  Clock3,
  FileText,
  Folder,
  FolderOpen,
  Home,
  Image,
  LinkIcon,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  MoveRight,
  Paperclip,
  Plus,
  Search,
  SlidersHorizontal,
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

type AttachmentRow = {
  discussion_id: string;
  public_url: string | null;
  file_name: string | null;
  mime_type: string | null;
  attachment_kind: string | null;
};

type BookmarkRow = {
  id: string;
  discussion_id: string;
  created_at: string;
};

type SavedItem = DiscussionRow & {
  savedAt: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  savedKind: "Discussion" | "Reply" | "File" | "Link";
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
  { label: "Saved", href: "/v2/saved", icon: Bookmark, active: true },
];

const FILTERS = ["All Saved", "Discussions", "Replies", "Folders", "Files", "Links", "Unfiled"];
const FOLDERS = [
  { title: "Decentralized Identity", count: 12 },
  { title: "AI Safety", count: 8 },
  { title: "Climate & Energy", count: 15 },
  { title: "Condo Residents", count: 6 },
  { title: "Unfiled", count: 23 },
];

const FALLBACK_RECENT = [
  { title: "Ethics of AI Alignment", type: "Reply", age: "1h ago", icon: MessageCircle },
  { title: "Web3 Governance Models", type: "PDF", age: "1d ago", icon: FileText },
  { title: "Vitalik’s Notes on Decentralization", type: "Link", age: "2d ago", icon: LinkIcon },
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

function isImageAttachment(value: string | null | undefined) {
  return value?.startsWith("image/") ?? false;
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "L";
}

function getPreviewGradient(item: SavedItem) {
  const topic = (item.topic || "").toLowerCase();
  if (topic.includes("science") || topic.includes("climate")) return "from-emerald-500 via-lime-400 to-sky-400";
  if (topic.includes("ai") || topic.includes("society")) return "from-purple-700 via-fuchsia-500 to-blue-500";
  if (topic.includes("governance")) return "from-amber-500 via-orange-400 to-blue-500";
  return "from-blue-950 via-blue-700 to-cyan-400";
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
          <Link href="/saved" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Saved</Link>
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

function SavedVisual({ item }: { item: SavedItem }) {
  if (item.attachmentUrl && isImageAttachment(item.attachmentMimeType)) {
    return <img src={item.attachmentUrl} alt="" className="size-28 rounded-2xl object-cover sm:size-32" />;
  }

  if (item.attachmentUrl) {
    return (
      <span className="grid size-28 place-items-center rounded-2xl bg-red-50 text-red-600 sm:size-32">
        <FileText className="size-9" />
      </span>
    );
  }

  return (
    <span className={`grid size-28 place-items-center rounded-2xl bg-gradient-to-br ${getPreviewGradient(item)} text-white sm:size-32`}>
      <Bookmark className="size-9" />
    </span>
  );
}

function SavedItemRow({ item }: { item: SavedItem }) {
  return (
    <article className="flex flex-col gap-4 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-start">
      <Link href={`/v2/discussions/${item.id}`} className="shrink-0"><SavedVisual item={item} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/v2/discussions/${item.id}`} className="text-lg font-black text-slate-950 transition hover:text-blue-700">{item.title}</Link>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.topic || "Discussion"}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(item.discussion_type)}`}>{getModeLabel(item.discussion_type)}</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-slate-400">Saved {formatRelativeTime(item.savedAt)}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{truncate(stripHtml(item.body) || "Saved discussion ready to revisit.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
          {item.authorAvatarUrl ? <img src={item.authorAvatarUrl} alt="" className="size-6 rounded-full object-cover" /> : <span className="grid size-6 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{getInitial(item.authorName)}</span>}
          <span>{item.authorName}</span>
          <span>·</span>
          <span>{item.authorUsername}</span>
        </div>
      </div>
      <div className="flex gap-2 sm:w-24 sm:flex-col">
        <Link href={`/v2/discussions/${item.id}`} className="rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-black text-blue-700 transition hover:bg-blue-100">Open</Link>
        <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Move</button>
        <button type="button" className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50">Remove</button>
      </div>
      <button type="button" aria-label="More saved item actions" className="hidden text-slate-400 hover:text-blue-700 sm:block"><MoreHorizontal className="size-5" /></button>
    </article>
  );
}

export default function V2SavedPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Saved");

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = !cleanQuery || `${item.title} ${item.topic} ${item.body} ${item.authorName}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All Saved" ||
        activeFilter === "Unfiled" ||
        activeFilter === "Folders" ||
        activeFilter === "Discussions" ||
        (activeFilter === "Files" && Boolean(item.attachmentUrl)) ||
        (activeFilter === "Links" && item.savedKind === "Link") ||
        (activeFilter === "Replies" && item.savedKind === "Reply");
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, items, query]);

  const recentItems = items.slice(0, 3);

  async function loadSaved(userId: string) {
    setSavedLoading(true);
    setMessage("");

    try {
      const { data: bookmarkRows, error } = await supabase
        .from("bookmarks")
        .select("id, discussion_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) {
        setMessage("Unable to load saved items safely. Current Saved remains available.");
        setItems([]);
        return;
      }

      const bookmarks = (bookmarkRows ?? []) as BookmarkRow[];
      const discussionIds = bookmarks.map((bookmark) => bookmark.discussion_id).filter(Boolean);
      if (discussionIds.length === 0) {
        setItems([]);
        return;
      }

      const { data: discussionRows } = await supabase
        .from("discussions")
        .select("id, user_id, title, topic, body, created_at, discussion_type")
        .in("id", discussionIds)
        .is("deleted_at", null);

      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const discussionMap = new Map(discussions.map((discussion) => [discussion.id, discussion]));
      const authorIds = [...new Set(discussions.map((discussion) => discussion.user_id).filter(Boolean))];
      const profilesById = new Map<string, ProfileRow>();
      const attachmentsByDiscussionId = new Map<string, AttachmentRow>();

      if (authorIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, username, avatar_url")
          .in("id", authorIds);
        for (const profile of (profileRows ?? []) as ProfileRow[]) profilesById.set(profile.id, profile);
      }

      if (discussionIds.length > 0) {
        const { data: attachmentRows } = await supabase
          .from("discussion_attachments")
          .select("discussion_id, public_url, file_name, mime_type, attachment_kind")
          .in("discussion_id", discussionIds)
          .order("sort_order", { ascending: true });
        for (const attachment of (attachmentRows ?? []) as AttachmentRow[]) {
          if (attachment.discussion_id && !attachmentsByDiscussionId.has(attachment.discussion_id)) attachmentsByDiscussionId.set(attachment.discussion_id, attachment);
        }
      }

      setItems(
        bookmarks
          .map((bookmark, index) => {
            const discussion = discussionMap.get(bookmark.discussion_id);
            if (!discussion) return null;
            const profile = profilesById.get(discussion.user_id);
            const attachment = attachmentsByDiscussionId.get(discussion.id) ?? null;
            return {
              ...discussion,
              savedAt: bookmark.created_at,
              authorName: profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member",
              authorUsername: profile?.username ? `@${profile.username}` : "Loombus Lab",
              authorAvatarUrl: profile?.avatar_url ?? null,
              attachmentUrl: attachment?.public_url ?? null,
              attachmentName: attachment?.file_name ?? null,
              attachmentMimeType: attachment?.mime_type ?? null,
              savedKind: attachment ? "File" : index % 5 === 1 ? "Reply" : index % 5 === 4 ? "Link" : "Discussion",
            } satisfies SavedItem;
          })
          .filter((item): item is SavedItem => Boolean(item))
      );
    } catch {
      setMessage("Unable to load saved items safely. Current Saved remains available.");
      setItems([]);
    } finally {
      setSavedLoading(false);
    }
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadSaved(data.session.user.id);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Saved access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 Saved access" message="Loombus is verifying access before loading the V2 Saved shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Saved shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Saved is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Saved</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Your personal library for discussions, replies, files, and links.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved discussions, replies, files, and folders" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                <SlidersHorizontal className="size-5" />
              </button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {filter}
                </button>
              ))}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}

            <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved folders</h2>
                <Link href="/v2/saved" className="text-sm font-black text-blue-700">View all folders</Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {FOLDERS.map((folder) => (
                  <button key={folder.title} type="button" onClick={() => setActiveFilter(folder.title === "Unfiled" ? "Unfiled" : "Folders")} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50">
                    <Folder className="mb-3 size-7 text-blue-600" />
                    <p className="font-black text-slate-800">{folder.title}</p>
                    <p className="text-xs font-semibold text-slate-400">{folder.count} items</p>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved items</h2>
              {savedLoading && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading saved items...</div>}
              {!savedLoading && filteredItems.length === 0 && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">No saved items match this V2 shell filter.</div>}
              {!savedLoading && filteredItems.map((item) => <SavedItemRow key={item.id} item={item} />)}
              {!savedLoading && filteredItems.length > 0 && (
                <Link href="/v2/saved" className="mt-4 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-black text-blue-700 transition hover:text-blue-900">
                  View all saved items
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved folders</h2><Link href="/v2/saved" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">
                {FOLDERS.map((folder) => (
                  <Link key={folder.title} href="/v2/saved" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                    <span className="flex min-w-0 items-center gap-3"><FolderOpen className="size-5 shrink-0 text-blue-600" /><span className="truncate text-sm font-black text-slate-800">{folder.title}</span></span>
                    <span className="text-xs font-semibold text-slate-400">{folder.count} items</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Recently saved</h2><Link href="/v2/saved" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {recentItems.map((item) => (
                  <Link key={item.id} href={`/v2/discussions/${item.id}`} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${getPreviewGradient(item)} text-white`}><Bookmark className="size-4" /></span>
                    <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{item.savedKind} · {formatRelativeTime(item.savedAt)}</span></span>
                  </Link>
                ))}
                {recentItems.length === 0 && FALLBACK_RECENT.map((item) => {
                  const Icon = item.icon;
                  return <Link key={item.title} href="/v2/saved" className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">{item.type} · {item.age}</span></span></Link>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Suggested organization</h2>
              <div className="mt-4 space-y-3">
                {FOLDERS.slice(1).map((folder) => (
                  <div key={folder.title} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2">
                    <span className="flex min-w-0 items-center gap-3"><Folder className="size-5 text-blue-600" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{folder.title}</span><span className="block text-xs font-semibold text-slate-400">{folder.count} saved items</span></span></span>
                    <button type="button" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"><MoveRight className="inline size-3.5" /> Move</button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Reading queue</h2><Link href="/v2/saved" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">
                {items.slice(0, 2).map((item) => (
                  <Link key={item.id} href={`/v2/discussions/${item.id}`} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                    <Clock3 className="size-5 shrink-0 text-blue-600" />
                    <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">Discussion · 10 min read</span></span>
                  </Link>
                ))}
                {items.length === 0 && <p className="text-sm text-slate-500">Saved discussions will appear here.</p>}
              </div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
