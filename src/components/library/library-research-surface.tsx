"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Check,
  FlaskConical,
  Folder,
  FolderPlus,
  Loader2,
  PencilLine,
  Save,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ResearchItem = {
  id: string;
  publication_id: string;
  locator: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  text_sha256: string;
  created_at: string;
};

type Publication = {
  id: string;
  title: string;
  author_name: string | null;
  publisher_name: string | null;
};

type Section = {
  publication_id: string;
  section_key: string;
  ordinal: number;
  title: string | null;
};

type ResearchCollection = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ResearchMetadata = {
  research_item_id: string;
  user_id: string;
  note: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type CollectionItem = {
  collection_id: string;
  research_item_id: string;
  created_at: string;
};

function sectionLabel(section: Section) {
  return section.title ?? `Section ${section.ordinal + 1}`;
}

function normalizeTags(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of value.split(",")) {
    const tag = raw.trim().replace(/^#+/, "").slice(0, 40);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === 20) break;
  }

  return tags;
}

export function LibraryResearchSurface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [collections, setCollections] = useState<ResearchCollection[]>([]);
  const [metadata, setMetadata] = useState<ResearchMetadata[]>([]);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);
  const [query, setQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState<string>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [editCollectionName, setEditCollectionName] = useState("");
  const [editCollectionDescription, setEditCollectionDescription] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagsDraft, setTagsDraft] = useState("");

  const loadResearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setError("Sign in to view your Library Research.");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [itemResult, collectionResult, metadataResult, collectionItemResult] = await Promise.all([
      supabase
        .from("library_research_items")
        .select("id, publication_id, locator, selected_text, start_offset, end_offset, text_sha256, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("library_research_collections")
        .select("id, user_id, name, description, created_at, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("library_research_item_metadata")
        .select("research_item_id, user_id, note, tags, created_at, updated_at"),
      supabase
        .from("library_research_collection_items")
        .select("collection_id, research_item_id, created_at"),
    ]);

    if (itemResult.error || collectionResult.error || metadataResult.error || collectionItemResult.error) {
      setError("Unable to load the complete Research workspace.");
      setLoading(false);
      return;
    }

    const rows = (itemResult.data ?? []) as ResearchItem[];
    setItems(rows);
    setCollections((collectionResult.data ?? []) as ResearchCollection[]);
    setMetadata((metadataResult.data ?? []) as ResearchMetadata[]);
    setCollectionItems((collectionItemResult.data ?? []) as CollectionItem[]);

    const publicationIds = Array.from(new Set(rows.map((row) => row.publication_id)));
    if (!publicationIds.length) {
      setPublications([]);
      setSections([]);
      setLoading(false);
      return;
    }

    const [publicationResult, sectionResult] = await Promise.all([
      supabase
        .from("library_publications")
        .select("id, title, author_name, publisher_name")
        .in("id", publicationIds),
      supabase
        .from("library_publication_sections")
        .select("publication_id, section_key, ordinal, title")
        .in("publication_id", publicationIds)
        .order("ordinal", { ascending: true }),
    ]);

    if (publicationResult.error || sectionResult.error) {
      setError("Your research passages loaded, but some publication details are unavailable.");
    }
    setPublications((publicationResult.data ?? []) as Publication[]);
    setSections((sectionResult.data ?? []) as Section[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadResearch();
  }, [loadResearch]);

  const publicationById = useMemo(
    () => new Map(publications.map((row) => [row.id, row])),
    [publications]
  );
  const sectionByKey = useMemo(
    () => new Map(sections.map((row) => [`${row.publication_id}:${row.section_key}`, row])),
    [sections]
  );
  const metadataByItemId = useMemo(
    () => new Map(metadata.map((row) => [row.research_item_id, row])),
    [metadata]
  );
  const collectionIdsByItemId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of collectionItems) {
      const set = map.get(row.research_item_id) ?? new Set<string>();
      set.add(row.collection_id);
      map.set(row.research_item_id, set);
    }
    return map;
  }, [collectionItems]);

  const allTags = useMemo(() => {
    const values = new Map<string, string>();
    for (const row of metadata) {
      for (const tag of row.tags ?? []) {
        const key = tag.toLocaleLowerCase();
        if (!values.has(key)) values.set(key, tag);
      }
    }
    return Array.from(values.values()).sort((a, b) => a.localeCompare(b));
  }, [metadata]);

  const collectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of collectionItems) {
      counts.set(row.collection_id, (counts.get(row.collection_id) ?? 0) + 1);
    }
    return counts;
  }, [collectionItems]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();

    return items.filter((item) => {
      const itemMetadata = metadataByItemId.get(item.id);
      const itemCollectionIds = collectionIdsByItemId.get(item.id) ?? new Set<string>();

      if (activeCollectionId !== "all" && !itemCollectionIds.has(activeCollectionId)) return false;
      if (
        activeTag &&
        !(itemMetadata?.tags ?? []).some(
          (tag) => tag.toLocaleLowerCase() === activeTag.toLocaleLowerCase()
        )
      ) {
        return false;
      }

      if (!needle) return true;

      const publication = publicationById.get(item.publication_id);
      const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
      const collectionNames = collections
        .filter((collection) => itemCollectionIds.has(collection.id))
        .map((collection) => collection.name);

      return [
        item.selected_text,
        itemMetadata?.note,
        ...(itemMetadata?.tags ?? []),
        ...collectionNames,
        publication?.title,
        publication?.author_name,
        publication?.publisher_name,
        section?.title,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle));
    });
  }, [
    activeCollectionId,
    activeTag,
    collectionIdsByItemId,
    collections,
    items,
    metadataByItemId,
    publicationById,
    query,
    sectionByKey,
  ]);

  async function createCollection() {
    if (!userId) return;
    const name = collectionName.trim();
    const description = collectionDescription.trim();
    if (!name) return;

    setCreatingCollection(true);
    setError(null);
    const now = new Date().toISOString();
    const result = await supabase
      .from("library_research_collections")
      .insert({
        user_id: userId,
        name,
        description: description || null,
        updated_at: now,
      })
      .select("id, user_id, name, description, created_at, updated_at")
      .single();

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "You already have a Research collection with that name."
          : "Unable to create this Research collection."
      );
    } else if (result.data) {
      const created = result.data as ResearchCollection;
      setCollections((rows) => [created, ...rows]);
      setCollectionName("");
      setCollectionDescription("");
      setActiveCollectionId(created.id);
    }
    setCreatingCollection(false);
  }

  function beginEditCollection(collection: ResearchCollection) {
    setEditingCollectionId(collection.id);
    setEditCollectionName(collection.name);
    setEditCollectionDescription(collection.description ?? "");
  }

  async function saveCollection(collectionId: string) {
    if (!userId) return;
    const name = editCollectionName.trim();
    const description = editCollectionDescription.trim();
    if (!name) return;

    setBusyId(`collection:${collectionId}`);
    setError(null);
    const now = new Date().toISOString();
    const result = await supabase
      .from("library_research_collections")
      .update({ name, description: description || null, updated_at: now })
      .eq("id", collectionId)
      .eq("user_id", userId)
      .select("id, user_id, name, description, created_at, updated_at")
      .single();

    if (result.error) {
      setError(
        result.error.code === "23505"
          ? "You already have a Research collection with that name."
          : "Unable to update this Research collection."
      );
    } else if (result.data) {
      const updated = result.data as ResearchCollection;
      setCollections((rows) =>
        rows.map((row) => (row.id === collectionId ? updated : row))
      );
      setEditingCollectionId(null);
    }
    setBusyId(null);
  }

  async function deleteCollection(collection: ResearchCollection) {
    if (!userId) return;
    if (!window.confirm(`Delete the collection “${collection.name}”? Saved passages will remain in Research.`)) {
      return;
    }

    setBusyId(`collection:${collection.id}`);
    setError(null);
    const { error: deleteError } = await supabase
      .from("library_research_collections")
      .delete()
      .eq("id", collection.id)
      .eq("user_id", userId);

    if (deleteError) {
      setError("Unable to delete this Research collection.");
    } else {
      setCollections((rows) => rows.filter((row) => row.id !== collection.id));
      setCollectionItems((rows) => rows.filter((row) => row.collection_id !== collection.id));
      if (activeCollectionId === collection.id) setActiveCollectionId("all");
      if (editingCollectionId === collection.id) setEditingCollectionId(null);
    }
    setBusyId(null);
  }

  function beginEditMetadata(item: ResearchItem) {
    const row = metadataByItemId.get(item.id);
    setEditingItemId(item.id);
    setNoteDraft(row?.note ?? "");
    setTagsDraft((row?.tags ?? []).join(", "));
  }

  async function saveMetadata(item: ResearchItem) {
    if (!userId) return;
    const note = noteDraft.trim();
    const tags = normalizeTags(tagsDraft);
    setBusyId(`metadata:${item.id}`);
    setError(null);

    const existing = metadataByItemId.get(item.id);
    if (!note && tags.length === 0) {
      if (existing) {
        const { error: deleteError } = await supabase
          .from("library_research_item_metadata")
          .delete()
          .eq("research_item_id", item.id)
          .eq("user_id", userId);
        if (deleteError) {
          setError("Unable to clear this research note and tags.");
          setBusyId(null);
          return;
        }
        setMetadata((rows) => rows.filter((row) => row.research_item_id !== item.id));
      }
      setEditingItemId(null);
      setBusyId(null);
      return;
    }

    const now = new Date().toISOString();
    const result = await supabase
      .from("library_research_item_metadata")
      .upsert(
        {
          research_item_id: item.id,
          user_id: userId,
          note: note || null,
          tags,
          updated_at: now,
        },
        { onConflict: "research_item_id" }
      )
      .select("research_item_id, user_id, note, tags, created_at, updated_at")
      .single();

    if (result.error) {
      setError("Unable to save this research note and tags.");
    } else if (result.data) {
      const saved = result.data as ResearchMetadata;
      setMetadata((rows) => [saved, ...rows.filter((row) => row.research_item_id !== item.id)]);
      setEditingItemId(null);
    }
    setBusyId(null);
  }

  async function toggleCollectionMembership(itemId: string, collectionId: string) {
    const membershipExists = collectionItems.some(
      (row) => row.research_item_id === itemId && row.collection_id === collectionId
    );
    setBusyId(`membership:${itemId}:${collectionId}`);
    setError(null);

    if (membershipExists) {
      const { error: deleteError } = await supabase
        .from("library_research_collection_items")
        .delete()
        .eq("research_item_id", itemId)
        .eq("collection_id", collectionId);
      if (deleteError) {
        setError("Unable to remove this passage from the collection.");
      } else {
        setCollectionItems((rows) =>
          rows.filter(
            (row) => !(row.research_item_id === itemId && row.collection_id === collectionId)
          )
        );
      }
    } else {
      const result = await supabase
        .from("library_research_collection_items")
        .insert({ research_item_id: itemId, collection_id: collectionId })
        .select("collection_id, research_item_id, created_at")
        .single();
      if (result.error) {
        setError("Unable to add this passage to the collection.");
      } else if (result.data) {
        setCollectionItems((rows) => [result.data as CollectionItem, ...rows]);
      }
    }
    setBusyId(null);
  }

  async function deleteItem(item: ResearchItem) {
    if (!userId) return;
    if (!window.confirm("Remove this saved passage from Research?")) return;

    setBusyId(item.id);
    setError(null);
    const { error: deleteError } = await supabase
      .from("library_research_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (deleteError) {
      setError("Unable to remove this research passage.");
    } else {
      setItems((rows) => rows.filter((row) => row.id !== item.id));
      setMetadata((rows) => rows.filter((row) => row.research_item_id !== item.id));
      setCollectionItems((rows) => rows.filter((row) => row.research_item_id !== item.id));
    }
    setBusyId(null);
  }

  async function openChapter(item: ResearchItem) {
    if (!userId) return;
    const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
    if (!section) return;

    setBusyId(item.id);
    setError(null);
    const publicationSections = sections.filter(
      (row) => row.publication_id === item.publication_id
    );
    const index = publicationSections.findIndex((row) => row.section_key === item.locator);
    const progressPercent =
      index >= 0 && publicationSections.length
        ? Math.min(
            100,
            Math.max(1, Math.round(((index + 1) / publicationSections.length) * 100))
          )
        : 1;
    const now = new Date().toISOString();
    const { error: progressError } = await supabase
      .from("library_reading_progress")
      .upsert(
        {
          user_id: userId,
          publication_id: item.publication_id,
          locator: item.locator,
          progress_percent: progressPercent,
          last_read_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,publication_id" }
      );

    if (progressError) {
      setError("Unable to open the saved chapter.");
      setBusyId(null);
      return;
    }
    window.location.href = `/library/read/${item.publication_id}`;
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"
          >
            <ArrowLeft className="size-4" /> Library
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Research</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--loombus-text-muted)]">
                Organize private passages into collections, attach your own notes and tags, and return to the exact source chapter.
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm"
          >
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">
                    Collections
                  </p>
                  <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                    Private organization
                  </p>
                </div>
                <Folder className="size-5 text-[var(--loombus-gold)]" />
              </div>

              <div className="mt-4 space-y-1.5">
                <button
                  type="button"
                  onClick={() => setActiveCollectionId("all")}
                  data-active={activeCollectionId === "all" ? "true" : "false"}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold data-[active=true]:bg-[var(--loombus-gold-surface)] data-[active=true]:text-[var(--loombus-gold)]"
                >
                  <span>All passages</span>
                  <span className="text-xs opacity-70">{items.length}</span>
                </button>

                {collections.map((collection) => (
                  <div key={collection.id}>
                    <button
                      type="button"
                      onClick={() => setActiveCollectionId(collection.id)}
                      data-active={activeCollectionId === collection.id ? "true" : "false"}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-bold data-[active=true]:bg-[var(--loombus-gold-surface)] data-[active=true]:text-[var(--loombus-gold)]"
                    >
                      <span className="truncate">{collection.name}</span>
                      <span className="text-xs opacity-70">
                        {collectionCounts.get(collection.id) ?? 0}
                      </span>
                    </button>
                    {activeCollectionId === collection.id ? (
                      <div className="mx-2 mb-2 mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => beginEditCollection(collection)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
                        >
                          <PencilLine className="size-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={busyId === `collection:${collection.id}`}
                          onClick={() => void deleteCollection(collection)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)] disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {editingCollectionId ? (
                <div className="mt-4 space-y-2 border-t border-[var(--loombus-border)] pt-4">
                  <input
                    value={editCollectionName}
                    maxLength={80}
                    onChange={(event) => setEditCollectionName(event.target.value)}
                    placeholder="Collection name"
                    className="w-full rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <textarea
                    value={editCollectionDescription}
                    maxLength={500}
                    onChange={(event) => setEditCollectionDescription(event.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={!editCollectionName.trim() || busyId === `collection:${editingCollectionId}`}
                      onClick={() => void saveCollection(editingCollectionId)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--loombus-gold)] px-3 py-2 text-xs font-black text-black disabled:opacity-40"
                    >
                      <Save className="size-3.5" /> Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCollectionId(null)}
                      className="rounded-full px-3 py-2 text-xs font-bold text-[var(--loombus-text-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2 border-t border-[var(--loombus-border)] pt-4">
                  <div className="flex items-center gap-2 text-xs font-black text-[var(--loombus-text-muted)]">
                    <FolderPlus className="size-4 text-[var(--loombus-gold)]" /> New collection
                  </div>
                  <input
                    value={collectionName}
                    maxLength={80}
                    onChange={(event) => setCollectionName(event.target.value)}
                    placeholder="Collection name"
                    className="w-full rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <textarea
                    value={collectionDescription}
                    maxLength={500}
                    onChange={(event) => setCollectionDescription(event.target.value)}
                    placeholder="Optional description"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    disabled={!collectionName.trim() || creatingCollection}
                    onClick={() => void createCollection()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--loombus-gold)] px-3 py-2 text-xs font-black text-black disabled:opacity-40"
                  >
                    {creatingCollection ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <FolderPlus className="size-3.5" />
                    )}
                    Create
                  </button>
                </div>
              )}
            </section>
          </aside>

          <div className="min-w-0">
            <div className="flex items-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4">
              <Search className="size-4 shrink-0 text-[var(--loombus-text-subtle)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search passages, notes, tags, collections, books, or authors…"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none"
              />
            </div>

            {allTags.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-text-muted)]">
                  <Tag className="size-3.5" /> Tags
                </span>
                {allTags.map((tag) => (
                  <button
                    key={tag.toLocaleLowerCase()}
                    type="button"
                    onClick={() =>
                      setActiveTag((current) =>
                        current?.toLocaleLowerCase() === tag.toLocaleLowerCase() ? null : tag
                      )
                    }
                    data-active={activeTag?.toLocaleLowerCase() === tag.toLocaleLowerCase() ? "true" : "false"}
                    className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-bold text-[var(--loombus-text-muted)] data-[active=true]:border-[var(--loombus-gold)] data-[active=true]:bg-[var(--loombus-gold-surface)] data-[active=true]:text-[var(--loombus-gold)]"
                  >
                    #{tag}
                  </button>
                ))}
                {activeTag ? (
                  <button
                    type="button"
                    onClick={() => setActiveTag(null)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-[var(--loombus-text-muted)]"
                  >
                    <X className="size-3.5" /> Clear
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 space-y-4">
              {filtered.length ? (
                filtered.map((item) => {
                  const publication = publicationById.get(item.publication_id);
                  const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
                  const itemMetadata = metadataByItemId.get(item.id);
                  const itemCollectionIds = collectionIdsByItemId.get(item.id) ?? new Set<string>();
                  const editing = editingItemId === item.id;

                  return (
                    <article
                      key={item.id}
                      className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">
                            {publication?.title ?? "Library publication"}
                          </p>
                          <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                            {section
                              ? `${section.ordinal + 1}. ${sectionLabel(section)}`
                              : "Unavailable chapter"}
                            {publication?.author_name ? ` · ${publication.author_name}` : ""}
                          </p>
                          <blockquote className="mt-4 whitespace-pre-wrap text-[15px] leading-7">
                            “{item.selected_text}”
                          </blockquote>
                          <p className="mt-3 text-[11px] text-[var(--loombus-text-subtle)]">
                            Saved {new Date(item.created_at).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Delete research passage"
                          disabled={busyId === item.id}
                          onClick={() => void deleteItem(item)}
                          className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--loombus-border)] text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)] disabled:opacity-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      {itemMetadata?.note || itemMetadata?.tags?.length ? (
                        <div className="mt-4 rounded-2xl bg-[var(--loombus-surface-strong)] p-4">
                          {itemMetadata.note ? (
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                                Private note
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{itemMetadata.note}</p>
                            </div>
                          ) : null}
                          {itemMetadata.tags?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {itemMetadata.tags.map((tag) => (
                                <button
                                  key={tag.toLocaleLowerCase()}
                                  type="button"
                                  onClick={() => setActiveTag(tag)}
                                  className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-[11px] font-bold text-[var(--loombus-gold)]"
                                >
                                  #{tag}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {editing ? (
                        <div className="mt-4 space-y-3 border-t border-[var(--loombus-border)] pt-4">
                          <label className="block">
                            <span className="text-xs font-black text-[var(--loombus-text-muted)]">Private note</span>
                            <textarea
                              value={noteDraft}
                              maxLength={10000}
                              rows={4}
                              onChange={(event) => setNoteDraft(event.target.value)}
                              placeholder="Why does this passage matter? What should you remember or investigate?"
                              className="mt-1.5 w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-3 text-sm outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-xs font-black text-[var(--loombus-text-muted)]">Tags</span>
                            <input
                              value={tagsDraft}
                              onChange={(event) => setTagsDraft(event.target.value)}
                              placeholder="evidence, AI, policy"
                              className="mt-1.5 w-full rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2.5 text-sm outline-none"
                            />
                            <span className="mt-1 block text-[11px] text-[var(--loombus-text-subtle)]">
                              Comma-separated. Up to 20 tags.
                            </span>
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busyId === `metadata:${item.id}`}
                              onClick={() => void saveMetadata(item)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--loombus-gold)] px-3 py-2 text-xs font-black text-black disabled:opacity-40"
                            >
                              <Save className="size-3.5" /> Save note & tags
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="rounded-full px-3 py-2 text-xs font-bold text-[var(--loombus-text-muted)]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="mt-4 border-t border-[var(--loombus-border)] pt-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            disabled={!section || busyId === item.id}
                            onClick={() => void openChapter(item)}
                            className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)] disabled:opacity-40"
                          >
                            <BookOpen className="size-4" /> Open chapter
                          </button>
                          <button
                            type="button"
                            onClick={() => (editing ? setEditingItemId(null) : beginEditMetadata(item))}
                            className="inline-flex items-center gap-2 text-sm font-bold text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"
                          >
                            <PencilLine className="size-4" /> {editing ? "Close editor" : "Note & tags"}
                          </button>
                        </div>

                        {collections.length ? (
                          <div className="mt-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                              Collections
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {collections.map((collection) => {
                                const assigned = itemCollectionIds.has(collection.id);
                                const membershipBusy =
                                  busyId === `membership:${item.id}:${collection.id}`;
                                return (
                                  <button
                                    key={collection.id}
                                    type="button"
                                    disabled={membershipBusy}
                                    onClick={() => void toggleCollectionMembership(item.id, collection.id)}
                                    data-active={assigned ? "true" : "false"}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-2.5 py-1.5 text-xs font-bold text-[var(--loombus-text-muted)] data-[active=true]:border-[var(--loombus-gold)] data-[active=true]:bg-[var(--loombus-gold-surface)] data-[active=true]:text-[var(--loombus-gold)] disabled:opacity-40"
                                  >
                                    {assigned ? <Check className="size-3.5" /> : <Folder className="size-3.5" />}
                                    {collection.name}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
                  <FlaskConical className="mx-auto size-6 text-[var(--loombus-gold)]" />
                  <p className="mt-3 text-sm font-semibold">
                    {items.length ? "No research passages match these filters." : "No saved research passages yet."}
                  </p>
                  <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">
                    {items.length
                      ? "Try All passages, clear a tag, or change your search."
                      : "Select a passage in the Reader and choose Save to Research."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
