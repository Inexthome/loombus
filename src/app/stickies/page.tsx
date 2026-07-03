"use client";

import Link from "next/link";
import { type DragEvent, type FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Bookmark, GripVertical, Sparkles, StickyNote } from "lucide-react";
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

export default function StickiesPage() {
  const [items, setItems] = useState<StickyItem[]>([]);
  const [discussionInput, setDiscussionInput] = useState("");
  const [draggedStickyId, setDraggedStickyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
    setMessage("Sticky removed.");
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href="/discussions" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" />
          Back to discussions
        </Link>

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
                Pin active discussions, reorder them, and keep your current focus separate from your long-term saved library.
              </p>
            </div>
          </div>
        </section>

        {loading && (
          <p className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-600 shadow-sm">
            Loading Stickies...
          </p>
        )}

        {!loading && !isLoggedIn && (
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Log in to use Stickies.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Stickies are tied to your account.</p>
            <Link href="/login" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">
              Log In
            </Link>
          </section>
        )}

        {!loading && isLoggedIn && upgradeRequired && (
          <section className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Premium Required</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Stickies are a Premium workspace feature.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              Free users can keep using Saved. Premium users can pin active discussion cards to a focused workspace board.
            </p>
            <Link href="/premium" className="mt-5 inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800">
              View Premium
            </Link>
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
                  <button
                    type="submit"
                    disabled={working || !discussionInput.trim()}
                    className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Adding..." : "Add to Stickies"}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Stickies v1 supports discussion cards only. Notes, topics, people, and AI cards are reserved for a later version.
                </p>
              </form>

              {message && <p className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm">{message}</p>}

              {items.length === 0 ? (
                <section className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                  <StickyNote className="mx-auto size-9 text-amber-700" />
                  <h2 className="mt-3 text-xl font-black text-slate-950">Your board is empty.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Add a discussion card to start building your visible workspace.</p>
                </section>
              ) : (
                <section className="mt-5 grid gap-4">
                  {items.map((item, index) => (
                    <article
                      key={item.id}
                      onDragOver={handleStickyDragOver}
                      onDrop={() => handleStickyDrop(item.id)}
                      className={`rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition ${
                        draggedStickyId === item.id ? "opacity-60 ring-2 ring-amber-300" : ""
                      }`}
                    >
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Discussion
                        </p>

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

                          <button
                            type="button"
                            onClick={() => moveSticky(item.id, "up")}
                            disabled={working || index === 0}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Up
                          </button>

                          <button
                            type="button"
                            onClick={() => moveSticky(item.id, "down")}
                            disabled={working || index === items.length - 1}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-amber-300 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Down
                          </button>

                          <button
                            type="button"
                            onClick={() => removeSticky(item.id)}
                            disabled={working}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 transition hover:border-red-200 hover:text-red-700 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      <Link href={item.href} className="block rounded-2xl transition hover:opacity-90">
                        <h2 className="text-xl font-black leading-snug tracking-tight text-slate-950">{item.title}</h2>
                        {item.subtitle && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-slate-600">{item.subtitle}</p>}
                        <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-amber-700">Open discussion →</p>
                      </Link>
                    </article>
                  ))}
                </section>
              )}
            </div>

            <aside className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Stickies vs Saved</h2>
                  <Bookmark className="size-4 text-amber-700" />
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Saved is your long-term library. Stickies is the focused board for what you want visible and active right now.
                </p>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Current support</h2>
                  <Sparkles className="size-4 text-amber-700" />
                </div>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-600">
                  <li>Discussion cards</li>
                  <li>Drag reorder</li>
                  <li>Up / Down controls</li>
                  <li>Remove from board</li>
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
