"use client";

import Link from "next/link";
import { type DragEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Bookmark,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Pin,
  Search,
  Sparkles,
  StickyNote,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../v2/v2-shell-components";

type StickyItem = {
  id: string;
  item_type: string;
  source_key: string;
  title: string;
  subtitle: string | null;
  href: string;
  position: number;
  created_at: string;
};

type StickyFilter = "all" | "pinned" | "archived" | "discussion";

const PINNED_STORAGE_KEY = "loombus:stickies:pinned";
const ARCHIVED_STORAGE_KEY = "loombus:stickies:archived";

function readStoredIds(key: string) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function writeStoredIds(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(ids));
}

export default function StickiesPage() {
  const [items, setItems] = useState<StickyItem[]>([]);
  const [discussionInput, setDiscussionInput] = useState("");
  const [draggedStickyId, setDraggedStickyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<StickyFilter>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");

  useEffect(() => {
    setPinnedIds(readStoredIds(PINNED_STORAGE_KEY));
    setArchivedIds(readStoredIds(ARCHIVED_STORAGE_KEY));
  }, []);

  const visibleItems = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    return [...items]
      .sort((a, b) => {
        const aPinned = pinnedIds.includes(a.id) ? 1 : 0;
        const bPinned = pinnedIds.includes(b.id) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return a.position - b.position;
      })
      .filter((item) => {
        const isPinned = pinnedIds.includes(item.id);
        const isArchived = archivedIds.includes(item.id);
        const searchable = `${item.title} ${item.subtitle ?? ""} ${item.item_type}`.toLowerCase();
        const matchesQuery = !cleanQuery || searchable.includes(cleanQuery);
        const matchesFilter =
          activeFilter === "all"
            ? !isArchived
            : activeFilter === "pinned"
              ? isPinned && !isArchived
              : activeFilter === "archived"
                ? isArchived
                : item.item_type === "discussion" && !isArchived;

        return matchesQuery && matchesFilter;
      });
  }, [activeFilter, archivedIds, items, pinnedIds, searchQuery]);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadStickies() {
    setLoading(true);
    setMessage("");

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setIsLoggedIn(false);
      setUpgradeRequired(false);
      setItems([]);
      setLoading(false);
      return;
    }

    setIsLoggedIn(true);

    const response = await fetch("/api/stickies", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setItems([]);
      setMessage(result.error ?? "Unable to load Stickies.");
      setLoading(false);
      return;
    }

    setUpgradeRequired(false);
    setItems(result.stickies ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadStickies();
  }, []);

  function clearFilters() {
    setSearchQuery("");
    setActiveFilter("all");
    setOpenMenuId(null);
  }

  function togglePinned(stickyId: string) {
    setPinnedIds((current) => {
      const next = current.includes(stickyId) ? current.filter((id) => id !== stickyId) : [stickyId, ...current];
      writeStoredIds(PINNED_STORAGE_KEY, next);
      return next;
    });
    setOpenMenuId(null);
    setMessage(pinnedIds.includes(stickyId) ? "Sticky unpinned." : "Sticky pinned.");
  }

  function toggleArchived(stickyId: string) {
    setArchivedIds((current) => {
      const next = current.includes(stickyId) ? current.filter((id) => id !== stickyId) : [stickyId, ...current];
      writeStoredIds(ARCHIVED_STORAGE_KEY, next);
      return next;
    });
    setOpenMenuId(null);
    setMessage(archivedIds.includes(stickyId) ? "Sticky restored from archive." : "Sticky archived.");
  }

  function beginEdit(item: StickyItem) {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditSubtitle(item.subtitle ?? "");
    setOpenMenuId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditSubtitle("");
  }

  async function saveStickyEdit(stickyId: string) {
    const cleanTitle = editTitle.trim();
    const cleanSubtitle = editSubtitle.trim();

    if (!cleanTitle) {
      setMessage("Sticky title is required.");
      return;
    }

    setWorking(true);
    setMessage("");

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setWorking(false);
      setIsLoggedIn(false);
      return;
    }

    const response = await fetch("/api/stickies", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ stickyId, title: cleanTitle, subtitle: cleanSubtitle }),
    });

    const result = await response.json().catch(() => ({}));
    setWorking(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to edit sticky.");
      return;
    }

    const nextSticky = result.sticky as StickyItem | undefined;
    setItems((current) => current.map((item) => (item.id === stickyId && nextSticky ? nextSticky : item)));
    cancelEdit();
    setMessage("Sticky updated.");
  }

  async function addDiscussionSticky(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (working) return;

    const cleanInput = discussionInput.trim();

    if (!cleanInput) {
      setMessage("Paste a discussion link or discussion ID.");
      return;
    }

    setWorking(true);
    setMessage("");

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setWorking(false);
      setIsLoggedIn(false);
      return;
    }

    const response = await fetch("/api/stickies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        discussionUrl: cleanInput,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to add discussion to Stickies.");
      return;
    }

    setDiscussionInput("");
    setMessage("Discussion added to Stickies.");

    await loadStickies();
  }

  async function persistStickyOrder(nextItems: StickyItem[], fallbackItems: StickyItem[]) {
    setItems(nextItems);
    setWorking(true);
    setMessage("");

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setItems(fallbackItems);
      setWorking(false);
      setIsLoggedIn(false);
      return;
    }

    const response = await fetch("/api/stickies", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        orderedIds: nextItems.map((item) => item.id),
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      setItems(fallbackItems);
      setMessage(result.error ?? "Unable to reorder stickies.");
      return;
    }

    setMessage("Stickies reordered.");
  }

  function handleStickyDragStart(stickyId: string) {
    if (working) return;
    setDraggedStickyId(stickyId);
  }

  function handleStickyDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  async function handleStickyDrop(targetStickyId: string) {
    if (!draggedStickyId || draggedStickyId === targetStickyId || working) {
      setDraggedStickyId(null);
      return;
    }

    const fromIndex = items.findIndex((item) => item.id === draggedStickyId);
    const toIndex = items.findIndex((item) => item.id === targetStickyId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedStickyId(null);
      return;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);

    const fallbackItems = items;
    setDraggedStickyId(null);

    await persistStickyOrder(nextItems, fallbackItems);
  }

  async function moveSticky(stickyId: string, direction: "up" | "down") {
    if (working) return;

    const currentIndex = items.findIndex((item) => item.id === stickyId);
    if (currentIndex === -1) return;

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);

    await persistStickyOrder(nextItems, items);
  }

  async function removeSticky(stickyId: string) {
    if (working) return;

    setWorking(true);
    setMessage("");

    const accessToken = await getAccessToken();

    if (!accessToken) {
      setWorking(false);
      setIsLoggedIn(false);
      return;
    }

    const response = await fetch("/api/stickies", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        stickyId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to remove sticky.");
      return;
    }

    setItems((current) => current.filter((item) => item.id !== stickyId));
    setPinnedIds((current) => {
      const next = current.filter((id) => id !== stickyId);
      writeStoredIds(PINNED_STORAGE_KEY, next);
      return next;
    });
    setArchivedIds((current) => {
      const next = current.filter((id) => id !== stickyId);
      writeStoredIds(ARCHIVED_STORAGE_KEY, next);
      return next;
    });
    setMessage("Sticky removed.");
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/discussions" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
            <ArrowLeft className="size-4" />
            Back to discussions
          </Link>
          <button type="button" onClick={clearFilters} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">
            View All
          </button>
        </div>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 bg-gradient-to-br from-slate-950 via-slate-900 to-amber-800 p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Premium Workspace</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Stickies</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">
                Stickies are your personal board for discussion cards you want visible right now. Saved is your library. Stickies are your working surface.
              </p>
            </div>
            <div className="rounded-[1.5rem] bg-white/10 p-5 ring-1 ring-white/15">
              <div className="flex items-center gap-3">
                <StickyNote className="size-6 text-amber-200" />
                <h2 className="text-lg font-black text-white">Working board</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-50/90">
                Pin active discussions, search your board, archive cards you do not need right now, and open the original source discussion.
              </p>
            </div>
          </div>
        </section>

        {loading && <p className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">Loading Stickies...</p>}

        {!loading && !isLoggedIn && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Log in to use Stickies.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Stickies are tied to your account.</p>
            <Link href="/login" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">Log In</Link>
          </section>
        )}

        {!loading && isLoggedIn && upgradeRequired && (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Premium Required</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Stickies are a Premium workspace feature.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">Free users can keep using Saved. Premium users can pin active discussion cards to a focused workspace board.</p>
            <Link href="/premium" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">View Premium</Link>
          </section>
        )}

        {!loading && isLoggedIn && !upgradeRequired && (
          <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <form onSubmit={addDiscussionSticky} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <label className="block text-sm font-black uppercase tracking-[0.16em] text-slate-500">Add discussion card</label>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    value={discussionInput}
                    onChange={(event) => setDiscussionInput(event.target.value)}
                    placeholder="Paste a discussion link or discussion ID"
                    className="min-h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-300 focus:ring-4 focus:ring-amber-100"
                  />
                  <button type="submit" disabled={working || !discussionInput.trim()} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                    {working ? "Adding..." : "Add to Stickies"}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">Stickies v1 supports discussion cards only. Notes, topics, people, and AI cards are reserved for a later version.</p>
              </form>

              <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-500">
                    <Search className="size-4 shrink-0" />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search stickies" className="min-w-0 flex-1 bg-transparent text-slate-950 outline-none placeholder:text-slate-400" />
                  </label>
                  <button type="button" onClick={clearFilters} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                    View All
                  </button>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {([
                    ["all", "All"],
                    ["pinned", "Pinned"],
                    ["archived", "Archived"],
                    ["discussion", "Discussions"],
                  ] as Array<[StickyFilter, string]>).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setActiveFilter(filter)}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${activeFilter === filter ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:text-amber-800"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {message && <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm">{message}</p>}

              {items.length === 0 ? (
                <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                  <StickyNote className="mx-auto size-9 text-amber-700" />
                  <h2 className="mt-3 text-xl font-black text-slate-950">Your board is empty.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Add a discussion card to start building your visible workspace.</p>
                </section>
              ) : visibleItems.length === 0 ? (
                <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                  <Search className="mx-auto size-9 text-amber-700" />
                  <h2 className="mt-3 text-xl font-black text-slate-950">No stickies match this view.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Clear the search or select View All to return to your board.</p>
                  <button type="button" onClick={clearFilters} className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">View All</button>
                </section>
              ) : (
                <section className="mt-5 grid gap-4">
                  {visibleItems.map((item, index) => {
                    const isPinned = pinnedIds.includes(item.id);
                    const isArchived = archivedIds.includes(item.id);
                    const isEditing = editingId === item.id;

                    return (
                      <article
                        key={item.id}
                        onDragOver={handleStickyDragOver}
                        onDrop={() => handleStickyDrop(item.id)}
                        className={`relative rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition ${draggedStickyId === item.id ? "opacity-60 ring-2 ring-amber-300" : ""}`}
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Discussion</p>
                            {isPinned && <p className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-800 ring-1 ring-amber-200">Pinned</p>}
                            {isArchived && <p className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 ring-1 ring-slate-200">Archived</p>}
                          </div>

                          <div className="flex shrink-0 flex-wrap justify-end gap-2">
                            <span
                              draggable={!working}
                              onDragStart={() => handleStickyDragStart(item.id)}
                              onDragEnd={() => setDraggedStickyId(null)}
                              className="inline-flex cursor-grab items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-amber-300 hover:text-amber-800 active:cursor-grabbing"
                              title="Drag to reorder"
                            >
                              <GripVertical className="size-3" />
                              Drag
                            </span>
                            <button type="button" onClick={() => moveSticky(item.id, "up")} disabled={working || index === 0} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40">Up</button>
                            <button type="button" onClick={() => moveSticky(item.id, "down")} disabled={working || index === visibleItems.length - 1} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40">Down</button>
                            <div className="relative">
                              <button type="button" onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)} className="grid size-8 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-amber-300 hover:text-amber-800" aria-label="Open sticky actions" aria-expanded={openMenuId === item.id}>
                                <MoreHorizontal className="size-4" />
                              </button>
                              {openMenuId === item.id && (
                                <div className="absolute right-0 top-10 z-20 w-48 rounded-2xl border border-slate-200 bg-white p-2 text-sm font-bold text-slate-700 shadow-2xl">
                                  <button type="button" onClick={() => beginEdit(item)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"><Pencil className="size-4" /> Edit</button>
                                  <button type="button" onClick={() => togglePinned(item.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"><Pin className="size-4" /> {isPinned ? "Unpin" : "Pin"}</button>
                                  <button type="button" onClick={() => toggleArchived(item.id)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"><Archive className="size-4" /> {isArchived ? "Restore" : "Archive"}</button>
                                  <Link href={item.href} onClick={() => setOpenMenuId(null)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-50"><ExternalLink className="size-4" /> Open source</Link>
                                  <button type="button" onClick={clearFilters} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-slate-50"><X className="size-4" /> View all</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <label className="block text-xs font-black uppercase tracking-[0.16em] text-amber-800">Edit sticky</label>
                            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className="mt-3 w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-black text-slate-950 outline-none focus:ring-4 focus:ring-amber-100" />
                            <textarea value={editSubtitle} onChange={(event) => setEditSubtitle(event.target.value)} rows={3} className="mt-3 w-full resize-none rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none focus:ring-4 focus:ring-amber-100" />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button type="button" onClick={() => saveStickyEdit(item.id)} disabled={working} className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Save edit</button>
                              <button type="button" onClick={cancelEdit} disabled={working} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <Link href={item.href} className="block rounded-2xl transition hover:opacity-90">
                            <h2 className="text-xl font-black leading-snug tracking-tight text-slate-950">{item.title}</h2>
                            {item.subtitle && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.subtitle}</p>}
                            <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-amber-700">Open discussion →</p>
                          </Link>
                        )}
                      </article>
                    );
                  })}
                </section>
              )}
            </div>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Stickies vs Saved</h2>
                  <Bookmark className="size-4 text-amber-700" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">Saved is your long-term library. Stickies is the focused board for what you want visible and active right now.</p>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Current support</h2>
                  <Sparkles className="size-4 text-amber-700" />
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
                  <li>Discussion cards</li>
                  <li>Search and filters</li>
                  <li>Edit card title/subtitle</li>
                  <li>Pin and archive</li>
                  <li>Open source discussion</li>
                </ul>
              </section>
            </aside>
          </section>
        )}
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
