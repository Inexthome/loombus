"use client";

import Link from "next/link";
import { ArrowLeft, FileUp, Loader2, RefreshCw, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryAuthorProofingPreflight } from "@/components/library/library-author-proofing-preflight";
import { LibraryBibliographicMetadataEditor } from "@/components/library/library-bibliographic-metadata-editor";
import { LibraryVersionNormalizedPreview } from "@/components/library/library-version-normalized-preview";
import { supabase } from "@/lib/supabase/client";

const MAX_EPUB_BYTES = 50 * 1024 * 1024;
const publicationTypes = ["book", "essay", "research", "report", "guide", "article", "other"];

type Publication = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  isbn: string | null;
  status: string;
  active_version_id: string | null;
};

type RevisionReview = {
  version_id: string;
  publication_id: string;
  submission_status: "draft" | "submitted" | "changes_requested" | "approved" | "rejected";
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  updated_at: string;
};

type Version = {
  id: string;
  publication_id: string;
  version_number: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  isbn: string | null;
  version_status: string;
  published_at?: string | null;
  superseded_at?: string | null;
};

type Source = {
  id: string;
  version_id: string;
  byte_size: number;
  ingestion_status: "pending" | "processing" | "ready" | "failed";
  ingestion_error: string | null;
};

type Form = {
  title: string;
  subtitle: string;
  description: string;
  publicationType: string;
  authorName: string;
  publisherName: string;
  languageCode: string;
  isbn: string;
};

const emptyForm: Form = {
  title: "",
  subtitle: "",
  description: "",
  publicationType: "book",
  authorName: "",
  publisherName: "",
  languageCode: "en",
  isbn: "",
};

function formFromVersion(version: Version): Form {
  return {
    title: version.title,
    subtitle: version.subtitle ?? "",
    description: version.description ?? "",
    publicationType: version.publication_type,
    authorName: version.author_name ?? "",
    publisherName: version.publisher_name ?? "",
    languageCode: version.language_code,
    isbn: version.isbn ?? "",
  };
}

function payload(form: Form) {
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

function reviewStatusLabel(status: RevisionReview["submission_status"]) {
  return status.replace("_", " ");
}

function displayValue(value: string | null | undefined) {
  return value?.trim() || "—";
}

function changed(live: string | null | undefined, staged: string | null | undefined) {
  return (live ?? "").trim() !== (staged ?? "").trim();
}

async function sha256File(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export default function LibraryPublishedRevisionsPage() {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [review, setReview] = useState<RevisionReview | null>(null);
  const [version, setVersion] = useState<Version | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [history, setHistory] = useState<Version[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [proofingReady, setProofingReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => publications.find((row) => row.id === selectedId) ?? null,
    [publications, selectedId],
  );
  const editable = review?.submission_status === "draft" || review?.submission_status === "changes_requested";
  const ready = source?.ingestion_status === "ready";

  const loadRevision = useCallback(async (publicationId: string | null) => {
    setReview(null);
    setVersion(null);
    setSource(null);
    setHistory([]);
    setFile(null);
    setProofingReady(false);
    setForm(emptyForm);
    if (!publicationId) return;

    const [reviewResult, historyResult] = await Promise.all([
      supabase
        .from("library_publication_revision_reviews")
        .select("version_id,publication_id,submission_status,submitted_at,reviewed_at,review_note,updated_at")
        .eq("publication_id", publicationId)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("library_publication_versions")
        .select("id,publication_id,version_number,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,version_status,published_at,superseded_at")
        .eq("publication_id", publicationId)
        .order("version_number", { ascending: false }),
    ]);

    if (reviewResult.error || historyResult.error) {
      setError("Unable to load this publication's revision state.");
      return;
    }

    setHistory((historyResult.data ?? []) as Version[]);
    const rows = (reviewResult.data ?? []) as RevisionReview[];
    const chosen = rows.find((row) => ["draft", "submitted", "changes_requested", "approved"].includes(row.submission_status)) ?? rows[0] ?? null;
    if (!chosen) return;

    setReview(chosen);
    const [versionResult, sourceResult] = await Promise.all([
      supabase
        .from("library_publication_versions")
        .select("id,publication_id,version_number,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,version_status,published_at,superseded_at")
        .eq("id", chosen.version_id)
        .single(),
      supabase
        .from("library_publication_sources")
        .select("id,version_id,byte_size,ingestion_status,ingestion_error")
        .eq("version_id", chosen.version_id)
        .maybeSingle(),
    ]);

    if (versionResult.error || !versionResult.data) {
      setError("Unable to load the staged revision metadata.");
      return;
    }

    const nextVersion = versionResult.data as Version;
    setVersion(nextVersion);
    setForm(formFromVersion(nextVersion));
    setSource((sourceResult.data ?? null) as Source | null);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    const auth = await supabase.auth.getUser();
    if (!auth.data.user) {
      setError("Sign in to manage published revisions.");
      setLoading(false);
      return;
    }

    const ownership = await supabase
      .from("library_author_publications")
      .select("publication_id,published_at,retired_at")
      .not("published_at", "is", null)
      .is("retired_at", null);

    if (ownership.error) {
      setError("Unable to load your published Library works.");
      setLoading(false);
      return;
    }

    const ids = (ownership.data ?? []).map((row) => row.publication_id);
    if (!ids.length) {
      setPublications([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }

    const result = await supabase
      .from("library_publications")
      .select("id,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,status,active_version_id")
      .in("id", ids)
      .eq("status", "published")
      .order("title");

    if (result.error) {
      setError("Unable to load your published Library works.");
      setLoading(false);
      return;
    }

    const rows = (result.data ?? []) as Publication[];
    setPublications(rows);
    const nextId = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id ?? null;
    setSelectedId(nextId);
    await loadRevision(nextId);
    setLoading(false);
  }, [loadRevision, selectedId]);

  useEffect(() => {
    void loadWorkspace();
    // Initial workspace hydration only; subsequent selection changes call loadRevision directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choose(publicationId: string) {
    setSelectedId(publicationId);
    setMessage(null);
    setError(null);
    await loadRevision(publicationId);
  }

  function updateField<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setProofingReady(false);
  }

  async function createRevision() {
    if (!selected || working) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    const result = await supabase.rpc("create_library_author_revision", { p_publication_id: selected.id });
    if (result.error) setError("Unable to start a revision. Confirm there is no existing open revision.");
    else {
      setMessage("Revision created. The currently published version remains live until an approved revision is published.");
      await loadRevision(selected.id);
    }
    setWorking(false);
  }

  async function saveRevision() {
    if (!version || !editable || working) return;
    if (!form.title.trim()) {
      setError("Add a title before saving the revision.");
      return;
    }
    setWorking(true);
    setError(null);
    setMessage(null);
    const result = await supabase.rpc("update_library_author_revision", { p_version_id: version.id, ...payload(form) });
    if (result.error) setError("Unable to save this revision in its current review state.");
    else {
      setMessage("Revision metadata saved. Review the final comparison and proof before submission.");
      await loadRevision(selectedId);
    }
    setWorking(false);
  }

  async function uploadAndProcess() {
    if (!version || !editable || !file || working) return;
    setWorking(true);
    setError(null);
    setMessage(null);
    setProofingReady(false);
    try {
      if (!file.name.toLowerCase().endsWith(".epub")) throw new Error("Choose an .epub file.");
      if (file.size < 1 || file.size > MAX_EPUB_BYTES) throw new Error("EPUB files must be 50 MiB or smaller.");
      const sha256 = await sha256File(file);
      const preparedResult = await supabase.rpc("prepare_library_author_revision_epub_source", {
        p_version_id: version.id,
        p_byte_size: file.size,
        p_sha256: sha256,
      });
      if (preparedResult.error) throw preparedResult.error;
      const prepared = (preparedResult.data as Array<{ source_id: string; storage_bucket: string; storage_path: string }> | null)?.[0];
      if (!prepared) throw new Error("Unable to prepare this revision EPUB.");

      const upload = await supabase.storage.from(prepared.storage_bucket).upload(prepared.storage_path, file, {
        upsert: true,
        cacheControl: "0",
        contentType: "application/epub+zip",
      });
      if (upload.error) throw upload.error;

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Sign in again before processing this EPUB.");

      const response = await fetch("/api/library/author/ingest-epub", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: prepared.source_id }),
      });
      const body = await response.json().catch(() => null) as { error?: string; sectionCount?: number } | null;
      if (!response.ok) throw new Error(body?.error ?? "Unable to process this revision EPUB.");

      setMessage(`Revision EPUB processed${body?.sectionCount ? ` into ${body.sectionCount} readable sections` : ""}. Review the proof and reconfirm preflight.`);
      setFile(null);
      await loadRevision(selectedId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to upload this revision EPUB.");
      await loadRevision(selectedId);
    }
    setWorking(false);
  }

  async function submitRevision() {
    if (!version || !editable || !ready || !proofingReady || working) return;
    setWorking(true);
    setError(null);
    setMessage(null);

    const save = await supabase.rpc("update_library_author_revision", { p_version_id: version.id, ...payload(form) });
    if (save.error) {
      setError("Save the revision successfully before submitting it.");
      setWorking(false);
      return;
    }

    const result = await supabase.rpc("submit_library_author_revision", { p_version_id: version.id });
    if (result.error) {
      setError("Unable to submit this revision. Reopen the current proof and confirm final preflight for the staged EPUB.");
    } else {
      setMessage("Revision submitted for Loombus review. The current published version remains live.");
      await loadRevision(selectedId);
    }
    setWorking(false);
  }

  const comparisonRows = selected && version ? [
    ["Title", selected.title, form.title],
    ["Subtitle", selected.subtitle, form.subtitle],
    ["Description", selected.description, form.description],
    ["Type", selected.publication_type, form.publicationType],
    ["Author", selected.author_name, form.authorName],
    ["Publisher", selected.publisher_name, form.publisherName],
    ["Language", selected.language_code, form.languageCode],
    ["ISBN", selected.isbn, form.isbn],
  ] as Array<[string, string | null, string | null]> : [];

  return (
    <main data-library-publish-editorial className="library-publish-page">
      <div className="library-publish-shell">
        <div className="library-publish-topbar">
          <Link href="/library/publish" className="library-publish-back"><ArrowLeft aria-hidden="true" />Publishing</Link>
          <span className="library-publish-state">Published revisions</span>
        </div>

        <header className="library-publish-header">
          <p className="library-publish-eyebrow">Controlled revisions</p>
          <h1>Revise published work without interrupting the live edition.</h1>
          <p>Stage a private next version, compare it against the live edition, proof the exact Reader output, confirm publishing rights, and submit it for Loombus review. The live version remains readable until an approved revision is explicitly published.</p>
        </header>

        {error ? <div role="alert" className="library-publish-feedback library-publish-feedback-error">{error}</div> : null}
        {message ? <div role="status" className="library-publish-feedback library-publish-feedback-success">{message}</div> : null}

        <div className="library-publish-workspace">
          <aside className="library-publish-rail" aria-labelledby="library-revisions-list-heading">
            <div className="library-publish-rail-heading">
              <div><p className="library-publish-eyebrow">Your live catalog</p><h2 id="library-revisions-list-heading">Published work</h2></div>
              {loading ? <Loader2 className="library-publish-spinner" aria-label="Loading published work" /> : null}
            </div>
            {!loading && !publications.length ? <p className="library-publish-empty">No currently published author works are available to revise.</p> : null}
            <div className="library-publish-list" role="list">
              {publications.map((row) => (
                <button key={row.id} type="button" role="listitem" data-active={selectedId === row.id} onClick={() => void choose(row.id)} className="library-publish-publication">
                  <span className="library-publish-publication-title">{row.title}</span>
                  <span className="library-publish-publication-meta"><span className="library-publish-status">published</span><span className="library-publish-type">{row.publication_type}</span></span>
                </button>
              ))}
            </div>
          </aside>

          <article className="library-publish-editor">
            {!selected ? (
              <div className="library-publish-empty">Choose a published work to manage its next revision.</div>
            ) : !review || !version ? (
              <>
                <header className="library-publish-editor-header"><div><p className="library-publish-eyebrow">Published</p><h2>{selected.title}</h2></div><span className="library-publish-state">Live version protected</span></header>
                <p className="library-publish-lock-note">No open revision is staged. Starting one creates a private version snapshot; it does not modify or unpublish the edition readers can currently access.</p>
                <footer className="library-publish-actions"><div className="library-publish-secondary-actions" /><button type="button" disabled={working} onClick={() => void createRevision()} className="library-publish-primary">{working ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Create revision</button></footer>
              </>
            ) : (
              <>
                <header className="library-publish-editor-header">
                  <div><p className="library-publish-eyebrow">Version {version.version_number} · {reviewStatusLabel(review.submission_status)}</p><h2>Staged revision</h2></div>
                  <span className="library-publish-state">{proofingReady ? "Preflight complete" : ready ? "Proof required" : "Live version protected"}</span>
                </header>

                {review.review_note ? <aside className="library-publish-review-note" aria-label="Review note"><p className="library-publish-eyebrow">Review note</p><p>{review.review_note}</p></aside> : null}

                <fieldset disabled={!editable || working} className="library-publish-fields">
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

                <LibraryBibliographicMetadataEditor mode="revision" versionId={version.id} editable={Boolean(editable && !working)} />

                <section className="library-publish-commerce" aria-labelledby="library-revision-comparison-heading">
                  <div className="library-publish-commerce-heading"><div><p className="library-publish-eyebrow">Live vs staged</p><h3 id="library-revision-comparison-heading">Review what this revision changes.</h3></div></div>
                  <p className="library-publish-commerce-copy">The left value is live now. The right value is the staged Version {version.version_number}. Changed fields are marked before you proof and submit.</p>
                  <div className="library-publish-comparison" role="table" aria-label="Live and staged metadata comparison">
                    {comparisonRows.map(([label, liveValue, stagedValue]) => (
                      <div key={label} role="row" data-changed={changed(liveValue, stagedValue)}>
                        <strong role="rowheader">{label}</strong>
                        <span role="cell"><small>Live</small>{displayValue(liveValue)}</span>
                        <span role="cell"><small>Staged</small>{displayValue(stagedValue)}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="library-publish-commerce" aria-labelledby="library-revision-epub-heading">
                  <div className="library-publish-commerce-heading"><div><p className="library-publish-eyebrow">Replacement EPUB</p><h3 id="library-revision-epub-heading">Stage the content for Version {version.version_number}.</h3></div></div>
                  <p className="library-publish-commerce-copy">The live edition remains untouched. Loombus keeps the uploaded EPUB private and writes normalized readable sections only to this staged revision.</p>
                  {source ? <p className="library-publish-lock-note">Processing status: <strong>{source.ingestion_status}</strong>{source.ingestion_error ? ` · ${source.ingestion_error}` : ""}</p> : null}
                  {editable ? (
                    <div className="library-publish-commerce-fields">
                      <label className="library-publish-field"><span className="library-publish-field-label">EPUB file <span>Maximum 50 MiB</span></span><input type="file" accept=".epub,application/epub+zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                      <button type="button" disabled={!file || working} onClick={() => void uploadAndProcess()} className="library-publish-secondary">{working ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : source ? <RefreshCw aria-hidden="true" /> : <FileUp aria-hidden="true" />}{source ? "Replace & process" : "Upload & process"}</button>
                    </div>
                  ) : null}
                  <div className="library-publish-secondary-actions"><LibraryVersionNormalizedPreview versionId={version.id} disabled={!ready || working} /></div>
                </section>

                <LibraryAuthorProofingPreflight publicationId={selected.id} versionId={version.id} editable={Boolean(editable && !working)} sourceReady={ready} onReadyChange={setProofingReady} />

                <section className="library-publish-commerce" aria-labelledby="library-revision-history-heading">
                  <div className="library-publish-commerce-heading"><div><p className="library-publish-eyebrow">Version history</p><h3 id="library-revision-history-heading">Durable publication lineage</h3></div></div>
                  <p className="library-publish-commerce-copy">Earlier editions remain historical records. Publishing this revision will supersede—not delete—the current active version.</p>
                  <div className="library-publish-history">
                    {history.map((item) => (
                      <p key={item.id} data-current={item.id === selected.active_version_id} data-staged={item.id === version.id}>
                        <strong>Version {item.version_number}</strong>
                        <span>{item.version_status}{item.id === selected.active_version_id ? " · live" : item.id === version.id ? " · staged" : ""}</span>
                        <small>{item.title}</small>
                      </p>
                    ))}
                  </div>
                </section>

                {!editable ? <p className="library-publish-lock-note">This revision is locked in its current editorial state. The live publication remains unchanged while Loombus review controls the next transition.</p> : null}

                <footer className="library-publish-actions">
                  <div className="library-publish-secondary-actions">
                    {editable ? <button type="button" disabled={working} onClick={() => void saveRevision()} className="library-publish-secondary">{working ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : <Save aria-hidden="true" />}Save revision</button> : null}
                  </div>
                  {editable ? <button type="button" disabled={!ready || !proofingReady || working} onClick={() => void submitRevision()} className="library-publish-primary"><Send aria-hidden="true" />Submit for review</button> : null}
                </footer>
              </>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}
