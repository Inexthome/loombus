"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, FolderPlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { supabase } from "@/lib/supabase/client";

type Collection = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type CollectionItem = {
  collection_id: string;
  publication_id: string;
  added_at: string;
};

type Publication = {
  id: string;
  title: string;
  author_name: string | null;
  publisher_name: string | null;
  cover_url: string | null;
};

const publicationSelect = "id, title, author_name, publisher_name, cover_url";

export function LibraryCollectionsPanel({ query }: { query: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [savedPublicationIds, setSavedPublicationIds] = useState<string[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [managingBooks, setManagingBooks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutationKey, setMutationKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    const currentUser = userResult.user;
    if (userError || !currentUser) {
      setUserId(null);
      setCollections([]);
      setItems([]);
      setSavedPublicationIds([]);
      setPublications([]);
      setSelectedCollectionId(null);
      setLoading(false);
      return;
    }

    setUserId(currentUser.id);
    const [collectionsResult, itemsResult, savedResult] = await Promise.all([
      supabase.from("library_collections").select("id, name, created_at, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_collection_items").select("collection_id, publication_id, added_at").order("added_at", { ascending: false }),
      supabase.from("library_member_items").select("publication_id").order("added_at", { ascending: false }),
    ]);

    const firstError = collectionsResult.error ?? itemsResult.error ?? savedResult.error;
    if (firstError) {
      setErrorMessage("Unable to load your private collections.");
      setLoading(false);
      return;
    }

    const nextCollections = (collectionsResult.data ?? []) as Collection[];
    const nextItems = (itemsResult.data ?? []) as CollectionItem[];
    const nextSavedIds = (savedResult.data ?? []).map((row) => row.publication_id as string);
    setCollections(nextCollections);
    setItems(nextItems);
    setSavedPublicationIds(nextSavedIds);
    setSelectedCollectionId((current) => current && nextCollections.some((collection) => collection.id === current) ? current : nextCollections[0]?.id ?? null);

    const publicationIds = [...new Set([...nextSavedIds, ...nextItems.map((item) => item.publication_id)])];
    if (!publicationIds.length) {
      setPublications([]);
      setLoading(false);
      return;
    }

    const publicationResult = await supabase
      .from("library_publications")
      .select(publicationSelect)
      .in("id", publicationIds)
      .eq("status", "published");

    if (publicationResult.error) {
      setErrorMessage("Unable to load publication metadata for your collections.");
      setPublications([]);
    } else {
      setPublications((publicationResult.data ?? []) as Publication[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const publicationById = useMemo(() => new Map(publications.map((publication) => [publication.id, publication])), [publications]);
  const selectedCollection = useMemo(() => collections.find((collection) => collection.id === selectedCollectionId) ?? null, [collections, selectedCollectionId]);
  const selectedItemIds = useMemo(() => new Set(items.filter((item) => item.collection_id === selectedCollectionId).map((item) => item.publication_id)), [items, selectedCollectionId]);
  const normalizedQuery = query.trim().toLowerCase();

  const selectedPublications = useMemo(() => items
    .filter((item) => item.collection_id === selectedCollectionId)
    .map((item) => publicationById.get(item.publication_id))
    .filter((publication): publication is Publication => Boolean(publication))
    .filter((publication) => !normalizedQuery || [publication.title, publication.author_name, publication.publisher_name].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery)), [items, normalizedQuery, publicationById, selectedCollectionId]);

  const savedPublications = useMemo(() => savedPublicationIds
    .map((publicationId) => publicationById.get(publicationId))
    .filter((publication): publication is Publication => Boolean(publication))
    .filter((publication) => !normalizedQuery || [publication.title, publication.author_name, publication.publisher_name].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery)), [normalizedQuery, publicationById, savedPublicationIds]);

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!userId || !name) return;
    setMutationKey("create");
    setErrorMessage(null);
    const { data, error } = await supabase
      .from("library_collections")
      .insert({ user_id: userId, name })
      .select("id, name, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.code === "23505" ? "You already have a collection with that name." : "Unable to create this collection.");
    } else {
      const collection = data as Collection;
      setCollections((current) => [collection, ...current]);
      setSelectedCollectionId(collection.id);
      setNewCollectionName("");
      setManagingBooks(true);
    }
    setMutationKey(null);
  }

  async function renameCollection() {
    if (!userId || !selectedCollection) return;
    const name = renameValue.trim();
    if (!name) return;
    setMutationKey(`rename:${selectedCollection.id}`);
    setErrorMessage(null);
    const { data, error } = await supabase
      .from("library_collections")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", selectedCollection.id)
      .eq("user_id", userId)
      .select("id, name, created_at, updated_at")
      .single();

    if (error || !data) {
      setErrorMessage(error?.code === "23505" ? "You already have a collection with that name." : "Unable to rename this collection.");
    } else {
      setCollections((current) => current.map((collection) => collection.id === selectedCollection.id ? data as Collection : collection));
      setRenaming(false);
    }
    setMutationKey(null);
  }

  async function deleteCollection() {
    if (!userId || !selectedCollection) return;
    const collectionId = selectedCollection.id;
    setMutationKey(`delete:${collectionId}`);
    setErrorMessage(null);
    const { error } = await supabase
      .from("library_collections")
      .delete()
      .eq("id", collectionId)
      .eq("user_id", userId);

    if (error) {
      setErrorMessage("Unable to delete this collection.");
    } else {
      const remaining = collections.filter((collection) => collection.id !== collectionId);
      setCollections(remaining);
      setItems((current) => current.filter((item) => item.collection_id !== collectionId));
      setSelectedCollectionId(remaining[0]?.id ?? null);
      setManagingBooks(false);
      setRenaming(false);
    }
    setMutationKey(null);
  }

  async function togglePublication(publicationId: string) {
    if (!userId || !selectedCollection) return;
    const key = `${selectedCollection.id}:${publicationId}`;
    setMutationKey(key);
    setErrorMessage(null);

    if (selectedItemIds.has(publicationId)) {
      const { error } = await supabase
        .from("library_collection_items")
        .delete()
        .eq("collection_id", selectedCollection.id)
        .eq("publication_id", publicationId)
        .eq("user_id", userId);
      if (error) {
        setErrorMessage("Unable to remove this book from the collection.");
      } else {
        setItems((current) => current.filter((item) => !(item.collection_id === selectedCollection.id && item.publication_id === publicationId)));
      }
    } else {
      const { data, error } = await supabase
        .from("library_collection_items")
        .insert({ collection_id: selectedCollection.id, user_id: userId, publication_id: publicationId })
        .select("collection_id, publication_id, added_at")
        .single();
      if (error || !data) {
        setErrorMessage("Unable to add this book to the collection.");
      } else {
        setItems((current) => [data as CollectionItem, ...current]);
      }
    }
    setMutationKey(null);
  }

  if (loading) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading collections" /></div>;

  if (!userId) {
    return <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-8 text-center"><FolderPlus className="mx-auto h-6 w-6 text-[var(--loombus-gold)]" aria-hidden="true" /><h2 className="mt-3 text-sm font-semibold">Sign in to use Collections</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">Collections are private and sync with your Loombus account.</p></div>;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-w-0">
        <form onSubmit={(event) => { event.preventDefault(); void createCollection(); }} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-4 ring-1 ring-[var(--loombus-border)]">
          <label className="text-xs font-semibold text-[var(--loombus-text-muted)]" htmlFor="new-library-collection">New Collection</label>
          <div className="mt-2 flex gap-2">
            <input id="new-library-collection" value={newCollectionName} onChange={(event) => setNewCollectionName(event.target.value)} maxLength={80} placeholder="Collection name" className="min-w-0 flex-1 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2 text-sm outline-none focus:border-[var(--loombus-gold)]" />
            <button type="submit" disabled={!newCollectionName.trim() || mutationKey === "create"} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--loombus-gold)] text-black disabled:opacity-50" aria-label="Create collection">{mutationKey === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</button>
          </div>
        </form>

        <div className="mt-4 space-y-1">
          {collections.map((collection) => {
            const count = items.filter((item) => item.collection_id === collection.id).length;
            return <button key={collection.id} type="button" onClick={() => { setSelectedCollectionId(collection.id); setManagingBooks(false); setRenaming(false); }} className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${selectedCollectionId === collection.id ? "bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]" : "hover:bg-[var(--loombus-surface-muted)]"}`}><span className="min-w-0"><span className="block truncate text-sm font-semibold">{collection.name}</span><span className={`mt-0.5 block text-xs ${selectedCollectionId === collection.id ? "opacity-70" : "text-[var(--loombus-text-muted)]"}`}>{count} {count === 1 ? "book" : "books"}</span></span></button>;
          })}
        </div>
      </aside>

      <section className="min-w-0">
        {errorMessage ? <div role="alert" className="mb-5 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{errorMessage}</div> : null}

        {!selectedCollection ? (
          <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-10 text-center"><FolderPlus className="mx-auto h-7 w-7 text-[var(--loombus-gold)]" aria-hidden="true" /><h2 className="mt-3 text-base font-semibold">Create your first collection</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--loombus-text-muted)]">Group books from My Library by topic, project, course, research question, or anything else that helps you organize what you read.</p></div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--loombus-border)] pb-5">
              <div className="min-w-0 flex-1">
                {renaming ? <form onSubmit={(event) => { event.preventDefault(); void renameCollection(); }} className="flex max-w-xl gap-2"><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2 text-lg font-semibold outline-none focus:border-[var(--loombus-gold)]" /><button type="submit" disabled={!renameValue.trim() || mutationKey === `rename:${selectedCollection.id}`} className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--loombus-gold)] text-black"><Check className="h-4 w-4" /></button><button type="button" onClick={() => setRenaming(false)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--loombus-border)]"><X className="h-4 w-4" /></button></form> : <><h2 className="truncate text-2xl font-semibold">{selectedCollection.name}</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{selectedItemIds.size} {selectedItemIds.size === 1 ? "book" : "books"} · private</p></>}
              </div>
              {!renaming ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setManagingBooks((value) => !value)} className="rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-semibold text-black">{managingBooks ? "Done" : "Add Books"}</button><button type="button" onClick={() => { setRenameValue(selectedCollection.name); setRenaming(true); }} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--loombus-border)]" aria-label="Rename collection"><Pencil className="h-3.5 w-3.5" /></button><button type="button" onClick={() => void deleteCollection()} disabled={mutationKey === `delete:${selectedCollection.id}`} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--loombus-border)]" aria-label="Delete collection">{mutationKey === `delete:${selectedCollection.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button></div> : null}
            </div>

            {managingBooks ? (
              <div>
                <div className="mb-4"><h3 className="text-sm font-semibold">Add books from My Library</h3><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">A book can belong to multiple collections. Removing it here does not remove it from My Library.</p></div>
                {!savedPublications.length ? <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-8 text-center text-sm text-[var(--loombus-text-muted)]">No matching books are available in My Library.</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">{savedPublications.map((publication) => { const selected = selectedItemIds.has(publication.id); const key = `${selectedCollection.id}:${publication.id}`; return <button key={publication.id} type="button" onClick={() => void togglePublication(publication.id)} disabled={mutationKey === key} className={`relative rounded-xl p-2 text-left ring-1 transition ${selected ? "bg-[var(--loombus-gold-surface)] ring-[var(--loombus-gold)]" : "bg-[var(--loombus-surface-strong)] ring-[var(--loombus-border)] hover:ring-[var(--loombus-gold)]"}`}><span className="block aspect-[2/3] overflow-hidden rounded-lg"><LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-5 w-5" /></span><span className="mt-2 block line-clamp-2 text-xs font-semibold leading-5">{publication.title}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--loombus-text-muted)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</span><span className={`absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full ${selected ? "bg-[var(--loombus-gold)] text-black" : "bg-black/70 text-white"}`}>{mutationKey === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}</span></button>; })}</div>}
              </div>
            ) : selectedPublications.length ? (
              <div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">{selectedPublications.map((publication) => <article key={publication.id} className="min-w-0"><Link href={`/library/publication/${publication.id}`} className="group block"><span className="block aspect-[2/3] overflow-hidden rounded-lg bg-[var(--loombus-surface-strong)] shadow-sm ring-1 ring-[var(--loombus-border)] transition group-hover:-translate-y-0.5 group-hover:shadow-md"><LibraryCoverImage storagePath={publication.cover_url} alt={`${publication.title} cover`} fallbackClassName="h-5 w-5" /></span><h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{publication.title}</h3><p className="mt-0.5 truncate text-xs text-[var(--loombus-text-muted)]">{publication.author_name ?? publication.publisher_name ?? "Loombus Library"}</p></Link></article>)}</div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-10 text-center"><FolderPlus className="mx-auto h-7 w-7 text-[var(--loombus-gold)]" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold">This collection is empty</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--loombus-text-muted)]">Add books from My Library. The same book can be organized into more than one collection without creating duplicate publication records.</p><button type="button" onClick={() => setManagingBooks(true)} className="mt-4 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-semibold text-black">Add Books</button></div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
