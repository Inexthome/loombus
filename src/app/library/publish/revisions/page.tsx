"use client";

import Link from "next/link";
import { ArrowLeft, FileUp, Loader2, RefreshCw, Save, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryVersionNormalizedPreview } from "@/components/library/library-version-normalized-preview";
import { supabase } from "@/lib/supabase/client";

const MAX_EPUB_BYTES = 50 * 1024 * 1024;
const publicationTypes = ["book", "essay", "research", "report", "guide", "article", "other"];

type Publication = { id: string; title: string; subtitle: string | null; publication_type: string; author_name: string | null; publisher_name: string | null; language_code: string; isbn: string | null; status: string };
type RevisionReview = { version_id: string; publication_id: string; submission_status: "draft" | "submitted" | "changes_requested" | "approved" | "rejected"; submitted_at: string | null; reviewed_at: string | null; review_note: string | null; updated_at: string };
type Version = { id: string; publication_id: string; version_number: number; title: string; subtitle: string | null; description: string | null; publication_type: string; author_name: string | null; publisher_name: string | null; language_code: string; isbn: string | null; version_status: string };
type Source = { id: string; version_id: string; byte_size: number; ingestion_status: "pending" | "processing" | "ready" | "failed"; ingestion_error: string | null };
type Form = { title: string; subtitle: string; description: string; publicationType: string; authorName: string; publisherName: string; languageCode: string; isbn: string };

const emptyForm: Form = { title: "", subtitle: "", description: "", publicationType: "book", authorName: "", publisherName: "", languageCode: "en", isbn: "" };

function formFromVersion(version: Version): Form {
  return { title: version.title, subtitle: version.subtitle ?? "", description: version.description ?? "", publicationType: version.publication_type, authorName: version.author_name ?? "", publisherName: version.publisher_name ?? "", languageCode: version.language_code, isbn: version.isbn ?? "" };
}
function payload(form: Form) {
  return { p_title: form.title, p_author_name: form.authorName || null, p_publication_type: form.publicationType, p_subtitle: form.subtitle || null, p_description: form.description || null, p_publisher_name: form.publisherName || null, p_language_code: form.languageCode || "en", p_isbn: form.isbn || null };
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
  const [form, setForm] = useState<Form>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => publications.find((row) => row.id === selectedId) ?? null, [publications, selectedId]);
  const editable = review?.submission_status === "draft" || review?.submission_status === "changes_requested";
  const ready = source?.ingestion_status === "ready";

  const loadRevision = useCallback(async (publicationId: string | null) => {
    setReview(null); setVersion(null); setSource(null); setFile(null); setForm(emptyForm);
    if (!publicationId) return;
    const reviewResult = await supabase.from("library_publication_revision_reviews").select("version_id,publication_id,submission_status,submitted_at,reviewed_at,review_note,updated_at").eq("publication_id", publicationId).order("updated_at", { ascending: false }).limit(10);
    if (reviewResult.error) { setError("Unable to load this publication's revision state."); return; }
    const rows = (reviewResult.data ?? []) as RevisionReview[];
    const chosen = rows.find((row) => ["draft","submitted","changes_requested","approved"].includes(row.submission_status)) ?? rows[0] ?? null;
    if (!chosen) return;
    setReview(chosen);
    const [versionResult, sourceResult] = await Promise.all([
      supabase.from("library_publication_versions").select("id,publication_id,version_number,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,version_status").eq("id", chosen.version_id).single(),
      supabase.from("library_publication_sources").select("id,version_id,byte_size,ingestion_status,ingestion_error").eq("version_id", chosen.version_id).maybeSingle(),
    ]);
    if (versionResult.error || !versionResult.data) { setError("Unable to load the staged revision metadata."); return; }
    const nextVersion = versionResult.data as Version;
    setVersion(nextVersion); setForm(formFromVersion(nextVersion));
    setSource((sourceResult.data ?? null) as Source | null);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true); setError(null);
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) { setError("Sign in to manage published revisions."); setLoading(false); return; }
    const ownership = await supabase.from("library_author_publications").select("publication_id,published_at,retired_at").not("published_at", "is", null).is("retired_at", null);
    if (ownership.error) { setError("Unable to load your published Library works."); setLoading(false); return; }
    const ids = (ownership.data ?? []).map((row) => row.publication_id);
    if (!ids.length) { setPublications([]); setSelectedId(null); setLoading(false); return; }
    const result = await supabase.from("library_publications").select("id,title,subtitle,publication_type,author_name,publisher_name,language_code,isbn,status").in("id", ids).eq("status", "published").order("title");
    if (result.error) { setError("Unable to load your published Library works."); setLoading(false); return; }
    const rows = (result.data ?? []) as Publication[];
    setPublications(rows);
    const nextId = selectedId && rows.some((row) => row.id === selectedId) ? selectedId : rows[0]?.id ?? null;
    setSelectedId(nextId);
    await loadRevision(nextId);
    setLoading(false);
  }, [loadRevision, selectedId]);

  useEffect(() => { void loadWorkspace(); }, []); // load once; explicit refreshes follow mutations

  async function choose(publicationId: string) { setSelectedId(publicationId); setMessage(null); setError(null); await loadRevision(publicationId); }

  async function createRevision() {
    if (!selected || working) return;
    setWorking(true); setError(null); setMessage(null);
    const result = await supabase.rpc("create_library_author_revision", { p_publication_id: selected.id });
    if (result.error) setError("Unable to start a revision. Confirm there is no existing open revision.");
    else { setMessage("Revision created. The currently published version remains live until an approved revision is published."); await loadRevision(selected.id); }
    setWorking(false);
  }

  async function saveRevision() {
    if (!version || !editable || working) return;
    if (!form.title.trim()) { setError("Add a title before saving the revision."); return; }
    setWorking(true); setError(null); setMessage(null);
    const result = await supabase.rpc("update_library_author_revision", { p_version_id: version.id, ...payload(form) });
    if (result.error) setError("Unable to save this revision in its current review state.");
    else { setMessage("Revision metadata saved."); await loadRevision(selectedId); }
    setWorking(false);
  }

  async function uploadAndProcess() {
    if (!version || !editable || !file || working) return;
    setWorking(true); setError(null); setMessage(null);
    try {
      if (!file.name.toLowerCase().endsWith(".epub")) throw new Error("Choose an .epub file.");
      if (file.size < 1 || file.size > MAX_EPUB_BYTES) throw new Error("EPUB files must be 50 MiB or smaller.");
      const sha256 = await sha256File(file);
      const preparedResult = await supabase.rpc("prepare_library_author_revision_epub_source", { p_version_id: version.id, p_byte_size: file.size, p_sha256: sha256 });
      if (preparedResult.error) throw preparedResult.error;
      const prepared = (preparedResult.data as Array<{ source_id: string; storage_bucket: string; storage_path: string }> | null)?.[0];
      if (!prepared) throw new Error("Unable to prepare this revision EPUB.");
      const upload = await supabase.storage.from(prepared.storage_bucket).upload(prepared.storage_path, file, { upsert: true, cacheControl: "0", contentType: "application/epub+zip" });
      if (upload.error) throw upload.error;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("Sign in again before processing this EPUB.");
      const response = await fetch("/api/library/author/ingest-epub", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: prepared.source_id }) });
      const body = await response.json().catch(() => null) as { error?: string; sectionCount?: number } | null;
      if (!response.ok) throw new Error(body?.error ?? "Unable to process this revision EPUB.");
      setMessage(`Revision EPUB processed${body?.sectionCount ? ` into ${body.sectionCount} readable sections` : ""}.`); setFile(null); await loadRevision(selectedId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to upload this revision EPUB."); await loadRevision(selectedId); }
    setWorking(false);
  }

  async function submitRevision() {
    if (!version || !editable || !ready || working) return;
    setWorking(true); setError(null); setMessage(null);
    const save = await supabase.rpc("update_library_author_revision", { p_version_id: version.id, ...payload(form) });
    if (save.error) { setError("Save the revision successfully before submitting it."); setWorking(false); return; }
    const result = await supabase.rpc("submit_library_author_revision", { p_version_id: version.id });
    if (result.error) setError("Unable to submit this revision. Confirm the replacement EPUB is processed and ready.");
    else { setMessage("Revision submitted for Loombus review. The current published version remains live."); await loadRevision(selectedId); }
    setWorking(false);
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-28 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-16 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5"><Link href="/library/publish" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Publishing</Link></div>
        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Controlled revisions</p><h1 className="mt-3 text-3xl font-semibold">Revise a published Library work without replacing it in place.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Loombus stages a new publication version privately. The current version stays readable until the revision is reviewed, approved, and explicitly published by an admin.</p></section>
        {error ? <div role="alert" className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div> : null}
        {message ? <div role="status" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] p-4 text-sm">{message}</div> : null}
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <aside className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Published work</h2>{loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--loombus-gold)]" /> : null}</div><div className="mt-4 space-y-2">{publications.map((row) => <button key={row.id} type="button" onClick={() => void choose(row.id)} className={`w-full rounded-2xl border p-4 text-left ${selectedId===row.id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><p className="font-semibold">{row.title}</p><p className="mt-1 text-xs capitalize text-[var(--loombus-text-muted)]">{row.publication_type}</p></button>)}</div>{!loading && !publications.length ? <p className="mt-4 text-sm text-[var(--loombus-text-muted)]">No currently published author works are available to revise.</p> : null}</aside>
          <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
            {!selected ? <p className="text-sm text-[var(--loombus-text-muted)]">Choose a published work.</p> : !review || !version ? <div><h2 className="text-xl font-semibold">{selected.title}</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">No open revision is staged for this publication.</p><button type="button" disabled={working} onClick={() => void createRevision()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-semibold text-black disabled:opacity-50"><Sparkles className="h-4 w-4" />Create revision</button></div> : <>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Version {version.version_number} · {review.submission_status.replace("_"," ")}</p><h2 className="mt-2 text-xl font-semibold">Staged revision</h2></div>{source?.ingestion_status === "ready" ? <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1.5 text-xs font-semibold">EPUB ready</span> : null}</div>
              {review.review_note ? <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] p-4"><p className="text-xs font-bold text-[var(--loombus-gold)]">Review note</p><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{review.review_note}</p></div> : null}
              <fieldset disabled={!editable || working} className="mt-5 grid gap-4 disabled:opacity-70"><label className="grid gap-2 text-sm font-medium">Title<input value={form.title} onChange={(e)=>setForm((x)=>({...x,title:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label><label className="grid gap-2 text-sm font-medium">Subtitle<input value={form.subtitle} onChange={(e)=>setForm((x)=>({...x,subtitle:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label><label className="grid gap-2 text-sm font-medium">Description<textarea rows={5} value={form.description} onChange={(e)=>setForm((x)=>({...x,description:e.target.value}))} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Type<select value={form.publicationType} onChange={(e)=>setForm((x)=>({...x,publicationType:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3">{publicationTypes.map((type)=><option key={type}>{type}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Language<input value={form.languageCode} onChange={(e)=>setForm((x)=>({...x,languageCode:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium">Author<input value={form.authorName} onChange={(e)=>setForm((x)=>({...x,authorName:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label><label className="grid gap-2 text-sm font-medium">Publisher<input value={form.publisherName} onChange={(e)=>setForm((x)=>({...x,publisherName:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label></div><label className="grid gap-2 text-sm font-medium">ISBN<input value={form.isbn} onChange={(e)=>setForm((x)=>({...x,isbn:e.target.value}))} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label></fieldset>
              <div className="mt-5 flex flex-wrap gap-2">{editable ? <button type="button" disabled={working} onClick={() => void saveRevision()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold"><Save className="h-4 w-4" />Save revision</button> : null}<LibraryVersionNormalizedPreview versionId={version.id} disabled={!ready || working} /></div>
              <section className="mt-6 border-t border-[var(--loombus-border)] pt-5"><p className="text-sm font-semibold">Replacement EPUB</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">The original remains private. Processing writes normalized sections only to Version {version.version_number}.</p>{source ? <p className="mt-3 text-xs capitalize text-[var(--loombus-text-muted)]">Status: {source.ingestion_status}{source.ingestion_error ? ` · ${source.ingestion_error}` : ""}</p> : null}{editable ? <div className="mt-4 flex flex-wrap items-end gap-3"><input type="file" accept=".epub,application/epub+zip" onChange={(e)=>setFile(e.target.files?.[0]??null)} className="min-h-11 flex-1 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-2 text-sm" /><button type="button" disabled={!file || working} onClick={() => void uploadAndProcess()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-50">{source ? <RefreshCw className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}{source ? "Replace & process" : "Upload & process"}</button></div> : null}</section>
              {editable ? <button type="button" disabled={!ready || working} onClick={() => void submitRevision()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black disabled:opacity-50"><Send className="h-4 w-4" />Submit revision for review</button> : <p className="mt-6 text-sm text-[var(--loombus-text-muted)]">This revision is locked in its current editorial state. The live publication has not been replaced.</p>}
            </>}
          </section>
        </div>
      </div>
    </main>
  );
}
