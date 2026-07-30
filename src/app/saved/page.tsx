"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import { useBackgroundRefresh } from "@/lib/use-background-refresh";
import Link from "next/link";
import { Bookmark, ChevronRight, Download, Folder, Library, MessageSquareText, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useState } from "react";

type Discussion = { id: string; title: string; topic: string | null; reality_lens: string | null; purpose_lane: string | null; body: string; created_at: string };
type SavedItem = { id: string; created_at: string; collection_id: string | null; private_note: string | null; private_note_updated_at: string | null; discussions: Discussion | null };
type Collection = { id: string; user_id: string; name: string; description: string | null; created_at: string; updated_at: string };
type Entitlement = { tier: string | null; ai_assisted_enabled: boolean | null; monthly_summary_limit: number | null } | null;
type SortMode = "newest" | "oldest" | "title";

const SAVED_REFRESH_EVENTS = ["loombus:bookmarks-changed", "loombus:discussion-metrics-changed"];

function canUseFolders(entitlement: Entitlement, isAdmin: boolean) {
  return isAdmin || Boolean(entitlement?.ai_assisted_enabled && ["premium", "admin"].includes(entitlement.tier ?? ""));
}
function canUseNotes(entitlement: Entitlement, isAdmin: boolean) {
  return isAdmin || Boolean(entitlement?.ai_assisted_enabled && entitlement?.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50);
}
function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function excerpt(value: string) {
  return normalizePublicText(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function broadcastSavedChanged() {
  window.dispatchEvent(new Event("loombus:bookmarks-changed"));
}

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [entitlement, setEntitlement] = useState<Entitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [notesOnly, setNotesOnly] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const foldersEnabled = canUseFolders(entitlement, isAdmin);
  const notesEnabled = canUseNotes(entitlement, isAdmin);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return window.location.replace("/login?next=%2Fsaved");
    try {
      const [profile, access, folderRows, bookmarkRows] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
        supabase.from("user_ai_entitlements").select("tier, ai_assisted_enabled, monthly_summary_limit").eq("user_id", user.id).maybeSingle(),
        supabase.from("bookmark_collections").select("id, user_id, name, description, created_at, updated_at").eq("user_id", user.id).order("created_at"),
        supabase.from("bookmarks").select("id, created_at, collection_id, private_note, private_note_updated_at, discussions(id, title, topic, reality_lens, purpose_lane, body, created_at)").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      const normalized = (bookmarkRows.data ?? []).map((row: any) => ({ ...row, discussions: Array.isArray(row.discussions) ? row.discussions[0] ?? null : row.discussions })) as SavedItem[];
      setUserId(user.id);
      setIsAdmin(Boolean(profile.data?.is_admin));
      setEntitlement((access.data ?? null) as Entitlement);
      setCollections((folderRows.data ?? []) as Collection[]);
      setSaved(normalized);
      setNoteDrafts((current) => Object.fromEntries(normalized.map((item) => [item.id, current[item.id] ?? item.private_note ?? ""])));
    } catch {
      if (!silent) setMessage("Unable to load your saved library.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useBackgroundRefresh({
    refresh: () => load(true),
    enabled: Boolean(userId),
    intervalMs: 180_000,
    events: SAVED_REFRESH_EVENTS,
  });

  useState(() => {
    void load(false);
    return undefined;
  });

  const folderNames = useMemo(() => Object.fromEntries(collections.map((folder) => [folder.id, folder.name])), [collections]);
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: saved.length, unfiled: 0 };
    for (const item of saved) counts[item.collection_id ?? "unfiled"] = (counts[item.collection_id ?? "unfiled"] ?? 0) + 1;
    return counts;
  }, [saved]);
  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of saved) if (item.discussions?.topic) counts.set(item.discussions.topic, (counts.get(item.discussions.topic) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [saved]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return saved
      .filter((item) => selectedFolder === "all" || (selectedFolder === "unfiled" ? !item.collection_id : item.collection_id === selectedFolder))
      .filter((item) => !notesOnly || Boolean((noteDrafts[item.id] ?? item.private_note ?? "").trim()))
      .filter((item) => {
        if (!q) return true;
        const d = item.discussions;
        return [d?.title, d?.body, d?.topic, d?.reality_lens, d?.purpose_lane, noteDrafts[item.id], folderNames[item.collection_id ?? ""]].filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => sort === "title" ? (a.discussions?.title ?? "").localeCompare(b.discussions?.title ?? "") : sort === "oldest" ? +new Date(a.created_at) - +new Date(b.created_at) : +new Date(b.created_at) - +new Date(a.created_at));
  }, [folderNames, noteDrafts, notesOnly, query, saved, selectedFolder, sort]);

  async function token() {
    return (await supabase.auth.getSession()).data.session?.access_token ?? null;
  }
  async function createFolder(event: FormEvent) {
    event.preventDefault();
    const name = newFolder.trim();
    if (!name || !userId || !foldersEnabled) return setMessage(foldersEnabled ? "Enter a folder name." : "Saved folders require Premium access.");
    setBusyId("folder-create");
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks/collections", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok && result.collection) { setCollections((current) => [...current, result.collection]); setSelectedFolder(result.collection.id); setNewFolder(""); setMessage("Saved folder created."); broadcastSavedChanged(); }
    else setMessage(result?.error ?? "Unable to create folder.");
    setBusyId(null);
  }
  async function moveBookmark(bookmarkId: string, collectionId: string) {
    if (!foldersEnabled) return setMessage("Moving saved discussions requires Premium access.");
    setBusyId(bookmarkId);
    const accessToken = await token();
    const next = collectionId === "unfiled" ? null : collectionId;
    const response = accessToken ? await fetch("/api/bookmarks/move", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId, collectionId: next }) }) : null;
    if (response?.ok) { setSaved((current) => current.map((item) => item.id === bookmarkId ? { ...item, collection_id: next } : item)); setMessage("Saved discussion moved."); broadcastSavedChanged(); }
    else setMessage("Unable to move saved discussion.");
    setBusyId(null);
  }
  async function saveNote(bookmarkId: string) {
    if (!notesEnabled) return setMessage("Private notes require Premium Plus access.");
    setBusyId(bookmarkId);
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks/note", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId, note: (noteDrafts[bookmarkId] ?? "").trim() }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok) { setSaved((current) => current.map((item) => item.id === bookmarkId ? { ...item, private_note: result.bookmark?.private_note ?? null, private_note_updated_at: result.bookmark?.private_note_updated_at ?? null } : item)); setMessage("Private note saved."); broadcastSavedChanged(); }
    else setMessage(result?.error ?? "Unable to save private note.");
    setBusyId(null);
  }
  async function removeBookmark(bookmarkId: string) {
    setBusyId(bookmarkId);
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId }) }) : null;
    if (response?.ok) { setSaved((current) => current.filter((item) => item.id !== bookmarkId)); setMessage("Saved discussion removed."); broadcastSavedChanged(); }
    else setMessage("Unable to remove saved discussion.");
    setBusyId(null);
  }
  async function deleteFolder(collectionId: string) {
    if (!foldersEnabled) return;
    setBusyId(collectionId);
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks/collections", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ collectionId }) }) : null;
    if (response?.ok) { setCollections((current) => current.filter((folder) => folder.id !== collectionId)); setSaved((current) => current.map((item) => item.collection_id === collectionId ? { ...item, collection_id: null } : item)); if (selectedFolder === collectionId) setSelectedFolder("all"); setMessage("Folder deleted. Its discussions moved to Unfiled."); broadcastSavedChanged(); }
    else setMessage("Unable to delete folder.");
    setBusyId(null);
  }
  function exportLibrary(format: "markdown" | "json") {
    if (!notesEnabled) return setMessage("Export requires Premium Plus access.");
    const items = saved.filter((item) => item.discussions).map((item) => ({ title: item.discussions!.title, topic: item.discussions!.topic, folder: item.collection_id ? folderNames[item.collection_id] : "Unfiled", note: noteDrafts[item.id] ?? "", url: `${window.location.origin}/discussions/${item.discussions!.id}` }));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") downloadFile(`loombus-saved-${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), items }, null, 2), "application/json");
    else downloadFile(`loombus-saved-${stamp}.md`, ["# Loombus Saved Library", "", ...items.flatMap((item, index) => [`## ${index + 1}. ${item.title}`, "", `- Topic: ${item.topic ?? "Other"}`, `- Folder: ${item.folder}`, `- URL: ${item.url}`, "", item.note ? `Private note: ${item.note}` : "_No private note._", "", "---", ""])].join("\n"), "text/markdown");
    setMessage(`Saved library exported as ${format === "json" ? "JSON" : "Markdown"}.`);
  }

  if (loading) return <LoombusLoadingScreen title="Loading Saved..." message="Preparing your signal library." />;

  return <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.24em] text-[var(--loombus-gold)]">Personal signal library</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Saved discussions</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">Search, organize, annotate, and revisit the conversations worth keeping.</p></div>
        <Link href="/discussions" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]"><Plus className="h-4 w-4" />Add more signal</Link>
      </header>

      {message && <p className="mt-5 rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_30%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] p-4 text-sm">{message}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Saved", saved.length, <Bookmark key="a" className="h-5 w-5" />], ["Folders", collections.length, <Folder key="b" className="h-5 w-5" />], ["With notes", saved.filter((item) => (noteDrafts[item.id] ?? "").trim()).length, <MessageSquareText key="c" className="h-5 w-5" />], ["Topics", topics.length, <Sparkles key="d" className="h-5 w-5" />]].map(([label, count, icon]) => <article key={String(label)} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">{icon}</span><strong className="text-3xl">{String(count)}</strong></div><p className="mt-4 text-sm font-black">{String(label)}</p></article>)}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between"><h2 className="font-black">Folders</h2><Folder className="h-5 w-5 text-[var(--loombus-gold)]" /></div><div className="mt-4 grid gap-2">{[["all", "All saved"], ["unfiled", "Unfiled"]].map(([id, name]) => <button key={id} onClick={() => setSelectedFolder(id)} className={`flex justify-between rounded-xl px-3 py-2 text-left text-sm font-bold ${selectedFolder === id ? "bg-[var(--loombus-gold-surface)]" : ""}`}><span>{name}</span><span>{folderCounts[id] ?? 0}</span></button>)}{collections.map((folder) => <div key={folder.id} className="flex gap-1"><button onClick={() => setSelectedFolder(folder.id)} className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2 text-left text-sm font-bold ${selectedFolder === folder.id ? "bg-[var(--loombus-gold-surface)]" : ""}`}>{folder.name} · {folderCounts[folder.id] ?? 0}</button>{foldersEnabled && <button onClick={() => void deleteFolder(folder.id)} disabled={busyId === folder.id} aria-label={`Delete ${folder.name}`} className="rounded-xl p-2 text-red-500"><Trash2 className="h-4 w-4" /></button>}</div>)}</div>{foldersEnabled ? <form onSubmit={createFolder} className="mt-4 flex gap-2"><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} placeholder="New folder" className="min-w-0 flex-1 rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm" /><button disabled={busyId === "folder-create"} className="rounded-xl bg-[var(--loombus-gold)] px-3 text-sm font-black text-[var(--loombus-gold-contrast)]">Add</button></form> : <Link href="/premium" className="mt-4 block text-sm font-black text-[var(--loombus-gold)]">Unlock folders</Link>}</section>
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="font-black">Export</h2><div className="mt-3 grid gap-2"><button onClick={() => exportLibrary("markdown")} className="flex items-center justify-between rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-bold">Markdown <Download className="h-4 w-4" /></button><button onClick={() => exportLibrary("json")} className="flex items-center justify-between rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-bold">JSON <Download className="h-4 w-4" /></button></div></section>
        </aside>

        <div><div className="flex flex-col gap-3 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 sm:flex-row"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[var(--loombus-border)] px-3"><Search className="h-4 w-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search saved discussions, notes, and folders" className="w-full bg-transparent py-3 outline-none" /></label><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option></select>{notesEnabled && <button onClick={() => setNotesOnly((current) => !current)} className={`rounded-2xl border px-4 py-3 text-sm font-black ${notesOnly ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}>Notes only</button>}</div>

          <div className="mt-4 space-y-4">{visible.length ? visible.map((item) => { const discussion = item.discussions; if (!discussion) return null; return <article key={item.id} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10"><div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><Library className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-xs font-black text-[var(--loombus-text-muted)]"><span>{discussion.topic || "Other"}</span><span>·</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div><Link href={`/discussions/${discussion.id}`} className="mt-2 block text-xl font-black">{discussion.title}</Link><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{excerpt(discussion.body)}</p></div><button onClick={() => void removeBookmark(item.id)} disabled={busyId === item.id} className="self-start rounded-xl p-2 text-red-500" aria-label="Remove saved discussion"><Trash2 className="h-4 w-4" /></button></div>{foldersEnabled && <label className="mt-4 block text-xs font-black text-[var(--loombus-text-muted)]">Folder<select value={item.collection_id ?? "unfiled"} onChange={(event) => void moveBookmark(item.id, event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2 text-sm"><option value="unfiled">Unfiled</option>{collections.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>}{notesEnabled && <div className="mt-4"><textarea value={noteDrafts[item.id] ?? ""} onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Add a private note" rows={3} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3 text-sm" /><button onClick={() => void saveNote(item.id)} disabled={busyId === item.id} className="mt-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-black">Save note</button></div>}</article>; }) : <div className="rounded-3xl border border-dashed border-[var(--loombus-border)] p-12 text-center"><Library className="mx-auto h-9 w-9 text-[var(--loombus-gold)]" /><h2 className="mt-4 text-xl font-black">No saved discussions match this view.</h2><Link href="/discussions" className="mt-4 inline-flex items-center gap-2 font-black text-[var(--loombus-gold)]">Browse discussions <ChevronRight className="h-4 w-4" /></Link></div>}</div>
        </div>
      </section>
    </div>
  </main>;
}
