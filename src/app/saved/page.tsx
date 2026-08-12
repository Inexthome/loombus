"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { ORGANIZATION_LIMITS } from "@/lib/organization-limits";
import { normalizePublicText } from "@/lib/public-text";
import {
  evaluateSubscriptionEntitlement,
  type SubscriptionPlanId,
} from "@/lib/subscription-entitlements";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Bookmark, ChevronRight, Download, Folder, Library, MessageSquareText, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type Discussion = { id: string; title: string; topic: string | null; reality_lens: string | null; purpose_lane: string | null; body: string; created_at: string };
type SavedItem = { id: string; created_at: string; collection_id: string | null; private_note: string | null; private_note_updated_at: string | null; discussions: Discussion | null };
type Collection = { id: string; user_id: string; name: string; description: string | null; created_at: string; updated_at: string };
type SubscriptionStatus = { plan: SubscriptionPlanId; isAdmin: boolean } | null;
type SortMode = "newest" | "oldest" | "title";

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
function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [selectedFolder, setSelectedFolder] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [notesOnly, setNotesOnly] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const plan = subscriptionStatus?.plan ?? "free";
  const isAdmin = Boolean(subscriptionStatus?.isAdmin);
  const unlimitedOrganization = isAdmin || evaluateSubscriptionEntitlement(plan, "unlimited_organization").allowed;
  const canExport = isAdmin || evaluateSubscriptionEntitlement(plan, "saved_discussion_export").allowed;
  const canAdvancedExport = isAdmin || evaluateSubscriptionEntitlement(plan, "advanced_export_formats").allowed;
  const privateNoteCount = useMemo(() => saved.filter((item) => Boolean(item.private_note?.trim())).length, [saved]);
  const folderLimit = ORGANIZATION_LIMITS.free.folders;
  const noteLimit = ORGANIZATION_LIMITS.free.privateNotes;
  const saveLimit = ORGANIZATION_LIMITS.free.saves;
  const folderLimitReached = !unlimitedOrganization && collections.length >= folderLimit;

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return window.location.replace("/login?next=%2Fsaved");
      const accessToken = (await supabase.auth.getSession()).data.session?.access_token;
      if (!accessToken) return window.location.replace("/login?next=%2Fsaved");

      const [statusResponse, folderRows, bookmarkRows] = await Promise.all([
        fetch("/api/billing/subscription-status", { headers: { Authorization: `Bearer ${accessToken}` } }),
        supabase.from("bookmark_collections").select("id, user_id, name, description, created_at, updated_at").eq("user_id", user.id).order("created_at"),
        supabase.from("bookmarks").select("id, created_at, collection_id, private_note, private_note_updated_at, discussions(id, title, topic, reality_lens, purpose_lane, body, created_at)").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (!statusResponse.ok) throw new Error("Unable to verify subscription status.");
      const status = await statusResponse.json();
      if (!mounted) return;
      const normalized = (bookmarkRows.data ?? []).map((row: any) => ({ ...row, discussions: Array.isArray(row.discussions) ? row.discussions[0] ?? null : row.discussions })) as SavedItem[];
      setSubscriptionStatus({ plan: status.plan as SubscriptionPlanId, isAdmin: Boolean(status.isAdmin) });
      setCollections((folderRows.data ?? []) as Collection[]);
      setSaved(normalized);
      setNoteDrafts(Object.fromEntries(normalized.map((item) => [item.id, item.private_note ?? ""])));
      setLoading(false);
    }
    load().catch(() => { if (mounted) { setMessage("Unable to load your saved library."); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

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
    if (!name) return setMessage("Enter a folder name.");
    if (folderLimitReached) return setMessage(`Free Saved folders are limited to ${folderLimit}. Upgrade to Premium for unlimited folders.`);
    setBusyId("folder-create");
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks/collections", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ name }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok && result.collection) { setCollections((current) => [...current, result.collection]); setSelectedFolder(result.collection.id); setNewFolder(""); setMessage("Saved folder created."); }
    else setMessage(result?.error ?? "Unable to create folder.");
    setBusyId(null);
  }
  async function moveBookmark(bookmarkId: string, collectionId: string) {
    setBusyId(bookmarkId);
    const accessToken = await token();
    const next = collectionId === "unfiled" ? null : collectionId;
    const response = accessToken ? await fetch("/api/bookmarks/move", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId, collectionId: next }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok) { setSaved((current) => current.map((item) => item.id === bookmarkId ? { ...item, collection_id: next } : item)); setMessage("Saved discussion moved."); }
    else setMessage(result?.error ?? "Unable to move saved discussion.");
    setBusyId(null);
  }
  async function saveNote(bookmarkId: string) {
    const current = saved.find((item) => item.id === bookmarkId);
    const draft = (noteDrafts[bookmarkId] ?? "").trim();
    const isCreatingNote = Boolean(draft) && !Boolean(current?.private_note?.trim());
    if (!unlimitedOrganization && isCreatingNote && privateNoteCount >= noteLimit) return setMessage(`Free private notes are limited to ${noteLimit} saved discussions. Upgrade to Premium for unlimited private notes.`);
    setBusyId(bookmarkId);
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks/note", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId, note: draft }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok) { setSaved((items) => items.map((item) => item.id === bookmarkId ? { ...item, private_note: result.bookmark?.private_note ?? null, private_note_updated_at: result.bookmark?.private_note_updated_at ?? null } : item)); setMessage(draft ? "Private note saved." : "Private note cleared."); }
    else setMessage(result?.error ?? "Unable to save private note.");
    setBusyId(null);
  }
  async function removeBookmark(bookmarkId: string) {
    setBusyId(bookmarkId);
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ bookmarkId }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok) { setSaved((current) => current.filter((item) => item.id !== bookmarkId)); setMessage("Saved discussion removed."); }
    else setMessage(result?.error ?? "Unable to remove saved discussion.");
    setBusyId(null);
  }
  async function deleteFolder(collectionId: string) {
    setBusyId(collectionId);
    const accessToken = await token();
    const response = accessToken ? await fetch("/api/bookmarks/collections", { method: "DELETE", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ collectionId }) }) : null;
    const result = await response?.json().catch(() => ({}));
    if (response?.ok) { setCollections((current) => current.filter((folder) => folder.id !== collectionId)); setSaved((current) => current.map((item) => item.collection_id === collectionId ? { ...item, collection_id: null } : item)); if (selectedFolder === collectionId) setSelectedFolder("all"); setMessage("Folder deleted. Its discussions moved to Unfiled."); }
    else setMessage(result?.error ?? "Unable to delete folder.");
    setBusyId(null);
  }
  function exportLibrary(format: "markdown" | "json") {
    if (!canExport) return setMessage("Saved-discussion export is unavailable for this plan.");
    const items = saved.filter((item) => item.discussions).map((item) => ({ title: item.discussions!.title, topic: item.discussions!.topic, folder: item.collection_id ? folderNames[item.collection_id] : "Unfiled", note: noteDrafts[item.id] ?? "", url: `${window.location.origin}/discussions/${item.discussions!.id}` }));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    if (format === "json") downloadFile(`loombus-saved-${stamp}.json`, JSON.stringify({ exported_at: new Date().toISOString(), items }, null, 2), "application/json");
    else downloadFile(`loombus-saved-${stamp}.md`, ["# Loombus Saved Library", "", ...items.flatMap((item, index) => [`## ${index + 1}. ${item.title}`, "", `- Topic: ${item.topic ?? "Other"}`, `- Folder: ${item.folder}`, `- URL: ${item.url}`, "", item.note ? `Private note: ${item.note}` : "_No private note._", "", "---", ""])].join("\n"), "text/markdown");
    setMessage(`Saved library exported as ${format === "json" ? "JSON" : "Markdown"}.`);
  }
  function exportHtmlReport() {
    if (!canAdvancedExport) return setMessage("Advanced export formats require Premium Pro.");
    const exportedAt = new Date();
    const items = saved.filter((item) => item.discussions).map((item) => {
      const discussion = item.discussions!;
      return {
        title: normalizePublicText(discussion.title),
        topic: discussion.topic ?? "Other",
        realityLens: discussion.reality_lens ?? "",
        purposeLane: discussion.purpose_lane ?? "",
        folder: item.collection_id ? folderNames[item.collection_id] ?? "Folder" : "Unfiled",
        note: noteDrafts[item.id] ?? "",
        excerpt: excerpt(discussion.body),
        savedAt: new Date(item.created_at).toLocaleDateString(),
        url: `${window.location.origin}/discussions/${discussion.id}`,
      };
    });
    const withNotes = items.filter((item) => item.note.trim()).length;
    const folderTotal = new Set(items.map((item) => item.folder)).size;
    const cards = items.map((item, index) => {
      const metadata = [item.topic, item.realityLens, item.purposeLane].filter(Boolean).map((value) => `<span>${escapeHtml(value)}</span>`).join("");
      return `<article class="card"><div class="eyebrow">${escapeHtml(item.folder)} · Saved ${escapeHtml(item.savedAt)}</div><h2>${index + 1}. ${escapeHtml(item.title)}</h2><div class="meta">${metadata}</div>${item.excerpt ? `<p class="excerpt">${escapeHtml(item.excerpt)}</p>` : ""}<div class="note"><strong>Private note</strong><p>${item.note.trim() ? escapeHtml(item.note) : "No private note."}</p></div><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open discussion</a></article>`;
    }).join("");
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>Loombus Saved Library</title>
<style>
:root{color-scheme:light dark;--gold:#CBAB5B;--cream:#FEFBEC;--ink:#171717;--muted:#666;--surface:#fff;--border:#e5e1d4;--note:#f8f4e8}*{box-sizing:border-box}body{margin:0;background:#f6f4ef;color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{max-width:980px;margin:0 auto;padding:48px 24px 72px}.brand{color:var(--gold);font-size:12px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}h1{font-size:40px;line-height:1.1;margin:8px 0 12px}.sub{color:var(--muted);margin:0}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:28px 0}.stat,.card{background:var(--surface);border:1px solid var(--border);border-radius:18px}.stat{padding:18px}.stat strong{display:block;font-size:26px}.stat span{color:var(--muted);font-size:12px;font-weight:700;text-transform:uppercase}.card{padding:24px;margin:16px 0;break-inside:avoid}.eyebrow{color:var(--gold);font-size:12px;font-weight:800;text-transform:uppercase}.card h2{margin:8px 0 10px;font-size:22px;line-height:1.25}.meta{display:flex;flex-wrap:wrap;gap:8px}.meta span{border:1px solid var(--border);border-radius:999px;padding:4px 9px;font-size:12px}.excerpt{color:var(--muted)}.note{background:var(--note);border-radius:12px;padding:14px 16px;margin:16px 0}.note p{margin:6px 0 0;white-space:pre-wrap}.card a{color:var(--gold);font-weight:800;text-decoration:none}.footer{color:var(--muted);font-size:12px;margin-top:28px}@media(max-width:620px){h1{font-size:32px}.summary{grid-template-columns:1fr}}@media(prefers-color-scheme:dark){:root{--ink:#f5f1e6;--muted:#b7b1a5;--surface:#171717;--border:#34312b;--note:#211f1a}body{background:#0d0d0d}}@media print{body{background:#fff}.wrap{max-width:none;padding:20px}.card,.stat{box-shadow:none}.card a{color:#7d6528}}
</style>
</head>
<body><main class="wrap"><div class="brand">Loombus · Signal over noise</div><h1>Saved Library</h1><p class="sub">Premium Pro HTML report · Exported ${escapeHtml(exportedAt.toLocaleString())}</p><section class="summary"><div class="stat"><strong>${items.length}</strong><span>Saved discussions</span></div><div class="stat"><strong>${folderTotal}</strong><span>Folders represented</span></div><div class="stat"><strong>${withNotes}</strong><span>Private notes</span></div></section>${cards || '<article class="card"><h2>No saved discussions</h2><p class="sub">This library was empty when the report was exported.</p></article>'}<p class="footer">Generated locally from your Loombus Saved library. Private notes are included in this file.</p></main></body>
</html>`;
    const stamp = exportedAt.toISOString().replace(/[:.]/g, "-");
    downloadFile(`loombus-saved-report-${stamp}.html`, html, "text/html;charset=utf-8");
    setMessage("Saved library exported as a Premium Pro HTML report.");
  }

  if (loading) return <LoombusLoadingScreen title="Loading Saved..." message="Preparing your signal library." />;

  return <main className="min-h-screen bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.24em] text-[var(--loombus-gold)]">Personal signal library</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Saved discussions</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">Search, organize, annotate, and revisit the conversations worth keeping.</p>{!unlimitedOrganization && <p className="mt-2 text-xs font-bold text-[var(--loombus-text-subtle)]">Free organization: {saved.length}/{saveLimit} saves · {collections.length}/{folderLimit} folders · {privateNoteCount}/{noteLimit} private notes</p>}</div>
        <Link href="/discussions" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]"><Plus className="h-4 w-4" />Add more signal</Link>
      </header>

      {message && <p className="mt-5 rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_30%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] p-4 text-sm">{message}</p>}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[["Saved", saved.length, <Bookmark key="a" className="h-5 w-5" />], ["Folders", collections.length, <Folder key="b" className="h-5 w-5" />], ["With notes", privateNoteCount, <MessageSquareText key="c" className="h-5 w-5" />], ["Topics", topics.length, <Sparkles key="d" className="h-5 w-5" />]].map(([label, count, icon]) => <article key={String(label)} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">{icon}</span><strong className="text-2xl font-black">{count}</strong></div><p className="mt-4 text-sm font-bold text-[var(--loombus-text-muted)]">{label}</p></article>)}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside id="folders" className="scroll-mt-28 space-y-4">
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><h2 className="flex items-center gap-2 font-black"><Library className="h-5 w-5 text-[var(--loombus-gold)]" />Library views</h2><div className="mt-4 space-y-2">
            <button onClick={() => setSelectedFolder("all")} className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-bold ${selectedFolder === "all" ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "hover:bg-[var(--loombus-surface-muted)]"}`}><span>All saved</span><span>{folderCounts.all}</span></button>
            <button onClick={() => setSelectedFolder("unfiled")} className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-bold ${selectedFolder === "unfiled" ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "hover:bg-[var(--loombus-surface-muted)]"}`}><span>Unfiled</span><span>{folderCounts.unfiled}</span></button>
            {collections.map((folder) => <div key={folder.id} className="flex items-center gap-1"><button onClick={() => setSelectedFolder(folder.id)} className={`flex min-w-0 flex-1 items-center justify-between rounded-2xl px-3 py-3 text-left text-sm font-bold ${selectedFolder === folder.id ? "bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "hover:bg-[var(--loombus-surface-muted)]"}`}><span className="truncate">{folder.name}</span><span>{folderCounts[folder.id] ?? 0}</span></button><button aria-label={`Delete ${folder.name}`} onClick={() => deleteFolder(folder.id)} disabled={busyId === folder.id} className="rounded-xl p-2 text-[var(--loombus-text-subtle)] hover:text-red-400"><Trash2 className="h-4 w-4" /></button></div>)}
          </div></section>
          <form onSubmit={createFolder} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-black">Create folder</h2><span className="text-xs font-bold text-[var(--loombus-text-subtle)]">{unlimitedOrganization ? "Unlimited" : `${collections.length}/${folderLimit}`}</span></div><input value={newFolder} onChange={(event) => setNewFolder(event.target.value)} maxLength={60} placeholder="AI strategy" className="mt-3 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 outline-none focus:border-[var(--loombus-gold)]" /><button disabled={busyId === "folder-create" || folderLimitReached} className="mt-3 w-full rounded-2xl bg-[var(--loombus-gold)] px-4 py-3 text-sm font-black text-[var(--loombus-gold-contrast)] disabled:cursor-not-allowed disabled:opacity-50">{busyId === "folder-create" ? "Creating..." : folderLimitReached ? "Free folder limit reached" : "Create folder"}</button>{folderLimitReached && <Link href="/premium" className="mt-3 flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]">Upgrade for unlimited folders <ChevronRight className="h-3 w-3" /></Link>}</form>
        </aside>

        <section className="min-w-0">
          <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-xl shadow-black/10"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_auto]"><label className="relative"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--loombus-text-subtle)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, topics, notes, or folders" className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] py-3 pl-11 pr-4 outline-none focus:border-[var(--loombus-gold)]" /></label><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 outline-none"><option value="newest">Newest saved</option><option value="oldest">Oldest saved</option><option value="title">Title A–Z</option></select><button onClick={() => setNotesOnly((value) => !value)} className={`rounded-2xl border px-4 py-3 text-sm font-black ${notesOnly ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)]"}`}>Notes only</button></div><p className="mt-3 text-xs font-bold text-[var(--loombus-text-muted)]">Showing {visible.length} of {saved.length} saved discussions</p></div>

          <div className="mt-4 space-y-4">
            {visible.map((item) => { const discussion = item.discussions; if (!discussion) return null; const noteDraft = noteDrafts[item.id] ?? ""; const addingNewNoteAtLimit = !unlimitedOrganization && privateNoteCount >= noteLimit && !item.private_note?.trim() && Boolean(noteDraft.trim()); return <article key={item.id} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10 transition hover:border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))]"><Link href={`/discussions/${discussion.id}`}><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">{discussion.topic || "Discussion"}</span>{discussion.purpose_lane && <span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-bold">{discussion.purpose_lane}</span>}</div><h2 className="mt-4 text-xl font-black leading-tight sm:text-2xl">{normalizePublicText(discussion.title)}</h2><p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{excerpt(discussion.body)}</p><div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--loombus-border-muted)] pt-4 text-xs font-bold text-[var(--loombus-text-muted)]"><span>Saved {new Date(item.created_at).toLocaleDateString()}</span><span>{item.collection_id ? folderNames[item.collection_id] ?? "Folder" : "Unfiled"}</span><span className="ml-auto text-[var(--loombus-gold)]">Open discussion →</span></div></Link>
              <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><div className="flex items-center justify-between gap-2"><label className="text-sm font-black">Private note</label><span className="text-xs font-bold text-[var(--loombus-text-subtle)]">{unlimitedOrganization ? "Unlimited" : `${privateNoteCount}/${noteLimit} used`}</span></div><textarea value={noteDraft} onChange={(event) => setNoteDrafts((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Why is this worth keeping?" className="mt-3 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none focus:border-[var(--loombus-gold)]" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-[var(--loombus-text-subtle)]">{noteDraft.length}/1000{addingNewNoteAtLimit ? " · Free note limit reached" : ""}</span><button onClick={() => saveNote(item.id)} disabled={busyId === item.id || addingNewNoteAtLimit} className="rounded-xl bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-[var(--loombus-gold-contrast)] disabled:cursor-not-allowed disabled:opacity-50">Save note</button></div></div>
              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--loombus-border-muted)] pt-4 sm:flex-row sm:items-center sm:justify-between"><select value={item.collection_id ?? "unfiled"} onChange={(event) => moveBookmark(item.id, event.target.value)} disabled={busyId === item.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-sm outline-none"><option value="unfiled">Unfiled</option>{collections.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select><button onClick={() => removeBookmark(item.id)} disabled={busyId === item.id} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black text-[var(--loombus-text-muted)] hover:text-red-400"><Trash2 className="h-4 w-4" />Remove</button></div>
            </article>; })}
            {visible.length === 0 && <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center"><Bookmark className="mx-auto h-9 w-9 text-[var(--loombus-gold)]" /><h2 className="mt-4 text-xl font-black">No saved discussions found.</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Clear the current filters or browse discussions to add more signal.</p><div className="mt-5 flex justify-center gap-3"><button onClick={() => { setQuery(""); setSelectedFolder("all"); setNotesOnly(false); }} className="rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black">Clear filters</button><Link href="/discussions" className="rounded-2xl bg-[var(--loombus-gold)] px-4 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]">Browse discussions</Link></div></div>}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Sparkles className="h-5 w-5 text-[var(--loombus-gold)]" />Strongest topics</h2><div className="mt-4 space-y-3">{topics.map(([topic, count], index) => <button key={topic} onClick={() => setQuery(topic)} className="flex w-full items-center gap-3 text-left text-sm"><strong className="w-5 text-[var(--loombus-gold)]">{index + 1}</strong><span className="min-w-0 flex-1 truncate font-bold">{topic}</span><span className="text-xs text-[var(--loombus-text-subtle)]">{count}</span></button>)}</div></section>
          {canExport ? <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Download className="h-5 w-5 text-[var(--loombus-gold)]" />Export library</h2><p className="mt-3 text-sm leading-6 text-[var(--loombus-text-muted)]">Download saved discussions, folders, links, and private notes.</p><div className="mt-4 grid gap-2"><button onClick={() => exportLibrary("markdown")} className="rounded-2xl bg-[var(--loombus-gold)] px-4 py-3 text-sm font-black text-[var(--loombus-gold-contrast)]">Export Markdown</button><button onClick={() => exportLibrary("json")} className="rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black">Export JSON</button></div><div className="mt-5 border-t border-[var(--loombus-border-muted)] pt-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--loombus-text-subtle)]">Advanced format</p><span className="rounded-full bg-[var(--loombus-gold-surface)] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[var(--loombus-gold)]">Premium Pro</span></div><p className="mt-3 text-xs leading-5 text-[var(--loombus-text-muted)]">Create a styled, self-contained HTML report with excerpts and Saved metadata.</p>{canAdvancedExport ? <button onClick={exportHtmlReport} className="mt-3 w-full rounded-2xl border border-[var(--loombus-gold)] px-4 py-3 text-sm font-black text-[var(--loombus-gold)]">Export HTML report</button> : <Link href="/premium" className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black">Unlock HTML report <ChevronRight className="h-4 w-4 text-[var(--loombus-gold)]" /></Link>}</div></section> : <Link href="/premium" className="block rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><Download className="h-6 w-6 text-[var(--loombus-gold)]" /><h2 className="mt-4 font-black">Export unavailable</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">This plan does not include Saved-discussion export.</p><ChevronRight className="mt-3 h-4 w-4 text-[var(--loombus-gold)]" /></Link>}
        </aside>
      </section>
    </div>
  </main>;
}
