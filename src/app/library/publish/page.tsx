"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { LibraryAuthorCommerceEditor } from "@/components/library/library-author-commerce-editor";
import { LibraryAuthorEpubUpload } from "@/components/library/library-author-epub-upload";
import { LibraryBibliographicMetadataEditor } from "@/components/library/library-bibliographic-metadata-editor";
import { supabase } from "@/lib/supabase/client";

type SubmissionStatus = "draft" | "submitted" | "changes_requested" | "approved" | "rejected";

type AuthorPublicationRow = {
  publication_id: string;
  submission_status: SubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  published_at: string | null;
  retired_at: string | null;
  updated_at: string;
};

type PublicationRow = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  isbn: string | null;
  status: "draft" | "published" | "archived";
  is_free: boolean;
  price_cents: number | null;
  currency: string | null;
};

type AuthorPublication = AuthorPublicationRow & { publication: PublicationRow };

type DraftForm = {
  title: string;
  subtitle: string;
  description: string;
  publicationType: string;
  authorName: string;
  publisherName: string;
  languageCode: string;
  isbn: string;
};

const emptyForm: DraftForm = {
  title: "",
  subtitle: "",
  description: "",
  publicationType: "book",
  authorName: "",
  publisherName: "",
  languageCode: "en",
  isbn: "",
};

const publicationTypes = ["book", "essay", "research", "report", "guide", "article", "other"];

function formFromPublication(publication: PublicationRow): DraftForm {
  return {
    title: publication.title,
    subtitle: publication.subtitle ?? "",
    description: publication.description ?? "",
    publicationType: publication.publication_type,
    authorName: publication.author_name ?? "",
    publisherName: publication.publisher_name ?? "",
    languageCode: publication.language_code,
    isbn: publication.isbn ?? "",
  };
}

function rpcPayload(form: DraftForm) {
  return {
    p_title: form.title,
    p_author_name: form.authorName || null,
    p_publication_type: form.publicationType,
    p_subtitle: form.subtitle || null,
    p_description: form.description || null,
    p_publisher_name: form.publisherName || null,
    p_language_code: form.languageCode || "en",
    p_isbn: form.isbn || null,
  };
}

function authorStatusLabel(row: AuthorPublication) {
  if (row.retired_at) return "unpublished";
  if (row.published_at) return "published";
  return row.submission_status.replace("_", " ");
}

export default function LibraryPublishPage() {
  const [rows, setRows] = useState<AuthorPublication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentReady, setContentReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.publication_id === selectedId) ?? null,
    [rows, selectedId]
  );

  const editable = Boolean(
    selected &&
      selected.publication.status === "draft" &&
      ["draft", "changes_requested"].includes(selected.submission_status)
  );
  const deletable = Boolean(
    selected &&
      !selected.published_at &&
      !selected.retired_at &&
      ["draft", "changes_requested", "rejected"].includes(selected.submission_status)
  );
  const retirable = Boolean(selected && !selected.published_at && selected.publication.status === "archived" && !selected.retired_at);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) {
      setRows([]);
      setSelectedId(null);
      setLoading(false);
      setError("Sign in to manage Library publishing.");
      return;
    }

    const authorResult = await supabase
      .from("library_author_publications")
      .select("publication_id,submission_status,submitted_at,reviewed_at,review_note,published_at,retired_at,updated_at")
      .is("retired_at", null)
      .order("updated_at", { ascending: false });

    if (authorResult.error) {
      setRows([]);
      setLoading(false);
      setError("Unable to load your Library publications.");
      return;
    }

    const authorRows = (authorResult.data ?? []) as AuthorPublicationRow[];
    if (!authorRows.length) {
      setRows([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const publicationIds = authorRows.map((row) => row.publication_id);
    const publicationResult = await supabase
      .from("library_publications")
      .select("id,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,status,is_free,price_cents,currency")
      .in("id", publicationIds);

    if (publicationResult.error) {
      setRows([]);
      setLoading(false);
      setError("Unable to load publication metadata.");
      return;
    }

    const publications = new Map(
      ((publicationResult.data ?? []) as PublicationRow[]).map((publication) => [publication.id, publication])
    );
    const nextRows = authorRows.flatMap((authorRow) => {
      const publication = publications.get(authorRow.publication_id);
      return publication ? [{ ...authorRow, publication }] : [];
    });
    setRows(nextRows);

    const nextSelectedId = selectedId && nextRows.some((row) => row.publication_id === selectedId)
      ? selectedId
      : nextRows[0]?.publication_id ?? null;
    setSelectedId(nextSelectedId);
    const nextSelected = nextRows.find((row) => row.publication_id === nextSelectedId) ?? null;
    setForm(nextSelected ? formFromPublication(nextSelected.publication) : emptyForm);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => {
    void loadWorkspace();
    // Initial workspace hydration only; explicit actions reload the workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choosePublication(row: AuthorPublication) {
    setSelectedId(row.publication_id);
    setForm(formFromPublication(row.publication));
    setContentReady(false);
    setMessage(null);
    setError(null);
  }

  function startNewDraft() {
    setSelectedId(null);
    setForm(emptyForm);
    setContentReady(false);
    setMessage(null);
    setError(null);
  }

  function updateField<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setContentReady(false);
  }

  async function saveDraft() {
    if (saving) return;
    if (!form.title.trim()) {
      setError("Add a title before saving this publication.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (selected) {
        const result = await supabase.rpc("update_library_author_publication", {
          p_publication_id: selected.publication_id,
          ...rpcPayload(form),
        });
        if (result.error) throw result.error;
        setMessage("Publication draft saved.");
      } else {
        const result = await supabase.rpc("create_library_author_publication", rpcPayload(form));
        if (result.error) throw result.error;
        const createdId = typeof result.data === "string" ? result.data : null;
        if (createdId) setSelectedId(createdId);
        setMessage("Private publication draft created.");
      }
      setContentReady(false);
      await loadWorkspace();
    } catch (saveError) {
      console.error("Unable to save Library publication.", saveError);
      setError("Unable to save this publication in its current state.");
    } finally {
      setSaving(false);
    }
  }

  async function submitForReview() {
    if (!selected || !editable || !contentReady || saving) return;
    if (!form.title.trim()) {
      setError("Add a title before submitting this publication.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const saveResult = await supabase.rpc("update_library_author_publication", {
        p_publication_id: selected.publication_id,
        ...rpcPayload(form),
      });
      if (saveResult.error) throw saveResult.error;

      const submitResult = await supabase.rpc("submit_library_author_publication", {
        p_publication_id: selected.publication_id,
      });
      if (submitResult.error) throw submitResult.error;

      setContentReady(false);
      await loadWorkspace();
      setMessage("Publication submitted for Loombus review.");
    } catch (submitError) {
      console.error("Unable to submit Library publication.", submitError);
      setError("Unable to submit this publication. Review the current EPUB proof and complete final preflight before trying again.");
    } finally {
      setSaving(false);
    }
  }

  async function deletePublication() {
    if (!selected || !deletable || saving) return;
    const confirmed = window.confirm(
      `Permanently delete “${selected.publication.title}”? This is allowed only because it has never been published. This action cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const sourceResult = await supabase
        .from("library_publication_sources")
        .select("storage_bucket,storage_path")
        .eq("publication_id", selected.publication_id)
        .maybeSingle();
      if (sourceResult.error) throw sourceResult.error;

      if (sourceResult.data?.storage_bucket && sourceResult.data?.storage_path) {
        const storageResult = await supabase.storage
          .from(sourceResult.data.storage_bucket)
          .remove([sourceResult.data.storage_path]);
        if (storageResult.error) throw storageResult.error;
      }

      const deleteResult = await supabase.rpc("delete_library_author_unpublished_publication", {
        p_publication_id: selected.publication_id,
      });
      if (deleteResult.error) throw deleteResult.error;

      setSelectedId(null);
      setForm(emptyForm);
      setContentReady(false);
      await loadWorkspace();
      setMessage("Never-published publication deleted permanently.");
    } catch (deleteError) {
      console.error("Unable to delete Library publication.", deleteError);
      setError("Unable to delete this publication. Published history and review-state safeguards remain in force.");
    } finally {
      setSaving(false);
    }
  }

  async function retirePublication() {
    if (!selected || !retirable || saving) return;
    const confirmed = window.confirm(
      `Delete “${selected.publication.title}” from your publishing workspace? It will remain unpublished and cannot be republished. Loombus will preserve historical references internally so existing Library activity does not break.`
    );
    if (!confirmed) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const result = await supabase.rpc("retire_library_author_unpublished_publication", {
        p_publication_id: selected.publication_id,
      });
      if (result.error) throw result.error;

      setSelectedId(null);
      setForm(emptyForm);
      setContentReady(false);
      await loadWorkspace();
      setMessage("Unpublished publication removed from your publishing workspace. Historical Library references remain preserved.");
    } catch (retireError) {
      console.error("Unable to retire Library publication.", retireError);
      setError("Unable to remove this unpublished publication from your workspace.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main data-library-publish-editorial className="library-publish-page">
      <div className="library-publish-shell">
        <div className="library-publish-topbar">
          <Link href="/library" className="library-publish-back"><ArrowLeft aria-hidden="true" />Library</Link>
          <button type="button" onClick={startNewDraft} className="library-publish-new"><Sparkles aria-hidden="true" />New publication</button>
        </div>

        <header className="library-publish-header">
          <p className="library-publish-eyebrow">Author Publishing</p>
          <h1>Prepare work for the Loombus Library.</h1>
          <p>Create and refine publication metadata, upload its EPUB, choose free or paid access, proof the exact Reader edition, then submit it for review. Drafts remain private; authors cannot directly publish or approve their own work.</p>
        </header>

        {error ? <div role="alert" className="library-publish-feedback library-publish-feedback-error">{error}</div> : null}
        {message ? <div role="status" className="library-publish-feedback library-publish-feedback-success">{message}</div> : null}

        <div className="library-publish-workspace">
          <aside className="library-publish-rail" aria-labelledby="library-publish-list-heading">
            <div className="library-publish-rail-heading"><div><p className="library-publish-eyebrow">Your work</p><h2 id="library-publish-list-heading">Publications</h2></div>{loading ? <Loader2 className="library-publish-spinner" aria-label="Loading publications" /> : null}</div>
            {!loading && !rows.length ? <p className="library-publish-empty">No author publications yet. Create your first private draft.</p> : null}
            <div className="library-publish-list" role="list">
              {rows.map((row) => (
                <button key={row.publication_id} type="button" role="listitem" data-active={selectedId === row.publication_id} onClick={() => choosePublication(row)} className="library-publish-publication">
                  <span className="library-publish-publication-title">{row.publication.title}</span>
                  <span className="library-publish-publication-meta"><span className="library-publish-status">{authorStatusLabel(row)}</span><span className="library-publish-type">{row.publication.publication_type}</span></span>
                </button>
              ))}
            </div>
          </aside>

          <article className="library-publish-editor">
            <header className="library-publish-editor-header">
              <div><p className="library-publish-eyebrow">{selected ? authorStatusLabel(selected) : "New draft"}</p><h2>Publication details</h2></div>
              {selected?.publication.status === "published" ? <span className="library-publish-state">Published to Library</span> : selected?.publication.status === "archived" ? <span className="library-publish-state">Unpublished · history preserved</span> : selected?.submission_status === "approved" ? <span className="library-publish-state">Approved for controlled publishing</span> : null}
            </header>

            {selected?.review_note ? <aside className="library-publish-review-note" aria-label="Review note"><p className="library-publish-eyebrow">Review note</p><p>{selected.review_note}</p></aside> : null}

            <fieldset disabled={!editable || saving} className="library-publish-fields">
              <label className="library-publish-field"><span className="library-publish-field-label">Title</span><input value={form.title} onChange={(event) => updateField("title", event.target.value)} maxLength={200} /></label>
              <label className="library-publish-field"><span className="library-publish-field-label">Subtitle <span>Optional</span></span><input value={form.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} /></label>
              <label className="library-publish-field"><span className="library-publish-field-label">Description <span>Optional</span></span><textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={5} /></label>
              <div className="library-publish-field-grid">
                <label className="library-publish-field"><span className="library-publish-field-label">Type</span><select value={form.publicationType} onChange={(event) => updateField("publicationType", event.target.value)}>{publicationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label className="library-publish-field"><span className="library-publish-field-label">Language</span><input value={form.languageCode} onChange={(event) => updateField("languageCode", event.target.value)} maxLength={12} /></label>
              </div>
              <div className="library-publish-field-grid">
                <label className="library-publish-field"><span className="library-publish-field-label">Author name <span>Optional</span></span><input value={form.authorName} onChange={(event) => updateField("authorName", event.target.value)} /></label>
                <label className="library-publish-field"><span className="library-publish-field-label">Publisher <span>Optional</span></span><input value={form.publisherName} onChange={(event) => updateField("publisherName", event.target.value)} /></label>
              </div>
              <label className="library-publish-field"><span className="library-publish-field-label">ISBN <span>Optional</span></span><input value={form.isbn} onChange={(event) => updateField("isbn", event.target.value)} /></label>
            </fieldset>

            <LibraryBibliographicMetadataEditor mode="publication" publicationId={selected?.publication_id ?? null} editable={Boolean(selected && editable)} />

            <LibraryAuthorCommerceEditor publicationId={selected?.publication_id ?? null} editable={Boolean(selected && editable)} isFree={selected?.publication.is_free ?? true} priceCents={selected?.publication.price_cents ?? null} currency={selected?.publication.currency ?? null} onSaved={loadWorkspace} />

            <LibraryAuthorEpubUpload publicationId={selected?.publication_id ?? null} editable={Boolean(selected && editable)} published={selected?.publication.status === "published"} onReadyChange={setContentReady} />

            {selected && !editable ? (
              <p className="library-publish-lock-note">{selected.publication.status === "published" ? "This publication is published in the Loombus Library and is locked from author-side draft editing." : selected.publication.status === "archived" ? "This publication is currently unpublished. You may remove it from your publishing workspace; Loombus will preserve historical references so prior Library activity does not break." : "This publication is locked while it is in its current review state. Loombus review controls approval and publishing."}</p>
            ) : null}

            <footer className="library-publish-actions">
              <div className="library-publish-secondary-actions">
                {editable ? <button type="button" disabled={saving} onClick={() => void saveDraft()} className="library-publish-secondary">{saving ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : <BookOpen aria-hidden="true" />}Save draft</button> : null}
                {selected && deletable ? <button type="button" disabled={saving} onClick={() => void deletePublication()} className="library-publish-destructive"><Trash2 aria-hidden="true" />Delete publication</button> : null}
                {selected && retirable ? <button type="button" disabled={saving} onClick={() => void retirePublication()} className="library-publish-destructive"><Trash2 aria-hidden="true" />Delete publication</button> : null}
              </div>
              {selected && editable ? <button type="button" disabled={saving || !contentReady} onClick={() => void submitForReview()} className="library-publish-primary"><Send aria-hidden="true" />Submit for review</button> : null}
            </footer>
          </article>
        </div>
      </div>
    </main>
  );
}
