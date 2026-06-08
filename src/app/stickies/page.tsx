"use client";

import Link from "next/link";
import { type DragEvent, type FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";

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

function getStickyTypeLabel(type: string) {
  if (type === "note") return "Note";
  if (type === "person") return "Person";
  if (type === "topic") return "Topic";
  if (type === "saved") return "Saved";
  if (type === "ai_summary") return "AI";
  if (type === "discussion") return "Discussion";

  return type;
}

function looksLikeAiRequest(value: string) {
  const lower = value.toLowerCase();

  return [
    "help me",
    "create a",
    "make a",
    "generate",
    "summarize",
    "organize",
    "brainstorm",
    "plan",
    "turn this into",
    "what should i",
    "how should i",
    "give me",
    "ideas for",
    "next steps",
    "workspace card",
  ].some((phrase) => lower.includes(phrase));
}

function getSmartAddPayload(input: string) {
  const clean = input.trim();

  if (!clean) {
    return null;
  }

  const lower = clean.toLowerCase();
  const uuidMatch = clean.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );

  if (uuidMatch || lower.includes("/discussions/")) {
    return {
      body: {
        discussionUrl: clean,
      },
      label: "Discussion",
      buttonLabel: "Add Discussion",
    };
  }

  if (lower.startsWith("ai:")) {
    return {
      body: {
        itemType: "ai_summary",
        prompt: clean.slice(3).trim(),
      },
      label: "AI workspace card",
      buttonLabel: "Generate AI Card",
    };
  }

  if (lower.startsWith("note:")) {
    const note = clean.slice(5).trim();
    const firstLine = note.split("\n")[0]?.trim() ?? "";

    return {
      body: {
        itemType: "note",
        title: firstLine.slice(0, 80) || "Untitled note",
        note,
      },
      label: "Note",
      buttonLabel: "Add Note",
    };
  }

  if (lower.startsWith("topic:")) {
    return {
      body: {
        itemType: "topic",
        topic: clean.slice(6).trim(),
      },
      label: "Topic",
      buttonLabel: "Add Topic",
    };
  }

  if (lower.startsWith("person:")) {
    return {
      body: {
        itemType: "person",
        username: clean.slice(7).trim(),
      },
      label: "Person",
      buttonLabel: "Add Person",
    };
  }

  if (clean.startsWith("@")) {
    return {
      body: {
        itemType: "person",
        username: clean,
      },
      label: "Person",
      buttonLabel: "Add Person",
    };
  }

  const matchedTopic = DISCUSSION_TOPICS.find(
    (topic) => topic.toLowerCase() === lower
  );

  if (matchedTopic) {
    return {
      body: {
        itemType: "topic",
        topic: matchedTopic,
      },
      label: "Topic",
      buttonLabel: "Add Topic",
    };
  }

  if (looksLikeAiRequest(clean)) {
    return {
      body: {
        itemType: "ai_summary",
        prompt: clean,
      },
      label: "AI workspace card",
      buttonLabel: "Generate AI Card",
    };
  }

  if (/^[a-z0-9_-]{3,40}$/i.test(clean)) {
    return {
      body: {
        itemType: "person",
        username: clean,
      },
      label: "Person",
      buttonLabel: "Add Person",
    };
  }

  return {
    body: {
      itemType: "note",
      title: clean.slice(0, 80),
      note: clean,
    },
    label: "Note",
    buttonLabel: "Add Note",
  };
}

export default function StickiesPage() {
  const [items, setItems] = useState<StickyItem[]>([]);
  const [smartAddInput, setSmartAddInput] = useState("");
  const [discussionInput, setDiscussionInput] = useState("");
  const [topicInput, setTopicInput] = useState("");
  const [personInput, setPersonInput] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteTitle, setEditingNoteTitle] = useState("");
  const [editingNoteBody, setEditingNoteBody] = useState("");
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

  async function addSmartSticky(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (working) {
      return;
    }

    const payload = getSmartAddPayload(smartAddInput);

    if (!payload) {
      setMessage("Add a discussion link, @username, topic, note:, or ai: prompt.");
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
      body: JSON.stringify(payload.body),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to add to Stickies.");
      return;
    }

    setSmartAddInput("");
    setMessage(`${payload.label} added to Stickies.`);

    await loadStickies();
  }

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

  async function addAiSticky(event: FormEvent<HTMLFormElement>) {
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
        itemType: "ai_summary",
        prompt: aiPrompt,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      if (response.status === 403 && result.upgradeRequired) {
        setUpgradeRequired(true);
      }

      setMessage(result.error ?? "Unable to generate AI card.");
      return;
    }

    setAiPrompt("");
    setMessage("AI card added to Stickies.");

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

  function startEditingNote(item: StickyItem) {
    if (item.item_type !== "note") {
      return;
    }

    setEditingNoteId(item.id);
    setEditingNoteTitle(item.title);
    setEditingNoteBody(item.subtitle ?? "");
    setMessage("");
  }

  function cancelEditingNote() {
    setEditingNoteId(null);
    setEditingNoteTitle("");
    setEditingNoteBody("");
  }

  async function updateNoteSticky(stickyId: string) {
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
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "update_note",
        stickyId,
        title: editingNoteTitle,
        note: editingNoteBody,
      }),
    });

    const result = await response.json().catch(() => ({}));

    setWorking(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to update note.");
      return;
    }

    const updatedSticky = result.sticky as StickyItem;

    setItems((current) =>
      current.map((item) => (item.id === stickyId ? updatedSticky : item))
    );
    cancelEditingNote();
    setMessage("Note updated.");
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
    <main className="min-h-screen bg-[var(--loombus-bg)] px-4 pb-24 pt-4 text-[var(--loombus-text)] sm:px-6 sm:py-10 lg:py-12 loombus-shell-with-right-rail">
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
            Stickies are your personal workspace for pinning Loombus cards you want visible right now. Saved is your library. Stickies are your board.
          </p>
        </section>

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
              Free users can keep using Saved. Premium users can build a visible workspace board from Loombus cards.
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
              onSubmit={addSmartSticky}
              className="mb-5 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-2xl shadow-black/10 sm:p-5"
            >
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <label className="text-sm font-medium text-[var(--loombus-text)]">
                  Smart Add
                </label>

                <span className="w-fit rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs text-[var(--loombus-text-muted)]">
                  One field
                </span>
              </div>

              <div className="flex flex-col gap-3">
                <textarea
                  value={smartAddInput}
                  onChange={(event) => setSmartAddInput(event.target.value)}
                  placeholder="Paste a discussion link, type @username, enter a topic, write note:..., or ask ai:..."
                  rows={3}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-base text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-text-subtle)]"
                />

                <button
                  type="submit"
                  disabled={working || !smartAddInput.trim()}
                  className="w-full rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
                >
                  {working ? "Adding..." : "Add to Stickies"}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-[var(--loombus-text-muted)]">
                  discussion link
                </span>
                <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-[var(--loombus-text-muted)]">
                  @username
                </span>
                <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-[var(--loombus-text-muted)]">
                  topic name
                </span>
                <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-[var(--loombus-text-muted)]">
                  note: your note
                </span>
                <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1.5 text-[var(--loombus-text-muted)]">
                  ai: your prompt
                </span>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-[var(--loombus-text-subtle)]">
                Saved discussions can still be added directly from the Saved page.
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
                        {getStickyTypeLabel(item.item_type)}
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

                        {item.item_type === "note" && (
                          <button
                            type="button"
                            onClick={() => startEditingNote(item)}
                            disabled={working || editingNoteId === item.id}
                            className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Edit
                          </button>
                        )}

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

                    {item.item_type === "note" || item.item_type === "ai_summary" ? (
                      editingNoteId === item.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingNoteTitle}
                            onChange={(event) => setEditingNoteTitle(event.target.value)}
                            placeholder="Note title"
                            className="min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-base text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-text-subtle)]"
                          />

                          <textarea
                            value={editingNoteBody}
                            onChange={(event) => setEditingNoteBody(event.target.value)}
                            placeholder="Write a short note for your workspace..."
                            rows={4}
                            className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-base text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-text-subtle)]"
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => updateNoteSticky(item.id)}
                              disabled={working || (!editingNoteTitle.trim() && !editingNoteBody.trim())}
                              className="rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-xs font-medium text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {working ? "Saving..." : "Save Note"}
                            </button>

                            <button
                              type="button"
                              onClick={cancelEditingNote}
                              disabled={working}
                              className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-text-subtle)] hover:text-[var(--loombus-text)] disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h2 className="text-xl font-semibold tracking-tight text-[var(--loombus-text)]">
                            {item.title}
                          </h2>

                          {item.subtitle && (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      )
                    ) : (
                      <Link href={item.href} className="block">
                        <h2 className="text-xl font-semibold tracking-tight text-[var(--loombus-text)] transition hover:text-[var(--loombus-text-muted)]">
                          {item.title}
                        </h2>

                        {item.subtitle && (
                          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
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
          <p className="text-sm text-[var(--loombus-text-muted)]">
            Loading Stickies...
          </p>
        )}
      </div>
    </main>
  );
}
