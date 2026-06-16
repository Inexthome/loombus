"use client";

import Link from "next/link";
import { type DragEvent, type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

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

    if (working) {
      return;
    }

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
    if (working) {
      return;
    }

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
    if (working) {
      return;
    }

    const currentIndex = items.findIndex((item) => item.id === stickyId);

    if (currentIndex === -1) {
      return;
    }

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (nextIndex < 0 || nextIndex >= items.length) {
      return;
    }

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);

    await persistStickyOrder(nextItems, items);
  }

  async function removeSticky(stickyId: string) {
    if (working) {
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
    <main className="min-h-screen bg-[var(--loombus-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:py-12">
      <div className="mx-auto max-w-[46rem]">
        <Link
          href="/discussions"
          className="mb-3 inline-block text-sm text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)] sm:mb-10"
        >
          ← Back to discussions
        </Link>

        <section className="mb-6 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl shadow-black/10 sm:p-7">
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-[var(--loombus-text-subtle)]">
            Premium Workspace
          </p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Stickies
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--loombus-text-muted)] sm:text-base">
            Stickies are your personal board for discussion cards you want visible right now. Saved is your library. Stickies are your working surface.
          </p>
        </section>

        {loading && (
          <p className="text-sm leading-relaxed text-[var(--loombus-text-muted)]">
            Loading Stickies...
          </p>
        )}

        {!loading && !isLoggedIn && (
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <h2 className="text-xl font-semibold">
              Log in to use Stickies.
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
              Stickies are tied to your account.
            </p>

            <Link
              href="/login"
              className="mt-5 inline-flex rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90"
            >
              Log In
            </Link>
          </section>
        )}

        {!loading && isLoggedIn && upgradeRequired && (
          <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
              Premium Required
            </p>

            <h2 className="text-xl font-semibold">
              Stickies are a Premium workspace feature.
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
              Free users can keep using Saved. Premium users can pin active discussion cards to a focused workspace board.
            </p>

            <Link
              href="/premium"
              className="mt-5 inline-flex rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90"
            >
              View Premium
            </Link>
          </section>
        )}

        {!loading && isLoggedIn && !upgradeRequired && (
          <>
            <form
              onSubmit={addDiscussionSticky}
              className="mb-5 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-2xl shadow-black/10 sm:p-5"
            >
              <label className="mb-3 block text-sm font-medium text-[var(--loombus-text)]">
                Add discussion card
              </label>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={discussionInput}
                  onChange={(event) => setDiscussionInput(event.target.value)}
                  placeholder="Paste a discussion link or discussion ID"
                  className="min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-base text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-text-subtle)]"
                />

                <button
                  type="submit"
                  disabled={working || !discussionInput.trim()}
                  className="w-full rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                >
                  {working ? "Adding..." : "Add to Stickies"}
                </button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[var(--loombus-text-subtle)]">
                Stickies v1 supports discussion cards only. Notes, topics, people, and AI cards are reserved for a later version.
              </p>
            </form>

            {message && (
              <p className="mb-4 text-sm text-[var(--loombus-text-muted)]">
                {message}
              </p>
            )}

            {items.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-center">
                <h2 className="text-xl font-semibold">
                  Your board is empty.
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                  Add a discussion card to start building your visible workspace.
                </p>
              </section>
            ) : (
              <section className="grid gap-4">
                {items.map((item, index) => (
                  <article
                    key={item.id}
                    onDragOver={handleStickyDragOver}
                    onDrop={() => handleStickyDrop(item.id)}
                    className={`rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl shadow-black/10 transition ${
                      draggedStickyId === item.id ? "opacity-60 ring-1 ring-[var(--loombus-text-subtle)]" : ""
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[var(--loombus-text-muted)]">
                        Discussion
                      </p>

                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <span
                          draggable={!working}
                          onDragStart={() => handleStickyDragStart(item.id)}
                          onDragEnd={() => setDraggedStickyId(null)}
                          className="cursor-grab rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] active:cursor-grabbing"
                          title="Drag to reorder"
                        >
                          Drag
                        </span>

                        <button
                          type="button"
                          onClick={() => moveSticky(item.id, "up")}
                          disabled={working || index === 0}
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Up
                        </button>

                        <button
                          type="button"
                          onClick={() => moveSticky(item.id, "down")}
                          disabled={working || index === items.length - 1}
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Down
                        </button>

                        <button
                          type="button"
                          onClick={() => removeSticky(item.id)}
                          disabled={working}
                          className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <Link href={item.href} className="block rounded-2xl transition hover:opacity-90">
                      <h2 className="text-xl font-semibold leading-snug tracking-tight">
                        {item.title}
                      </h2>

                      {item.subtitle && (
                        <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                          {item.subtitle}
                        </p>
                      )}

                      <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">
                        Open discussion →
                      </p>
                    </Link>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
