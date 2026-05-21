"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type SavedDiscussion = {
  id: string;
  created_at: string;
  collection_id: string | null;
  private_note: string | null;
  private_note_updated_at: string | null;
  discussions: {
    id: string;
    title: string;
    topic: string;
    body: string;
    created_at: string;
  } | null;
};

type BookmarkCollection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

function hasCollectionAccess(entitlement: AiEntitlement) {
  if (!entitlement?.ai_assisted_enabled) {
    return false;
  }

  return entitlement.tier === "premium" || entitlement.tier === "admin";
}

function hasPrivateNotesAccess(entitlement: AiEntitlement) {
  if (!entitlement) {
    return false;
  }

  if (entitlement.tier === "admin") {
    return true;
  }

  return (
    entitlement.ai_assisted_enabled === true &&
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  );
}

export default function SavedPage() {
  const [saved, setSaved] = useState<SavedDiscussion[]>([]);
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [entitlement, setEntitlement] = useState<AiEntitlement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState("all");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [removingBookmarkId, setRemovingBookmarkId] = useState<string | null>(null);
  const [movingBookmarkId, setMovingBookmarkId] = useState<string | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const canUseCollections = hasCollectionAccess(entitlement);
  const canUsePrivateNotes = hasPrivateNotesAccess(entitlement);

  useEffect(() => {
    async function loadSaved() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(userData.user.id);

      const [
        { data: entitlementData },
        { data: collectionData },
        { data: bookmarkData },
      ] = await Promise.all([
        supabase
          .from("user_ai_entitlements")
          .select("tier, ai_assisted_enabled, monthly_summary_limit")
          .eq("user_id", userData.user.id)
          .maybeSingle(),
        supabase
          .from("bookmark_collections")
          .select("id, user_id, name, description, created_at, updated_at")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("bookmarks")
          .select(`
            id,
            created_at,
            collection_id,
            private_note,
            private_note_updated_at,
            discussions (
              id,
              title,
              topic,
              body,
              created_at
            )
          `)
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: false }),
      ]);

      setEntitlement((entitlementData ?? null) as AiEntitlement);
      setCollections((collectionData ?? []) as BookmarkCollection[]);

      const normalized = (bookmarkData ?? []).map((item) => ({
        ...item,
        collection_id: item.collection_id ?? null,
        private_note: item.private_note ?? null,
        private_note_updated_at: item.private_note_updated_at ?? null,
        discussions: Array.isArray(item.discussions)
          ? item.discussions[0] ?? null
          : item.discussions,
      })) as SavedDiscussion[];

      setSaved(normalized);
      setNoteDrafts(
        normalized.reduce<Record<string, string>>((drafts, item) => {
          drafts[item.id] = item.private_note ?? "";
          return drafts;
        }, {})
      );
      setLoading(false);
    }

    loadSaved();
  }, []);

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: saved.length,
      unfiled: 0,
    };

    for (const item of saved) {
      if (!item.collection_id) {
        counts.unfiled += 1;
        continue;
      }

      counts[item.collection_id] = (counts[item.collection_id] ?? 0) + 1;
    }

    return counts;
  }, [saved]);

  const filteredSaved = useMemo(() => {
    if (selectedCollectionId === "all") {
      return saved;
    }

    if (selectedCollectionId === "unfiled") {
      return saved.filter((item) => !item.collection_id);
    }

    return saved.filter((item) => item.collection_id === selectedCollectionId);
  }, [saved, selectedCollectionId]);

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!currentUserId || creatingCollection) {
      return;
    }

    if (!canUseCollections) {
      setMessage("Saved folders require Premium or Admin access.");
      return;
    }

    const cleanName = newCollectionName.trim();

    if (!cleanName) {
      setMessage("Enter a folder name.");
      return;
    }

    setCreatingCollection(true);

    const { data, error } = await supabase
      .from("bookmark_collections")
      .insert({
        user_id: currentUserId,
        name: cleanName,
      })
      .select("id, user_id, name, description, created_at, updated_at")
      .single();

    setCreatingCollection(false);

    if (error) {
      setMessage(`Unable to create folder: ${error.message}`);
      return;
    }

    const created = data as BookmarkCollection;
    setCollections((current) => [...current, created]);
    setSelectedCollectionId(created.id);
    setNewCollectionName("");
    setMessage("Saved folder created.");
  }

  async function moveBookmark(bookmarkId: string, collectionId: string) {
    setMessage("");

    if (!currentUserId || movingBookmarkId) {
      return;
    }

    if (!canUseCollections) {
      setMessage("Moving saved discussions into folders requires Premium or Admin access.");
      return;
    }

    const nextCollectionId = collectionId === "unfiled" ? null : collectionId;
    setMovingBookmarkId(bookmarkId);

    const { error } = await supabase
      .from("bookmarks")
      .update({ collection_id: nextCollectionId })
      .eq("id", bookmarkId)
      .eq("user_id", currentUserId);

    setMovingBookmarkId(null);

    if (error) {
      setMessage(`Unable to move saved discussion: ${error.message}`);
      return;
    }

    setSaved((current) =>
      current.map((item) =>
        item.id === bookmarkId
          ? {
              ...item,
              collection_id: nextCollectionId,
            }
          : item
      )
    );

    setMessage(nextCollectionId ? "Saved discussion moved." : "Saved discussion moved to Unfiled.");
  }

  async function deleteCollection(collectionId: string) {
    setMessage("");

    if (!currentUserId || deletingCollectionId) {
      return;
    }

    if (!canUseCollections) {
      setMessage("Deleting saved folders requires Premium or Admin access.");
      return;
    }

    setDeletingCollectionId(collectionId);

    const { error } = await supabase
      .from("bookmark_collections")
      .delete()
      .eq("id", collectionId)
      .eq("user_id", currentUserId);

    setDeletingCollectionId(null);

    if (error) {
      setMessage(`Unable to delete folder: ${error.message}`);
      return;
    }

    setCollections((current) =>
      current.filter((collection) => collection.id !== collectionId)
    );

    setSaved((current) =>
      current.map((item) =>
        item.collection_id === collectionId
          ? {
              ...item,
              collection_id: null,
            }
          : item
      )
    );

    if (selectedCollectionId === collectionId) {
      setSelectedCollectionId("all");
    }

    setMessage("Saved folder deleted. Its saved discussions were moved to Unfiled.");
  }

  async function savePrivateNote(bookmarkId: string) {
    setMessage("");

    if (!currentUserId || savingNoteId) {
      return;
    }

    if (!canUsePrivateNotes) {
      setMessage("Private notes require Premium Plus or Admin access.");
      return;
    }

    const cleanNote = (noteDrafts[bookmarkId] ?? "").trim();
    setSavingNoteId(bookmarkId);

    const { data, error } = await supabase
      .from("bookmarks")
      .update({
        private_note: cleanNote || null,
      })
      .eq("id", bookmarkId)
      .eq("user_id", currentUserId)
      .select("id, private_note, private_note_updated_at")
      .single();

    setSavingNoteId(null);

    if (error) {
      setMessage(`Unable to save private note: ${error.message}`);
      return;
    }

    const updatedNote = data?.private_note ?? null;
    const updatedAt = data?.private_note_updated_at ?? null;

    setSaved((current) =>
      current.map((item) =>
        item.id === bookmarkId
          ? {
              ...item,
              private_note: updatedNote,
              private_note_updated_at: updatedAt,
            }
          : item
      )
    );

    setNoteDrafts((current) => ({
      ...current,
      [bookmarkId]: updatedNote ?? "",
    }));

    setMessage(updatedNote ? "Private note saved." : "Private note cleared.");
  }

  async function removeBookmark(bookmarkId: string) {
    setMessage("");

    if (!currentUserId || removingBookmarkId) {
      return;
    }

    setRemovingBookmarkId(bookmarkId);

    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", bookmarkId)
      .eq("user_id", currentUserId);

    setRemovingBookmarkId(null);

    if (error) {
      setMessage("Unable to remove saved discussion.");
      return;
    }

    setSaved((current) =>
      current.filter((item) => item.id !== bookmarkId)
    );

    setMessage("Saved discussion removed.");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="mb-4 text-5xl font-semibold tracking-tight">
              Saved discussions
            </h1>

            <p className="text-zinc-500">
              Discussions you saved for later reflection.
            </p>
          </div>

          <Link
            href="/premium"
            className="w-fit rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
          >
            Premium folders
          </Link>
        </div>

        {!loading && !canUseCollections && (
          <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-2 text-2xl font-medium">
              Saved folders are a Premium feature.
            </h2>

            <p className="max-w-3xl leading-relaxed text-zinc-500">
              You can still save and remove discussions on the Free plan. Premium and
              Admin accounts can organize saved discussions into folders.
            </p>
          </div>
        )}

        {!loading && canUseCollections && !canUsePrivateNotes && (
          <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-2 text-2xl font-medium">
              Private notes are a Premium Plus feature.
            </h2>

            <p className="max-w-3xl leading-relaxed text-zinc-500">
              Your saved folders are available. Upgrade to Premium Plus or use Admin
              access to add private notes to saved discussions.
            </p>
          </div>
        )}

        {canUseCollections && (
          <form
            onSubmit={createCollection}
            className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
          >
            <h2 className="mb-2 text-2xl font-medium">
              Create saved folder
            </h2>

            <p className="mb-5 max-w-2xl leading-relaxed text-zinc-500">
              Use folders to group high-signal discussions by research area,
              project, topic, or reading priority.
            </p>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                type="text"
                value={newCollectionName}
                onChange={(event) => setNewCollectionName(event.target.value)}
                placeholder="Folder name, for example AI strategy"
                maxLength={60}
                className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
              />

              <button
                type="submit"
                disabled={creatingCollection}
                className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
              >
                {creatingCollection ? "Creating..." : "Create folder"}
              </button>
            </div>
          </form>
        )}

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <div className="mb-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSelectedCollectionId("all")}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              selectedCollectionId === "all"
                ? "border-zinc-400 text-white"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
            }`}
          >
            All saved ({collectionCounts.all ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setSelectedCollectionId("unfiled")}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              selectedCollectionId === "unfiled"
                ? "border-zinc-400 text-white"
                : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
            }`}
          >
            Unfiled ({collectionCounts.unfiled ?? 0})
          </button>

          {collections.map((collection) => (
            <div key={collection.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedCollectionId(collection.id)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selectedCollectionId === collection.id
                    ? "border-zinc-400 text-white"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-white"
                }`}
              >
                {collection.name} ({collectionCounts[collection.id] ?? 0})
              </button>

              {canUseCollections && (
                <button
                  type="button"
                  onClick={() => deleteCollection(collection.id)}
                  disabled={deletingCollectionId === collection.id}
                  className="rounded-full border border-zinc-900 px-3 py-2 text-xs text-zinc-600 transition hover:border-zinc-700 hover:text-zinc-300 disabled:cursor-not-allowed disabled:text-zinc-800"
                >
                  {deletingCollectionId === collection.id ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          ))}
        </div>

        {loading && (
          <p className="text-zinc-500">
            Loading saved discussions...
          </p>
        )}

        {!loading && saved.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              Nothing saved yet.
            </h2>

            <p className="text-zinc-400">
              Save discussions that are worth revisiting.
            </p>
          </div>
        )}

        {!loading && saved.length > 0 && filteredSaved.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No saved discussions in this folder.
            </h2>

            <p className="text-zinc-400">
              Move saved discussions into this folder from the saved list.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredSaved.map((item) => {
            const discussion = item.discussions;

            if (!discussion) {
              return null;
            }

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <Link
                  href={`/discussions/${discussion.id}`}
                  className="block transition hover:opacity-90"
                >
                  <p className="mb-3 text-sm text-zinc-500">
                    {discussion.topic}
                  </p>

                  <h2 className="mb-3 text-2xl font-medium">
                    {discussion.title}
                  </h2>

                  <p className="mb-4 line-clamp-2 leading-relaxed text-zinc-400">
                    {discussion.body}
                  </p>
                </Link>

                {canUsePrivateNotes && (
                  <div className="mb-5 rounded-2xl border border-zinc-900 bg-black/40 p-4">
                    <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <label className="text-sm font-medium text-zinc-300">
                        Private note
                      </label>

                      {item.private_note_updated_at && (
                        <p className="text-xs text-zinc-600">
                          Updated {new Date(item.private_note_updated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <textarea
                      value={noteDrafts[item.id] ?? ""}
                      onChange={(event) =>
                        setNoteDrafts((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                      maxLength={1000}
                      rows={3}
                      placeholder="Add a private note for why this discussion matters..."
                      className="mb-3 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                    />

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-zinc-600">
                        {(noteDrafts[item.id] ?? "").length}/1000 characters
                      </p>

                      <button
                        type="button"
                        onClick={() => savePrivateNote(item.id)}
                        disabled={savingNoteId === item.id}
                        className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {savingNoteId === item.id ? "Saving..." : "Save note"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-zinc-600">
                    Saved {new Date(item.created_at).toLocaleDateString()}
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <select
                      value={item.collection_id ?? "unfiled"}
                      onChange={(event) => moveBookmark(item.id, event.target.value)}
                      disabled={!canUseCollections || movingBookmarkId === item.id}
                      className="rounded-2xl border border-zinc-800 bg-black px-4 py-2 text-sm text-zinc-300 outline-none transition focus:border-zinc-600 disabled:cursor-not-allowed disabled:text-zinc-700"
                    >
                      <option value="unfiled">Unfiled</option>
                      {collections.map((collection) => (
                        <option key={collection.id} value={collection.id}>
                          {collection.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeBookmark(item.id)}
                      disabled={removingBookmarkId === item.id}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      {removingBookmarkId === item.id ? "Removing..." : "Remove saved"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
