"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
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
  const [topicInput, setTopicInput] = useState("");
  const [personInput, setPersonInput] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
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
        discussionUrl: discussionInput,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to add sticky.");
      return;
    }

    setDiscussionInput("");
    setMessage("Added to Stickies.");

    await loadStickies();
  }

  async function addTopicSticky(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        itemType: "topic",
        topic: topicInput,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to add topic.");
      return;
    }

    setTopicInput("");
    setMessage("Topic added to Stickies.");

    await loadStickies();
  }

  async function addPersonSticky(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        itemType: "person",
        username: personInput,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to add person.");
      return;
    }

    setPersonInput("");
    setMessage("Person added to Stickies.");

    await loadStickies();
  }

  async function addNoteSticky(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        itemType: "note",
        title: noteTitle,
        note: noteBody,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to add note.");
      return;
    }

    setNoteTitle("");
    setNoteBody("");
    setMessage("Note added to Stickies.");

    await loadStickies();
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

    setItems(nextItems);
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
      body: JSON.stringify({
        orderedIds: nextItems.map((item) => item.id),
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      setItems(items);
      setMessage(result.error ?? "Unable to reorder stickies.");
      return;
    }

    setMessage("Stickies reordered.");
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
    <main className="min-h-screen bg-black px-4 pb-24 pt-4 text-white sm:px-6 sm:py-10 lg:py-12 loombus-shell-with-right-rail">
      <div className="mx-auto max-w-[46rem]">
        <Link
          href="/discussions"
          className="mb-3 inline-block text-sm text-zinc-500 hover:text-white sm:mb-10"
        >
          ← Back to discussions
        </Link>

        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20 sm:p-7">
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
            Premium Workspace
          </p>

          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Stickies
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
            Stickies are your personal workspace for pinning Loombus cards you want visible right now. Saved is your library. Stickies are your board.
          </p>
        </section>

        {!loading && !isLoggedIn && (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <h2 className="text-xl font-semibold">
              Log in to use Stickies.
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Stickies are tied to your account.
            </p>

            <Link
              href="/login"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Log In
            </Link>
          </section>
        )}

        {!loading && isLoggedIn && upgradeRequired && (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-600">
              Premium Required
            </p>

            <h2 className="text-xl font-semibold">
              Stickies are a Premium workspace feature.
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              Free users can keep using Saved. Premium users can build a visible workspace board from Loombus cards.
            </p>

            <Link
              href="/premium"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              View Premium
            </Link>
          </section>
        )}

        {!loading && isLoggedIn && !upgradeRequired && (
          <>
            <form
              onSubmit={addDiscussionSticky}
              className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
            >
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Add discussion to Stickies
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={discussionInput}
                  onChange={(event) => setDiscussionInput(event.target.value)}
                  placeholder="Paste discussion link or ID"
                  className="min-h-12 flex-1 rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                />

                <button
                  type="submit"
                  disabled={working || !discussionInput.trim()}
                  className="rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Adding..." : "Add"}
                </button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                V1 supports discussion cards. More card types can come later.
              </p>
            </form>

            <div className="mb-5 grid gap-4 md:grid-cols-2">
              <form
                onSubmit={addTopicSticky}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
              >
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Add topic card
                </label>

                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={topicInput}
                    onChange={(event) => setTopicInput(event.target.value)}
                    placeholder="Topic name"
                    className="min-h-12 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                  />

                  <button
                    type="submit"
                    disabled={working || !topicInput.trim()}
                    className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Adding..." : "Add Topic"}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  Topic cards open the matching discussion lane.
                </p>
              </form>

              <form
                onSubmit={addPersonSticky}
                className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
              >
                <label className="mb-2 block text-sm font-medium text-zinc-300">
                  Add person card
                </label>

                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={personInput}
                    onChange={(event) => setPersonInput(event.target.value)}
                    placeholder="@username"
                    className="min-h-12 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                  />

                  <button
                    type="submit"
                    disabled={working || !personInput.trim()}
                    className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {working ? "Adding..." : "Add Person"}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  Person cards link to public profile pages.
                </p>
              </form>
            </div>

            <form
              onSubmit={addNoteSticky}
              className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/20 sm:p-5"
            >
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Add custom note
              </label>

              <div className="space-y-3">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(event) => setNoteTitle(event.target.value)}
                  placeholder="Note title"
                  className="min-h-12 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                />

                <textarea
                  value={noteBody}
                  onChange={(event) => setNoteBody(event.target.value)}
                  placeholder="Write a short note for your workspace..."
                  rows={4}
                  className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-base text-white outline-none transition placeholder:text-zinc-700 focus:border-zinc-500"
                />

                <button
                  type="submit"
                  disabled={working || (!noteTitle.trim() && !noteBody.trim())}
                  className="rounded-full border border-zinc-700 px-5 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Adding..." : "Add Note"}
                </button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                Notes are private workspace stickies and are separate from Saved notes.
              </p>
            </form>

            {message && (
              <p className="mb-4 text-sm text-zinc-500">
                {message}
              </p>
            )}

            {items.length === 0 ? (
              <section className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/60 p-6 text-center">
                <h2 className="text-xl font-semibold">
                  Your board is empty.
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                  Add a discussion card to start building your visible workspace.
                </p>
              </section>
            ) : (
              <section className="grid gap-4">
                {items.map((item, index) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/20"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="rounded-full border border-zinc-800 bg-black px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                        {item.item_type === "note"
                          ? "Note"
                          : item.item_type === "person"
                            ? "Person"
                            : item.item_type === "topic"
                              ? "Topic"
                              : item.item_type}
                      </p>

                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => moveSticky(item.id, "up")}
                          disabled={working || index === 0}
                          className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Up
                        </button>

                        <button
                          type="button"
                          onClick={() => moveSticky(item.id, "down")}
                          disabled={working || index === items.length - 1}
                          className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Down
                        </button>

                        <button
                          type="button"
                          onClick={() => removeSticky(item.id)}
                          disabled={working}
                          className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {item.item_type === "note" ? (
                      <div>
                        <h2 className="text-xl font-semibold tracking-tight text-white">
                          {item.title}
                        </h2>

                        {item.subtitle && (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-500">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Link href={item.href} className="block">
                        <h2 className="text-xl font-semibold tracking-tight text-white transition hover:text-zinc-300">
                          {item.title}
                        </h2>

                        {item.subtitle && (
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-zinc-500">
                            {item.subtitle}
                          </p>
                        )}
                      </Link>
                    )}
                  </article>
                ))}
              </section>
            )}
          </>
        )}

        {loading && (
          <p className="text-sm text-zinc-500">
            Loading Stickies...
          </p>
        )}
      </div>
    </main>
  );
}
