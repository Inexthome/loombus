"use client";

import { useCallback, useEffect, useState } from "react";
import { FileUp, Loader2, RefreshCw } from "lucide-react";
import { LibraryAuthorCoverUpload } from "@/components/library/library-author-cover-upload";
import { LibraryAuthorNormalizedPreview } from "@/components/library/library-author-normalized-preview";
import { supabase } from "@/lib/supabase/client";

const MAX_EPUB_BYTES = 50 * 1024 * 1024;

type SourceRow = { id: string; publication_id: string; storage_bucket: string; storage_path: string; byte_size: number; ingestion_status: "pending" | "processing" | "ready" | "failed"; ingestion_error: string | null; updated_at: string };
type PreparedSourceRow = { source_id: string; storage_bucket: string; storage_path: string };
type Props = { publicationId: string | null; editable: boolean; published: boolean; onReadyChange: (ready: boolean) => void };

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value < 1) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

async function sha256File(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function statusCopy(source: SourceRow | null) {
  if (!source) return "No EPUB uploaded yet.";
  if (source.ingestion_status === "ready") return "EPUB processed successfully. Readable content is ready for review.";
  if (source.ingestion_status === "processing") return "Loombus is processing this EPUB.";
  if (source.ingestion_status === "failed") return "The EPUB could not be processed. You can replace it and try again.";
  return "EPUB uploaded and waiting for processing.";
}

export function LibraryAuthorEpubUpload({ publicationId, editable, published, onReadyChange }: Props) {
  const [source, setSource] = useState<SourceRow | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadSource = useCallback(async () => {
    onReadyChange(false);
    if (!publicationId) { setSource(null); return; }
    setLoading(true);
    const result = await supabase.from("library_publication_sources").select("id, publication_id, storage_bucket, storage_path, byte_size, ingestion_status, ingestion_error, updated_at").eq("publication_id", publicationId).maybeSingle();
    if (result.error) { setSource(null); setError("Unable to load EPUB status."); setLoading(false); return; }
    const nextSource = (result.data ?? null) as SourceRow | null;
    setSource(nextSource); onReadyChange(nextSource?.ingestion_status === "ready"); setLoading(false);
  }, [onReadyChange, publicationId]);

  useEffect(() => { setFile(null); setError(null); setMessage(null); void loadSource(); }, [loadSource]);

  async function uploadAndProcess() {
    if (!publicationId || !editable || !file) return;
    setUploading(true); setError(null); setMessage(null); onReadyChange(false);
    try {
      if (!file.name.toLowerCase().endsWith(".epub")) throw new Error("Choose an .epub file.");
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_EPUB_BYTES) throw new Error("EPUB files must be 50 MiB or smaller.");
      if (file.type && file.type !== "application/epub+zip" && file.type !== "application/octet-stream") throw new Error("Choose a valid EPUB file.");
      const sha256 = await sha256File(file);
      const prepareResult = await supabase.rpc("prepare_library_author_epub_source", { p_publication_id: publicationId, p_byte_size: file.size, p_sha256: sha256 });
      if (prepareResult.error) throw prepareResult.error;
      const prepared = ((prepareResult.data ?? []) as PreparedSourceRow[])[0];
      if (!prepared) throw new Error("Unable to prepare this EPUB upload.");
      const uploadResult = await supabase.storage.from(prepared.storage_bucket).upload(prepared.storage_path, file, { upsert: true, cacheControl: "0", contentType: "application/epub+zip" });
      if (uploadResult.error) throw uploadResult.error;
      const sessionResult = await supabase.auth.getSession();
      const accessToken = sessionResult.data.session?.access_token;
      if (!accessToken) throw new Error("Sign in again before processing this EPUB.");
      const response = await fetch("/api/library/author/ingest-epub", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: prepared.source_id }) });
      const result = (await response.json().catch(() => null)) as { error?: string; sectionCount?: number } | null;
      if (!response.ok) throw new Error(result?.error ?? "Unable to process this EPUB.");
      setMessage(`EPUB processed successfully${result?.sectionCount ? ` into ${result.sectionCount} readable sections` : ""}.`);
      setFile(null); await loadSource();
    } catch (uploadError) {
      const uploadMessage = uploadError instanceof Error ? uploadError.message : "Unable to upload this EPUB.";
      await loadSource(); setError(uploadMessage);
    } finally { setUploading(false); }
  }

  return (
    <>
      <LibraryAuthorCoverUpload publicationId={publicationId} editable={editable} published={published} />
      <section className="mt-6 border-t border-[var(--loombus-border)] pt-5" aria-labelledby="library-epub-heading">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p id="library-epub-heading" className="text-sm font-semibold">EPUB content</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-subtle)]">Originals stay private. Loombus reads only normalized sections after validation and processing.</p></div>{loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--loombus-gold)]" aria-label="Loading EPUB status" /> : null}</div>
        <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{statusCopy(source)}</p>{source ? <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{formatBytes(Number(source.byte_size))} · <span className="capitalize">{source.ingestion_status}</span></p> : null}</div>{source?.ingestion_status === "ready" ? <span className="rounded-full border border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] px-3 py-1.5 text-xs font-semibold">Ready for review</span> : null}</div>{source?.ingestion_error ? <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-muted)]">{source.ingestion_error}</p> : null}</div>
        <LibraryAuthorNormalizedPreview publicationId={publicationId} ready={source?.ingestion_status === "ready"} published={published} />
        {error ? <div role="alert" className="mt-3 rounded-xl border border-[var(--loombus-border)] p-3 text-xs text-[var(--loombus-text-muted)]">{error}</div> : null}
        {message ? <div role="status" className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] p-3 text-xs">{message}</div> : null}
        {!publicationId ? <p className="mt-4 text-xs leading-5 text-[var(--loombus-text-subtle)]">Save the publication draft before uploading its EPUB.</p> : published ? <p className="mt-4 text-xs leading-5 text-[var(--loombus-text-subtle)]">Published originals remain locked from author-side replacement.</p> : editable ? <div className="mt-4 flex flex-wrap items-end gap-3"><label className="grid min-w-[240px] flex-1 gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">Choose EPUB<input type="file" accept=".epub,application/epub+zip" disabled={uploading} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[var(--loombus-gold-surface)] file:px-3 file:py-1.5 file:font-semibold file:text-[var(--loombus-text)]" /></label><button type="button" disabled={!file || uploading} onClick={() => void uploadAndProcess()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : source ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}{source ? "Replace & process EPUB" : "Upload & process EPUB"}</button></div> : <p className="mt-4 text-xs leading-5 text-[var(--loombus-text-subtle)]">EPUB replacement is locked while this publication is under review.</p>}
      </section>
    </>
  );
}
