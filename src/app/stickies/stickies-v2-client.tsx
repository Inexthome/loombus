"use client";

import { normalizePublicText } from "@/lib/public-text";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  Library,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import "./stickies-v2.css";

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

type BoardSort = "manual" | "newest" | "oldest";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getStickyTopic(item: StickyItem) {
  const [topic] = (item.subtitle ?? "").split(" · ");
  return topic?.trim() || "Other";
}

function getStickyDescription(item: StickyItem) {
  const subtitle = item.subtitle?.trim() ?? "";
  const topic = getStickyTopic(item);
  const prefix = `${topic} · `;

  if (!subtitle) return "Pinned discussion card.";
  return normalizePublicText(subtitle.startsWith(prefix) ? subtitle.slice(prefix.length) : subtitle);
}

export default function StickiesV2Client() {
  const [items, setItems] = useState<StickyItem[]>([]);
  const [discussionInput, setDiscussionInput] = useState("");
  const [draggedStickyId, setDraggedStickyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [sortMode, setSortMode] = useState<BoardSort>("manual");
  const [pendingRemoval, setPendingRemoval] = useState<StickyItem | null>(null);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadStickies() {
    setLoading(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        setIsLoggedIn(false);
        setUpgradeRequired(false);
        setItems([]);
        return;
      }

      setIsLoggedIn(true);

      const response = await fetch("/api/stickies", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403 && result.upgradeRequired) {
          setUpgradeRequired(true);
        }

        setItems([]);
        setMessage(result.error ?? "Unable to load your Signal Board.");
        return;
      }

      setUpgradeRequired(false);
      setItems((result.stickies ?? []) as StickyItem[]);
    } catch (error) {
      console.error("Unable to load Stickies.", error);
      setMessage("Your Signal Board could not be loaded. Refresh and try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStickies();
  }, []);

  const topicOptions = useMemo(
    () => [...new Set(items.map(getStickyTopic))].sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const next = items.filter((item) => {
      const topic = getStickyTopic(item);
      if (topicFilter !== "all" && topic !== topicFilter) return false;
      if (!needle) return true;

      return [item.title, item.subtitle, topic, item.item_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return [...next].sort((a, b) => {
      if (sortMode === "manual") return a.position - b.position;
      const delta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortMode === "newest" ? delta : -delta;
    });
  }, [items, query, sortMode, topicFilter]);

  const latestSticky = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0] ?? null,
    [items]
  );

  const canReorder =
    sortMode === "manual" && query.trim().length === 0 && topicFilter === "all";

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

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setIsLoggedIn(false);
        return;
      }

      const response = await fetch("/api/stickies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ discussionUrl: cleanInput }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 403 && result.upgradeRequired) {
          setUpgradeRequired(true);
        }
        setMessage(result.error ?? "Unable to pin that discussion.");
        return;
      }

      setDiscussionInput("");
      await loadStickies();
      setMessage("Discussion pinned to your Signal Board.");
    } catch (error) {
      console.error("Unable to add Sticky.", error);
      setMessage("That discussion could not be pinned. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function persistStickyOrder(nextItems: StickyItem[], fallbackItems: StickyItem[]) {
    setItems(nextItems);
    setWorking(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setItems(fallbackItems);
        setIsLoggedIn(false);
        return;
      }

      const response = await fetch("/api/stickies", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ orderedIds: nextItems.map((item) => item.id) }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setItems(fallbackItems);
        setMessage(result.error ?? "Unable to save the board order.");
        return;
      }

      setItems((current) => current.map((item, index) => ({ ...item, position: index })));
      setMessage("Signal Board order saved.");
    } catch (error) {
      console.error("Unable to reorder Stickies.", error);
      setItems(fallbackItems);
      setMessage("The board order could not be saved.");
    } finally {
      setWorking(false);
    }
  }

  function handleStickyDragStart(stickyId: string) {
    if (!canReorder || working) return;
    setDraggedStickyId(stickyId);
  }

  function handleStickyDragOver(event: DragEvent<HTMLElement>) {
    if (canReorder) event.preventDefault();
  }

  async function handleStickyDrop(targetStickyId: string) {
    if (!canReorder || !draggedStickyId || draggedStickyId === targetStickyId || working) {
      setDraggedStickyId(null);
      return;
    }

    const fromIndex = items.findIndex((item) => item.id === draggedStickyId);
    const toIndex = items.findIndex((item) => item.id === targetStickyId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedStickyId(null);
      return;
    }

    const fallbackItems = items;
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    setDraggedStickyId(null);
    await persistStickyOrder(nextItems, fallbackItems);
  }

  async function moveSticky(stickyId: string, direction: "up" | "down") {
    if (!canReorder || working) return;

    const currentIndex = items.findIndex((item) => item.id === stickyId);
    if (currentIndex === -1) return;

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItems = [...items];
    const [movedItem] = nextItems.splice(currentIndex, 1);
    nextItems.splice(nextIndex, 0, movedItem);
    await persistStickyOrder(nextItems, items);
  }

  async function removeSticky(item: StickyItem) {
    if (working) return;
    setWorking(true);
    setMessage("");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setIsLoggedIn(false);
        return;
      }

      const response = await fetch("/api/stickies", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ stickyId: item.id }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to remove that card.");
        return;
      }

      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      setPendingRemoval(null);
      setMessage("Discussion removed from your Signal Board.");
    } catch (error) {
      console.error("Unable to remove Sticky.", error);
      setMessage("That card could not be removed. Try again.");
    } finally {
      setWorking(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setTopicFilter("all");
    setSortMode("manual");
  }

  if (loading) {
    return (
      <main className="stickies-v2-page">
        <section className="stickies-v2-state">
          <p>Private Signal workspace</p>
          <h1>Building your Signal Board…</h1>
          <span>Loading pinned discussions and your saved board order.</span>
        </section>
      </main>
    );
  }

  return (
    <main className="stickies-v2-page">
      <div className="stickies-v2-shell">
        <header className="stickies-v2-hero">
          <div>
            <p className="stickies-v2-eyebrow">Stickies · Private workspace</p>
            <h1>Signal Board</h1>
            <p>
              Pin active discussions to a focused working surface. Saved remains your
              library; Signal Board keeps what needs attention visible now.
            </p>
          </div>
          <div className="stickies-v2-hero-actions">
            <Link href="/saved" className="stickies-v2-secondary-action">
              <Library aria-hidden="true" /> Open Saved
            </Link>
            <Link href="/discussions" className="stickies-v2-primary-action">
              Browse Signal
            </Link>
          </div>
        </header>

        {!isLoggedIn && (
          <section className="stickies-v2-state">
            <p>Account required</p>
            <h1>Log in to open your private board.</h1>
            <span>Signal Board cards and their order are tied to your Loombus account.</span>
            <Link href="/login" className="stickies-v2-primary-action">Log in</Link>
          </section>
        )}

        {isLoggedIn && upgradeRequired && (
          <section className="stickies-v2-state">
            <p>Premium workspace</p>
            <h1>Signal Board is available with Premium.</h1>
            <span>
              Free members can keep using Saved. Premium and admin accounts can pin
              active discussions to a private, manually organized board.
            </span>
            <div className="stickies-v2-state-actions">
              <Link href="/premium" className="stickies-v2-primary-action">View Premium</Link>
              <Link href="/saved" className="stickies-v2-secondary-action">Open Saved</Link>
            </div>
          </section>
        )}

        {isLoggedIn && !upgradeRequired && (
          <>
            <section className="stickies-v2-metrics" aria-label="Signal Board overview">
              <article>
                <span>Pinned discussions</span>
                <strong>{items.length}</strong>
              </article>
              <article>
                <span>Signal topics</span>
                <strong>{topicOptions.length}</strong>
              </article>
              <article>
                <span>Visible now</span>
                <strong>{filteredItems.length}</strong>
              </article>
              <article className="is-accent">
                <span>Last pinned</span>
                <strong>{latestSticky ? formatDate(latestSticky.created_at) : "None"}</strong>
              </article>
            </section>

            <div className="stickies-v2-layout">
              <section className="stickies-v2-main">
                <form className="stickies-v2-add" onSubmit={addDiscussionSticky}>
                  <div>
                    <p className="stickies-v2-eyebrow">Pin Signal</p>
                    <h2>Add a discussion card</h2>
                    <p>Paste a Loombus discussion link or discussion ID.</p>
                  </div>
                  <div className="stickies-v2-add-controls">
                    <input
                      type="text"
                      value={discussionInput}
                      onChange={(event) => setDiscussionInput(event.target.value)}
                      placeholder="Discussion link or ID"
                      aria-label="Discussion link or ID"
                    />
                    <button type="submit" disabled={working || !discussionInput.trim()}>
                      <Plus aria-hidden="true" /> {working ? "Pinning…" : "Pin discussion"}
                    </button>
                  </div>
                  <p className="stickies-v2-support-note">
                    This version supports discussion cards. Notes, replies, people, and
                    other card types are not stored by the current Stickies data model.
                  </p>
                </form>

                {message && <div className="stickies-v2-notice" role="status">{message}</div>}

                {items.length > 0 && (
                  <section className="stickies-v2-tools" aria-label="Signal Board controls">
                    <label className="stickies-v2-search">
                      <Search aria-hidden="true" />
                      <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search pinned discussions"
                      />
                    </label>
                    <label>
                      <span>Topic</span>
                      <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
                        <option value="all">All Signal topics</option>
                        {topicOptions.map((topic) => (
                          <option key={topic} value={topic}>{topic}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Order</span>
                      <select value={sortMode} onChange={(event) => setSortMode(event.target.value as BoardSort)}>
                        <option value="manual">Manual board order</option>
                        <option value="newest">Newest pinned</option>
                        <option value="oldest">Oldest pinned</option>
                      </select>
                    </label>
                  </section>
                )}

                {items.length > 0 && !canReorder && (
                  <div className="stickies-v2-order-note">
                    Switch to Manual board order and clear search/topic filters to rearrange cards.
                  </div>
                )}

                {items.length === 0 ? (
                  <section className="stickies-v2-empty">
                    <Pin aria-hidden="true" />
                    <p className="stickies-v2-eyebrow">Empty Signal Board</p>
                    <h2>Pin the discussions that need your attention.</h2>
                    <p>
                      Open a discussion, copy its link, and add it above. Your board stays
                      private and separate from Saved.
                    </p>
                    <Link href="/discussions">Browse discussions</Link>
                  </section>
                ) : filteredItems.length === 0 ? (
                  <section className="stickies-v2-empty">
                    <Search aria-hidden="true" />
                    <p className="stickies-v2-eyebrow">No matching Signal</p>
                    <h2>No pinned discussions match this view.</h2>
                    <p>Broaden the search or return to all topics and manual order.</p>
                    <button type="button" onClick={resetFilters}>Reset board view</button>
                  </section>
                ) : (
                  <section className="stickies-v2-grid" aria-label="Pinned discussion cards">
                    {filteredItems.map((item) => {
                      const originalIndex = items.findIndex((candidate) => candidate.id === item.id);
                      const title = normalizePublicText(item.title);
                      const topic = getStickyTopic(item);

                      return (
                        <article
                          key={item.id}
                          onDragOver={handleStickyDragOver}
                          onDrop={() => void handleStickyDrop(item.id)}
                          className={draggedStickyId === item.id ? "is-dragging" : ""}
                        >
                          <div className="stickies-v2-card-topline">
                            <span><Sparkles aria-hidden="true" /> {topic}</span>
                            <time>{formatDate(item.created_at)}</time>
                          </div>

                          <Link href={item.href} className="stickies-v2-card-content">
                            <h2>{title}</h2>
                            <p>{getStickyDescription(item)}</p>
                            <strong>Open discussion <ExternalLink aria-hidden="true" /></strong>
                          </Link>

                          <div className="stickies-v2-card-actions">
                            <span
                              draggable={canReorder && !working}
                              onDragStart={() => handleStickyDragStart(item.id)}
                              onDragEnd={() => setDraggedStickyId(null)}
                              className={canReorder ? "is-enabled" : ""}
                              title={canReorder ? "Drag to reorder" : "Use Manual board order to rearrange"}
                            >
                              <GripVertical aria-hidden="true" /> Drag
                            </span>
                            <button
                              type="button"
                              onClick={() => void moveSticky(item.id, "up")}
                              disabled={!canReorder || working || originalIndex === 0}
                              aria-label={`Move ${title} up`}
                            >
                              <ArrowUp aria-hidden="true" /> Up
                            </button>
                            <button
                              type="button"
                              onClick={() => void moveSticky(item.id, "down")}
                              disabled={!canReorder || working || originalIndex === items.length - 1}
                              aria-label={`Move ${title} down`}
                            >
                              <ArrowDown aria-hidden="true" /> Down
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => setPendingRemoval(item)}
                              disabled={working}
                            >
                              <Trash2 aria-hidden="true" /> Remove
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                )}
              </section>

              <aside className="stickies-v2-sidebar">
                <section>
                  <p className="stickies-v2-eyebrow">Signal Board standard</p>
                  <h2>Visible now, not saved forever.</h2>
                  <p>
                    Use the board for discussions you are actively reading, comparing, or
                    preparing to answer. Remove cards when they no longer need attention.
                  </p>
                </section>
                <section>
                  <p className="stickies-v2-eyebrow">Saved vs. Stickies</p>
                  <div className="stickies-v2-compare">
                    <div><Library aria-hidden="true" /><span><strong>Saved</strong>Long-term discussion library</span></div>
                    <div><Pin aria-hidden="true" /><span><strong>Signal Board</strong>Short-term working surface</span></div>
                  </div>
                </section>
                <section>
                  <p className="stickies-v2-eyebrow">Board privacy</p>
                  <h2>Your arrangement is private.</h2>
                  <p>
                    Pinning or reordering a discussion does not change the public discussion
                    or another member’s experience.
                  </p>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>

      {pendingRemoval && (
        <div className="stickies-v2-modal-backdrop">
          <section role="dialog" aria-modal="true" aria-labelledby="remove-sticky-title" className="stickies-v2-modal">
            <button type="button" className="stickies-v2-modal-close" onClick={() => setPendingRemoval(null)} aria-label="Close">
              <X aria-hidden="true" />
            </button>
            <p className="stickies-v2-eyebrow">Remove card</p>
            <h2 id="remove-sticky-title">Remove this discussion from Signal Board?</h2>
            <p>
              “{normalizePublicText(pendingRemoval.title)}” will leave this private board.
              The discussion itself and any Saved copy remain unchanged.
            </p>
            <div>
              <button type="button" className="stickies-v2-danger-action" onClick={() => void removeSticky(pendingRemoval)} disabled={working}>
                {working ? "Removing…" : "Remove from board"}
              </button>
              <button type="button" className="stickies-v2-secondary-action" onClick={() => setPendingRemoval(null)} disabled={working}>
                Keep card
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
