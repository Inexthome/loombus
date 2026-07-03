"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Folder,
  FolderOpen,
  Home,
  LinkIcon,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  MoveRight,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = { v2_shell: boolean; v2_signal_brief: boolean; v2_rooms: boolean };
type ShellPayload = { version: "v1" | "v2"; configured: boolean; authenticated: boolean; flags: FeatureFlags };
type DiscussionRow = { id: string; user_id: string; title: string; topic: string | null; body: string | null; created_at: string; discussion_type?: string | null };
type ProfileRow = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
type AttachmentRow = { discussion_id: string; public_url: string | null; file_name: string | null; mime_type: string | null; attachment_kind: string | null };
type BookmarkRow = { id: string; discussion_id: string; created_at: string; collection_id: string | null; private_note: string | null; private_note_updated_at: string | null };
type CollectionRow = { id: string; user_id: string; name: string; description: string | null; created_at: string; updated_at: string };
type SavedKind = "Discussion" | "File";
type SavedFilter = "All Saved" | "Discussions" | "Folders" | "Files" | "Unfiled" | "Notes";
type SavedSort = "newest" | "oldest" | "title";
type SavedItem = DiscussionRow & {
  bookmarkId: string;
  collectionId: string | null;
  privateNote: string | null;
  savedAt: string;
  authorName: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  savedKind: SavedKind;
};

const DEFAULT_FLAGS: FeatureFlags = { v2_shell: false, v2_signal_brief: false, v2_rooms: false };
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
const FILTERS: SavedFilter[] = ["All Saved", "Discussions", "Folders", "Files", "Unfiled", "Notes"];
const FALLBACK_RECENT = [
  { title: "Saved discussions will appear here", type: "Discussion", age: "When saved", icon: MessageCircle },
  { title: "Files attached to saved discussions", type: "File", age: "When available", icon: FileText },
  { title: "Private notes and folders", type: "Premium", age: "When used", icon: LinkIcon },
];

function getDefaultShellPayload(): ShellPayload { return { version: "v1", configured: false, authenticated: false, flags: DEFAULT_FLAGS }; }
function stripHtml(value: string | null | undefined) { return (value ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(); }
function truncate(value: string, maxLength = 140) { return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}…`; }
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
function getModeLabel(value: string | null | undefined) { if (value === "debate") return "Debate"; if (value === "research_question") return "Research Question"; if (value === "problem_solving") return "Problem Solving"; return "Discussion"; }
function getModeClass(value: string | null | undefined) { if (value === "debate") return "bg-rose-50 text-rose-700"; if (value === "research_question") return "bg-violet-50 text-violet-700"; if (value === "problem_solving") return "bg-orange-50 text-orange-700"; return "bg-emerald-50 text-emerald-700"; }
function isImageAttachment(value: string | null | undefined) { return value?.startsWith("image/") ?? false; }
function getInitial(value: string) { return value.trim().slice(0, 1).toUpperCase() || "L"; }
function getPreviewGradient(item: SavedItem) {
  const topic = (item.topic || "").toLowerCase();
  if (topic.includes("science") || topic.includes("climate")) return "from-emerald-500 via-lime-400 to-sky-400";
  if (topic.includes("ai") || topic.includes("society")) return "from-purple-700 via-fuchsia-500 to-blue-500";
  if (topic.includes("governance")) return "from-amber-500 via-orange-400 to-blue-500";
  return "from-blue-950 via-blue-700 to-cyan-400";
}
function getItemUrl(item: SavedItem) {
  if (typeof window === "undefined") return `/v2/discussions/${item.id}`;
  return `${window.location.origin}/v2/discussions/${item.id}`;
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">{loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}</div>
          <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p><h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1></div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && <p className="mt-5 text-xs text-slate-300">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Back to V2 Home</Link><Link href="/saved" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Saved</Link></div>
      </section>
    </main>
  );
}
function V2TopNav() {
  return <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link href="/v2" className="flex items-center gap-3 font-bold"><img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" /><span className="text-xl">Loombus</span></Link><nav className="hidden items-center gap-1 md:flex">{V2_NAV_ITEMS.map((item) => { const Icon = item.icon; return <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}><Icon className="size-4" />{item.label}</Link>; })}</nav><div className="flex items-center gap-2"><Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link><Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /></Link></div></div></header>;
}
function MobileBottomNav() {
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden"><div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">{MOBILE_NAV_ITEMS.map((item) => { const Icon = item.icon; return <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-600" : "text-slate-500"}`}><Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} /><span>{item.label}</span></Link>; })}</div></nav>;
}
function SavedVisual({ item }: { item: SavedItem }) {
  if (item.attachmentUrl && isImageAttachment(item.attachmentMimeType)) return <img src={item.attachmentUrl} alt="" className="size-28 rounded-2xl object-cover sm:size-32" />;
  if (item.attachmentUrl) return <span className="grid size-28 place-items-center rounded-2xl bg-red-50 text-red-600 sm:size-32"><FileText className="size-9" /></span>;
  return <span className={`grid size-28 place-items-center rounded-2xl bg-gradient-to-br ${getPreviewGradient(item)} text-white sm:size-32`}><Bookmark className="size-9" /></span>;
}

function SavedItemRow({ item, collections, movingBookmarkId, removingBookmarkId, savingNoteId, noteDraft, actionMenuOpen, onToggleActions, onMove, onRemove, onNoteChange, onSaveNote, onCopyLink }: {
  item: SavedItem;
  collections: CollectionRow[];
  movingBookmarkId: string | null;
  removingBookmarkId: string | null;
  savingNoteId: string | null;
  noteDraft: string;
  actionMenuOpen: boolean;
  onToggleActions: (bookmarkId: string) => void;
  onMove: (bookmarkId: string, collectionId: string) => void;
  onRemove: (bookmarkId: string) => void;
  onNoteChange: (bookmarkId: string, value: string) => void;
  onSaveNote: (bookmarkId: string) => void;
  onCopyLink: (item: SavedItem) => void;
}) {
  return (
    <article className="relative flex flex-col gap-4 border-b border-slate-100 py-4 last:border-b-0 sm:flex-row sm:items-start">
      <Link href={`/v2/discussions/${item.id}`} className="shrink-0"><SavedVisual item={item} /></Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><Link href={`/v2/discussions/${item.id}`} className="text-lg font-black text-slate-950 transition hover:text-blue-700">{item.title}</Link><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{item.topic || "Discussion"}</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${getModeClass(item.discussion_type)}`}>{getModeLabel(item.discussion_type)}</span>{item.collectionId ? <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">{collections.find((collection) => collection.id === item.collectionId)?.name ?? "Filed"}</span> : <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Unfiled</span>}</div></div>
          <span className="text-xs font-semibold text-slate-400">Saved {formatRelativeTime(item.savedAt)}</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">{truncate(stripHtml(item.body) || "Saved discussion ready to revisit.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">{item.authorAvatarUrl ? <img src={item.authorAvatarUrl} alt="" className="size-6 rounded-full object-cover" /> : <span className="grid size-6 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{getInitial(item.authorName)}</span>}<span>{item.authorName}</span><span>·</span><span>{item.authorUsername}</span></div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Private note</label>
          <textarea value={noteDraft} onChange={(event) => onNoteChange(item.bookmarkId, event.target.value)} placeholder="Add why this saved item matters..." className="mt-2 min-h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300" />
          <button type="button" onClick={() => onSaveNote(item.bookmarkId)} disabled={savingNoteId === item.bookmarkId} className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-60">{savingNoteId === item.bookmarkId ? "Saving..." : "Save note"}</button>
        </div>
      </div>
      <div className="flex gap-2 sm:w-32 sm:flex-col">
        <Link href={`/v2/discussions/${item.id}`} className="rounded-xl bg-blue-50 px-3 py-2 text-center text-xs font-black text-blue-700 transition hover:bg-blue-100">Open</Link>
        <select value={item.collectionId ?? "unfiled"} onChange={(event) => onMove(item.bookmarkId, event.target.value)} disabled={movingBookmarkId === item.bookmarkId} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none transition hover:border-blue-200 disabled:opacity-60"><option value="unfiled">Unfiled</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>
        <button type="button" onClick={() => onRemove(item.bookmarkId)} disabled={removingBookmarkId === item.bookmarkId} className="rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:opacity-60">{removingBookmarkId === item.bookmarkId ? "Removing..." : "Remove"}</button>
      </div>
      <button type="button" aria-expanded={actionMenuOpen} aria-label="Saved item actions" onClick={() => onToggleActions(item.bookmarkId)} className="absolute right-0 top-4 grid size-9 place-items-center rounded-full text-slate-400 transition hover:bg-blue-50 hover:text-blue-700 sm:static sm:right-auto sm:top-auto"><MoreHorizontal className="size-5" /></button>
      {actionMenuOpen && (
        <div className="absolute right-0 top-14 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:right-0 sm:top-12">
          <Link href={`/v2/discussions/${item.id}`} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700">Open discussion <ChevronRight className="size-4" /></Link>
          <button type="button" onClick={() => onCopyLink(item)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700">Copy link <Copy className="size-4" /></button>
          <button type="button" onClick={() => onSaveNote(item.bookmarkId)} disabled={savingNoteId === item.bookmarkId} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60">Save note <Bookmark className="size-4" /></button>
          <div className="my-1 border-t border-slate-100" />
          <label className="px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Move to</label>
          <select value={item.collectionId ?? "unfiled"} onChange={(event) => onMove(item.bookmarkId, event.target.value)} disabled={movingBookmarkId === item.bookmarkId} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option value="unfiled">Unfiled</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>
          <div className="my-1 border-t border-slate-100" />
          <button type="button" onClick={() => onRemove(item.bookmarkId)} disabled={removingBookmarkId === item.bookmarkId} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60">{removingBookmarkId === item.bookmarkId ? "Removing..." : "Remove saved"} <X className="size-4" /></button>
        </div>
      )}
    </article>
  );
}

export default function V2SavedPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [items, setItems] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<CollectionRow[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [newCollectionName, setNewCollectionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [movingBookmarkId, setMovingBookmarkId] = useState<string | null>(null);
  const [removingBookmarkId, setRemovingBookmarkId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SavedFilter>("All Saved");
  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [savedSort, setSavedSort] = useState<SavedSort>("newest");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [openActionsBookmarkId, setOpenActionsBookmarkId] = useState<string | null>(null);

  const collectionCounts = useMemo(() => { const counts: Record<string, number> = { unfiled: 0 }; for (const collection of collections) counts[collection.id] = 0; for (const item of items) { if (item.collectionId) counts[item.collectionId] = (counts[item.collectionId] ?? 0) + 1; else counts.unfiled += 1; } return counts; }, [collections, items]);
  const collectionNameById = useMemo(() => Object.fromEntries(collections.map((collection) => [collection.id, collection.name])), [collections]);
  const folderCards = useMemo(() => [{ id: "unfiled", name: "Unfiled", count: collectionCounts.unfiled ?? 0 }, ...collections.map((collection) => ({ id: collection.id, name: collection.name, count: collectionCounts[collection.id] ?? 0 }))], [collectionCounts, collections]);
  const filterCounts = useMemo(() => ({
    "All Saved": items.length,
    Discussions: items.filter((item) => item.savedKind === "Discussion").length,
    Folders: items.filter((item) => Boolean(item.collectionId)).length,
    Files: items.filter((item) => Boolean(item.attachmentUrl)).length,
    Unfiled: items.filter((item) => !item.collectionId).length,
    Notes: items.filter((item) => (noteDrafts[item.bookmarkId] ?? item.privateNote ?? "").trim().length > 0).length,
  }), [items, noteDrafts]);
  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    const nextItems = items.filter((item) => {
      const collectionName = item.collectionId ? collectionNameById[item.collectionId] ?? "" : "Unfiled";
      const note = noteDrafts[item.bookmarkId] ?? item.privateNote ?? "";
      const matchesQuery = !cleanQuery || `${item.title} ${item.topic} ${item.body} ${item.authorName} ${collectionName} ${note}`.toLowerCase().includes(cleanQuery);
      const matchesFilter = activeFilter === "All Saved" || (activeFilter === "Unfiled" && !item.collectionId) || (activeFilter === "Folders" && Boolean(item.collectionId)) || (activeFilter === "Files" && Boolean(item.attachmentUrl)) || (activeFilter === "Notes" && note.trim().length > 0) || (activeFilter === "Discussions" && item.savedKind === "Discussion");
      const matchesFolder = selectedFolderId === "all" || (selectedFolderId === "unfiled" ? !item.collectionId : item.collectionId === selectedFolderId);
      return matchesQuery && matchesFilter && matchesFolder;
    });
    return [...nextItems].sort((a, b) => {
      if (savedSort === "oldest") return new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime();
      if (savedSort === "title") return a.title.localeCompare(b.title);
      return new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();
    });
  }, [activeFilter, collectionNameById, items, noteDrafts, query, savedSort, selectedFolderId]);
  const recentItems = items.slice(0, 3);
  const readingQueue = items.filter((item) => !item.privateNote).slice(0, 2);

  async function loadSaved(userId: string) {
    setSavedLoading(true); setMessage("");
    try {
      const [bookmarkResult, collectionResult] = await Promise.all([
        supabase.from("bookmarks").select("id, discussion_id, created_at, collection_id, private_note, private_note_updated_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
        supabase.from("bookmark_collections").select("id, user_id, name, description, created_at, updated_at").eq("user_id", userId).order("created_at", { ascending: true }),
      ]);
      if (bookmarkResult.error) { setMessage("Unable to load saved items safely. Current Saved remains available."); setItems([]); return; }
      setCollections((collectionResult.data ?? []) as CollectionRow[]);
      const bookmarks = (bookmarkResult.data ?? []) as BookmarkRow[];
      const discussionIds = bookmarks.map((bookmark) => bookmark.discussion_id).filter(Boolean);
      if (discussionIds.length === 0) { setItems([]); setNoteDrafts({}); return; }
      const { data: discussionRows } = await supabase.from("discussions").select("id, user_id, title, topic, body, created_at, discussion_type").in("id", discussionIds).is("deleted_at", null);
      const discussions = (discussionRows ?? []) as DiscussionRow[];
      const discussionMap = new Map(discussions.map((discussion) => [discussion.id, discussion]));
      const authorIds = [...new Set(discussions.map((discussion) => discussion.user_id).filter(Boolean))];
      const profilesById = new Map<string, ProfileRow>();
      const attachmentsByDiscussionId = new Map<string, AttachmentRow>();
      if (authorIds.length > 0) { const { data: profileRows } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", authorIds); for (const profile of (profileRows ?? []) as ProfileRow[]) profilesById.set(profile.id, profile); }
      if (discussionIds.length > 0) { const { data: attachmentRows } = await supabase.from("discussion_attachments").select("discussion_id, public_url, file_name, mime_type, attachment_kind").in("discussion_id", discussionIds).order("sort_order", { ascending: true }); for (const attachment of (attachmentRows ?? []) as AttachmentRow[]) if (attachment.discussion_id && !attachmentsByDiscussionId.has(attachment.discussion_id)) attachmentsByDiscussionId.set(attachment.discussion_id, attachment); }
      const nextItems = bookmarks.map((bookmark) => { const discussion = discussionMap.get(bookmark.discussion_id); if (!discussion) return null; const profile = profilesById.get(discussion.user_id); const attachment = attachmentsByDiscussionId.get(discussion.id) ?? null; return { ...discussion, bookmarkId: bookmark.id, collectionId: bookmark.collection_id ?? null, privateNote: bookmark.private_note ?? null, savedAt: bookmark.created_at, authorName: profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member", authorUsername: profile?.username ? `@${profile.username}` : "Loombus Lab", authorAvatarUrl: profile?.avatar_url ?? null, attachmentUrl: attachment?.public_url ?? null, attachmentName: attachment?.file_name ?? null, attachmentMimeType: attachment?.mime_type ?? null, savedKind: attachment ? "File" : "Discussion" } satisfies SavedItem; }).filter((item): item is SavedItem => Boolean(item));
      setItems(nextItems); setNoteDrafts(Object.fromEntries(nextItems.map((item) => [item.bookmarkId, item.privateNote ?? ""])));
    } catch { setMessage("Unable to load saved items safely. Current Saved remains available."); setItems([]); }
    finally { setSavedLoading(false); }
  }
  async function getAccessToken() { const { data } = await supabase.auth.getSession(); return data.session?.access_token ?? null; }
  async function createCollection(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setMessage(""); const name = newCollectionName.trim(); if (!name || creatingCollection) return; setCreatingCollection(true); const accessToken = await getAccessToken(); if (!accessToken) { setCreatingCollection(false); window.location.href = "/v2/login"; return; } const response = await fetch("/api/bookmarks/collections", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name }) }); const result = await response.json().catch(() => ({})); setCreatingCollection(false); if (!response.ok) { setMessage(result.error ?? "Unable to create folder."); return; } setCollections((current) => [...current, result.collection as CollectionRow]); setNewCollectionName(""); setActiveFilter("Folders"); setSelectedFolderId(result.collection.id); setMessage("Saved folder created."); }
  async function moveBookmark(bookmarkId: string, collectionId: string) { setMessage(""); setMovingBookmarkId(bookmarkId); const accessToken = await getAccessToken(); if (!accessToken) { setMovingBookmarkId(null); window.location.href = "/v2/login"; return; } const nextCollectionId = collectionId === "unfiled" ? null : collectionId; const response = await fetch("/api/bookmarks/move", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId, collectionId: nextCollectionId }) }); const result = await response.json().catch(() => ({})); setMovingBookmarkId(null); if (!response.ok) { setMessage(result.error ?? "Unable to move saved item."); return; } setItems((current) => current.map((item) => item.bookmarkId === bookmarkId ? { ...item, collectionId: nextCollectionId } : item)); setOpenActionsBookmarkId(null); setMessage(nextCollectionId ? "Saved item moved." : "Saved item moved to Unfiled."); }
  async function removeBookmark(bookmarkId: string) { setMessage(""); setRemovingBookmarkId(bookmarkId); const accessToken = await getAccessToken(); if (!accessToken) { setRemovingBookmarkId(null); window.location.href = "/v2/login"; return; } const response = await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId }) }); const result = await response.json().catch(() => ({})); setRemovingBookmarkId(null); if (!response.ok) { setMessage(result.error ?? "Unable to remove saved item."); return; } setItems((current) => current.filter((item) => item.bookmarkId !== bookmarkId)); setOpenActionsBookmarkId(null); setMessage("Saved item removed."); }
  async function deleteCollection(collectionId: string) { setMessage(""); setDeletingCollectionId(collectionId); const accessToken = await getAccessToken(); if (!accessToken) { setDeletingCollectionId(null); window.location.href = "/v2/login"; return; } const response = await fetch("/api/bookmarks/collections", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ collectionId }) }); const result = await response.json().catch(() => ({})); setDeletingCollectionId(null); if (!response.ok) { setMessage(result.error ?? "Unable to delete folder."); return; } setCollections((current) => current.filter((collection) => collection.id !== collectionId)); setItems((current) => current.map((item) => item.collectionId === collectionId ? { ...item, collectionId: null } : item)); if (selectedFolderId === collectionId) setSelectedFolderId("all"); setMessage("Folder deleted. Its saved items moved to Unfiled."); }
  function updateNoteDraft(bookmarkId: string, value: string) { setNoteDrafts((current) => ({ ...current, [bookmarkId]: value })); }
  async function saveNote(bookmarkId: string) { setMessage(""); setSavingNoteId(bookmarkId); const accessToken = await getAccessToken(); if (!accessToken) { setSavingNoteId(null); window.location.href = "/v2/login"; return; } const response = await fetch("/api/bookmarks/note", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId, note: noteDrafts[bookmarkId] ?? "" }) }); const result = await response.json().catch(() => ({})); setSavingNoteId(null); if (!response.ok) { setMessage(result.error ?? "Unable to save note."); return; } const nextNote = result.bookmark?.private_note ?? null; setItems((current) => current.map((item) => item.bookmarkId === bookmarkId ? { ...item, privateNote: nextNote } : item)); setNoteDrafts((current) => ({ ...current, [bookmarkId]: nextNote ?? "" })); setOpenActionsBookmarkId(null); setMessage(nextNote ? "Private note saved." : "Private note cleared."); }
  async function copySavedLink(item: SavedItem) { await navigator.clipboard?.writeText(getItemUrl(item)); setOpenActionsBookmarkId(null); setMessage("Saved item link copied."); }
  function resetFilters() { setActiveFilter("All Saved"); setSelectedFolderId("all"); setSavedSort("newest"); setQuery(""); }

  async function loadShell() { setLoading(true); setMessage(""); try { const { data } = await supabase.auth.getSession(); const accessToken = data.session?.access_token; const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined }); const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload; setPayload(nextPayload); if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadSaved(data.session.user.id); } catch { setPayload(getDefaultShellPayload()); setMessage("Unable to verify V2 Saved access. Current Loombus remains on V1."); } finally { setLoading(false); } }
  useEffect(() => { loadShell(); const { data } = supabase.auth.onAuthStateChange(() => { loadShell(); }); return () => data.subscription.unsubscribe(); }, []);
  if (loading) return <GateCard title="Checking V2 Saved access" message="Loombus is verifying access before loading the V2 Saved shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Saved shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Saved is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950" onClick={() => openActionsBookmarkId && setOpenActionsBookmarkId(null)}>
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8" onClick={(event) => event.stopPropagation()}>
        <header className="mb-6"><h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Saved</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Your personal library for discussions, files, notes, and folders.</p></header>
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3"><div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><Search className="size-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved discussions, notes, files, and folders" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" /></div><button type="button" aria-expanded={showFilterPanel} onClick={() => setShowFilterPanel((current) => !current)} className={`grid size-12 place-items-center rounded-2xl border shadow-sm transition ${showFilterPanel ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"}`}><SlidersHorizontal className="size-5" /></button></div>
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{FILTERS.map((filter) => <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter} <span className="ml-1 opacity-75">{filterCounts[filter]}</span></button>)}</div>
            {showFilterPanel && <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Filters</h2><p className="mt-1 text-xs font-semibold text-slate-400">Refine saved items by type, folder, and order.</p></div><button type="button" onClick={resetFilters} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-700">Reset</button></div><div className="grid gap-4 md:grid-cols-3"><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Type<select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as SavedFilter)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option>All Saved</option><option>Discussions</option><option>Folders</option><option>Files</option><option>Unfiled</option><option>Notes</option></select></label><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Folder<select value={selectedFolderId} onChange={(event) => setSelectedFolderId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option value="all">All folders</option><option value="unfiled">Unfiled</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Sort<select value={savedSort} onChange={(event) => setSavedSort(event.target.value as SavedSort)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 outline-none"><option value="newest">Newest saved</option><option value="oldest">Oldest saved</option><option value="title">Title A-Z</option></select></label></div></section>}
            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            <section className="mb-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved folders</h2><form onSubmit={createCollection} className="flex min-w-0 gap-2"><input value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} placeholder="New folder" className="min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300" /><button type="submit" disabled={creatingCollection || !newCollectionName.trim()} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:opacity-60">{creatingCollection ? "Creating..." : "Create"}</button></form></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{folderCards.map((folder) => <button key={folder.id} type="button" onClick={() => { setSelectedFolderId(folder.id); setActiveFilter(folder.id === "unfiled" ? "Unfiled" : "Folders"); }} className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"><Folder className="mb-3 size-7 text-blue-600" /><p className="font-black text-slate-800">{folder.name}</p><p className="text-xs font-semibold text-slate-400">{folder.count} items</p></button>)}</div></section>
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm"><h2 className="mb-2 text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved items</h2>{savedLoading && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading saved items...</div>}{!savedLoading && filteredItems.length === 0 && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">No saved items match this V2 shell filter.</div>}{!savedLoading && filteredItems.map((item) => <SavedItemRow key={item.bookmarkId} item={item} collections={collections} movingBookmarkId={movingBookmarkId} removingBookmarkId={removingBookmarkId} savingNoteId={savingNoteId} noteDraft={noteDrafts[item.bookmarkId] ?? ""} actionMenuOpen={openActionsBookmarkId === item.bookmarkId} onToggleActions={(bookmarkId) => setOpenActionsBookmarkId((current) => current === bookmarkId ? null : bookmarkId)} onMove={moveBookmark} onRemove={removeBookmark} onNoteChange={updateNoteDraft} onSaveNote={saveNote} onCopyLink={copySavedLink} />)}{!savedLoading && filteredItems.length > 0 && <Link href="/v2/saved" className="mt-4 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-black text-blue-700 transition hover:text-blue-900">Showing {filteredItems.length} of {items.length} saved items<ChevronRight className="size-4" /></Link>}</section>
          </div>
          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Saved folders</h2><span className="text-xs font-bold text-slate-400">{collections.length} custom</span></div><div className="mt-4 space-y-3">{folderCards.map((folder) => <div key={folder.id} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><button type="button" onClick={() => { setSelectedFolderId(folder.id); setActiveFilter(folder.id === "unfiled" ? "Unfiled" : "Folders"); }} className="flex min-w-0 items-center gap-3 text-left"><FolderOpen className="size-5 shrink-0 text-blue-600" /><span className="truncate text-sm font-black text-slate-800">{folder.name}</span></button><span className="text-xs font-semibold text-slate-400">{folder.count}</span>{folder.id !== "unfiled" && <button type="button" onClick={() => deleteCollection(folder.id)} disabled={deletingCollectionId === folder.id} className="text-xs font-black text-red-500 hover:text-red-700 disabled:opacity-60">{deletingCollectionId === folder.id ? "..." : "Delete"}</button>}</div>)}</div></section>
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Recently saved</h2><Link href="/v2/saved" className="text-sm font-black text-blue-700">View all</Link></div><div className="mt-4 space-y-4">{recentItems.map((item) => <Link key={item.bookmarkId} href={`/v2/discussions/${item.id}`} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${getPreviewGradient(item)} text-white`}><Bookmark className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{item.savedKind} · {formatRelativeTime(item.savedAt)}</span></span></Link>)}{recentItems.length === 0 && FALLBACK_RECENT.map((item) => { const Icon = item.icon; return <Link key={item.title} href="/v2/saved" className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">{item.type} · {item.age}</span></span></Link>; })}</div></section>
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Suggested organization</h2><div className="mt-4 space-y-3">{items.filter((item) => !item.collectionId).slice(0, 4).map((item) => <div key={item.bookmarkId} className="rounded-2xl px-1 py-2"><span className="flex min-w-0 items-center gap-3"><Folder className="size-5 text-blue-600" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-400">Unfiled saved item</span></span></span>{collections.length > 0 && <button type="button" onClick={() => moveBookmark(item.bookmarkId, collections[0].id)} className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100"><MoveRight className="inline size-3.5" /> Move to {collections[0].name}</button>}</div>)}{items.filter((item) => !item.collectionId).length === 0 && <p className="text-sm text-slate-500">No unfiled saved items need organizing.</p>}</div></section>
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Reading queue</h2><Link href="/v2/reading-history" className="text-sm font-black text-blue-700">Open history</Link></div><div className="mt-4 space-y-3">{readingQueue.map((item) => <Link key={item.bookmarkId} href={`/v2/discussions/${item.id}`} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><Clock3 className="size-5 shrink-0 text-blue-600" /><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">Discussion · ready to revisit</span></span></Link>)}{readingQueue.length === 0 && <p className="text-sm text-slate-500">Saved discussions will appear here.</p>}</div></section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
